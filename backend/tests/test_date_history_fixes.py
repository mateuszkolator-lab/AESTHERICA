# Retest of iteration_13 fixes: ''->None date normalisation, location-scoped /audit/date, location names in audit
import os
import re
import json
import uuid
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
KEEP = os.environ.get("KEEP_DATA") == "1"
IDS_FILE = "/app/memory/tmp/hist_fix_ids.json"
PRO = "05d9b792-07f3-43f4-ace2-89d4ec9cc57d"  # Pro-Familia (jan has it)
MED = "589030c5-d58e-4ef7-a262-cd2b672bb4c8"  # Medicus (jan does not)
D1, D2, D3 = "2027-05-05", "2027-05-07", "2027-05-09"
UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-")
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


def _mk(admin, loc, name):
    body = {"first_name": f"TEST_{name}{uuid.uuid4().hex[:4]}", "last_name": "TEST_Fix", "status": "awaiting",
            "procedure_type": "Rhinoplastyka"}
    if loc:
        body["location_id"] = loc
    r = admin.post(f"{BASE_URL}/api/patients", json=body)
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


@pytest.fixture(scope="module", autouse=True)
def cleanup(admin):
    yield
    if KEEP:
        os.makedirs(os.path.dirname(IDS_FILE), exist_ok=True)
        json.dump(S, open(IDS_FILE, "w"))
        return
    pids = [S[k] for k in ("pid", "pid2", "pid3") if S.get(k)]
    for p in pids:
        admin.delete(f"{BASE_URL}/api/patients/{p}")
    if S.get("slot"):
        admin.delete(f"{BASE_URL}/api/surgery-slots/{S['slot']}")
    from dotenv import load_dotenv
    from pymongo import MongoClient
    load_dotenv("/app/backend/.env")
    db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    db.audit_log.delete_many({"patient_id": {"$in": pids}})


def _log(admin, pid):
    r = admin.get(f"{BASE_URL}/api/audit/patient/{pid}")
    assert r.status_code == 200, r.text
    return r.json()


def _hist(c, date, pid):
    r = c.get(f"{BASE_URL}/api/audit/date/{date}")
    assert r.status_code == 200, r.text
    return [e for e in r.json() if e["patient_id"] == pid]


# (a) '' dates produce no audit noise
def test_empty_dates_no_audit(admin):
    S["pid"] = _mk(admin, MED, "Empty")
    r = admin.put(f"{BASE_URL}/api/patients/{S['pid']}", json={"surgery_date": "", "documents_sent_date": ""})
    assert r.status_code == 200, r.text
    log = _log(admin, S["pid"])
    assert len(log) == 1, log
    assert log[0]["action"] in ("create", "created"), log
    feed = admin.get(f"{BASE_URL}/api/audit/date-changes/recent?days=1").json()
    assert not [e for e in feed if e["patient_id"] == S["pid"]]


def test_assign_then_move(admin):
    pid = S["pid"]
    assert admin.put(f"{BASE_URL}/api/patients/{pid}", json={"surgery_date": D1}).status_code == 200
    h1 = _hist(admin, D1, pid)
    assert [e["kind"] for e in h1] == ["assigned"], h1
    assert admin.put(f"{BASE_URL}/api/patients/{pid}", json={"surgery_date": D2}).status_code == 200
    h1 = _hist(admin, D1, pid)
    h2 = _hist(admin, D2, pid)
    assert any(e["kind"] == "moved" and e.get("old_date") == D1 and e.get("new_date") == D2 for e in h1), h1
    assert any(e["kind"] == "moved" for e in h2), h2


# (b) location scoping
def test_date_history_scoped(admin, jan):
    assert _hist(admin, D1, S["pid"])
    assert _hist(jan, D1, S["pid"]) == []
    assert _hist(jan, D2, S["pid"]) == []


def test_date_history_visible_to_jan_for_his_location(admin, jan):
    S["pid3"] = _mk(admin, PRO, "Own")
    assert admin.put(f"{BASE_URL}/api/patients/{S['pid3']}", json={"surgery_date": D1}).status_code == 200
    assert _hist(jan, D1, S["pid3"]), "jan should see his own location's patient"


# (c) location names in audit
def test_put_location_change_stores_names(admin):
    S["pid2"] = _mk(admin, PRO, "Loc")
    assert admin.put(f"{BASE_URL}/api/patients/{S['pid2']}", json={"location_id": MED}).status_code == 200
    ch = [e["changes"]["Lokalizacja"] for e in _log(admin, S["pid2"]) if "Lokalizacja" in (e.get("changes") or {})]
    assert ch, "no Lokalizacja change"
    assert ch[0]["old"].strip() == "Pro-Familia" and ch[0]["new"].strip() == "Medicus", ch


def test_slot_assign_location_names(admin):
    r = admin.post(f"{BASE_URL}/api/surgery-slots", json={"date": D3, "location_id": PRO})
    assert r.status_code == 200, r.text
    S["slot"] = r.json()["id"]
    # pid2 is now in Medicus; slot is Pro-Familia
    r = admin.post(f"{BASE_URL}/api/surgery-slots/{S['slot']}/assign/{S['pid2']}")
    assert r.status_code == 200, r.text
    entries = [e for e in _log(admin, S["pid2"]) if "Data zabiegu" in (e.get("changes") or {})]
    assert entries
    loc = entries[0]["changes"].get("Lokalizacja")
    assert loc, entries[0]
    assert not UUID_RE.match(str(loc["old"])) and not UUID_RE.match(str(loc["new"])), loc
    assert loc["old"].strip() == "Medicus" and loc["new"].strip() == "Pro-Familia", loc
