from fastapi import APIRouter, Depends, HTTPException, Header
from typing import Optional, List
from pydantic import BaseModel
import uuid
from datetime import datetime, timezone

from models.database import get_db
from models.schemas import PatientCreate, PatientUpdate, VisitCreate
from routers.auth import verify_token

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
    # Delete patient's photos first
    await db.photos.delete_many({"patient_id": patient_id})
    # Delete patient
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
    # Delete photos for this visit
    await db.photos.delete_many({"patient_id": patient_id, "visit_id": visit_id})
    # Remove visit from patient
    result = await db.patients.update_one(
        {"id": patient_id},
        {"$pull": {"visits": {"id": visit_id}}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Patient not found")
    
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
