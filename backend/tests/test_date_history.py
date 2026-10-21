# Surgery-date history audit (assign/unassign/move/cancel) + new patient date fields + recent feed
import os
import json
import uuid
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
KEEP = os.environ.get("KEEP_DATA") == "1"
IDS_FILE = "/app/memory/tmp/hist_test_ids.json"
D1, D2 = "2027-04-10", "2027-04-12"
JAN_LOC = "05d9b792-07f3-43f4-ace2-89d4ec9cc57d"
S = {}


def _login(email, pw):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200, r.text
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
    return s


@pytest.fixture(scope="module")
def admin():
    return _login("mateusz.kolator@gmail.com", "Matikolati123!")


@pytest.fixture(scope="module")
def jan():
    return _login("jan.kowalski@klinika.pl", "haslo123")


@pytest.fixture(scope="module", autouse=True)
def cleanup(admin):
    yield
    if KEEP:
        os.makedirs(os.path.dirname(IDS_FILE), exist_ok=True)
        json.dump(S, open(IDS_FILE, "w"))
        return
    for k in ("pid", "pid2", "pid3"):
        if S.get(k):
            admin.delete(f"{BASE_URL}/api/patients/{S[k]}")
    for k in ("s1", "s2"):
        if S.get(k):
            admin.delete(f"{BASE_URL}/api/surgery-slots/{S[k]}")
    # remove audit rows of test patients so they don't pollute the dashboard feed
    try:
        from dotenv import load_dotenv
        from pymongo import MongoClient
        load_dotenv("/app/backend/.env")
        db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
        db.audit_log.delete_many({"patient_id": {"$in": [S[k] for k in ("pid", "pid2", "pid3") if S.get(k)]}})
    except Exception as e:
        print("audit cleanup failed", e)


def _hist(c, date, pid):
    r = c.get(f"{BASE_URL}/api/audit/date/{date}")
    assert r.status_code == 200, r.text
    return [e for e in r.json() if e["patient_id"] == pid]


def _slot(admin, date):
    r = admin.post(f"{BASE_URL}/api/surgery-slots", json={"date": date, "location_id": JAN_LOC})
    if r.status_code == 400:
        slots = admin.get(f"{BASE_URL}/api/surgery-slots?include_past=true").json()
        sl = next(s for s in slots if s["date"] == date)
        if sl.get("assigned_patient_id"):
            pytest.skip(f"slot {date} already occupied")
        return sl["id"], False
    assert r.status_code == 200, r.text
    return r.json()["id"], True


# --- Patient date fields ---
def test_create_patient_with_dates(admin):
    u = uuid.uuid4().hex[:6]
    r = admin.post(f"{BASE_URL}/api/patients", json={
        "first_name": f"TEST_Hist{u}", "last_name": "TEST_Termin", "status": "awaiting",
        "procedure_type": "Rhinoplastyka", "location_id": JAN_LOC,
        "documents_sent_date": "2026-01-05", "hospital_registration_date": "2026-01-07"})
    assert r.status_code in (200, 201), r.text
    S["pid"] = r.json()["id"]
    p = admin.get(f"{BASE_URL}/api/patients/{S['pid']}").json()
    assert p["documents_sent_date"] == "2026-01-05"
    assert p["hospital_registration_date"] == "2026-01-07"


def test_update_and_clear_date_audited(admin):
    pid = S["pid"]
    r = admin.put(f"{BASE_URL}/api/patients/{pid}", json={"documents_sent_date": None, "hospital_registration_date": "2026-01-09"})
    assert r.status_code == 200, r.text
    p = admin.get(f"{BASE_URL}/api/patients/{pid}").json()
    assert p.get("documents_sent_date") is None
    assert p["hospital_registration_date"] == "2026-01-09"
    log = admin.get(f"{BASE_URL}/api/audit/patient/{pid}").json()
    keys = set()
    for e in log:
        keys |= set((e.get("changes") or {}).keys())
    assert "Data wysłania dokumentów" in keys and "Data zgłoszenia do szpitala" in keys


# --- Slot assign / unassign / move / cancel history ---
def test_assign_logs_assigned(admin):
    S["s1"], c1 = _slot(admin, D1)
    S["s2"], c2 = _slot(admin, D2)
    if not c1: S["s1_keep"] = True
    if not c2: S["s2_keep"] = True
    r = admin.post(f"{BASE_URL}/api/surgery-slots/{S['s1']}/assign/{S['pid']}")
    assert r.status_code == 200, r.text
    h = _hist(admin, D1, S["pid"])
    a = [e for e in h if e["kind"] == "assigned"]
    assert a, h
    assert a[0]["user_name"].strip() == "Mateusz Kolator"
    assert "TEST_Termin" in a[0]["patient_name"]
    assert a[0]["new_date"] == D1


