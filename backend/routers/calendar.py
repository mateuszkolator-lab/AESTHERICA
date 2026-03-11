from fastapi import APIRouter, Depends, HTTPException, Header, Request
from fastapi.responses import RedirectResponse
from typing import Optional
import os
import json
from datetime import datetime, timezone

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
    
    creds = Credentials(
        token=creds_dict.get('token'),
        refresh_token=creds_dict.get('refresh_token'),
        token_uri=creds_dict.get('token_uri'),
        client_id=creds_dict.get('client_id'),
        client_secret=creds_dict.get('client_secret'),
        scopes=creds_dict.get('scopes')
    )
    
    # Refresh token if expired
    if creds.expired and creds.refresh_token:
        try:
            creds.refresh(GoogleRequest())
            # Save refreshed credentials
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
            print(f"Error refreshing token: {e}")
            return None
    
    try:
        service = build('calendar', 'v3', credentials=creds)
        return service
    except Exception as e:
        print(f"Error building calendar service: {e}")
        return None


@router.get("/status")
async def get_calendar_status(user: dict = Depends(get_auth)):
    """Check if Google Calendar is connected"""
    creds = await get_stored_credentials()
    
    config = get_google_client_config()
    configured = config is not None
    
    if not creds:
        return {"connected": False, "configured": configured}
    
    # Try to get calendar service to verify connection
    service = await get_calendar_service()
    if service:
        return {"connected": True, "configured": configured}
    
    return {"connected": False, "configured": configured, "error": "Token expired or invalid"}


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
    
    patient = await db.patients.find_one({"id": patient_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    if not patient.get('surgery_date'):
        raise HTTPException(status_code=400, detail="Patient has no surgery date")
    
    # Get location's calendar
    location_id = patient.get('location_id')
    calendar_id = None
    location_name = ""
    
    if location_id:
        location = await db.locations.find_one({"id": location_id})
        if location:
            calendar_id = location.get('google_calendar_id')
            location_name = location.get('name', '')
    
    if not calendar_id:
        raise HTTPException(status_code=400, detail="No calendar configured for patient's location")
    
    service = await get_calendar_service()
    if not service:
        raise HTTPException(status_code=400, detail="Google Calendar not connected")
    
    # Create event
    procedure = patient.get('procedure_type', 'Zabieg')
    event = {
        'summary': f"{patient['first_name']} {patient['last_name']} - {procedure}",
        'description': f"Pacjent: {patient['first_name']} {patient['last_name']}\nZabieg: {procedure}\nLokalizacja: {location_name}\nNotatki: {patient.get('notes', '')}",
        'start': {
            'date': patient['surgery_date'],
        },
        'end': {
            'date': patient['surgery_date'],
        },
    }
    
    try:
        # Check if event already exists
        existing_event_id = patient.get('google_event_id')
        
        if existing_event_id:
            # Update existing event
            try:
                event = service.events().update(
                    calendarId=calendar_id,
                    eventId=existing_event_id,
                    body=event
                ).execute()
            except Exception:
                # Event might have been deleted, create new one
                event = service.events().insert(calendarId=calendar_id, body=event).execute()
        else:
            # Create new event
            event = service.events().insert(calendarId=calendar_id, body=event).execute()
        
        # Save event ID to patient
        await db.patients.update_one(
            {"id": patient_id},
            {"$set": {"google_event_id": event['id']}}
        )
        
        return {"message": "Synced to Google Calendar", "event_id": event['id']}
        
    except Exception as e:
        print(f"Error syncing to calendar: {e}")
        raise HTTPException(status_code=500, detail=f"Error syncing to calendar: {str(e)}")


@router.delete("/sync/{patient_id}")
async def remove_patient_from_calendar(patient_id: str, user: dict = Depends(get_auth)):
    """Remove patient surgery from Google Calendar"""
    db = get_db()
    
    patient = await db.patients.find_one({"id": patient_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    event_id = patient.get('google_event_id')
    if not event_id:
        return {"message": "No calendar event to remove"}
    
    # Get location's calendar
    location_id = patient.get('location_id')
    if location_id:
        location = await db.locations.find_one({"id": location_id})
        if location and location.get('google_calendar_id'):
            service = await get_calendar_service()
            if service:
                try:
                    service.events().delete(
                        calendarId=location['google_calendar_id'],
                        eventId=event_id
                    ).execute()
                except Exception as e:
                    print(f"Error deleting calendar event: {e}")
    
    # Remove event ID from patient
    await db.patients.update_one(
        {"id": patient_id},
        {"$unset": {"google_event_id": ""}}
    )
    
    return {"message": "Removed from Google Calendar"}
