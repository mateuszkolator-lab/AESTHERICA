from fastapi import APIRouter, Depends, HTTPException, Header
from typing import Optional, List
from pydantic import BaseModel
import uuid
from datetime import datetime, timezone

from models.database import get_db
from models.schemas import PatientCreate, PatientUpdate, VisitCreate
from routers.auth import verify_token, get_patient_location_filter
from routers.audit import log_patient_change

router = APIRouter(prefix="/patients", tags=["Patients"])

def get_auth(authorization: str = Header(None)):
    return verify_token(authorization)

# Photo schemas
class PhotoCreate(BaseModel):
    data: str
    filename: Optional[str] = None
    angle: Optional[str] = None
    caption: Optional[str] = None

class PhotoUpdate(BaseModel):
    angle: Optional[str] = None
    caption: Optional[str] = None

class BulkPhotoCreate(BaseModel):
    photos: List[dict]  # [{data, filename, angle, caption}, ...]

class SurgeryOutcome(BaseModel):
    performed: bool

async def delete_google_event(db, patient: dict):
    """Remove patient's Google Calendar event (best-effort)."""
    from routers.calendar import delete_patient_event
    try:
        await delete_patient_event(db, patient)
    except Exception as e:
        print(f"Google Calendar event delete failed: {e}")

@router.get("/pending-surgery-confirmations")
async def get_pending_surgery_confirmations(user: dict = Depends(get_auth)):
    """Planned patients whose surgery date is today or already passed — need outcome confirmation."""
    db = get_db()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    query = {"status": "planned", "surgery_date": {"$nin": [None, ""], "$lte": today}}
    loc_filter = get_patient_location_filter(user)
    if loc_filter:
        query = {"$and": [query, loc_filter]}
    patients = await db.patients.find(query, {"_id": 0, "visits": 0}).sort("surgery_date", 1).to_list(200)
    locations = await db.locations.find({}, {"_id": 0}).to_list(100)
    location_map = {loc["id"]: loc["name"] for loc in locations}
    for p in patients:
        p["location_name"] = location_map.get(p.get("location_id"))
    return patients

@router.post("/{patient_id}/restore")
async def restore_cancelled_patient(patient_id: str, user: dict = Depends(get_auth)):
    """Bring a cancelled patient back to the waiting list, keeping cancellation history."""
    db = get_db()
    patient = await db.patients.find_one({"id": patient_id}, {"_id": 0})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    if patient.get("status") != "cancelled":
        raise HTTPException(status_code=400, detail="Patient is not cancelled")
    
    now = datetime.now(timezone.utc).isoformat()
    history_entry = {
        "cancelled_at": patient.get("cancelled_at"),
        "cancelled_surgery_date": patient.get("cancelled_surgery_date"),
        "reason": patient.get("cancellation_reason"),
        "restored_at": now
    }
    await db.patients.update_one({"id": patient_id}, {
        "$set": {"status": "awaiting", "updated_at": now},
        "$unset": {"cancellation_reason": "", "cancelled_at": "", "cancelled_surgery_date": ""},
        "$push": {"cancellation_history": history_entry}
    })
    await log_patient_change(
        patient_id=patient_id, action="update", user=user,
        changes={"Status": {"old": "cancelled", "new": "awaiting"}},
        details="Przywrócono pacjenta z rezygnacji do oczekujących" + (f" (poprzedni powód: {patient.get('cancellation_reason')})" if patient.get("cancellation_reason") else "")
    )
    return {"status": "awaiting"}

@router.post("/{patient_id}/surgery-outcome")
async def set_surgery_outcome(patient_id: str, data: SurgeryOutcome, user: dict = Depends(get_auth)):
    """Confirm whether a scheduled surgery took place."""
    db = get_db()
    patient = await db.patients.find_one({"id": patient_id}, {"_id": 0})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    now = datetime.now(timezone.utc).isoformat()
    user_data = await db.users.find_one({"id": user.get("user_id")})
    user_name = f"{user_data.get('first_name', '')} {user_data.get('last_name', '')}".strip() if user_data else "Nieznany"
    
    if data.performed:
        await db.patients.update_one({"id": patient_id}, {"$set": {
            "status": "operated",
            "surgery_confirmed_by": user_name,
            "surgery_confirmed_at": now,
            "updated_at": now
        }})
        await log_patient_change(
            patient_id=patient_id, action="update", user=user,
            changes={"Status": {"old": patient.get("status"), "new": "operated"}},
            details=f"Potwierdzono wykonanie zabiegu w dniu {patient.get('surgery_date')}"
        )
        return {"status": "operated"}
    
    await db.patients.update_one({"id": patient_id}, {"$set": {
        "status": "awaiting",
        "surgery_date": None,
        "confirmed": False,
        "updated_at": now
    }})
    await delete_google_event(db, patient)
    await log_patient_change(
        patient_id=patient_id, action="update", user=user,
        changes={
            "Status": {"old": patient.get("status"), "new": "awaiting"},
            "Data zabiegu": {"old": patient.get("surgery_date"), "new": None}
        },
        details=f"Zabieg z dnia {patient.get('surgery_date')} nie odbył się"
    )
    return {"status": "awaiting"}

