"""Tests for two-way Google Calendar sync (routers/calendar.py).

Google Calendar is NOT connected in this preview environment, so we mock
the Google service object via monkeypatching ``routers.calendar.get_calendar_service``.
"""
import os
import sys
import uuid
import asyncio
from datetime import datetime, timezone, timedelta
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv

# Make sure backend code is importable and env vars are loaded
BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))
load_dotenv(BACKEND_DIR / ".env")

import httpx  # noqa: E402

import server  # noqa: E402  (loads routers + lifespan)
from models.database import get_db  # noqa: E402
import routers.calendar as cal  # noqa: E402

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# ---------------------------------------------------------------------------
# Fake Google Calendar service
# ---------------------------------------------------------------------------
class FakeExec:
    def __init__(self, value):
        self._value = value
    def execute(self):
        return self._value() if callable(self._value) else self._value


class FakeEvents:
    def __init__(self, parent):
        self.p = parent

    def insert(self, calendarId, body):
        def _do():
            eid = f"ev_{uuid.uuid4().hex[:12]}"
            self.p.calls.append(("insert", calendarId, body))
            self.p.by_cal.setdefault(calendarId, {})[eid] = {"id": eid, "status": "confirmed", **body}
            return {"id": eid, **body}
        return FakeExec(_do)

    def update(self, calendarId, eventId, body):
        def _do():
            self.p.calls.append(("update", calendarId, eventId, body))
            self.p.by_cal.setdefault(calendarId, {})[eventId] = {"id": eventId, "status": "confirmed", **body}
            return {"id": eventId, **body}
        return FakeExec(_do)

    def delete(self, calendarId, eventId):
        def _do():
            self.p.calls.append(("delete", calendarId, eventId))
            self.p.by_cal.get(calendarId, {}).pop(eventId, None)
            return {}
        return FakeExec(_do)

    def list(self, **kwargs):
        def _do():
            self.p.calls.append(("list", kwargs.get("calendarId"), kwargs.get("pageToken")))
            cal_id = kwargs["calendarId"]
            scripted = self.p.list_scripts.get(cal_id)
            if scripted:
                page_idx = self.p.list_page_idx.get(cal_id, 0)
                if page_idx < len(scripted):
                    resp = scripted[page_idx]
                    self.p.list_page_idx[cal_id] = page_idx + 1
                    return resp
            # Default: return no items
            return {"items": [], "nextPageToken": None}
        return FakeExec(_do)


class FakeCalendarList:
    def __init__(self, parent):
        self.p = parent
    def list(self, **kwargs):
        def _do():
            self.p.calls.append(("calendarList.list", kwargs))
            if self.p.calendar_list_raises:
                raise RuntimeError(self.p.calendar_list_raises)
            return {"items": [{"id": "primary", "summary": "Primary"}]}
        return FakeExec(_do)


class FakeService:
    def __init__(self):
        self.calls = []
        self.by_cal = {}
        self.list_scripts = {}      # calendarId -> list[response dicts]
        self.list_page_idx = {}
        self.calendar_list_raises = None
    def events(self):
        return FakeEvents(self)
    def calendarList(self):
        return FakeCalendarList(self)
    # helpers
    def script_list(self, calendar_id, responses):
        self.list_scripts[calendar_id] = responses
        self.list_page_idx[calendar_id] = 0
    def count(self, kind):
        return sum(1 for c in self.calls if c[0] == kind)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def fake_service():
    return FakeService()


@pytest.fixture
def admin_token():
    """Login via live BASE_URL to grab a JWT (same DB)."""
    if not BASE_URL:
        pytest.skip("REACT_APP_BACKEND_URL not set")
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": "mateusz.kolator@gmail.com", "password": "Matikolati123!"},
                      timeout=15)
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text}")
    return r.json()["token"]


@pytest.fixture
def client(event_loop):
    """Async httpx client bound to the SAME event loop as motor."""
    transport = httpx.ASGITransport(app=server.app)
    ac = httpx.AsyncClient(transport=transport, base_url="http://testserver")

    class _Wrap:
        def __init__(self, ac): self.ac = ac
        def _call(self, method, url, **kw):
            return event_loop.run_until_complete(self.ac.request(method, url, **kw))
        def get(self, url, **kw): return self._call("GET", url, **kw)
        def post(self, url, **kw): return self._call("POST", url, **kw)
        def put(self, url, **kw): return self._call("PUT", url, **kw)
        def delete(self, url, **kw): return self._call("DELETE", url, **kw)

    yield _Wrap(ac)
    event_loop.run_until_complete(ac.aclose())


