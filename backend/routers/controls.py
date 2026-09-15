from fastapi import APIRouter, Depends, HTTPException, Header
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta

from models.database import get_db
from routers.auth import verify_token, get_patient_location_filter

router = APIRouter(prefix="/controls", tags=["Follow-up Controls"])

def get_auth(authorization: str = Header(None)):
    return verify_token(authorization)

# Default control intervals (used when procedure type has none configured)
DEFAULT_CONTROL_INTERVALS = [
    {"days": 7, "label": "1 tydzień"},
    {"days": 30, "label": "1 miesiąc"},
    {"days": 90, "label": "3 miesiące"},
    {"days": 180, "label": "6 miesięcy"},
    {"days": 365, "label": "1 rok"},
]

# Legacy control_type keys -> new "<days>d" keys
LEGACY_TYPE_MAP = {
    "1_week": "7d",
    "1_month": "30d",
    "3_months": "90d",
    "6_months": "180d",
    "1_year": "365d",
}

def normalize_control_type(control_type: str) -> str:
    return LEGACY_TYPE_MAP.get(control_type, control_type)

def is_valid_control_type(control_type: str) -> bool:
    ct = normalize_control_type(control_type)
    return ct.endswith("d") and ct[:-1].isdigit()

async def get_intervals_by_procedure(db) -> dict:
    procedure_types = await db.procedure_types.find({}, {"_id": 0}).to_list(200)
    result = {}
    for pt in procedure_types:
        intervals = [i for i in (pt.get("control_intervals") or []) if isinstance(i.get("days"), int) and i["days"] > 0]
        if intervals:
            result[pt["name"]] = sorted(intervals, key=lambda i: i["days"])
    return result

class ControlComplete(BaseModel):
    control_type: str  # "1_week", "1_month", etc.
    completed_date: Optional[str] = None  # ISO date, defaults to today
    notes: Optional[str] = None

class NoContactUpdate(BaseModel):
    no_contact: bool
    no_contact_note: Optional[str] = None

class ControlEntry(BaseModel):
    type: str
    label: str
    due_date: str
    completed: bool
    completed_date: Optional[str] = None
    completed_by: Optional[str] = None
    notes: Optional[str] = None

class PatientWithControls(BaseModel):
    id: str
    first_name: str
    last_name: str
    phone: Optional[str] = None
    procedure_type: str
    surgery_date: str
    controls: List[ControlEntry]
    next_control: Optional[ControlEntry] = None
    no_contact: bool = False
    no_contact_note: Optional[str] = None
    no_contact_date: Optional[str] = None
    no_contact_by: Optional[str] = None

@router.get("/patients", response_model=List[PatientWithControls])
async def get_patients_with_controls(user: dict = Depends(get_auth)):
    """Get all operated patients with their control schedules"""
    db = get_db()
    
    # Get patients with completed surgeries (have surgery_date in the past)
    today = datetime.now(timezone.utc).date()
    
    loc_filter = get_patient_location_filter(user)
    
    base_q1 = {
        "surgery_date": {"$nin": [None, ""]},
        "status": {"$in": ["operated", "completed", "po_zabiegu", "zoperowany"]}
    }
    base_q2 = {
        "surgery_date": {"$nin": [None, ""], "$lte": today.isoformat()},
        "status": {"$nin": ["cancelled", "thinking"]}
    }
    
    if loc_filter:
        base_q1 = {"$and": [base_q1, loc_filter]}
        base_q2 = {"$and": [base_q2, loc_filter]}
    
    patients = await db.patients.find(base_q1, {"_id": 0}).to_list(1000)
    
    # Also include patients with surgery_date in the past regardless of status
    patients_by_date = await db.patients.find(base_q2, {"_id": 0}).to_list(1000)
    
    # Merge and dedupe
    seen_ids = set()
    all_patients = []
    for p in patients + patients_by_date:
        if p["id"] not in seen_ids:
            seen_ids.add(p["id"])
            all_patients.append(p)
    
    intervals_by_procedure = await get_intervals_by_procedure(db)
    
    # Get all control records (normalize legacy keys)
    control_records = await db.patient_controls.find({}, {"_id": 0}).to_list(5000)
    controls_by_patient = {}
    for cr in control_records:
        pid = cr["patient_id"]
        if pid not in controls_by_patient:
            controls_by_patient[pid] = {}
        controls_by_patient[pid][normalize_control_type(cr["control_type"])] = cr
    
    result = []
    for patient in all_patients:
        surgery_date_str = patient.get("surgery_date")
        if not surgery_date_str:
            continue
            
        try:
            surgery_date = datetime.fromisoformat(surgery_date_str.replace("Z", "+00:00")).date()
        except ValueError:
            try:
                surgery_date = datetime.strptime(surgery_date_str[:10], "%Y-%m-%d").date()
            except ValueError:
                continue
        
        # Skip future surgeries
        if surgery_date > today:
            continue
        
        patient_controls = controls_by_patient.get(patient["id"], {})
        
        controls = []
        next_control = None
        
        intervals = intervals_by_procedure.get(patient.get("procedure_type"), DEFAULT_CONTROL_INTERVALS)
        
        for interval in intervals:
            days = interval["days"]
            ctrl_type = f"{days}d"
            due_date = surgery_date + timedelta(days=days)
            completed_record = patient_controls.get(ctrl_type)
            
            control_entry = {
                "type": ctrl_type,
                "label": interval.get("label") or f"{days} dni",
                "due_date": due_date.isoformat(),
                "completed": completed_record is not None,
                "completed_date": completed_record.get("completed_date") if completed_record else None,
                "completed_by": completed_record.get("completed_by") if completed_record else None,
                "notes": completed_record.get("notes") if completed_record else None
            }
            controls.append(control_entry)
            
            # Find next pending control
            if not control_entry["completed"] and next_control is None:
                next_control = control_entry
        
        result.append({
            "id": patient["id"],
            "first_name": patient.get("first_name", ""),
            "last_name": patient.get("last_name", ""),
            "phone": patient.get("phone"),
            "procedure_type": patient.get("procedure_type", ""),
            "surgery_date": surgery_date_str,
            "controls": controls,
            "next_control": next_control,
            "no_contact": patient.get("no_contact", False),
            "no_contact_note": patient.get("no_contact_note"),
            "no_contact_date": patient.get("no_contact_date"),
            "no_contact_by": patient.get("no_contact_by")
        })
    
    # Sort by next control due date (soonest first), then by patients without next control at the end
    def sort_key(p):
        if p["next_control"]:
            return (0, p["next_control"]["due_date"])
        return (1, "9999-99-99")
    
    result.sort(key=sort_key)
    
    return result

