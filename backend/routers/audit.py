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
    user_data = await db.users.find_one({"id": user.get("user_id")}) if user.get("user_id") else None
    user_name = user.get("user_name") or (f"{user_data.get('first_name', '')} {user_data.get('last_name', '')}" if user_data else "Nieznany")
    
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


def _classify_date_change(entry: dict) -> str:
    ch = (entry.get("changes") or {}).get("Data zabiegu") or {}
    details = (entry.get("details") or "").lower()
    status_new = ((entry.get("changes") or {}).get("Status") or {}).get("new")
    if status_new == "cancelled" or "zrezygnował" in details:
        return "cancelled"
    if "google" in details:
        return "google"
    if "nie odbył" in details:
        return "not_performed"
    if ch.get("old") and ch.get("new"):
        return "moved"
    if ch.get("new"):
        return "assigned"
    return "removed"

async def _enrich_date_entries(db, entries: list) -> list:
    pids = list({e["patient_id"] for e in entries})
    patients = {p["id"]: p for p in await db.patients.find({"id": {"$in": pids}}, {"_id": 0, "id": 1, "first_name": 1, "last_name": 1, "status": 1, "procedure_type": 1, "cancellation_reason": 1}).to_list(5000)}
    out = []
    for e in entries:
        p = patients.get(e["patient_id"])
        ch = (e.get("changes") or {}).get("Data zabiegu") or {}
        out.append({
            "id": e["id"], "patient_id": e["patient_id"],
            "patient_name": f"{p['last_name']} {p['first_name']}" if p else "(pacjent usunięty)",
            "patient_status": (p or {}).get("status"), "procedure_type": (p or {}).get("procedure_type"),
            "cancellation_reason": (p or {}).get("cancellation_reason"),
            "old_date": ch.get("old"), "new_date": ch.get("new"),
            "kind": _classify_date_change(e), "user_name": e.get("user_name"),
            "timestamp": e.get("timestamp"), "details": e.get("details")
        })
    return out

@router.get("/date/{date}")
async def get_date_history(date: str, user: dict = Depends(get_auth)):
    """Who assigned / moved / removed which patient for a given surgery date."""
    db = get_db()
    entries = await db.audit_log.find(
        {"$or": [{"changes.Data zabiegu.old": date}, {"changes.Data zabiegu.new": date}]},
        {"_id": 0}
    ).sort("timestamp", -1).to_list(500)
    enriched = await _enrich_date_entries(db, entries)
    if not user.get("global_access"):
        allowed = set(await db.patients.distinct("id", {"location_id": {"$in": user.get("location_ids") or []}}))
        enriched = [e for e in enriched if e["patient_id"] in allowed]
    return enriched

@router.get("/date-changes/recent")
async def get_recent_date_changes(days: int = 14, limit: int = 50, user: dict = Depends(get_auth)):
    """Recent removals / cancellations / moves of surgery dates (dashboard feed)."""
    from datetime import timedelta
    db = get_db()
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    entries = await db.audit_log.find(
        {"timestamp": {"$gte": since}, "changes.Data zabiegu": {"$exists": True}},
        {"_id": 0}
    ).sort("timestamp", -1).to_list(limit * 3)
    enriched = await _enrich_date_entries(db, entries)
    loc_filter = user.get("location_ids") if not user.get("global_access") else None
    if loc_filter is not None:
        allowed = set(await db.patients.distinct("id", {"location_id": {"$in": loc_filter}}))
        enriched = [e for e in enriched if e["patient_id"] in allowed]
    return enriched[:limit]
