#!/bin/bash
# Skrypt aktualizacji AestheticaMD - 10.03.2026
# Uruchom: bash update_all.sh

cd /opt/aesthetica-md/deployment

echo "=== Zatrzymuję kontenery ==="
docker-compose down

echo ""
echo "=== Aktualizuję pliki backendu ==="

# 1. server.py
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

app = FastAPI(
    title="AestheticaMD API",
    description="Patient Management System for Facial Plastic Surgery",
    version="2.0.0"
)

api_router = FastAPI()
api_router.include_router(auth_router)
api_router.include_router(patients_router)
api_router.include_router(surgery_slots_router)
api_router.include_router(settings_router)
api_router.include_router(stats_router)
api_router.include_router(utils_router)
api_router.include_router(calendar_router)

app.mount("/api", api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    get_client().close()

@app.get("/")
async def root():
    return {"message": "AestheticaMD API", "version": "2.0.0", "docs": "/api/docs"}
EOF
echo "  - backend/server.py OK"

# 2. stats.py
cat > backend/routers/stats.py << 'EOF'
from fastapi import APIRouter, Depends, Header
from typing import Optional
from datetime import datetime, timezone
from io import BytesIO
import os
import openpyxl
from openpyxl.utils import get_column_letter
from fastapi.responses import StreamingResponse

from models.database import get_db
from routers.auth import verify_token

router = APIRouter(tags=["Stats & Dashboard"])

def get_auth(authorization: str = Header(None)):
    return verify_token(authorization)

@router.get("/stats")
async def get_stats(year: Optional[int] = None, user: dict = Depends(get_auth)):
    db = get_db()
    if not year:
        year = datetime.now(timezone.utc).year
    year_str = str(year)
    total = await db.patients.count_documents({})
    by_status = {
        "consultation": await db.patients.count_documents({"status": "consultation"}),
        "planned": await db.patients.count_documents({"status": "planned"}),
        "awaiting": await db.patients.count_documents({"status": "awaiting"}),
        "operated": await db.patients.count_documents({"status": "operated"})
    }
    procedures_pipeline = [
        {"$match": {"surgery_date": {"$regex": f"^{year_str}"}, "status": "operated"}},
        {"$group": {"_id": {"$substr": ["$surgery_date", 5, 2]}, "count": {"$sum": 1}}},
        {"$project": {"_id": 0, "month": "$_id", "count": 1}}
    ]
    procedures_by_month = await db.patients.aggregate(procedures_pipeline).to_list(12)
    revenue_pipeline = [
        {"$match": {"surgery_date": {"$regex": f"^{year_str}"}, "status": "operated", "price": {"$gt": 0}}},
        {"$group": {"_id": {"$substr": ["$surgery_date", 5, 2]}, "revenue": {"$sum": "$price"}}},
        {"$project": {"_id": 0, "month": "$_id", "revenue": 1}}
    ]
    revenue_by_month = await db.patients.aggregate(revenue_pipeline).to_list(12)
    locations = await db.locations.find({}, {"_id": 0}).to_list(100)
    location_map = {loc["id"]: loc["name"] for loc in locations}
    location_pipeline = [
        {"$match": {"status": "operated", "location_id": {"$ne": None}}},
        {"$group": {"_id": "$location_id", "count": {"$sum": 1}}},
        {"$project": {"_id": 0, "location_id": "$_id", "count": 1}}
    ]
    location_data = await db.patients.aggregate(location_pipeline).to_list(100)
    procedures_by_location = [
        {"location": location_map.get(item["location_id"], "Nieznana"), "count": item["count"]}
        for item in location_data
    ]
    return {
        "total_patients": total,
        "by_status": by_status,
        "procedures_by_month": procedures_by_month,
        "revenue_by_month": revenue_by_month,
        "procedures_by_location": procedures_by_location
    }

@router.get("/dashboard")
async def get_dashboard(user: dict = Depends(get_auth)):
    db = get_db()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    upcoming = await db.patients.find(
        {"surgery_date": {"$gte": today}, "status": {"$in": ["planned", "awaiting"]}},
        {"_id": 0}
    ).sort("surgery_date", 1).to_list(100)
    recent = await db.patients.find({}, {"_id": 0}).sort("created_at", -1).to_list(5)
    total = await db.patients.count_documents({})
    operated = await db.patients.count_documents({"status": "operated"})
    planned = await db.patients.count_documents({"status": "planned"})
    awaiting = await db.patients.count_documents({"status": "awaiting"})
    consultation = await db.patients.count_documents({"status": "consultation"})
    return {
        "upcoming_surgeries": upcoming,
        "recent_patients": recent,
        "stats": {"total": total, "operated": operated, "planned": planned, "awaiting": awaiting, "consultation": consultation}
    }

@router.get("/export/patients")
async def export_patients(status: Optional[str] = None, year: Optional[int] = None, user: dict = Depends(get_auth)):
    db = get_db()
    query = {}
    if status:
        query["status"] = status
    if year:
        query["surgery_date"] = {"$regex": f"^{year}"}
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
    return {"configured": bool(google_client_id), "message": "Google Calendar integration ready" if google_client_id else "Google Calendar not configured."}

@router.get("/stats/waiting-summary")
async def get_waiting_summary(user: dict = Depends(get_auth)):
    db = get_db()
    pipeline = [
        {"$match": {"status": {"$in": ["consultation", "planned", "awaiting"]}}},
        {"$group": {"_id": {"status": "$status", "procedure_type": {"$ifNull": ["$procedure_type", "Nieokreslony"]}}, "count": {"$sum": 1}}},
        {"$project": {"_id": 0, "status": "$_id.status", "procedure_type": "$_id.procedure_type", "count": 1}},
        {"$sort": {"count": -1}}
    ]
    results = await db.patients.aggregate(pipeline).to_list(1000)
    return results
EOF
echo "  - backend/routers/stats.py OK"

# 3. settings.py
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
    procedure_types_docs = await db.procedure_types.find({}, {"_id": 0}).to_list(100)
    procedure_types_from_settings = [pt.get("name") for pt in procedure_types_docs if pt.get("name")]
    unique_from_patients = await db.patients.distinct("procedure_type")
    unique_from_patients = [pt for pt in unique_from_patients if pt]
    all_procedure_types = list(set(procedure_types_from_settings + unique_from_patients))
    all_procedure_types.sort()
    return {"procedure_types": all_procedure_types}

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
EOF
echo "  - backend/routers/settings.py OK"

echo ""
echo "=== Aktualizuję pliki frontendu ==="

# 4. constants.js
cat > frontend/src/utils/constants.js << 'EOF'
export const STATUS_LABELS = {
  consultation: "Konsultacja",
  planned: "Zaplanowany",
  awaiting: "Oczekujacy",
  operated: "Zoperowany"
};

export const VISIT_TYPE_LABELS = {
  consultation: "Konsultacja",
  surgery: "Operacja",
  follow_up: "Wizyta kontrolna",
  "7_days_after": "7 dni po zabiegu",
  "1_month_after": "Miesiac po",
  "3_months_after": "3 miesiace po",
  "6_months_after": "6 miesiecy po",
  "1_year_after": "Rok po",
  photo_upload: "Zdjecia",
  custom: "Inna"
};

export const VISIT_TYPE_OPTIONS = [
  { value: "consultation", label: "Konsultacja" },
  { value: "surgery", label: "Operacja" },
  { value: "7_days_after", label: "7 dni po zabiegu" },
  { value: "1_month_after", label: "Miesiac po" },
  { value: "3_months_after", label: "3 miesiace po" },
  { value: "6_months_after", label: "6 miesiecy po" },
  { value: "1_year_after", label: "Rok po" },
  { value: "follow_up", label: "Wizyta kontrolna" },
  { value: "custom", label: "Inna (wpisz wlasna)" }
];

export const PHOTO_CATEGORY_LABELS = {
  before: "Przed",
  after: "Po",
  during: "W trakcie",
  other: "Inne"
};

export const PHOTO_ANGLE_LABELS = {
  front: "Przod",
  left_profile: "Profil lewy",
  right_profile: "Profil prawy",
  left_oblique: "Skos lewy",
  right_oblique: "Skos prawy",
  base: "Podstawa",
  other: "Inne"
};

export const PHOTO_ANGLE_OPTIONS = [
  { value: "front", label: "Przod" },
  { value: "left_profile", label: "Profil lewy" },
  { value: "right_profile", label: "Profil prawy" },
  { value: "left_oblique", label: "Skos lewy (3/4)" },
  { value: "right_oblique", label: "Skos prawy (3/4)" },
  { value: "base", label: "Podstawa nosa" },
  { value: "other", label: "Inny" }
];

export const STATUS_OPTIONS = [
  { value: "consultation", label: "Konsultacja" },
  { value: "planned", label: "Zaplanowany" },
  { value: "awaiting", label: "Oczekujacy" },
  { value: "operated", label: "Zoperowany" }
];

export const getStatusColor = (status) => {
  const colors = {
    consultation: "bg-slate-100 text-slate-800",
    planned: "bg-blue-100 text-blue-800",
    awaiting: "bg-amber-100 text-amber-800",
    operated: "bg-emerald-100 text-emerald-800"
  };
  return colors[status] || colors.consultation;
};

export const getStatusColorBg = (status) => {
  const colors = {
    planned: "bg-blue-600",
    awaiting: "bg-amber-500",
    operated: "bg-emerald-600"
  };
  return colors[status] || "bg-slate-500";
};

export const getLocationColor = (locationName) => {
  if (!locationName) return null;
  const colorMap = {
    "Pro-Familia": { border: "border-l-orange-500", dot: "bg-orange-500" },
    "Medicus": { border: "border-l-violet-500", dot: "bg-violet-500" },
  };
  for (const [key, value] of Object.entries(colorMap)) {
    if (locationName.includes(key)) return value;
  }
  const colors = [
    { border: "border-l-cyan-500", dot: "bg-cyan-500" },
    { border: "border-l-pink-500", dot: "bg-pink-500" },
    { border: "border-l-lime-500", dot: "bg-lime-500" },
    { border: "border-l-indigo-500", dot: "bg-indigo-500" },
  ];
  const hash = locationName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

export const getProcedureAbbrev = (procedureType) => {
  if (!procedureType) return "?";
  const abbrevMap = {
    "Rinoplastyka": "RIN",
    "Rhinoplasty": "RIN",
    "Blefaroplastyka": "BLE",
    "Lifting": "LIF",
    "Otoplastyka": "OTO",
    "Liposukcja": "LIP"
  };
  return abbrevMap[procedureType] || procedureType.substring(0, 3).toUpperCase();
};

export const getDaysInMonth = (date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDay = firstDay.getDay();
  const days = [];
  for (let i = 0; i < startingDay; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(new Date(year, month, i));
  }
  return days;
};

export const DAY_NAMES = ["Nd", "Pn", "Wt", "Sr", "Cz", "Pt", "So"];
export const MONTH_NAMES = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paz", "Lis", "Gru"];

export const formatDateLocal = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
EOF
echo "  - frontend/src/utils/constants.js OK"

echo ""
echo "=== Przebudowuję kontenery ==="
docker-compose build --no-cache

echo ""
echo "=== Uruchamiam ==="
docker-compose up -d

echo ""
echo "=== GOTOWE! ==="
echo "Sprawdz logi: docker-compose logs -f backend"
