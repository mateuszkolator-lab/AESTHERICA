import asyncio
from fastapi import APIRouter, Depends, HTTPException, Header, Request
from fastapi.responses import RedirectResponse
from typing import Optional
import os
import json
from datetime import datetime, timezone, timedelta

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from google.auth.transport.requests import Request as GoogleRequest

from models.database import get_db
from routers.auth import verify_token

router = APIRouter(prefix="/calendar", tags=["Calendar"])

# Google OAuth2 Configuration
SCOPES = ['https://www.googleapis.com/auth/calendar']

def get_auth(authorization: str = Header(None)):
    return verify_token(authorization)

def get_google_client_config():
    """Get Google OAuth client configuration from environment"""
    client_id = os.environ.get('GOOGLE_CLIENT_ID')
    client_secret = os.environ.get('GOOGLE_CLIENT_SECRET')
    redirect_uri = os.environ.get('GOOGLE_REDIRECT_URI', 'http://localhost/api/calendar/callback')
    
    if not client_id or not client_secret:
        return None
    
    return {
        "web": {
            "client_id": client_id,
            "client_secret": client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [redirect_uri]
        }
    }

async def get_stored_credentials():
    """Get stored Google credentials from database"""
    db = get_db()
    settings = await db.settings.find_one({"key": "google_calendar"})
    if settings and settings.get("credentials"):
        return settings["credentials"]
    return None

