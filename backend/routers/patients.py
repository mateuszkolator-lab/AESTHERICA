from fastapi import APIRouter, Depends, HTTPException, Header
from typing import Optional
import uuid
from datetime import datetime, timezone

from models.database import get_db
from models.schemas import PatientCreate, PatientUpdate, VisitCreate, PhotoCreate
from routers.auth import verify_token

router = APIRouter(prefix="/patients", tags=["Patients"])

def get_auth(authorization: str = Header(None)):
    return verify_token(authorization)

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
    if status:
        query["status"] = status
    if location_id:
        query["location_id"] = location_id
    if asap is not None:
        query["asap"] = asap
    
    sort_direction = -1 if sort_order == "desc" else 1
    
    # Handle special sort cases
    if sort_by == "asap":
        # Sort by asap (True first), then by created_at
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
    
    # Return without _id
    return {"id": patient_dict["id"], "message": "Patient created successfully"}

@router.get("/{patient_id}")
async def get_patient(patient_id: str, user: dict = Depends(get_auth)):
    db = get_db()
    patient = await db.patients.find_one({"id": patient_id}, {"_id": 0})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient

@router.put("/{patient_id}")
async def update_patient(patient_id: str, patient: PatientUpdate, user: dict = Depends(get_auth)):
    db = get_db()
    update_data = {k: v for k, v in patient.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.patients.update_one({"id": patient_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    return {"message": "Patient updated successfully"}

@router.delete("/{patient_id}")
async def delete_patient(patient_id: str, user: dict = Depends(get_auth)):
    db = get_db()
    result = await db.patients.delete_one({"id": patient_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Patient not found")
    return {"message": "Patient deleted successfully"}

# Visits
@router.post("/{patient_id}/visits")
async def add_visit(patient_id: str, visit: VisitCreate, user: dict = Depends(get_auth)):
    db = get_db()
    visit_dict = visit.model_dump()
    visit_dict["id"] = str(uuid.uuid4())
    visit_dict["photos"] = []
    visit_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.patients.update_one(
        {"id": patient_id},
        {"$push": {"visits": visit_dict}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    return {"id": visit_dict["id"], "message": "Visit added successfully"}

@router.delete("/{patient_id}/visits/{visit_id}")
async def delete_visit(patient_id: str, visit_id: str, user: dict = Depends(get_auth)):
    db = get_db()
    result = await db.patients.update_one(
        {"id": patient_id},
        {"$pull": {"visits": {"id": visit_id}}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    return {"message": "Visit deleted successfully"}

# Photos
@router.post("/{patient_id}/visits/{visit_id}/photos")
async def add_photo(patient_id: str, visit_id: str, photo: PhotoCreate, user: dict = Depends(get_auth)):
    db = get_db()
    photo_dict = photo.model_dump()
    photo_dict["id"] = str(uuid.uuid4())
    photo_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.patients.update_one(
        {"id": patient_id, "visits.id": visit_id},
        {"$push": {"visits.$.photos": photo_dict}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Patient or visit not found")
    
    return {"id": photo_dict["id"], "message": "Photo added successfully"}

@router.delete("/{patient_id}/visits/{visit_id}/photos/{photo_id}")
async def delete_photo(patient_id: str, visit_id: str, photo_id: str, user: dict = Depends(get_auth)):
    db = get_db()
    result = await db.patients.update_one(
        {"id": patient_id, "visits.id": visit_id},
        {"$pull": {"visits.$.photos": {"id": photo_id}}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Patient or visit not found")
    
    return {"message": "Photo deleted successfully"}

# Photo upload directly to patient (without visit)
@router.post("/{patient_id}/photos")
async def add_patient_photo(patient_id: str, photo: PhotoCreate, user: dict = Depends(get_auth)):
    db = get_db()
    
    # Check if patient exists
    patient = await db.patients.find_one({"id": patient_id}, {"_id": 0})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # Create a default visit for direct photo uploads
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    existing_visit = None
    
    for visit in patient.get("visits", []):
        if visit.get("date") == today and visit.get("type") == "photo_upload":
            existing_visit = visit
            break
    
    photo_dict = photo.model_dump()
    photo_dict["id"] = str(uuid.uuid4())
    photo_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    
    if existing_visit:
        # Add photo to existing photo_upload visit
        await db.patients.update_one(
            {"id": patient_id, "visits.id": existing_visit["id"]},
            {"$push": {"visits.$.photos": photo_dict}}
        )
    else:
        # Create new photo_upload visit
        visit_dict = {
            "id": str(uuid.uuid4()),
            "date": today,
            "type": "photo_upload",
            "notes": "Zdjęcia dodane bezpośrednio",
            "photos": [photo_dict],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.patients.update_one(
            {"id": patient_id},
            {"$push": {"visits": visit_dict}}
        )
    
    return {"id": photo_dict["id"], "message": "Photo added successfully"}
