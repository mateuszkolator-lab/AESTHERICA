"""Tests for new PROMs features:
- /api/surveys/due endpoint (window, overdue, RBAC)
- Timepoint offset_days migration (NOSE/ROE/SCHNOS: pre=0, 3m=90, 12m=365)
"""
import os
import pytest
import requests
from datetime import datetime, timedelta, timezone

def _load_backend_url():
    url = os.environ.get("REACT_APP_BACKEND_URL", "").strip()
    if not url:
        try:
            with open("/app/frontend/.env") as f:
                for line in f:
                    if line.startswith("REACT_APP_BACKEND_URL="):
                        url = line.split("=", 1)[1].strip()
                        break
        except Exception:
            pass
    return url.rstrip("/")

BASE_URL = _load_backend_url()
ADMIN = {"email": "mateusz.kolator@gmail.com", "password": "Matikolati123!"}
USER = {"email": "jan.kowalski@klinika.pl", "password": "haslo123"}


def _login(creds):
    r = requests.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_hdr():
    return {"Authorization": f"Bearer {_login(ADMIN)}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def user_hdr():
    tok = _login(USER)
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ---------- Timepoint offset migration ----------
class TestOffsetMigration:
    def test_nose_offsets(self, admin_hdr):
        r = requests.get(f"{BASE_URL}/api/surveys/templates", headers=admin_hdr, timeout=20)
        assert r.status_code == 200
        tpls = r.json()
        nose = next((t for t in tpls if t.get("code") == "NOSE"), None)
        assert nose, "NOSE template missing"
        offsets = {tp["key"]: tp.get("offset_days") for tp in nose["timepoints"]}
        # Expect pre=0, 3m=90, 12m=365 for migrated preset
        assert offsets.get("pre") == 0, f"NOSE pre offset not 0: {offsets}"
        # Keys may use 3m/12m or similar
        vals = set(offsets.values())
        assert 90 in vals, f"NOSE missing 90-day offset: {offsets}"
        assert 365 in vals, f"NOSE missing 365-day offset: {offsets}"

    def test_all_timepoints_have_offset(self, admin_hdr):
        r = requests.get(f"{BASE_URL}/api/surveys/templates", headers=admin_hdr, timeout=20)
        for t in r.json():
            for tp in t.get("timepoints", []):
                assert tp.get("offset_days") is not None, f"{t.get('code')} tp {tp.get('key')} missing offset_days"


# ---------- /api/surveys/due ----------
class TestSurveysDue:
    def test_due_returns_due_test_overdue(self, admin_hdr):
        r = requests.get(f"{BASE_URL}/api/surveys/due", headers=admin_hdr, timeout=20)
        assert r.status_code == 200, r.text
        items = r.json()
        assert isinstance(items, list)
        # Due Test must be present with NOSE 3m overdue around 10 days
        due_test = [i for i in items if i.get("first_name") == "Due" and i.get("last_name") == "Test"]
        assert due_test, f"Due Test not in /due: {[i.get('last_name') for i in items]}"
        row = due_test[0]
        assert row["template_code"] == "NOSE"
        assert "3 mies" in (row.get("timepoint_label") or "").lower() or "3m" in row.get("timepoint_label", "").lower()
        # overdue window: today - (surgery+90). surgery=today-100 → overdue=10
        assert row["days_overdue"] >= 9, f"days_overdue should be ~10, got {row['days_overdue']}"
        assert "token" in row and row["token"]

    def test_due_excludes_pre_and_12m_for_due_test(self, admin_hdr):
        r = requests.get(f"{BASE_URL}/api/surveys/due", headers=admin_hdr, timeout=20)
        items = [i for i in r.json() if i.get("first_name") == "Due" and i.get("last_name") == "Test"]
        # Only the 3m row for Due Test (pre-op expired post-surgery, 12m window not yet)
        assert len(items) == 1, f"Expected only 3m for Due Test, got: {items}"

    def test_due_fields_shape(self, admin_hdr):
        r = requests.get(f"{BASE_URL}/api/surveys/due", headers=admin_hdr, timeout=20)
        items = r.json()
        if items:
            keys = {"assignment_id", "token", "patient_id", "first_name", "last_name",
                    "surgery_date", "template_code", "timepoint_label", "due_date", "days_overdue"}
            assert keys.issubset(set(items[0].keys())), f"Missing keys: {keys - set(items[0].keys())}"


# ---------- Planned patient 5 days before surgery → pre-op in due list ----------
class TestPlannedPatientPreOp:
    """Create patient with surgery_date=today+5, assign NOSE pre → should appear with days_overdue=-5."""

    @pytest.fixture(scope="class")
    def planned_patient(self, admin_hdr):
        today = datetime.now(timezone.utc).date()
        payload = {
            "first_name": "TEST_Planned5",
            "last_name": "TEST_PreOp",
            "phone": "+48600600600",
            "status": "planned",
            "procedure_type": "Rhinoplastyka",
            "surgery_date": (today + timedelta(days=5)).isoformat(),
        }
        r = requests.post(f"{BASE_URL}/api/patients", headers=admin_hdr, json=payload, timeout=20)
        assert r.status_code in (200, 201), r.text
        pid = r.json()["id"]
        yield pid
        # cleanup
        requests.delete(f"{BASE_URL}/api/patients/{pid}", headers=admin_hdr, timeout=20)

    @pytest.fixture(scope="class")
    def planned_far(self, admin_hdr):
        today = datetime.now(timezone.utc).date()
        payload = {
            "first_name": "TEST_Planned60",
            "last_name": "TEST_Far",
            "phone": "+48600600601",
            "status": "planned",
            "procedure_type": "Rhinoplastyka",
            "surgery_date": (today + timedelta(days=60)).isoformat(),
        }
        r = requests.post(f"{BASE_URL}/api/patients", headers=admin_hdr, json=payload, timeout=20)
        assert r.status_code in (200, 201), r.text
        pid = r.json()["id"]
        yield pid
        requests.delete(f"{BASE_URL}/api/patients/{pid}", headers=admin_hdr, timeout=20)

    def _assign_nose(self, admin_hdr, pid):
        # Find NOSE template id
        tpls = requests.get(f"{BASE_URL}/api/surveys/templates", headers=admin_hdr, timeout=20).json()
        nose = next(t for t in tpls if t.get("code") == "NOSE")
        r = requests.post(f"{BASE_URL}/api/surveys/patients/{pid}/sync",
                          headers=admin_hdr, json={"template_ids": [nose["id"]]}, timeout=20)
        return r, nose

    def test_planned_patient_preop_in_due(self, admin_hdr, planned_patient):
        r, nose = self._assign_nose(admin_hdr, planned_patient)
        assert r.status_code in (200, 201), f"assign failed: {r.status_code} {r.text}"
        items = requests.get(f"{BASE_URL}/api/surveys/due", headers=admin_hdr, timeout=20).json()
        mine = [i for i in items if i["patient_id"] == planned_patient]
        assert mine, f"planned patient not in due list: {items}"
        pre = [i for i in mine if i.get("template_code") == "NOSE" and "przed" in (i.get("timepoint_label", "").lower())]
        assert pre, f"No pre-op row for planned patient: {mine}"
        assert pre[0]["days_overdue"] == -5, f"Expected -5, got {pre[0]['days_overdue']}"
        # No post-op rows for planned (surgery not happened; 3m/12m windows far)
        post = [i for i in mine if "mies" in (i.get("timepoint_label", "").lower()) or "rok" in (i.get("timepoint_label", "").lower())]
        assert not post, f"Unexpected post-op rows: {post}"

    def test_planned_far_patient_not_in_due(self, admin_hdr, planned_far):
        r, _ = self._assign_nose(admin_hdr, planned_far)
        assert r.status_code in (200, 201)
        items = requests.get(f"{BASE_URL}/api/surveys/due", headers=admin_hdr, timeout=20).json()
        mine = [i for i in items if i["patient_id"] == planned_far]
        assert not mine, f"Patient with surgery today+60 should NOT be in /due: {mine}"


# ---------- RBAC: non-global user only sees patients from his location ----------
class TestDueRbac:
    def test_user_sees_only_own_location(self, admin_hdr, user_hdr):
        admin_items = requests.get(f"{BASE_URL}/api/surveys/due", headers=admin_hdr, timeout=20).json()
        user_items = requests.get(f"{BASE_URL}/api/surveys/due", headers=user_hdr, timeout=20).json()
        # user set must be a subset of admin set (by assignment_id)
        a_ids = {i["assignment_id"] for i in admin_items}
        u_ids = {i["assignment_id"] for i in user_items}
        assert u_ids.issubset(a_ids), f"user sees ids not in admin set: {u_ids - a_ids}"
        # If user has at least 1 location restriction, we expect strict subset or equal
        # Check that all user items share the user's location_id
        if user_items:
            # get user profile to find allowed locations
            me = requests.get(f"{BASE_URL}/api/auth/me", headers=user_hdr, timeout=20).json()
            allowed = set(me.get("location_ids") or [])
            if allowed:
                for it in user_items:
                    assert it.get("location_id") in allowed, f"User sees out-of-location row: {it}"
