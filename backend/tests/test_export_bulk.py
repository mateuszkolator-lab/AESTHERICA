"""Backend tests for bulk survey export (POST /api/surveys/export-bulk) and patient status sync helpers."""
import os
import io
import pytest
import requests
import openpyxl

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/") or "https://clinic-scheduler-pro-1.preview.emergentagent.com"
ADMIN = {"email": "mateusz.kolator@gmail.com", "password": "Matikolati123!"}


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["access_token"] if "access_token" in r.json() else r.json().get("token")


@pytest.fixture(scope="module")
def h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def test_export_bulk_all_templates_no_filters(h):
    r = requests.post(f"{BASE_URL}/api/surveys/export-bulk", json={"template_ids": [], "statuses": ["planned"]}, headers=h, timeout=60)
    assert r.status_code == 200, r.text
    assert "spreadsheetml" in r.headers.get("content-type", "")
    cd = r.headers.get("content-disposition", "")
    assert "attachment" in cd and ".xlsx" in cd
    wb = openpyxl.load_workbook(io.BytesIO(r.content))
    names = wb.sheetnames
    assert "Podsumowanie" in names
    # Preset codes expected present
    for expected in ["NOSE", "SCHNOS"]:
        assert expected in names, f"Missing sheet {expected}, got {names}"
    ws = wb["Podsumowanie"]
    head = [ws.cell(row=1, column=c).value for c in range(1, 7)]
    assert head == ["Nazwisko", "Imię", "Status", "Placówka", "Zabieg", "Data zabiegu"]


def test_export_bulk_single_patient(h):
    # Find 'Ankieta Anna'
    r = requests.get(f"{BASE_URL}/api/patients", headers=h, timeout=20)
    assert r.status_code == 200
    anna = next((p for p in r.json() if p.get("first_name") == "Anna" and p.get("last_name", "").startswith("Ankieta")), None)
    assert anna, "Seed patient 'Ankieta Anna' not found"
    r = requests.post(f"{BASE_URL}/api/surveys/export-bulk", json={"template_ids": [], "patient_ids": [anna["id"]]}, headers=h, timeout=60)
    assert r.status_code == 200
    wb = openpyxl.load_workbook(io.BytesIO(r.content))
    ws = wb["Podsumowanie"]
    # exactly 1 data row
    row_count = sum(1 for row in ws.iter_rows(min_row=2, values_only=True) if any(v is not None for v in row))
    assert row_count == 1, f"Expected 1 row, got {row_count}"
    # last name matches
    assert ws.cell(row=2, column=1).value == anna["last_name"]


def test_status_sync_between_list_and_detail(h):
    # Create test patient
    payload = {"first_name": "TESTStatusSync", "last_name": "TESTPatient", "phone": "+48555000111", "status": "consultation"}
    r = requests.post(f"{BASE_URL}/api/patients", json=payload, headers=h, timeout=20)
    assert r.status_code in (200, 201), r.text
    pid = r.json()["id"]
    try:
        # Change to 'thinking'
        r = requests.put(f"{BASE_URL}/api/patients/{pid}", json={"status": "thinking"}, headers=h, timeout=20)
        assert r.status_code == 200
        # GET detail should reflect
        r = requests.get(f"{BASE_URL}/api/patients/{pid}", headers=h, timeout=20)
        assert r.status_code == 200
        assert r.json()["status"] == "thinking"
        # Change to 'awaiting'
        r = requests.put(f"{BASE_URL}/api/patients/{pid}", json={"status": "awaiting"}, headers=h, timeout=20)
        assert r.status_code == 200
        # List should include with new status
        r = requests.get(f"{BASE_URL}/api/patients", headers=h, timeout=20)
        row = next((p for p in r.json() if p["id"] == pid), None)
        assert row and row["status"] == "awaiting"
    finally:
        requests.delete(f"{BASE_URL}/api/patients/{pid}", headers=h, timeout=20)
