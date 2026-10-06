"""Tests for GET /api/calendar/health used by the CalendarSyncAlert UI component."""
import os
import pytest
import requests
from datetime import datetime, timezone
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://clinic-scheduler-pro-1.preview.emergentagent.com").rstrip("/")
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "test_database"

ADMIN_EMAIL = "mateusz.kolator@gmail.com"
ADMIN_PASSWORD = "Matikolati123!"


@pytest.fixture(scope="module")
def mongo():
    c = MongoClient(MONGO_URL)
    yield c[DB_NAME]
    # final cleanup
    c[DB_NAME].settings.delete_one({"key": "google_calendar"})
    c[DB_NAME].settings.delete_one({"key": "google_calendar_sync"})
    c.close()


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture
def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def _clean(mongo):
    mongo.settings.delete_one({"key": "google_calendar"})
    mongo.settings.delete_one({"key": "google_calendar_sync"})


def test_health_requires_auth():
    r = requests.get(f"{BASE_URL}/api/calendar/health", timeout=10)
    assert r.status_code in (401, 403)


def test_health_default_no_creds(mongo, auth_headers):
    _clean(mongo)
    r = requests.get(f"{BASE_URL}/api/calendar/health", headers=auth_headers, timeout=10)
    assert r.status_code == 200
    d = r.json()
    assert d["configured"] is True  # GOOGLE_CLIENT_ID is set in env
    assert d["has_credentials"] is False
    assert d["health"] is None
    assert d["last_error"] is None
    assert d["last_error_at"] is None


def test_health_broken_state(mongo, auth_headers):
    _clean(mongo)
    now = datetime.now(timezone.utc).isoformat()
    mongo.settings.update_one(
        {"key": "google_calendar"},
        {"$set": {"key": "google_calendar", "token": "x", "refresh_token": "y"}},
        upsert=True,
    )
    mongo.settings.update_one(
        {"key": "google_calendar_sync"},
        {"$set": {
            "key": "google_calendar_sync",
            "health": {"ok": False, "at": now, "error": "invalid_grant: Token has been expired or revoked."},
            "last_error": "Automatyczna synchronizacja: invalid_grant",
            "last_error_at": now,
        }},
        upsert=True,
    )
    r = requests.get(f"{BASE_URL}/api/calendar/health", headers=auth_headers, timeout=10)
    assert r.status_code == 200
    d = r.json()
    assert d["has_credentials"] is True
    assert d["health"]["ok"] is False
    assert "invalid_grant" in d["health"]["error"]
    assert d["last_error"] and "invalid_grant" in d["last_error"]


def test_health_credentials_dropped(mongo, auth_headers):
    _clean(mongo)
    now = datetime.now(timezone.utc).isoformat()
    mongo.settings.update_one(
        {"key": "google_calendar_sync"},
        {"$set": {
            "key": "google_calendar_sync",
            "health": {"ok": False, "at": now, "error": "invalid_grant"},
            "last_error": "invalid_grant",
            "last_error_at": now,
        }},
        upsert=True,
    )
    r = requests.get(f"{BASE_URL}/api/calendar/health", headers=auth_headers, timeout=10)
    assert r.status_code == 200
    d = r.json()
    assert d["has_credentials"] is False
    assert d["last_error"] == "invalid_grant"


def test_health_healthy_state(mongo, auth_headers):
    _clean(mongo)
    now = datetime.now(timezone.utc).isoformat()
    mongo.settings.update_one(
        {"key": "google_calendar"},
        {"$set": {"key": "google_calendar", "token": "x", "refresh_token": "y"}},
        upsert=True,
    )
    mongo.settings.update_one(
        {"key": "google_calendar_sync"},
        {"$set": {"key": "google_calendar_sync", "health": {"ok": True, "at": now}},
         "$unset": {"last_error": "", "last_error_at": ""}},
        upsert=True,
    )
    r = requests.get(f"{BASE_URL}/api/calendar/health", headers=auth_headers, timeout=10)
    d = r.json()
    assert d["has_credentials"] is True
    assert d["health"]["ok"] is True
    assert d.get("last_error") is None


def test_cleanup_at_end(mongo):
    _clean(mongo)
    assert mongo.settings.find_one({"key": "google_calendar"}) is None
    assert mongo.settings.find_one({"key": "google_calendar_sync"}) is None
