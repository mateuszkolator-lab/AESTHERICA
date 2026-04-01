from fastapi import APIRouter, Depends, HTTPException, Header
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta

from models.database import get_db
from routers.auth import verify_token

router = APIRouter(prefix="/controls", tags=["Follow-up Controls"])

def get_auth(authorization: str = Header(None)):
    return verify_token(authorization)

# Control intervals in days
CONTROL_INTERVALS = {
    "1_week": 7,
    "1_month": 30,
    "3_months": 90,
    "6_months": 180,
    "1_year": 365
}

CONTROL_LABELS = {
    "1_week": "1 tydzień",
    "1_month": "1 miesiąc",
    "3_months": "3 miesiące",
    "6_months": "6 miesięcy",
    "1_year": "1 rok"
}

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
    
    patients = await db.patients.find(
        {
            "surgery_date": {"$ne": None, "$ne": ""},
            "status": {"$in": ["completed", "po_zabiegu", "zoperowany"]}
        },
        {"_id": 0}
    ).to_list(1000)
    
    # Also include patients with surgery_date in the past regardless of status
    patients_by_date = await db.patients.find(
        {
            "surgery_date": {"$ne": None, "$ne": "", "$lte": today.isoformat()}
        },
        {"_id": 0}
    ).to_list(1000)
    
    # Merge and dedupe
    seen_ids = set()
    all_patients = []
    for p in patients + patients_by_date:
        if p["id"] not in seen_ids:
            seen_ids.add(p["id"])
            all_patients.append(p)
    
    # Get all control records
    control_records = await db.patient_controls.find({}, {"_id": 0}).to_list(5000)
    controls_by_patient = {}
    for cr in control_records:
        pid = cr["patient_id"]
        if pid not in controls_by_patient:
            controls_by_patient[pid] = {}
        controls_by_patient[pid][cr["control_type"]] = cr
    
    result = []
    for patient in all_patients:
        surgery_date_str = patient.get("surgery_date")
        if not surgery_date_str:
            continue
            
        try:
            surgery_date = datetime.fromisoformat(surgery_date_str.replace("Z", "+00:00")).date()
        except:
            try:
                surgery_date = datetime.strptime(surgery_date_str[:10], "%Y-%m-%d").date()
            except:
                continue
        
        # Skip future surgeries
        if surgery_date > today:
            continue
        
        patient_controls = controls_by_patient.get(patient["id"], {})
        
        controls = []
        next_control = None
        
        for ctrl_type, days in CONTROL_INTERVALS.items():
            due_date = surgery_date + timedelta(days=days)
            completed_record = patient_controls.get(ctrl_type)
            
            control_entry = {
                "type": ctrl_type,
                "label": CONTROL_LABELS[ctrl_type],
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
    if data.control_type not in CONTROL_INTERVALS:
        raise HTTPException(status_code=400, detail="Invalid control type")
    
    # Get user name
    user_data = await db.users.find_one({"id": user.get("user_id")})
    user_name = f"{user_data.get('first_name', '')} {user_data.get('last_name', '')}" if user_data else "Nieznany"
    
    completed_date = data.completed_date or datetime.now(timezone.utc).date().isoformat()
    
    # Upsert control record
    await db.patient_controls.update_one(
        {"patient_id": patient_id, "control_type": data.control_type},
        {"$set": {
            "patient_id": patient_id,
            "control_type": data.control_type,
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
    
    if control_type not in CONTROL_INTERVALS:
        raise HTTPException(status_code=400, detail="Invalid control type")
    
    await db.patient_controls.delete_one({
        "patient_id": patient_id, 
        "control_type": control_type
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