@pytest.fixture
def db():
    return get_db()


@pytest.fixture
def seed(event_loop, db):
    """Create two TEST_ locations with calendar IDs and one TEST_ patient."""
    created_ids = {"locations": [], "patients": [], "slots": []}

    async def _setup():
        loc_a = {"id": f"TEST_LOC_A_{uuid.uuid4().hex[:6]}", "name": "TEST_LocA",
                 "address": "A", "google_calendar_id": "calA",
                 "created_at": datetime.now(timezone.utc).isoformat()}
        loc_b = {"id": f"TEST_LOC_B_{uuid.uuid4().hex[:6]}", "name": "TEST_LocB",
                 "address": "B", "google_calendar_id": "calB",
                 "created_at": datetime.now(timezone.utc).isoformat()}
        await db.locations.insert_one(dict(loc_a))
        await db.locations.insert_one(dict(loc_b))
        created_ids["locations"] += [loc_a["id"], loc_b["id"]]

        future = (datetime.now(timezone.utc) + timedelta(days=30)).strftime("%Y-%m-%d")
        patient = {
            "id": f"TEST_P_{uuid.uuid4().hex[:8]}",
            "first_name": "Jan", "last_name": "TEST_Kowalski",
            "procedure_type": "Rhinoplastyka",
            "status": "planned", "confirmed": False,
            "surgery_date": future, "location_id": loc_a["id"],
            "visits": [], "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.patients.insert_one(dict(patient))
        created_ids["patients"].append(patient["id"])
        return loc_a, loc_b, patient, future

    loc_a, loc_b, patient, future = event_loop.run_until_complete(_setup())
    yield {"loc_a": loc_a, "loc_b": loc_b, "patient": patient, "future_date": future, "created": created_ids}

    async def _cleanup():
        if created_ids["patients"]:
            await db.patients.delete_many({"id": {"$in": created_ids["patients"]}})
        if created_ids["locations"]:
            await db.locations.delete_many({"id": {"$in": created_ids["locations"]}})
        if created_ids["slots"]:
            await db.surgery_slots.delete_many({"id": {"$in": created_ids["slots"]}})
    event_loop.run_until_complete(_cleanup())


# ---------------------------------------------------------------------------
# Helper function tests (upsert_patient_event / delete_patient_event)
# ---------------------------------------------------------------------------
class TestUpsertHelper:
    def test_insert_then_update_then_relocate(self, event_loop, db, seed, fake_service):
        p = dict(seed["patient"])

        async def _run():
            # 1) First call → insert on calA
            r1 = await cal.upsert_patient_event(db, p, service=fake_service)
            assert r1["ok"] is True
            insert_calls = [c for c in fake_service.calls if c[0] == "insert"]
            assert len(insert_calls) == 1
            cal_id, body = insert_calls[0][1], insert_calls[0][2]
            assert cal_id == "calA"
            # Summary format: "<Last> <First> - <procedure>", no prefix (not confirmed)
            assert body["summary"] == f"TEST_Kowalski Jan - Rhinoplastyka"
            assert body["extendedProperties"]["private"]["aesthetica_patient_id"] == p["id"]
            # Patient doc should now have google_event_id + google_calendar_id
            fresh = await db.patients.find_one({"id": p["id"]}, {"_id": 0})
            assert fresh["google_event_id"] == r1["event_id"]
            assert fresh["google_calendar_id"] == "calA"

            # 2) Second call → update (not insert)
            r2 = await cal.upsert_patient_event(db, fresh, service=fake_service)
            assert r2["ok"] is True
            assert fake_service.count("insert") == 1
            assert fake_service.count("update") == 1

            # 2b) confirmed=True → summary with "P/ " prefix
            fresh2 = {**fresh, "confirmed": True}
            await db.patients.update_one({"id": p["id"]}, {"$set": {"confirmed": True}})
            await cal.upsert_patient_event(db, fresh2, service=fake_service)
            upd = [c for c in fake_service.calls if c[0] == "update"][-1]
            assert upd[3]["summary"].startswith("P/ ")

            # 3) Location change A → B: delete on calA + insert on calB
            fresh3 = await db.patients.find_one({"id": p["id"]}, {"_id": 0})
            fresh3["location_id"] = seed["loc_b"]["id"]
            old_event_id = fresh3["google_event_id"]
            await cal.upsert_patient_event(db, fresh3, service=fake_service)
            delete_calls = [c for c in fake_service.calls if c[0] == "delete"]
            assert any(c[1] == "calA" and c[2] == old_event_id for c in delete_calls)
            # New insert on calB
            inserts_on_b = [c for c in fake_service.calls if c[0] == "insert" and c[1] == "calB"]
            assert len(inserts_on_b) == 1
            fresh_after = await db.patients.find_one({"id": p["id"]}, {"_id": 0})
            assert fresh_after["google_calendar_id"] == "calB"

            # 4) Cancelled patient → no API call, reason no_date_or_location
            cancelled = {**fresh_after, "status": "cancelled"}
            before = len(fake_service.calls)
            r4 = await cal.upsert_patient_event(db, cancelled, service=fake_service)
            assert r4 == {"ok": False, "reason": "no_date_or_location"}
            assert len(fake_service.calls) == before

            # 5) No surgery date → no_date_or_location
            no_date = {**fresh_after, "surgery_date": None}
            r5 = await cal.upsert_patient_event(db, no_date, service=fake_service)
            assert r5["ok"] is False and r5["reason"] == "no_date_or_location"

        event_loop.run_until_complete(_run())


# ---------------------------------------------------------------------------
# pull_from_google
# ---------------------------------------------------------------------------
class TestPullFromGoogle:
    def test_date_change_then_cancellation_and_pagination(self, event_loop, db, seed, fake_service):
        async def _run():
            # Seed: give patient a known google_event_id on calA
            event_id = "ev_pull_test_1"
            await db.patients.update_one(
                {"id": seed["patient"]["id"]},
                {"$set": {"google_event_id": event_id, "google_calendar_id": "calA",
                          "status": "planned"}}
            )
            new_date = (datetime.now(timezone.utc) + timedelta(days=45)).strftime("%Y-%m-%d")

            # Script: calA returns the event with a NEW date, paginated (nextPageToken then empty)
            fake_service.script_list("calA", [
                {"items": [
                    {"id": event_id, "status": "confirmed", "start": {"date": new_date}},
                    {"id": "unknown_event_ignore_me", "status": "confirmed", "start": {"date": new_date}},
                ], "nextPageToken": "tok1"},
                {"items": [], "nextPageToken": None},
            ])
            # calB has no events but will still be listed (empty)
            fake_service.script_list("calB", [{"items": [], "nextPageToken": None}])

            res = await cal.pull_from_google(db, fake_service, user={"user_id": "test", "user_name": "T"})
            assert res["errors"] == 0
            assert len(res["moved"]) == 1
            assert res["moved"][0]["new"] == new_date
            fresh = await db.patients.find_one({"id": seed["patient"]["id"]}, {"_id": 0})
            assert fresh["surgery_date"] == new_date
            # Audit log present mentioning Google Calendar
            log = await db.audit_log.find_one({"patient_id": seed["patient"]["id"],
                                               "details": {"$regex": "Google Calendar"}})
            assert log is not None, "audit_log entry mentioning Google Calendar not found"

            # Pagination: list should have been called twice for calA (two pages)
            calA_list_calls = [c for c in fake_service.calls if c[0] == "list" and c[1] == "calA"]
            assert len(calA_list_calls) == 2

            # Round 2: event cancelled → surgery_date cleared, status planned→awaiting
            fake_service.list_scripts.clear(); fake_service.list_page_idx.clear(); fake_service.calls.clear()
            fake_service.script_list("calA", [
                {"items": [{"id": event_id, "status": "cancelled"}], "nextPageToken": None},
            ])
            fake_service.script_list("calB", [{"items": [], "nextPageToken": None}])
            res2 = await cal.pull_from_google(db, fake_service, user=None)
            assert len(res2["removed"]) == 1
            fresh2 = await db.patients.find_one({"id": seed["patient"]["id"]}, {"_id": 0})
            assert fresh2.get("surgery_date") is None
            assert fresh2["status"] == "awaiting"
            assert fresh2.get("google_event_id") is None

        event_loop.run_until_complete(_run())


# ---------------------------------------------------------------------------
# HTTP endpoints: sync-all, pull, status (with monkeypatched get_calendar_service)
# ---------------------------------------------------------------------------
class TestHttpEndpoints:
    def test_sync_all_with_mock(self, event_loop, db, seed, client, admin_token, fake_service, monkeypatch):
        # Script calA/calB with no events for pull phase
        fake_service.script_list("calA", [{"items": [], "nextPageToken": None}])
        fake_service.script_list("calB", [{"items": [], "nextPageToken": None}])

        async def fake_get():
            return fake_service
        monkeypatch.setattr(cal, "get_calendar_service", fake_get)

        headers = {"Authorization": f"Bearer {admin_token}"}
        r = client.post("/api/calendar/sync-all", headers=headers)
        assert r.status_code == 200, r.text
        data = r.json()
        for key in ("synced", "total", "errors", "pulled_moved", "pulled_removed",
                    "orphans_removed", "moved", "removed", "error_messages"):
            assert key in data, f"missing key {key}"

        # last_sync persisted
        async def _check():
            doc = await db.settings.find_one({"key": "google_calendar_sync"})
            assert doc is not None and doc.get("last_sync", {}).get("at")
        event_loop.run_until_complete(_check())

        # Our TEST_ patient should have been pushed (insert on calA)
        assert fake_service.count("insert") >= 1

    def test_status_connected_and_error(self, client, admin_token, fake_service, monkeypatch, event_loop, db):
        async def fake_get():
            return fake_service
        monkeypatch.setattr(cal, "get_calendar_service", fake_get)
        headers = {"Authorization": f"Bearer {admin_token}"}

        # Pre-seed credentials so get_calendar_status thinks we're linked
        async def _seed_creds():
            await db.settings.update_one(
                {"key": "google_calendar"},
                {"$set": {"credentials": {"token": "x", "refresh_token": "y",
                                          "token_uri": "https://oauth2.googleapis.com/token",
                                          "client_id": "cid", "client_secret": "cs", "scopes": ["s"],
                                          "expiry": None}}}, upsert=True)
        event_loop.run_until_complete(_seed_creds())
        try:
            r = client.get("/api/calendar/status", headers=headers)
            assert r.status_code == 200, r.text
            d = r.json()
            assert d["connected"] is True
            assert "last_sync" in d

            # Now make calendarList.list raise → connected False, last_error stored
            fake_service.calendar_list_raises = "boom"
            r2 = client.get("/api/calendar/status", headers=headers)
            d2 = r2.json()
            assert d2["connected"] is False
            assert "error" in d2 and d2["error"]
            async def _check_err():
                doc = await db.settings.find_one({"key": "google_calendar_sync"})
                assert doc and doc.get("last_error")
            event_loop.run_until_complete(_check_err())
        finally:
            # Clean up seeded creds and the artificial error
            event_loop.run_until_complete(db.settings.delete_one({"key": "google_calendar"}))
            event_loop.run_until_complete(db.settings.update_one(
                {"key": "google_calendar_sync"}, {"$unset": {"last_error": "", "last_error_at": "", "health": ""}}))

    def test_pull_endpoint_with_mock(self, client, admin_token, fake_service, monkeypatch):
        async def fake_get():
            return fake_service
        monkeypatch.setattr(cal, "get_calendar_service", fake_get)
        fake_service.script_list("calA", [{"items": [], "nextPageToken": None}])
        fake_service.script_list("calB", [{"items": [], "nextPageToken": None}])
        r = client.post("/api/calendar/pull", headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "moved" in data and "removed" in data

    def test_no_mock_not_connected(self, admin_token):
        """Against real preview backend (no mock) Google is NOT connected."""
        if not BASE_URL:
            pytest.skip("no BASE_URL")
        headers = {"Authorization": f"Bearer {admin_token}"}
        r = requests.post(f"{BASE_URL}/api/calendar/sync-all", headers=headers, timeout=15)
        assert r.status_code == 400
        assert "Google Calendar" in r.text or "nie jest" in r.text

        r2 = requests.get(f"{BASE_URL}/api/calendar/status", headers=headers, timeout=15)
        assert r2.status_code == 200
        assert r2.json().get("connected") is False


# ---------------------------------------------------------------------------
# Helper integration via PUT /api/patients and surgery-slot assign/unassign
# ---------------------------------------------------------------------------
class TestPatientSlotIntegration:
    def test_patient_update_triggers_upsert_and_delete(
        self, event_loop, db, seed, client, admin_token, fake_service, monkeypatch
    ):
        async def fake_get():
            return fake_service
        monkeypatch.setattr(cal, "get_calendar_service", fake_get)
        headers = {"Authorization": f"Bearer {admin_token}"}

        pid = seed["patient"]["id"]
        new_date = (datetime.now(timezone.utc) + timedelta(days=60)).strftime("%Y-%m-%d")

        # 1) PUT surgery_date → upsert (insert first time)
        r = client.put(f"/api/patients/{pid}", headers=headers, json={"surgery_date": new_date})
        assert r.status_code == 200, r.text
        assert fake_service.count("insert") + fake_service.count("update") >= 1

        # 2) PUT surgery_date=null → delete called
        before_del = fake_service.count("delete")
        r2 = client.put(f"/api/patients/{pid}", headers=headers, json={"surgery_date": None})
        assert r2.status_code == 200, r2.text
        assert fake_service.count("delete") > before_del

        # 3) Re-set date, then cancel → delete called again
        client.put(f"/api/patients/{pid}", headers=headers, json={"surgery_date": new_date})
        before_del2 = fake_service.count("delete")
        r3 = client.put(f"/api/patients/{pid}", headers=headers, json={"status": "cancelled"})
        assert r3.status_code == 200, r3.text
        assert fake_service.count("delete") > before_del2

    def test_slot_assign_unassign(self, event_loop, db, seed, client, admin_token, fake_service, monkeypatch):
        async def fake_get():
            return fake_service
        monkeypatch.setattr(cal, "get_calendar_service", fake_get)
        headers = {"Authorization": f"Bearer {admin_token}"}

        slot_date = (datetime.now(timezone.utc) + timedelta(days=90)).strftime("%Y-%m-%d")
        r = client.post("/api/surgery-slots", headers=headers,
                        json={"date": slot_date, "location_id": seed["loc_a"]["id"]})
        assert r.status_code == 200, r.text
        slot_id = r.json()["id"]
        seed["created"]["slots"].append(slot_id)

        # Prepare patient: ensure no event, awaiting status, no date
        pid = seed["patient"]["id"]
        async def _reset():
            await db.patients.update_one({"id": pid}, {
                "$set": {"status": "awaiting", "surgery_date": None, "location_id": seed["loc_a"]["id"]},
                "$unset": {"google_event_id": "", "google_calendar_id": ""}})
        event_loop.run_until_complete(_reset())

        before_i = fake_service.count("insert") + fake_service.count("update")
        r = client.post(f"/api/surgery-slots/{slot_id}/assign/{pid}", headers=headers)
        assert r.status_code == 200, r.text
        assert (fake_service.count("insert") + fake_service.count("update")) > before_i

        before_d = fake_service.count("delete")
        r = client.post(f"/api/surgery-slots/{slot_id}/unassign", headers=headers)
        assert r.status_code == 200, r.text
        assert fake_service.count("delete") > before_d


# ---------------------------------------------------------------------------
# Regression: patient CRUD still works without any Google connection
# ---------------------------------------------------------------------------
class TestRegression:
    def test_patient_create_update_delete_no_gcal(self, admin_token):
        if not BASE_URL:
            pytest.skip("no BASE_URL")
        h = {"Authorization": f"Bearer {admin_token}"}
        payload = {"first_name": "TEST_Reg", "last_name": f"NoGcal_{uuid.uuid4().hex[:6]}",
                   "status": "consultation", "procedure_type": "Rhinoplastyka"}
        r = requests.post(f"{BASE_URL}/api/patients", headers=h, json=payload, timeout=15)
        assert r.status_code == 200, r.text
        pid = r.json()["id"]
        try:
            r2 = requests.get(f"{BASE_URL}/api/patients/{pid}", headers=h, timeout=15)
            assert r2.status_code == 200
            r3 = requests.put(f"{BASE_URL}/api/patients/{pid}", headers=h,
                              json={"notes": "updated"}, timeout=15)
            assert r3.status_code == 200
        finally:
            requests.delete(f"{BASE_URL}/api/patients/{pid}", headers=h, timeout=15)