@router.get("")
async def get_patients(
    status: Optional[str] = None,
    location_id: Optional[str] = None,
    asap: Optional[bool] = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    user: dict = Depends(get_auth)
):
    db = get_db()
    query = {}
    
    # Apply location-based access filter
    loc_filter = get_patient_location_filter(user)
    if loc_filter:
        query.update(loc_filter)
    elif location_id:
        # Admin/global: allow explicit location filtering
        query["location_id"] = location_id
    
    if status:
        query["status"] = status
    if asap is not None:
        query["asap"] = asap
    
    sort_direction = -1 if sort_order == "desc" else 1
    
    if sort_by == "asap":
        patients = await db.patients.find(query, {"_id": 0}).sort([("asap", -1), ("created_at", -1)]).to_list(1000)
    else:
        patients = await db.patients.find(query, {"_id": 0}).sort(sort_by, sort_direction).to_list(1000)
    
    return patients

@router.post("")
async def create_patient(patient: PatientCreate, user: dict = Depends(get_auth)):
    db = get_db()
    patient_dict = patient.model_dump()
    patient_dict["id"] = str(uuid.uuid4())
    patient_dict["visits"] = []
    patient_dict["google_calendar_event_id"] = None
    patient_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    patient_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.patients.insert_one(patient_dict)
    
    if patient_dict.get("survey_template_ids"):
        from routers.surveys import _sync_patient_assignments
        await _sync_patient_assignments(db, patient_dict["id"], patient_dict["survey_template_ids"])
    
    # Log creation
    await log_patient_change(
        patient_id=patient_dict["id"],
        action="create",
        user=user,
        details=f"Utworzono pacjenta: {patient_dict.get('first_name', '')} {patient_dict.get('last_name', '')}"
    )
    
    # Auto-sync to Google Calendar if patient has surgery_date and location
    if patient_dict.get("surgery_date") and patient_dict.get("location_id"):
        try:
            from routers.calendar import upsert_patient_event
            await upsert_patient_event(db, patient_dict)
        except Exception as e:
            print(f"Auto-sync new patient to Google Calendar failed: {e}")
            from routers.calendar import record_sync_error
            await record_sync_error(f"Auto-sync nowego pacjenta {patient_dict.get('last_name')}: {str(e)[:200]}")
    
    return {"id": patient_dict["id"], "message": "Patient created successfully"}

@router.get("/{patient_id}")
async def get_patient(patient_id: str, user: dict = Depends(get_auth)):
    db = get_db()
    patient = await db.patients.find_one({"id": patient_id}, {"_id": 0})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # Fetch photos from separate collection and attach to visits
    photos = await db.photos.find({"patient_id": patient_id}, {"_id": 0}).to_list(1000)
    
    # Group photos by visit_id
    photos_by_visit = {}
    for photo in photos:
        visit_id = photo.get("visit_id")
        if visit_id not in photos_by_visit:
            photos_by_visit[visit_id] = []
        photos_by_visit[visit_id].append(photo)
    
    # Attach photos to visits
    for visit in patient.get("visits", []):
        visit["photos"] = photos_by_visit.get(visit["id"], [])
    
    return patient

