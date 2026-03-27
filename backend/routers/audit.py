from fastapi import APIRouter, Depends, Header
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, timezone

from models.database import get_db
from routers.auth import verify_token

router = APIRouter(prefix="/audit", tags=["Audit Log"])

def get_auth(authorization: str = Header(None)):
    return verify_token(authorization)

class AuditLogEntry(BaseModel):
    id: str
    patient_id: str
    action: str  # "create", "update", "delete", "add_visit", "delete_visit", "add_photo", "delete_photo"
    user_id: str
    user_name: str
    timestamp: str
    changes: Optional[dict] = None  # For updates: {"field": {"old": value, "new": value}}
    details: Optional[str] = None

# Helper function to log changes
async def log_patient_change(
    patient_id: str,
    action: str,
    user: dict,
    changes: dict = None,
    details: str = None
):
    """Log a change to patient records"""
    db = get_db()
    
    # Get user name from database
    user_data = await db.users.find_one({"id": user.get("user_id")})
    user_name = f"{user_data.get('first_name', '')} {user_data.get('last_name', '')}" if user_data else "Nieznany"
    
    log_entry = {
        "id": f"audit-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}",
        "patient_id": patient_id,
        "action": action,
        "user_id": user.get("user_id"),
        "user_name": user_name,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "changes": changes,
        "details": details
    }
    
    await db.audit_log.insert_one(log_entry)
    return log_entry

# Get audit log for a patient
@router.get("/patient/{patient_id}", response_model=List[AuditLogEntry])
async def get_patient_audit_log(patient_id: str, limit: int = 50, user: dict = Depends(get_auth)):
    """Get audit log entries for a specific patient"""
    db = get_db()
    
    entries = await db.audit_log.find(
        {"patient_id": patient_id},
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit).to_list(length=limit)
    
    return entries

# Get all recent audit logs (admin only)
@router.get("/recent", response_model=List[AuditLogEntry])
async def get_recent_audit_logs(limit: int = 100, user: dict = Depends(get_auth)):
    """Get recent audit log entries across all patients"""
    db = get_db()
    
    entries = await db.audit_log.find(
        {},
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit).to_list(length=limit)
    
    return entries

# Action labels for display
ACTION_LABELS = {
    "create": "Utworzono pacjenta",
    "update": "Zaktualizowano dane",
    "delete": "Usunięto pacjenta",
    "add_visit": "Dodano wizytę",
    "delete_visit": "Usunięto wizytę",
    "add_photo": "Dodano zdjęcie",
    "delete_photo": "Usunięto zdjęcie",
    "update_photo": "Zaktualizowano zdjęcie",
    "add_rhinoplan": "Utworzono plan operacji",
    "update_rhinoplan": "Zaktualizowano plan operacji",
    "delete_rhinoplan": "Usunięto plan operacji"
}