async def save_credentials(credentials_dict):
    """Save Google credentials to database"""
    db = get_db()
    await db.settings.update_one(
        {"key": "google_calendar"},
        {"$set": {"credentials": credentials_dict, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )

async def get_calendar_service():
    """Get authenticated Google Calendar service"""
    creds_dict = await get_stored_credentials()
    if not creds_dict:
        return None
    
    expiry = None
    if creds_dict.get('expiry'):
        try:
            expiry = datetime.fromisoformat(creds_dict['expiry'].replace("Z", "+00:00"))
            if expiry.tzinfo:
                expiry = expiry.astimezone(timezone.utc).replace(tzinfo=None)
        except ValueError:
            expiry = None
    
    creds = Credentials(
        token=creds_dict.get('token'),
        refresh_token=creds_dict.get('refresh_token'),
        token_uri=creds_dict.get('token_uri'),
        client_id=creds_dict.get('client_id'),
        client_secret=creds_dict.get('client_secret'),
        scopes=creds_dict.get('scopes'),
        expiry=expiry
    )
    
    # Refresh token if expired or expiry unknown
    if creds.refresh_token and (creds.expired or expiry is None):
        try:
            creds.refresh(GoogleRequest())
            await save_credentials({
                'token': creds.token,
                'refresh_token': creds.refresh_token,
                'token_uri': creds.token_uri,
                'client_id': creds.client_id,
                'client_secret': creds.client_secret,
                'scopes': creds.scopes,
                'expiry': creds.expiry.isoformat() if creds.expiry else None
            })
        except Exception as e:
            error_str = str(e)
            print(f"Error refreshing token: {error_str}")
            await record_sync_error(f"Odświeżenie tokenu Google nie powiodło się: {error_str[:200]}")
            if 'invalid_grant' in error_str:
                db = get_db()
                await db.settings.delete_one({"key": "google_calendar"})
                raise HTTPException(
                    status_code=401,
                    detail="Sesja Google Calendar wygasła. Przejdź do Ustawień i ponownie połącz konto Google."
                )
            return None
    
    try:
        service = build('calendar', 'v3', credentials=creds)
        return service
    except Exception as e:
        print(f"Error building calendar service: {e}")
        return None


async def record_sync_error(message: str):
    db = get_db()
    await db.settings.update_one(
        {"key": "google_calendar_sync"},
        {"$set": {"last_error": message, "last_error_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )

async def record_sync_result(result: dict):
    db = get_db()
    await db.settings.update_one(
        {"key": "google_calendar_sync"},
        {"$set": {"last_sync": {**result, "at": datetime.now(timezone.utc).isoformat()}}, "$unset": {"last_error": "", "last_error_at": ""}},
        upsert=True
    )


async def upsert_patient_event(db, patient: dict, service=None) -> dict:
    """Create/update the Google event for a patient (single source of truth for push sync).
    Handles location changes (removes event from the previous calendar)."""
    surgery_date = patient.get("surgery_date")
    location_id = patient.get("location_id")
    if not surgery_date or not location_id or patient.get("status") == "cancelled":
        return {"ok": False, "reason": "no_date_or_location"}
    location = await db.locations.find_one({"id": location_id}, {"_id": 0})
    if not location or not location.get("google_calendar_id"):
        return {"ok": False, "reason": "no_calendar"}
    service = service or await get_calendar_service()
    if not service:
        return {"ok": False, "reason": "not_connected"}
    calendar_id = location["google_calendar_id"]
    body = build_calendar_event(patient, surgery_date, location.get("name", ""))
    body["extendedProperties"] = {"private": {"aesthetica_patient_id": patient["id"]}}
    
    existing_id = patient.get("google_event_id")
    existing_cal = patient.get("google_calendar_id")
    # Location changed → remove from previous calendar
    if existing_id and existing_cal and existing_cal != calendar_id:
        try:
            service.events().delete(calendarId=existing_cal, eventId=existing_id).execute()
        except Exception as e:
            print(f"Could not remove event from previous calendar: {e}")
        existing_id = None
    
    event = None
    if existing_id:
        try:
            event = service.events().update(calendarId=calendar_id, eventId=existing_id, body=body).execute()
        except Exception as e:
            print(f"Update failed ({e}), inserting new event")
    if event is None:
        event = service.events().insert(calendarId=calendar_id, body=body).execute()
    await db.patients.update_one({"id": patient["id"]}, {"$set": {
        "google_event_id": event["id"], "google_calendar_id": calendar_id,
        "google_synced_at": datetime.now(timezone.utc).isoformat()
    }})
    return {"ok": True, "event_id": event["id"]}


async def delete_patient_event(db, patient: dict, service=None) -> bool:
    """Remove patient's Google event (best-effort) and clear references."""
    event_id = patient.get("google_event_id")
    if not event_id:
        return False
    calendar_id = patient.get("google_calendar_id")
    if not calendar_id and patient.get("location_id"):
        location = await db.locations.find_one({"id": patient["location_id"]}, {"_id": 0})
        calendar_id = (location or {}).get("google_calendar_id")
    deleted = False
    if calendar_id:
        try:
            service = service or await get_calendar_service()
            if service:
                service.events().delete(calendarId=calendar_id, eventId=event_id).execute()
                deleted = True
        except Exception as e:
            print(f"Google Calendar event delete failed: {e}")
    await db.patients.update_one({"id": patient["id"]}, {"$unset": {"google_event_id": "", "google_calendar_id": "", "google_synced_at": ""}})
    return deleted


async def pull_from_google(db, service, user: dict = None) -> dict:
    """Two-way sync: apply date changes / deletions made directly in Google Calendar to patients."""
    from routers.audit import log_patient_change
    locations = await db.locations.find({"google_calendar_id": {"$nin": [None, ""]}}, {"_id": 0}).to_list(100)
    patients = await db.patients.find({"google_event_id": {"$nin": [None, ""]}}, {"_id": 0, "visits": 0, "photos": 0}).to_list(5000)
    by_event = {p["google_event_id"]: p for p in patients}
    moved, removed, errors = [], [], 0
    time_min = (datetime.now(timezone.utc) - timedelta(days=60)).isoformat()
    time_max = (datetime.now(timezone.utc) + timedelta(days=730)).isoformat()
    
    for loc in locations:
        cal_id = loc["google_calendar_id"]
        seen = set()
        try:
            page_token = None
            while True:
                resp = service.events().list(calendarId=cal_id, timeMin=time_min, timeMax=time_max, singleEvents=True,
                                             showDeleted=True, maxResults=2500, pageToken=page_token).execute()
                for ev in resp.get("items", []):
                    p = by_event.get(ev["id"])
                    if not p:
                        continue
                    seen.add(ev["id"])
                    if ev.get("status") == "cancelled":
                        # Deleted in Google → clear surgery date, patient back to waiting list
                        if p.get("surgery_date"):
                            await db.patients.update_one({"id": p["id"]}, {
                                "$set": {"surgery_date": None, "confirmed": False, "status": "awaiting" if p.get("status") == "planned" else p.get("status"),
                                         "updated_at": datetime.now(timezone.utc).isoformat()},
                                "$unset": {"google_event_id": "", "google_calendar_id": ""}})
                            await log_patient_change(patient_id=p["id"], action="update", user=user or {"user_id": None, "user_name": "Google Calendar"},
                                                     changes={"Data zabiegu": {"old": p.get("surgery_date"), "new": None}},
                                                     details="Wydarzenie usunięte w Google Calendar – termin zabiegu usunięty")
                            removed.append({"id": p["id"], "name": f"{p.get('last_name')} {p.get('first_name')}", "date": p.get("surgery_date")})
                        continue
                    new_date = (ev.get("start") or {}).get("date") or ((ev.get("start") or {}).get("dateTime") or "")[:10]
                    if new_date and new_date != p.get("surgery_date"):
                        await db.patients.update_one({"id": p["id"]}, {"$set": {"surgery_date": new_date, "status": "planned" if p.get("status") in ("awaiting", "consultation", "thinking", "planned") else p.get("status"),
                                                                              "updated_at": datetime.now(timezone.utc).isoformat()}})
                        await log_patient_change(patient_id=p["id"], action="update", user=user or {"user_id": None, "user_name": "Google Calendar"},
                                                 changes={"Data zabiegu": {"old": p.get("surgery_date"), "new": new_date}},
                                                 details="Termin zmieniony w Google Calendar")
                        moved.append({"id": p["id"], "name": f"{p.get('last_name')} {p.get('first_name')}", "old": p.get("surgery_date"), "new": new_date})
                        p["surgery_date"] = new_date
                page_token = resp.get("nextPageToken")
                if not page_token:
                    break
        except Exception as e:
            print(f"Pull from Google failed for calendar {cal_id}: {e}")
            await record_sync_error(f"Pobieranie z Google ({loc.get('name')}): {str(e)[:200]}")
            errors += 1
    return {"moved": moved, "removed": removed, "errors": errors}


def build_calendar_event(patient, surgery_date, location_name=""):
    """Build Google Calendar event body from patient data"""
    procedure = patient.get('procedure_type', 'Zabieg')
    confirmed = patient.get('confirmed', False)
    prefix = "P/ " if confirmed else ""
    return {
        'summary': f"{prefix}{patient['last_name']} {patient['first_name']} - {procedure}",
        'description': f"Pacjent: {patient['first_name']} {patient['last_name']}\nZabieg: {procedure}\nLokalizacja: {location_name}\nPotwierdzony: {'Tak' if confirmed else 'Nie'}\nNotatki: {patient.get('notes', '')}",
        'start': {'date': surgery_date},
        'end': {'date': surgery_date},
    }


@router.get("/health")
async def get_calendar_health(user: dict = Depends(get_auth)):
    """Cheap status for the dashboard alert – no Google API call, uses data recorded by scheduler/syncs."""
    db = get_db()
    creds = await db.settings.find_one({"key": "google_calendar"}, {"_id": 0, "key": 1})
    info = await db.settings.find_one({"key": "google_calendar_sync"}, {"_id": 0}) or {}
    return {
        "configured": get_google_client_config() is not None,
        "has_credentials": creds is not None,
        "health": info.get("health"),
        "last_error": info.get("last_error"),
        "last_error_at": info.get("last_error_at"),
        "last_sync": info.get("last_sync"),
        "last_pull_at": info.get("last_pull_at"),
    }


@router.get("/status")
async def get_calendar_status(user: dict = Depends(get_auth)):
    """Check if Google Calendar is connected (performs a real API call)."""
    db = get_db()
    creds = await get_stored_credentials()
    config = get_google_client_config()
    configured = config is not None
    sync_info = await db.settings.find_one({"key": "google_calendar_sync"}, {"_id": 0}) or {}
    base = {"configured": configured, "last_sync": sync_info.get("last_sync"), "last_error": sync_info.get("last_error"), "last_error_at": sync_info.get("last_error_at")}
    
    if not creds:
        return {"connected": False, **base}
    
    service = await get_calendar_service()
    if not service:
        return {"connected": False, "error": "Token wygasł lub jest nieprawidłowy", **base}
    try:
        service.calendarList().list(maxResults=1).execute()
    except Exception as e:
        await record_sync_error(f"Połączenie z Google nie działa: {str(e)[:200]}")
        await db.settings.update_one({"key": "google_calendar_sync"}, {"$set": {"health": {"ok": False, "at": datetime.now(timezone.utc).isoformat(), "error": str(e)[:200]}}}, upsert=True)
        return {"connected": False, "error": f"Google odrzuca połączenie: {str(e)[:160]}", **base}
    await db.settings.update_one({"key": "google_calendar_sync"}, {"$set": {"health": {"ok": True, "at": datetime.now(timezone.utc).isoformat()}}}, upsert=True)
    return {"connected": True, **base}


@router.get("/authorize")
async def authorize_calendar(user: dict = Depends(get_auth)):
    """Get Google OAuth authorization URL"""
    config = get_google_client_config()
    if not config:
        raise HTTPException(status_code=400, detail="Google Calendar not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.")
    
    redirect_uri = os.environ.get('GOOGLE_REDIRECT_URI', 'http://localhost/api/calendar/callback')
    
    flow = Flow.from_client_config(config, scopes=SCOPES, redirect_uri=redirect_uri)
    
    authorization_url, state = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true',
        prompt='consent'
    )
    
    # Store state and code_verifier in database for callback
    db = get_db()
    await db.settings.update_one(
        {"key": "google_oauth_state"},
        {"$set": {
            "state": state, 
            "code_verifier": flow.code_verifier,
            "created_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    return {"authorization_url": authorization_url}


@router.get("/callback")
async def calendar_callback(code: str = None, state: str = None, error: str = None):
    """Handle Google OAuth callback"""
    app_url = os.environ.get('APP_URL', 'http://localhost:3000')
    
    if error:
        return RedirectResponse(url=f"{app_url}/settings?calendar_error={error}")
    
    if not code:
        return RedirectResponse(url=f"{app_url}/settings?calendar_error=no_code")
    
    config = get_google_client_config()
    if not config:
        return RedirectResponse(url=f"{app_url}/settings?calendar_error=not_configured")
    
    redirect_uri = os.environ.get('GOOGLE_REDIRECT_URI', 'http://localhost/api/calendar/callback')
    
    # Retrieve stored code_verifier
    db = get_db()
    oauth_state = await db.settings.find_one({"key": "google_oauth_state"})
    code_verifier = oauth_state.get("code_verifier") if oauth_state else None
    
    try:
        flow = Flow.from_client_config(config, scopes=SCOPES, redirect_uri=redirect_uri)
        
        # Set code_verifier if we have it
        if code_verifier:
            flow.code_verifier = code_verifier
        
        flow.fetch_token(code=code)
        
        creds = flow.credentials
        
        # Save credentials
        await save_credentials({
            'token': creds.token,
            'refresh_token': creds.refresh_token,
            'token_uri': creds.token_uri,
            'client_id': creds.client_id,
            'client_secret': creds.client_secret,
            'scopes': list(creds.scopes) if creds.scopes else SCOPES,
            'expiry': creds.expiry.isoformat() if creds.expiry else None
        })
        
        # Clean up oauth state
        await db.settings.delete_one({"key": "google_oauth_state"})
        
        return RedirectResponse(url=f"{app_url}/settings?calendar_connected=true")
        
    except Exception as e:
        print(f"OAuth callback error: {e}")
        return RedirectResponse(url=f"{app_url}/settings?calendar_error=auth_failed")


@router.post("/disconnect")
async def disconnect_calendar(user: dict = Depends(get_auth)):
    """Disconnect Google Calendar"""
    db = get_db()
    await db.settings.delete_one({"key": "google_calendar"})
    await db.settings.delete_one({"key": "google_oauth_state"})
    
    # Clear calendar IDs from locations
    await db.locations.update_many({}, {"$unset": {"google_calendar_id": ""}})
    
    return {"message": "Google Calendar disconnected"}


@router.get("/calendars")
async def list_calendars(user: dict = Depends(get_auth)):
    """List available Google Calendars"""
    service = await get_calendar_service()
    if not service:
        raise HTTPException(status_code=400, detail="Google Calendar not connected")
    
    try:
        calendar_list = service.calendarList().list().execute()
        calendars = []
        for calendar in calendar_list.get('items', []):
            calendars.append({
                "id": calendar['id'],
                "name": calendar.get('summary', 'Unnamed'),
                "primary": calendar.get('primary', False),
                "backgroundColor": calendar.get('backgroundColor')
            })
        return calendars
    except Exception as e:
        print(f"Error listing calendars: {e}")
        raise HTTPException(status_code=500, detail=f"Error listing calendars: {str(e)}")


@router.post("/locations/{location_id}/calendar")
async def set_location_calendar(location_id: str, calendar_id: str, user: dict = Depends(get_auth)):
    """Set Google Calendar for a location"""
    db = get_db()
    
    # Verify location exists
    location = await db.locations.find_one({"id": location_id})
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    
    # Verify calendar exists
    service = await get_calendar_service()
    if not service:
        raise HTTPException(status_code=400, detail="Google Calendar not connected")
    
    try:
        service.calendars().get(calendarId=calendar_id).execute()
    except Exception:
        raise HTTPException(status_code=400, detail="Calendar not found or not accessible")
    
    # Update location with calendar ID
    await db.locations.update_one(
        {"id": location_id},
        {"$set": {"google_calendar_id": calendar_id}}
    )
    
    return {"message": "Calendar assigned to location"}


@router.delete("/locations/{location_id}/calendar")
async def remove_location_calendar(location_id: str, user: dict = Depends(get_auth)):
    """Remove Google Calendar from a location"""
    db = get_db()
    
    result = await db.locations.update_one(
        {"id": location_id},
        {"$unset": {"google_calendar_id": ""}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Location not found")
    
    return {"message": "Calendar removed from location"}


@router.post("/sync/{patient_id}")
async def sync_patient_to_calendar(patient_id: str, user: dict = Depends(get_auth)):
    """Sync patient surgery to Google Calendar"""
    db = get_db()
    patient = await db.patients.find_one({"id": patient_id}, {"_id": 0})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    if not patient.get('surgery_date'):
        raise HTTPException(status_code=400, detail="Patient has no surgery date")
    try:
        result = await upsert_patient_event(db, patient)
    except Exception as e:
        await record_sync_error(f"Synchronizacja pacjenta {patient.get('last_name')}: {str(e)[:200]}")
        raise HTTPException(status_code=500, detail=f"Error syncing to calendar: {str(e)}")
    if not result.get("ok"):
        msgs = {"no_calendar": "Brak kalendarza Google dla lokalizacji pacjenta", "not_connected": "Google Calendar nie jest połączony",
                "no_date_or_location": "Pacjent nie ma daty zabiegu lub lokalizacji"}
        raise HTTPException(status_code=400, detail=msgs.get(result.get("reason"), "Nie udało się zsynchronizować"))
    return {"message": "Synced to Google Calendar", "event_id": result["event_id"]}


@router.delete("/sync/{patient_id}")
async def remove_patient_from_calendar(patient_id: str, user: dict = Depends(get_auth)):
    """Remove patient surgery from Google Calendar"""
    db = get_db()
    patient = await db.patients.find_one({"id": patient_id}, {"_id": 0})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    if not patient.get('google_event_id'):
        return {"message": "No calendar event to remove"}
    await delete_patient_event(db, patient)
    return {"message": "Removed from Google Calendar"}


@router.post("/pull")
async def pull_changes_from_google(user: dict = Depends(get_auth)):
    """Apply changes made in Google Calendar (moved / deleted events) to patients."""
    db = get_db()
    service = await get_calendar_service()
    if not service:
        raise HTTPException(status_code=400, detail="Google Calendar nie jest połączony")
    return await pull_from_google(db, service, user)


@router.post("/sync-all")
async def sync_all_to_calendar(user: dict = Depends(get_auth)):
    """Two-way sync: first pull changes from Google, then push all patients with surgery_date."""
    db = get_db()
    service = await get_calendar_service()
    if not service:
        raise HTTPException(status_code=400, detail="Google Calendar nie jest połączony")
    
    locations = await db.locations.find({"google_calendar_id": {"$nin": [None, ""]}}, {"_id": 0}).to_list(100)
    if not locations:
        raise HTTPException(status_code=400, detail="Brak lokalizacji z przypisanym kalendarzem Google")
    loc_ids = [loc["id"] for loc in locations]
    
    pulled = await pull_from_google(db, service, user)
    
    patients = await db.patients.find(
        {"surgery_date": {"$nin": [None, ""]}, "location_id": {"$in": loc_ids}, "status": {"$ne": "cancelled"}},
        {"_id": 0, "visits": 0, "photos": 0}
    ).to_list(5000)
    
    synced = 0
    errors = 0
    error_messages = []
    for patient in patients:
        try:
            res = await upsert_patient_event(db, patient, service)
            if res.get("ok"):
                synced += 1
        except Exception as e:
            errors += 1
            if len(error_messages) < 5:
                error_messages.append(f"{patient.get('last_name')} {patient.get('first_name')}: {str(e)[:120]}")
            print(f"Sync error for patient {patient.get('id')}: {e}")
    
    # Remove orphan events for patients whose date was cleared but event still referenced
    orphans = await db.patients.find({"google_event_id": {"$nin": [None, ""]}, "$or": [{"surgery_date": None}, {"surgery_date": ""}, {"status": "cancelled"}]}, {"_id": 0}).to_list(1000)
    for p in orphans:
        await delete_patient_event(db, p, service)
    
    result = {"synced": synced, "errors": errors, "total": len(patients), "pulled_moved": len(pulled["moved"]),
              "pulled_removed": len(pulled["removed"]), "orphans_removed": len(orphans), "error_messages": error_messages,
              "moved": pulled["moved"], "removed": pulled["removed"]}
    await record_sync_result({k: v for k, v in result.items() if k not in ("moved", "removed", "error_messages")})
    if errors and not synced:
        await record_sync_error(error_messages[0] if error_messages else "Synchronizacja nie powiodła się")
    return result


async def calendar_pull_scheduler(interval_seconds: int = 900):
    """Background two-way sync + health check: periodically apply changes made in Google Calendar."""
    delay = 15
    while True:
        await asyncio.sleep(delay)
        delay = interval_seconds
        db = get_db()
        if not await db.settings.find_one({"key": "google_calendar"}):
            continue
        now = datetime.now(timezone.utc).isoformat()
        try:
            service = await get_calendar_service()
            if not service:
                raise RuntimeError("Nie udało się uzyskać dostępu do Google Calendar (token)")
            service.calendarList().list(maxResults=1).execute()
            res = await pull_from_google(db, service)
            if res["moved"] or res["removed"]:
                print(f"[gcal] Auto-pull: moved={len(res['moved'])} removed={len(res['removed'])}")
            await db.settings.update_one({"key": "google_calendar_sync"}, {
                "$set": {"last_pull_at": now, "health": {"ok": res["errors"] == 0, "at": now}},
                **({"$unset": {"last_error": "", "last_error_at": ""}} if res["errors"] == 0 else {})
            }, upsert=True)
        except Exception as e:
            msg = str(e)
            print(f"[gcal] Auto-pull failed: {msg}")
            await db.settings.update_one({"key": "google_calendar_sync"}, {
                "$set": {"health": {"ok": False, "at": now, "error": msg[:200]}, "last_error": f"Automatyczna synchronizacja: {msg[:200]}", "last_error_at": now}
            }, upsert=True)