@router.put("/{patient_id}")
async def update_patient(patient_id: str, patient: PatientUpdate, user: dict = Depends(get_auth)):
    db = get_db()
    
    # Get old data for comparison
    old_patient = await db.patients.find_one({"id": patient_id}, {"_id": 0})
    if not old_patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # Use exclude_unset=True to only include fields explicitly sent in the request
    # This allows setting fields to null (e.g. surgery_date: null)
    update_data = patient.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # Cancellation: clear surgery date (frees calendar slot), Google event is removed below
    cancelling = update_data.get("status") == "cancelled" and old_patient.get("status") != "cancelled"
    if cancelling:
        update_data["surgery_date"] = None
        update_data["confirmed"] = False
        update_data["cancelled_at"] = update_data["updated_at"]
        update_data["cancelled_surgery_date"] = old_patient.get("surgery_date")
    
    # Track changes
    changes = {}
    field_labels = {
        "first_name": "Imię",
        "last_name": "Nazwisko",
        "phone": "Telefon",
        "email": "Email",
        "surgery_date": "Data zabiegu",
        "procedure_type": "Typ zabiegu",
        "status": "Status",
        "location_id": "Lokalizacja",
        "deposit": "Zaliczka",
        "notes": "Notatki",
        "asap": "ASAP",
        "cancellation_reason": "Powód rezygnacji",
        "survey_template_ids": "Ankiety",
        "documents_sent_date": "Data wysłania dokumentów",
        "hospital_registration_date": "Data zgłoszenia do szpitala"
    }
    
    for key, new_value in update_data.items():
        if key in ["updated_at", "cancelled_at", "cancelled_surgery_date", "confirmed"]:
            continue
        old_value = old_patient.get(key)
        if old_value != new_value:
            label = field_labels.get(key, key)
            changes[label] = {"old": old_value, "new": new_value}
    
    result = await db.patients.update_one({"id": patient_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    if "survey_template_ids" in update_data and update_data["survey_template_ids"] is not None:
        from routers.surveys import _sync_patient_assignments
        await _sync_patient_assignments(db, patient_id, update_data["survey_template_ids"])
    
    # Log changes if any
    if changes:
        reason = update_data.get("cancellation_reason")
        cancel_details = None
        if cancelling:
            cancel_details = "Pacjent zrezygnował"
            if old_patient.get("surgery_date"):
                cancel_details += f" (usunięto termin zabiegu {old_patient.get('surgery_date')})"
            if reason:
                cancel_details += f" – powód: {reason}"
        await log_patient_change(
            patient_id=patient_id,
            action="update",
            user=user,
            changes=changes,
            details=cancel_details
        )
    
    # Auto-sync to Google Calendar when relevant fields change
    sync_triggers = {"surgery_date", "status", "confirmed", "first_name", "last_name", "procedure_type", "location_id", "notes"}
    should_sync = bool(sync_triggers & set(update_data.keys()))
    
    if should_sync:
        surgery_date = update_data.get("surgery_date", old_patient.get("surgery_date"))
        location_id = update_data.get("location_id") or old_patient.get("location_id")
        
        # Date was explicitly cleared
        date_cleared = "surgery_date" in update_data and not update_data["surgery_date"]
        
        if date_cleared and old_patient.get("google_event_id"):
            await delete_google_event(db, old_patient)
        elif surgery_date and location_id:
            try:
                from routers.calendar import upsert_patient_event
                merged = {**old_patient, **update_data}
                await upsert_patient_event(db, merged)
            except Exception as e:
                print(f"Auto-sync to Google Calendar failed: {e}")
                from routers.calendar import record_sync_error
                await record_sync_error(f"Auto-sync pacjenta {old_patient.get('last_name')}: {str(e)[:200]}")
    
    return {"message": "Patient updated successfully"}

@router.post("/{patient_id}/confirm")
async def toggle_confirm(patient_id: str, user: dict = Depends(get_auth)):
    """Toggle phone confirmation for a planned patient"""
    db = get_db()
    patient = await db.patients.find_one({"id": patient_id}, {"_id": 0})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    new_val = not patient.get("confirmed", False)
    await db.patients.update_one({"id": patient_id}, {"$set": {"confirmed": new_val}})
    
    # Update Google Calendar event with confirmation status
    if patient.get("google_event_id") and patient.get("surgery_date") and patient.get("location_id"):
        try:
            location = await db.locations.find_one({"id": patient["location_id"]})
            if location and location.get("google_calendar_id"):
                from routers.calendar import get_calendar_service, build_calendar_event
                service = await get_calendar_service()
                if service:
                    updated_patient = {**patient, "confirmed": new_val}
                    event_body = build_calendar_event(updated_patient, patient["surgery_date"], location.get("name", ""))
                    try:
                        service.events().update(calendarId=location["google_calendar_id"], eventId=patient["google_event_id"], body=event_body).execute()
                    except Exception:
                        pass
        except Exception as e:
            print(f"Calendar update on confirm toggle failed: {e}")
    
    return {"confirmed": new_val}


@router.delete("/{patient_id}")
async def delete_patient(patient_id: str, user: dict = Depends(get_auth)):
    db = get_db()
    
    # Get patient name for log
    patient = await db.patients.find_one({"id": patient_id}, {"_id": 0})
    patient_name = f"{patient.get('first_name', '')} {patient.get('last_name', '')}" if patient else "Nieznany"
    
    # Delete patient's photos first
    await db.photos.delete_many({"patient_id": patient_id})
    # Delete patient
    result = await db.patients.delete_one({"id": patient_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # Log deletion
    await log_patient_change(
        patient_id=patient_id,
        action="delete",
        user=user,
        details=f"Usunięto pacjenta: {patient_name}"
    )
    
    return {"message": "Patient deleted successfully"}

# Visits
@router.post("/{patient_id}/visits")
async def add_visit(patient_id: str, visit: VisitCreate, user: dict = Depends(get_auth)):
    db = get_db()
    visit_dict = visit.model_dump()
    visit_dict["id"] = str(uuid.uuid4())
    visit_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.patients.update_one(
        {"id": patient_id},
        {"$push": {"visits": visit_dict}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # Log visit addition
    await log_patient_change(
        patient_id=patient_id,
        action="add_visit",
        user=user,
        details=f"Dodano wizytę: {visit_dict.get('date', 'brak daty')}"
    )
    
    return {"id": visit_dict["id"], "message": "Visit added successfully"}

@router.delete("/{patient_id}/visits/{visit_id}")
async def delete_visit(patient_id: str, visit_id: str, user: dict = Depends(get_auth)):
    db = get_db()
    # Delete photos for this visit
    await db.photos.delete_many({"patient_id": patient_id, "visit_id": visit_id})
    # Remove visit from patient
    result = await db.patients.update_one(
        {"id": patient_id},
        {"$pull": {"visits": {"id": visit_id}}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # Log visit deletion
    await log_patient_change(
        patient_id=patient_id,
        action="delete_visit",
        user=user,
        details="Usunięto wizytę"
    )
    
    return {"message": "Visit deleted successfully"}

# Photos - stored in separate collection
@router.post("/{patient_id}/visits/{visit_id}/photos")
async def add_photo(patient_id: str, visit_id: str, photo: PhotoCreate, user: dict = Depends(get_auth)):
    db = get_db()
    
    # Verify patient and visit exist
    patient = await db.patients.find_one({"id": patient_id, "visits.id": visit_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient or visit not found")
    
    photo_dict = {
        "id": str(uuid.uuid4()),
        "patient_id": patient_id,
        "visit_id": visit_id,
        "data": photo.data,
        "filename": photo.filename,
        "angle": photo.angle,
        "caption": photo.caption,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.photos.insert_one(photo_dict)
    
    return {"id": photo_dict["id"], "message": "Photo added successfully"}

# Bulk photo upload
@router.post("/{patient_id}/visits/{visit_id}/photos/bulk")
async def add_photos_bulk(patient_id: str, visit_id: str, bulk: BulkPhotoCreate, user: dict = Depends(get_auth)):
    db = get_db()
    
    # Verify patient and visit exist
    patient = await db.patients.find_one({"id": patient_id, "visits.id": visit_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient or visit not found")
    
    photo_ids = []
    for photo_data in bulk.photos:
        photo_dict = {
            "id": str(uuid.uuid4()),
            "patient_id": patient_id,
            "visit_id": visit_id,
            "data": photo_data.get("data"),
            "filename": photo_data.get("filename"),
            "angle": photo_data.get("angle"),
            "caption": photo_data.get("caption"),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.photos.insert_one(photo_dict)
        photo_ids.append(photo_dict["id"])
    
    return {"ids": photo_ids, "message": f"{len(photo_ids)} photos added successfully"}

@router.put("/{patient_id}/visits/{visit_id}/photos/{photo_id}")
async def update_photo(patient_id: str, visit_id: str, photo_id: str, photo: PhotoUpdate, user: dict = Depends(get_auth)):
    db = get_db()
    
    update_data = {k: v for k, v in photo.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    result = await db.photos.update_one(
        {"id": photo_id, "patient_id": patient_id, "visit_id": visit_id},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    return {"message": "Photo updated successfully"}

@router.delete("/{patient_id}/visits/{visit_id}/photos/{photo_id}")
async def delete_photo(patient_id: str, visit_id: str, photo_id: str, user: dict = Depends(get_auth)):
    db = get_db()
    result = await db.photos.delete_one({"id": photo_id, "patient_id": patient_id, "visit_id": visit_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    return {"message": "Photo deleted successfully"}

# Photo upload directly to patient (creates a photo_upload visit)
@router.post("/{patient_id}/photos")
async def add_patient_photo(patient_id: str, photo: PhotoCreate, user: dict = Depends(get_auth)):
    db = get_db()
    
    patient = await db.patients.find_one({"id": patient_id}, {"_id": 0})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    existing_visit = None
    
    for visit in patient.get("visits", []):
        if visit.get("date") == today and visit.get("type") == "photo_upload":
            existing_visit = visit
            break
    
    if not existing_visit:
        visit_dict = {
            "id": str(uuid.uuid4()),
            "date": today,
            "type": "photo_upload",
            "notes": "Zdjęcia dodane bezpośrednio",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.patients.update_one(
            {"id": patient_id},
            {"$push": {"visits": visit_dict}}
        )
        visit_id = visit_dict["id"]
    else:
        visit_id = existing_visit["id"]
    
    photo_dict = {
        "id": str(uuid.uuid4()),
        "patient_id": patient_id,
        "visit_id": visit_id,
        "data": photo.data,
        "filename": photo.filename,
        "angle": photo.angle,
        "caption": photo.caption,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.photos.insert_one(photo_dict)
    
    return {"id": photo_dict["id"], "message": "Photo added successfully"}
