#!/bin/bash
cd /opt/aesthetica-md/deployment
echo "=== BACKEND UPDATE ==="

cat > backend/server.py << 'EOF'
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv
load_dotenv()
from routers.auth import router as auth_router
from routers.patients import router as patients_router
from routers.surgery_slots import router as surgery_slots_router
from routers.settings import router as settings_router
from routers.stats import router as stats_router
from routers.utils import router as utils_router
from routers.calendar import router as calendar_router
from models.database import get_client
app = FastAPI(title="AestheticaMD API", version="2.0.0")
api_router = FastAPI()
api_router.include_router(auth_router)
api_router.include_router(patients_router)
api_router.include_router(surgery_slots_router)
api_router.include_router(settings_router)
api_router.include_router(stats_router)
api_router.include_router(utils_router)
api_router.include_router(calendar_router)
app.mount("/api", api_router)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','), allow_methods=["*"], allow_headers=["*"])
@app.on_event("shutdown")
async def shutdown_db_client():
    get_client().close()
@app.get("/")
async def root():
    return {"message": "AestheticaMD API", "version": "2.0.0"}
EOF
echo "server.py OK"

cat > backend/routers/stats.py << 'EOF'
from fastapi import APIRouter, Depends, Header
from typing import Optional
from datetime import datetime, timezone
from io import BytesIO
import os, openpyxl
from openpyxl.utils import get_column_letter
from fastapi.responses import StreamingResponse
from models.database import get_db
from routers.auth import verify_token
router = APIRouter(tags=["Stats"])
def get_auth(authorization: str = Header(None)):
    return verify_token(authorization)
@router.get("/stats")
async def get_stats(year: Optional[int] = None, user: dict = Depends(get_auth)):
    db = get_db()
    if not year: year = datetime.now(timezone.utc).year
    year_str = str(year)
    total = await db.patients.count_documents({})
    by_status = {"consultation": await db.patients.count_documents({"status": "consultation"}), "planned": await db.patients.count_documents({"status": "planned"}), "awaiting": await db.patients.count_documents({"status": "awaiting"}), "operated": await db.patients.count_documents({"status": "operated"})}
    proc_pipe = [{"$match": {"surgery_date": {"$regex": f"^{year_str}"}, "status": "operated"}}, {"$group": {"_id": {"$substr": ["$surgery_date", 5, 2]}, "count": {"$sum": 1}}}, {"$project": {"_id": 0, "month": "$_id", "count": 1}}]
    procedures_by_month = await db.patients.aggregate(proc_pipe).to_list(12)
    rev_pipe = [{"$match": {"surgery_date": {"$regex": f"^{year_str}"}, "status": "operated", "price": {"$gt": 0}}}, {"$group": {"_id": {"$substr": ["$surgery_date", 5, 2]}, "revenue": {"$sum": "$price"}}}, {"$project": {"_id": 0, "month": "$_id", "revenue": 1}}]
    revenue_by_month = await db.patients.aggregate(rev_pipe).to_list(12)
    locations = await db.locations.find({}, {"_id": 0}).to_list(100)
    location_map = {loc["id"]: loc["name"] for loc in locations}
    loc_pipe = [{"$match": {"status": "operated", "location_id": {"$ne": None}}}, {"$group": {"_id": "$location_id", "count": {"$sum": 1}}}, {"$project": {"_id": 0, "location_id": "$_id", "count": 1}}]
    location_data = await db.patients.aggregate(loc_pipe).to_list(100)
    procedures_by_location = [{"location": location_map.get(item["location_id"], "Nieznana"), "count": item["count"]} for item in location_data]
    return {"total_patients": total, "by_status": by_status, "procedures_by_month": procedures_by_month, "revenue_by_month": revenue_by_month, "procedures_by_location": procedures_by_location}
@router.get("/dashboard")
async def get_dashboard(user: dict = Depends(get_auth)):
    db = get_db()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    upcoming = await db.patients.find({"surgery_date": {"$gte": today}, "status": {"$in": ["planned", "awaiting"]}}, {"_id": 0}).sort("surgery_date", 1).to_list(100)
    recent = await db.patients.find({}, {"_id": 0}).sort("created_at", -1).to_list(5)
    total = await db.patients.count_documents({})
    operated = await db.patients.count_documents({"status": "operated"})
    planned = await db.patients.count_documents({"status": "planned"})
    awaiting = await db.patients.count_documents({"status": "awaiting"})
    consultation = await db.patients.count_documents({"status": "consultation"})
    return {"upcoming_surgeries": upcoming, "recent_patients": recent, "stats": {"total": total, "operated": operated, "planned": planned, "awaiting": awaiting, "consultation": consultation}}
