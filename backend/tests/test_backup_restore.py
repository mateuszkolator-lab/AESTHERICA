"""Tests for backup admin endpoints and patient restore flow."""
import os
import io
import zipfile
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback: read frontend .env
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL"):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
    except Exception:
        pass

ADMIN_EMAIL = "mateusz.kolator@gmail.com"
ADMIN_PASSWORD = "Matikolati123!"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"] if "access_token" in r.json() else r.json().get("token")


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def non_admin_headers(admin_headers):
    """Try existing non-admin, else create one."""
    # try login
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "jan.kowalski@klinika.pl", "password": "haslo123"})
    if r.status_code == 200:
        j = r.json()
        tok = j.get("access_token") or j.get("token")
        yield {"Authorization": f"Bearer {tok}"}
        return
    # create temporary user
    payload = {"email": "test_nonadmin@klinika.pl", "password": "TempPass123!", "first_name": "Temp", "last_name": "User", "role": "doctor"}
    c = requests.post(f"{BASE_URL}/api/users/", json=payload, headers=admin_headers)
    assert c.status_code in (200, 201), c.text
    uid = c.json().get("id")
    r2 = requests.post(f"{BASE_URL}/api/auth/login", json={"email": payload["email"], "password": payload["password"]})
    assert r2.status_code == 200, r2.text
    tok = r2.json().get("access_token") or r2.json().get("token")
    yield {"Authorization": f"Bearer {tok}"}
    # cleanup
    if uid:
        requests.delete(f"{BASE_URL}/api/users/{uid}", headers=admin_headers)


# ---------- BACKUP ----------

class TestBackup:
    def test_status_admin(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/backup/status", headers=admin_headers)
        assert r.status_code == 200
        d = r.json()
        assert d["auto_enabled"] is True
        assert "backups" in d and isinstance(d["backups"], list)

    def test_status_forbidden_for_non_admin(self, non_admin_headers):
        r = requests.get(f"{BASE_URL}/api/backup/status", headers=non_admin_headers)
        assert r.status_code == 403

    def test_run_creates_zip(self, admin_headers):
        r = requests.post(f"{BASE_URL}/api/backup/run", headers=admin_headers)
        assert r.status_code == 200
        info = r.json()
        assert info["name"].startswith("aestheticamd_") and info["name"].endswith(".zip")
        assert info["size"] > 0
        # verify listed
        s = requests.get(f"{BASE_URL}/api/backup/status", headers=admin_headers).json()
        names = [b["name"] for b in s["backups"]]
        assert info["name"] in names
        # download via files endpoint and verify zip validity
        d = requests.get(f"{BASE_URL}/api/backup/files/{info['name']}", headers=admin_headers)
        assert d.status_code == 200
        zf = zipfile.ZipFile(io.BytesIO(d.content))
        assert "meta.json" in zf.namelist()
        # delete
        de = requests.delete(f"{BASE_URL}/api/backup/files/{info['name']}", headers=admin_headers)
        assert de.status_code == 200

    def test_download_fresh_zip(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/backup/download", headers=admin_headers)
        assert r.status_code == 200
        cd = r.headers.get("content-disposition", "")
        assert "attachment" in cd.lower() or "filename" in cd.lower()
        zf = zipfile.ZipFile(io.BytesIO(r.content))
        assert "meta.json" in zf.namelist()

    def test_path_traversal_blocked(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/backup/files/..%2Fetc", headers=admin_headers)
        assert r.status_code == 404
        r2 = requests.get(f"{BASE_URL}/api/backup/files/evil.zip", headers=admin_headers)
        assert r2.status_code == 404


# ---------- RESTORE ----------

class TestRestore:
    def _create_and_cancel(self, admin_headers, suffix):
        payload = {
            "first_name": "TESTRestore",
            "last_name": suffix,
            "phone": "+48111222333",
            "surgery_type": "Rinoplastyka",
            "surgeon": "Pro-Familia",
            "status": "planned",
            "surgery_date": "2026-08-01",
        }
        r = requests.post(f"{BASE_URL}/api/patients", json=payload, headers=admin_headers)
        assert r.status_code in (200, 201), r.text
        pid = r.json()["id"]
        # cancel
        u = requests.put(f"{BASE_URL}/api/patients/{pid}", json={"status": "cancelled", "cancellation_reason": "Cena"}, headers=admin_headers)
        assert u.status_code == 200, u.text
        return pid

    def test_restore_flow(self, admin_headers):
        pid = self._create_and_cancel(admin_headers, "flow")
        try:
            r = requests.post(f"{BASE_URL}/api/patients/{pid}/restore", headers=admin_headers)
            assert r.status_code == 200, r.text
            g = requests.get(f"{BASE_URL}/api/patients/{pid}", headers=admin_headers).json()
            assert g["status"] == "awaiting"
            assert not g.get("cancellation_reason")
            assert len(g.get("cancellation_history") or []) == 1
            entry = g["cancellation_history"][0]
            assert entry.get("reason") == "Cena"
            # second restore should 400
            r2 = requests.post(f"{BASE_URL}/api/patients/{pid}/restore", headers=admin_headers)
            assert r2.status_code == 400
        finally:
            requests.delete(f"{BASE_URL}/api/patients/{pid}", headers=admin_headers)