def test_unassign_logs_removed(admin):
    r = admin.post(f"{BASE_URL}/api/surgery-slots/{S['s1']}/unassign")
    assert r.status_code == 200
    h = _hist(admin, D1, S["pid"])
    rem = [e for e in h if e["kind"] == "removed"]
    assert rem and rem[0]["old_date"] == D1 and rem[0]["new_date"] is None
    p = admin.get(f"{BASE_URL}/api/patients/{S['pid']}").json()
    assert p.get("surgery_date") is None and p["status"] == "awaiting"


def test_move_logged_under_both_dates(admin):
    pid = S["pid"]
    assert admin.put(f"{BASE_URL}/api/patients/{pid}", json={"surgery_date": D1}).status_code == 200
    assert admin.put(f"{BASE_URL}/api/patients/{pid}", json={"surgery_date": D2}).status_code == 200
    m1 = [e for e in _hist(admin, D1, pid) if e["kind"] == "moved"]
    m2 = [e for e in _hist(admin, D2, pid) if e["kind"] == "moved"]
    assert m1 and m2 and m1[0]["id"] == m2[0]["id"]
    assert m1[0]["old_date"] == D1 and m1[0]["new_date"] == D2
    # move back for cancel test
    assert admin.put(f"{BASE_URL}/api/patients/{pid}", json={"surgery_date": D1}).status_code == 200


def test_cancel_logged_with_reason(admin):
    pid = S["pid"]
    r = admin.put(f"{BASE_URL}/api/patients/{pid}", json={"status": "cancelled", "cancellation_reason": "Cena"})
    assert r.status_code == 200, r.text
    c = [e for e in _hist(admin, D1, pid) if e["kind"] == "cancelled"]
    assert c, _hist(admin, D1, pid)
    assert c[0]["cancellation_reason"] == "Cena"
    assert c[0]["old_date"] == D1


def test_recent_feed_contains_kinds(admin):
    r = admin.get(f"{BASE_URL}/api/audit/date-changes/recent?days=1&limit=200")
    assert r.status_code == 200
    kinds = {e["kind"] for e in r.json() if e["patient_id"] == S["pid"]}
    assert {"assigned", "removed", "moved", "cancelled"} <= kinds, kinds
    for e in r.json():
        for f in ("id", "patient_id", "patient_name", "kind", "user_name", "timestamp"):
            assert f in e


def test_recent_feed_non_global_user(jan, admin):
    r = jan.get(f"{BASE_URL}/api/audit/date-changes/recent?days=14")
    assert r.status_code == 200, r.text
    data = r.json()
    assert any(e["patient_id"] == S["pid"] for e in data)
    for e in data:
        p = admin.get(f"{BASE_URL}/api/patients/{e['patient_id']}")
        if p.status_code == 200:
            assert p.json().get("location_id") == JAN_LOC, e


def test_unauth_401():
    assert requests.get(f"{BASE_URL}/api/audit/date/{D1}").status_code in (401, 403)
    assert requests.get(f"{BASE_URL}/api/audit/date-changes/recent").status_code in (401, 403)


# --- Edge: noise / leakage ---
def test_empty_string_surgery_date_no_noise(admin):
    r = admin.post(f"{BASE_URL}/api/patients", json={"first_name": "TEST_Noise", "last_name": "TEST_Termin", "status": "awaiting"})
    S["pid2"] = r.json()["id"]
    admin.put(f"{BASE_URL}/api/patients/{S['pid2']}", json={"surgery_date": "", "notes": "x"})
    feed = admin.get(f"{BASE_URL}/api/audit/date-changes/recent?days=1&limit=200").json()
    noise = [e for e in feed if e["patient_id"] == S["pid2"]]
    assert not noise, f"Spurious date-change entry for null->'' : {noise}"


def test_date_history_location_scoping(admin, jan):
    r = admin.post(f"{BASE_URL}/api/patients", json={"first_name": "TEST_OtherLoc", "last_name": "TEST_Termin", "status": "awaiting"})
    S["pid3"] = r.json()["id"]
    admin.put(f"{BASE_URL}/api/patients/{S['pid3']}", json={"surgery_date": D2})
    leaked = _hist(jan, D2, S["pid3"])
    assert not leaked, "Non-global user sees date history of patient outside his locations"