@router.get("/export/patients")
async def export_patients(status: Optional[str] = None, year: Optional[int] = None, user: dict = Depends(get_auth)):
    db = get_db()
    query = {}
    if status: query["status"] = status
    if year: query["surgery_date"] = {"$regex": f"^{year}"}
    patients = await db.patients.find(query, {"_id": 0}).to_list(10000)
    locations = await db.locations.find({}, {"_id": 0}).to_list(100)
    location_map = {loc["id"]: loc["name"] for loc in locations}
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Patients"
    headers = ["First Name", "Last Name", "Email", "Phone", "Status", "Procedure", "Surgery Date", "Location", "Price", "Notes"]
    for col, header in enumerate(headers, 1):
        ws.cell(row=1, column=col, value=header)
        ws.cell(row=1, column=col).font = openpyxl.styles.Font(bold=True)
    for row, patient in enumerate(patients, 2):
        ws.cell(row=row, column=1, value=patient.get("first_name", ""))
        ws.cell(row=row, column=2, value=patient.get("last_name", ""))
        ws.cell(row=row, column=3, value=patient.get("email", ""))
        ws.cell(row=row, column=4, value=patient.get("phone", ""))
        ws.cell(row=row, column=5, value=patient.get("status", ""))
        ws.cell(row=row, column=6, value=patient.get("procedure_type", ""))
        ws.cell(row=row, column=7, value=patient.get("surgery_date", ""))
        ws.cell(row=row, column=8, value=location_map.get(patient.get("location_id"), ""))
        ws.cell(row=row, column=9, value=patient.get("price", ""))
        ws.cell(row=row, column=10, value=patient.get("notes", ""))
    for col in range(1, len(headers) + 1):
        ws.column_dimensions[get_column_letter(col)].width = 15
    output = BytesIO()
    wb.save(output)
    output.seek(0)
    filename = f"patients_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    return StreamingResponse(output, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": f"attachment; filename={filename}"})
@router.get("/calendar/status")
async def calendar_status(user: dict = Depends(get_auth)):
    google_client_id = os.environ.get('GOOGLE_CLIENT_ID')
    return {"configured": bool(google_client_id), "message": "Google Calendar integration ready" if google_client_id else "Not configured"}
@router.get("/stats/waiting-summary")
async def get_waiting_summary(user: dict = Depends(get_auth)):
    db = get_db()
    pipeline = [{"$match": {"status": {"$in": ["consultation", "planned", "awaiting"]}}}, {"$group": {"_id": {"status": "$status", "procedure_type": {"$ifNull": ["$procedure_type", "Nieokreslony"]}}, "count": {"$sum": 1}}}, {"$project": {"_id": 0, "status": "$_id.status", "procedure_type": "$_id.procedure_type", "count": 1}}, {"$sort": {"count": -1}}]
    return await db.patients.aggregate(pipeline).to_list(1000)
EOF
echo "stats.py OK"

cat > backend/routers/settings.py << 'EOF'
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
@router.get("/settings")
async def get_settings(user: dict = Depends(get_auth)):
    db = get_db()
    pt_docs = await db.procedure_types.find({}, {"_id": 0}).to_list(100)
    pt_from_settings = [pt.get("name") for pt in pt_docs if pt.get("name")]
    unique_from_patients = await db.patients.distinct("procedure_type")
    unique_from_patients = [pt for pt in unique_from_patients if pt]
    all_pt = list(set(pt_from_settings + unique_from_patients))
    all_pt.sort()
    return {"procedure_types": all_pt}
@router.get("/locations")
async def get_locations(user: dict = Depends(get_auth)):
    db = get_db()
    return await db.locations.find({}, {"_id": 0}).to_list(100)
@router.post("/locations")
async def create_location(location: LocationCreate, user: dict = Depends(get_auth)):
    db = get_db()
    loc_dict = location.model_dump()
    loc_dict["id"] = str(uuid.uuid4())
    loc_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.locations.insert_one(loc_dict)
    return {"id": loc_dict["id"], "message": "Location created"}
@router.put("/locations/{location_id}")
async def update_location(location_id: str, location: LocationCreate, user: dict = Depends(get_auth)):
    db = get_db()
    result = await db.locations.update_one({"id": location_id}, {"$set": location.model_dump()})
    if result.matched_count == 0: raise HTTPException(status_code=404, detail="Not found")
    return {"message": "Updated"}
@router.delete("/locations/{location_id}")
async def delete_location(location_id: str, user: dict = Depends(get_auth)):
    db = get_db()
    result = await db.locations.delete_one({"id": location_id})
    if result.deleted_count == 0: raise HTTPException(status_code=404, detail="Not found")
    return {"message": "Deleted"}
@router.get("/procedure-types")
async def get_procedure_types(user: dict = Depends(get_auth)):
    db = get_db()
    return await db.procedure_types.find({}, {"_id": 0}).to_list(100)
@router.post("/procedure-types")
async def create_procedure_type(pt: ProcedureTypeCreate, user: dict = Depends(get_auth)):
    db = get_db()
    pt_dict = pt.model_dump()
    pt_dict["id"] = str(uuid.uuid4())
    pt_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.procedure_types.insert_one(pt_dict)
    return {"id": pt_dict["id"], "message": "Created"}
@router.put("/procedure-types/{pt_id}")
async def update_procedure_type(pt_id: str, pt: ProcedureTypeCreate, user: dict = Depends(get_auth)):
    db = get_db()
    result = await db.procedure_types.update_one({"id": pt_id}, {"$set": pt.model_dump()})
    if result.matched_count == 0: raise HTTPException(status_code=404, detail="Not found")
    return {"message": "Updated"}
@router.delete("/procedure-types/{pt_id}")
async def delete_procedure_type(pt_id: str, user: dict = Depends(get_auth)):
    db = get_db()
    result = await db.procedure_types.delete_one({"id": pt_id})
    if result.deleted_count == 0: raise HTTPException(status_code=404, detail="Not found")
    return {"message": "Deleted"}
EOF
echo "settings.py OK"
echo "=== BACKEND DONE ==="
