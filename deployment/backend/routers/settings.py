from fastapi import APIRouter, Depends, HTTPException, Header
from typing import Optional
import uuid
from datetime import datetime, timezone

from models.database import get_db
from models.schemas import LocationCreate, ProcedureTypeCreate
from routers.auth import verify_token

router = APIRouter(tags=["Settings"])

def get_auth(authorization: str = Header(None)):
    return verify_token(authorization)

# Locations
@router.get("/locations")
async def get_locations(user: dict = Depends(get_auth)):
    db = get_db()
    locations = await db.locations.find({}, {"_id": 0}).to_list(100)
    return locations

@router.post("/locations")
async def create_location(location: LocationCreate, user: dict = Depends(get_auth)):
    db = get_db()
    location_dict = location.model_dump()
    location_dict["id"] = str(uuid.uuid4())
    location_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.locations.insert_one(location_dict)
    
    return {"id": location_dict["id"], "message": "Location created successfully"}

@router.put("/locations/{location_id}")
async def update_location(location_id: str, location: LocationCreate, user: dict = Depends(get_auth)):
    db = get_db()
    result = await db.locations.update_one({"id": location_id}, {"$set": location.model_dump()})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Location not found")
    return {"message": "Location updated successfully"}

@router.delete("/locations/{location_id}")
async def delete_location(location_id: str, user: dict = Depends(get_auth)):
    db = get_db()
    result = await db.locations.delete_one({"id": location_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Location not found")
    return {"message": "Location deleted successfully"}

# Procedure Types
@router.get("/procedure-types")
async def get_procedure_types(user: dict = Depends(get_auth)):
    db = get_db()
    procedure_types = await db.procedure_types.find({}, {"_id": 0}).to_list(100)
    return procedure_types

@router.post("/procedure-types")
async def create_procedure_type(procedure_type: ProcedureTypeCreate, user: dict = Depends(get_auth)):
    db = get_db()
    pt_dict = procedure_type.model_dump()
    pt_dict["id"] = str(uuid.uuid4())
    pt_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.procedure_types.insert_one(pt_dict)
    
    return {"id": pt_dict["id"], "message": "Procedure type created successfully"}

@router.put("/procedure-types/{procedure_type_id}")
async def update_procedure_type(procedure_type_id: str, procedure_type: ProcedureTypeCreate, user: dict = Depends(get_auth)):
    db = get_db()
    result = await db.procedure_types.update_one({"id": procedure_type_id}, {"$set": procedure_type.model_dump()})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Procedure type not found")
    return {"message": "Procedure type updated successfully"}

@router.delete("/procedure-types/{procedure_type_id}")
async def delete_procedure_type(procedure_type_id: str, user: dict = Depends(get_auth)):
    db = get_db()
    result = await db.procedure_types.delete_one({"id": procedure_type_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Procedure type not found")
    return {"message": "Procedure type deleted successfully"}