@router.post("/patients/{patient_id}/complete")
async def mark_control_complete(
    patient_id: str, 
    data: ControlComplete, 
    user: dict = Depends(get_auth)
):
    """Mark a control as completed"""
    db = get_db()
    
    # Verify patient exists
    patient = await db.patients.find_one({"id": patient_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # Validate control type
    if not is_valid_control_type(data.control_type):
        raise HTTPException(status_code=400, detail="Invalid control type")
    control_type = normalize_control_type(data.control_type)
    
    # Get user name
    user_data = await db.users.find_one({"id": user.get("user_id")})
    user_name = f"{user_data.get('first_name', '')} {user_data.get('last_name', '')}" if user_data else "Nieznany"
    
    completed_date = data.completed_date or datetime.now(timezone.utc).date().isoformat()
    
    # Upsert control record (also clean legacy-keyed duplicate)
    legacy_keys = [k for k, v in LEGACY_TYPE_MAP.items() if v == control_type]
    if legacy_keys:
        await db.patient_controls.delete_many({"patient_id": patient_id, "control_type": {"$in": legacy_keys}})
    await db.patient_controls.update_one(
        {"patient_id": patient_id, "control_type": control_type},
        {"$set": {
            "patient_id": patient_id,
            "control_type": control_type,
            "completed_date": completed_date,
            "completed_by": user_name,
            "completed_by_id": user.get("user_id"),
            "notes": data.notes,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    return {"message": "Control marked as completed"}

@router.delete("/patients/{patient_id}/complete/{control_type}")
async def unmark_control_complete(
    patient_id: str, 
    control_type: str,
    user: dict = Depends(get_auth)
):
    """Remove control completion mark"""
    db = get_db()
    
    if not is_valid_control_type(control_type):
        raise HTTPException(status_code=400, detail="Invalid control type")
    
    normalized = normalize_control_type(control_type)
    keys = [normalized] + [k for k, v in LEGACY_TYPE_MAP.items() if v == normalized]
    await db.patient_controls.delete_many({
        "patient_id": patient_id, 
        "control_type": {"$in": keys}
    })
    
    return {"message": "Control mark removed"}

@router.post("/patients/{patient_id}/no-contact")
async def toggle_no_contact(
    patient_id: str,
    data: NoContactUpdate,
    user: dict = Depends(get_auth)
):
    """Toggle no-contact flag on a patient"""
    db = get_db()
    
    patient = await db.patients.find_one({"id": patient_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    user_data = await db.users.find_one({"id": user.get("user_id")})
    user_name = f"{user_data.get('first_name', '')} {user_data.get('last_name', '')}" if user_data else "Nieznany"
    
    update = {
        "no_contact": data.no_contact,
        "no_contact_note": data.no_contact_note if data.no_contact else None,
        "no_contact_date": datetime.now(timezone.utc).isoformat() if data.no_contact else None,
        "no_contact_by": user_name if data.no_contact else None
    }
    
    await db.patients.update_one({"id": patient_id}, {"$set": update})
    
    return {"message": "Brak kontaktu zaktualizowany", "no_contact": data.no_contact}
