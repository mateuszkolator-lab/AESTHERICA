from fastapi import APIRouter, Depends, HTTPException, Header
from typing import Optional
import uuid
from datetime import datetime, timezone

from models.database import get_db
from models.schemas import SurgerySlotCreate, SurgerySlotUpdate
from routers.auth import verify_token

router = APIRouter(prefix="/surgery-slots", tags=["Surgery Slots"])

def get_auth(authorization: str = Header(None)):
    return verify_token(authorization)

@router.get("")
async def get_slots(include_past: bool = False, user: dict = Depends(get_auth)):
    db = get_db()
    query = {}
    if not include_past:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        query["date"] = {"$gte": today}
    
    slots = await db.surgery_slots.find(query, {"_id": 0}).sort("date", 1).to_list(1000)
    return slots

@router.post("")
async def create_slot(slot: SurgerySlotCreate, user: dict = Depends(get_auth)):
    db = get_db()
    
    # Check if slot already exists for this date
    existing = await db.surgery_slots.find_one({"date": slot.date}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Slot already exists for this date")
    
    slot_dict = slot.model_dump()
    slot_dict["id"] = str(uuid.uuid4())
    slot_dict["assigned_patient_id"] = None
    slot_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.surgery_slots.insert_one(slot_dict)
    
    return {"id": slot_dict["id"], "message": "Slot created successfully"}

@router.get("/calendar-data")
async def get_calendar_data(user: dict = Depends(get_auth)):
    db = get_db()
    
    # Get all slots
    slots = await db.surgery_slots.find({}, {"_id": 0}).to_list(1000)
    
    # Get locations for name lookup
    locations = await db.locations.find({}, {"_id": 0}).to_list(100)
    location_map = {loc["id"]: loc["name"] for loc in locations}
    
    # Add location names to slots
    for slot in slots:
        slot["location_name"] = location_map.get(slot.get("location_id"))
    
    # Get patients without surgery date (unassigned)
    unassigned = await db.patients.find(
        {"$or": [{"surgery_date": None}, {"surgery_date": ""}], "status": {"$in": ["consultation", "awaiting"]}},
        {"_id": 0, "visits": 0}
    ).to_list(1000)
    
    return {
        "slots": slots,
        "unassigned_patients": unassigned
    }

@router.get("/suggestions")
async def get_suggestions(user: dict = Depends(get_auth)):
    db = get_db()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Get available slots (not full)
    slots = await db.surgery_slots.find(
        {"date": {"$gte": today}, "is_full": False},
        {"_id": 0}
    ).sort("date", 1).to_list(100)
    
    # Get locations for name lookup
    locations = await db.locations.find({}, {"_id": 0}).to_list(100)
    location_map = {loc["id"]: loc["name"] for loc in locations}
    
    # Get patients who need scheduling
    patients = await db.patients.find(
        {"$or": [{"surgery_date": None}, {"surgery_date": ""}], "status": {"$in": ["consultation", "awaiting"]}},
        {"_id": 0, "visits": 0}
    ).to_list(1000)
    
    suggestions = []
    
    for slot in slots:
        slot["location_name"] = location_map.get(slot.get("location_id"))
        slot_location_id = slot.get("location_id")
        slot_date = slot["date"]
        
        matched_patients = []
        for patient in patients:
            match_score = 0
            date_match = False
            location_match = False
            
            # Check date preference
            pref_start = patient.get("preferred_date_start")
            pref_end = patient.get("preferred_date_end")
            
            if pref_start and pref_end:
                if pref_start <= slot_date <= pref_end:
                    match_score += 40
                    date_match = True
            elif pref_start and slot_date >= pref_start:
                match_score += 20
                date_match = True
            elif pref_end and slot_date <= pref_end:
                match_score += 20
                date_match = True
            else:
                # No preference, still a candidate
                match_score += 10
            
            # Check location preference - IMPORTANT for matching
            patient_location = patient.get("location_id")
            if patient_location and slot_location_id:
                if patient_location == slot_location_id:
                    match_score += 50  # Strong bonus for location match
                    location_match = True
            elif not patient_location:
                # No preference, slight penalty
                match_score += 5
            
            # ASAP bonus
            if patient.get("asap"):
                match_score += 30
            
            # Only include if there's some match
            if match_score > 0:
                patient_with_score = {
                    **patient,
                    "match_score": match_score,
                    "date_match": date_match,
                    "location_match": location_match,
                    "location_name": location_map.get(patient.get("location_id"))
                }
                matched_patients.append(patient_with_score)
        
        # Sort by match score (and prioritize ASAP + location match)
        matched_patients.sort(key=lambda x: (
            -x.get("location_match", False),  # Location match first
            -x.get("asap", False),             # Then ASAP
            -x.get("match_score", 0)           # Then overall score
        ))
        
        suggestions.append({
            "slot": slot,
            "suggested_patients": matched_patients[:10]  # Top 10
        })
    
    return suggestions

@router.put("/{slot_id}")
async def update_slot(slot_id: str, slot: SurgerySlotUpdate, user: dict = Depends(get_auth)):
    db = get_db()
    update_data = {k: v for k, v in slot.model_dump().items() if v is not None}
    
    if not update_data:
        # Nothing to update
        return {"message": "No changes made"}
    
    result = await db.surgery_slots.update_one({"id": slot_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Slot not found")
    
    return {"message": "Slot updated successfully"}

@router.delete("/{slot_id}")
async def delete_slot(slot_id: str, user: dict = Depends(get_auth)):
    db = get_db()
    result = await db.surgery_slots.delete_one({"id": slot_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Slot not found")
    return {"message": "Slot deleted successfully"}

@router.post("/{slot_id}/toggle-full")
async def toggle_full(slot_id: str, user: dict = Depends(get_auth)):
    db = get_db()
    slot = await db.surgery_slots.find_one({"id": slot_id}, {"_id": 0})
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    
    new_status = not slot.get("is_full", False)
    await db.surgery_slots.update_one({"id": slot_id}, {"$set": {"is_full": new_status}})
    
    return {"message": f"Slot marked as {'full' if new_status else 'available'}"}

@router.post("/{slot_id}/assign/{patient_id}")
async def assign_patient(slot_id: str, patient_id: str, user: dict = Depends(get_auth)):
    db = get_db()
    
    slot = await db.surgery_slots.find_one({"id": slot_id}, {"_id": 0})
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    
    patient = await db.patients.find_one({"id": patient_id}, {"_id": 0})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    if slot.get("is_full"):
        raise HTTPException(status_code=400, detail="Slot is full")
    
    # Update slot
    await db.surgery_slots.update_one(
        {"id": slot_id},
        {"$set": {"assigned_patient_id": patient_id}}
    )
    
    # Update patient
    await db.patients.update_one(
        {"id": patient_id},
        {"$set": {
            "surgery_date": slot["date"],
            "status": "planned" if patient.get("status") in ["consultation", "awaiting"] else patient.get("status"),
            "location_id": slot.get("location_id") or patient.get("location_id")
        }}
    )
    
    return {"message": "Patient assigned to slot successfully"}

@router.post("/{slot_id}/unassign")
async def unassign_patient(slot_id: str, user: dict = Depends(get_auth)):
    db = get_db()
    
    slot = await db.surgery_slots.find_one({"id": slot_id}, {"_id": 0})
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    
    patient_id = slot.get("assigned_patient_id")
    if patient_id:
        # Update patient
        await db.patients.update_one(
            {"id": patient_id},
            {"$set": {"surgery_date": None, "status": "awaiting"}}
        )
    
    # Update slot
    await db.surgery_slots.update_one(
        {"id": slot_id},
        {"$set": {"assigned_patient_id": None}}
    )
    
    return {"message": "Patient unassigned from slot successfully"}
