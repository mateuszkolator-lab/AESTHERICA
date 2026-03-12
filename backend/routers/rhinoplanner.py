from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone
from bson import ObjectId
from models.database import get_db

router = APIRouter(prefix="/rhinoplanner", tags=["rhinoplanner"])

class ProcedureSelection(BaseModel):
    category: str
    items: List[str]

class RhinoPlanCreate(BaseModel):
    patient_id: str
    canvas_frontal: Optional[str] = None  # JSON string of fabric canvas
    canvas_profile: Optional[str] = None
    canvas_base: Optional[str] = None
    procedures: Optional[List[ProcedureSelection]] = []
    notes: Optional[str] = None
    surgeon_notes: Optional[str] = None

class RhinoPlanUpdate(BaseModel):
    canvas_frontal: Optional[str] = None
    canvas_profile: Optional[str] = None
    canvas_base: Optional[str] = None
    procedures: Optional[List[ProcedureSelection]] = None
    notes: Optional[str] = None
    surgeon_notes: Optional[str] = None

def serialize_plan(plan):
    """Convert MongoDB document to JSON-serializable dict"""
    return {
        "id": str(plan["_id"]),
        "patient_id": plan["patient_id"],
        "canvas_frontal": plan.get("canvas_frontal"),
        "canvas_profile": plan.get("canvas_profile"),
        "canvas_base": plan.get("canvas_base"),
        "procedures": plan.get("procedures", []),
        "notes": plan.get("notes", ""),
        "surgeon_notes": plan.get("surgeon_notes", ""),
        "created_at": plan.get("created_at", "").isoformat() if plan.get("created_at") else None,
        "updated_at": plan.get("updated_at", "").isoformat() if plan.get("updated_at") else None
    }

@router.post("")
async def create_rhino_plan(plan: RhinoPlanCreate):
    """Create a new rhinoplasty plan for a patient"""
    db = get_db()
    
    # Check if patient exists
    patient = await db.patients.find_one({"id": plan.patient_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Pacjent nie znaleziony")
    
    # Check if plan already exists for this patient
    existing = await db.rhinoplans.find_one({"patient_id": plan.patient_id})
    if existing:
        raise HTTPException(status_code=400, detail="Plan już istnieje dla tego pacjenta. Użyj PUT do aktualizacji.")
    
    now = datetime.now(timezone.utc)
    plan_doc = {
        "patient_id": plan.patient_id,
        "canvas_frontal": plan.canvas_frontal,
        "canvas_profile": plan.canvas_profile,
        "canvas_base": plan.canvas_base,
        "procedures": [p.model_dump() for p in plan.procedures] if plan.procedures else [],
        "notes": plan.notes,
        "surgeon_notes": plan.surgeon_notes,
        "created_at": now,
        "updated_at": now
    }
    
    result = await db.rhinoplans.insert_one(plan_doc)
    plan_doc["_id"] = result.inserted_id
    
    return serialize_plan(plan_doc)

@router.get("/patient/{patient_id}")
async def get_patient_rhino_plan(patient_id: str):
    """Get rhinoplasty plan for a specific patient"""
    db = get_db()
    
    plan = await db.rhinoplans.find_one({"patient_id": patient_id})
    if not plan:
        return None
    
    return serialize_plan(plan)

@router.put("/patient/{patient_id}")
async def update_rhino_plan(patient_id: str, plan_update: RhinoPlanUpdate):
    """Update rhinoplasty plan for a patient"""
    db = get_db()
    
    existing = await db.rhinoplans.find_one({"patient_id": patient_id})
    if not existing:
        # Create new if doesn't exist
        plan_create = RhinoPlanCreate(
            patient_id=patient_id,
            canvas_frontal=plan_update.canvas_frontal,
            canvas_profile=plan_update.canvas_profile,
            canvas_base=plan_update.canvas_base,
            procedures=plan_update.procedures or [],
            notes=plan_update.notes,
            surgeon_notes=plan_update.surgeon_notes
        )
        return await create_rhino_plan(plan_create)
    
    update_data = {"updated_at": datetime.now(timezone.utc)}
    
    if plan_update.canvas_frontal is not None:
        update_data["canvas_frontal"] = plan_update.canvas_frontal
    if plan_update.canvas_profile is not None:
        update_data["canvas_profile"] = plan_update.canvas_profile
    if plan_update.canvas_base is not None:
        update_data["canvas_base"] = plan_update.canvas_base
    if plan_update.procedures is not None:
        update_data["procedures"] = [p.model_dump() for p in plan_update.procedures]
    if plan_update.notes is not None:
        update_data["notes"] = plan_update.notes
    if plan_update.surgeon_notes is not None:
        update_data["surgeon_notes"] = plan_update.surgeon_notes
    
    await db.rhinoplans.update_one(
        {"patient_id": patient_id},
        {"$set": update_data}
    )
    
    updated = await db.rhinoplans.find_one({"patient_id": patient_id})
    return serialize_plan(updated)

@router.delete("/patient/{patient_id}")
async def delete_rhino_plan(patient_id: str):
    """Delete rhinoplasty plan for a patient"""
    db = get_db()
    
    result = await db.rhinoplans.delete_one({"patient_id": patient_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Plan nie znaleziony")
    
    return {"message": "Plan usunięty"}

@router.get("/all")
async def get_all_rhino_plans():
    """Get all rhinoplasty plans (for admin/stats)"""
    db = get_db()
    
    plans = await db.rhinoplans.find().to_list(length=1000)
    return [serialize_plan(p) for p in plans]
