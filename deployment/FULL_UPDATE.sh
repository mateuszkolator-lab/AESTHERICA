#!/bin/bash
# ============================================
# KOMPLETNA AKTUALIZACJA AestheticaMD
# Data: 10.03.2026
# ============================================
# INSTRUKCJA:
# 1. Pobierz ten plik na serwer:
#    scp update.sh ubuntu@aestheticamd.ovh:/tmp/
#    lub wget/curl
# 2. Uruchom:
#    cd /opt/aesthetica-md/deployment
#    bash /tmp/FULL_UPDATE.sh
# ============================================

set -e
cd /opt/aesthetica-md/deployment

echo "============================================"
echo " AKTUALIZACJA AestheticaMD - 10.03.2026"
echo "============================================"
echo ""

echo "[1/5] Zatrzymuję kontenery..."
docker-compose down

echo ""
echo "[2/5] Aktualizuję backend..."
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
echo "[3/5] Aktualizuję frontend - constants.js..."
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
echo "[4/5] Aktualizuję frontend - strony JSX..."


echo "=== Aktualizuję CalendarPage.jsx ==="
cat > frontend/src/pages/CalendarPage.jsx << 'CALENDAREOF'
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { 
  Calendar, ChevronLeft, ChevronRight, User, MapPin, 
  Phone, X, Sparkles
} from "lucide-react";
import api from "../utils/api";
import { 
  STATUS_LABELS, getStatusColorBg, getLocationColor, 
  getDaysInMonth, DAY_NAMES, formatDateLocal
} from "../utils/constants";

const CalendarPage = () => {
  const [calendarData, setCalendarData] = useState(null);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [draggedPatient, setDraggedPatient] = useState(null);
  const [showUnassigned, setShowUnassigned] = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [calRes, patientsRes] = await Promise.all([
        api.get("/surgery-slots/calendar-data"),
        api.get("/patients")
      ]);
      setCalendarData(calRes.data);
      setPatients(patientsRes.data.filter(p => p.surgery_date));
    } catch (err) {
      toast.error("Nie udało się załadować kalendarza");
    } finally {
      setLoading(false);
    }
  };

  const getPatientsByDate = (date) => {
    if (!date) return [];
    const dateStr = formatDateLocal(date);
    return patients.filter(p => p.surgery_date === dateStr);
  };

  const getSlotByDate = (date) => {
    if (!date || !calendarData?.slots) return null;
    const dateStr = formatDateLocal(date);
    return calendarData.slots.find(s => s.date === dateStr);
  };

  const handleDragStart = (e, patient) => {
    setDraggedPatient(patient);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e, date) => {
    e.preventDefault();
    if (!draggedPatient || !date) return;

    const dateStr = formatDateLocal(date);
    const targetSlot = calendarData?.slots?.find(s => s.date === dateStr);

    if (targetSlot?.is_full) {
      toast.error("Ten termin jest oznaczony jako pełny");
      setDraggedPatient(null);
      return;
    }

    if (draggedPatient.surgery_date === dateStr) {
      setDraggedPatient(null);
      return;
    }

    try {
      if (draggedPatient.surgery_date) {
        const previousSlot = calendarData?.slots?.find(s => s.date === draggedPatient.surgery_date && s.assigned_patient_id === draggedPatient.id);
        if (previousSlot) {
          await api.post(`/surgery-slots/${previousSlot.id}/unassign`);
        }
      }

      if (targetSlot) {
        await api.post(`/surgery-slots/${targetSlot.id}/assign/${draggedPatient.id}`);
      } else {
        const newSlot = await api.post("/surgery-slots", { date: dateStr });
        await api.post(`/surgery-slots/${newSlot.data.id}/assign/${draggedPatient.id}`);
      }
      toast.success(`Pacjent przeniesiony na ${dateStr}`);
      loadData();
    } catch (err) {
      toast.error("Nie udało się przenieść pacjenta");
    }
    setDraggedPatient(null);
  };

  // Sortuj pacjentów bez terminu: ASAP najpierw, potem wg preferowanej daty
  const sortedUnassignedPatients = useMemo(() => {
    const patients = calendarData?.unassigned_patients || [];
    return [...patients].sort((a, b) => {
      // ASAP na górze
      if (a.asap && !b.asap) return -1;
      if (!a.asap && b.asap) return 1;
      
      // Potem wg preferowanej daty (najbliższa pierwsza)
      const dateA = a.preferred_date_start || "9999-99-99";
      const dateB = b.preferred_date_start || "9999-99-99";
      return dateA.localeCompare(dateB);
    });
  }, [calendarData?.unassigned_patients]);

  const days = getDaysInMonth(currentMonth);
  const monthName = currentMonth.toLocaleString("pl-PL", { month: "long", year: "numeric" });

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-700" /></div>;

  return (
    <div className="p-8" data-testid="calendar-page">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Unassigned Patients Panel */}
        {showUnassigned && (
          <div className="lg:w-80 bg-white rounded-xl border border-slate-200 h-fit lg:sticky lg:top-8">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Pacjenci bez terminu</h3>
              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-medium rounded-full">
                {calendarData?.unassigned_patients?.length || 0}
              </span>
            </div>
            <div className="p-3 max-h-[600px] overflow-y-auto">
              {sortedUnassignedPatients.length > 0 ? (
                <div className="space-y-2">
                  {sortedUnassignedPatients.map((patient) => (
                    <div
                      key={patient.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, patient)}
                      className="p-3 bg-slate-50 rounded-lg cursor-grab active:cursor-grabbing hover:bg-slate-100 transition-colors border border-slate-200"
                      data-testid={`draggable-patient-${patient.id}`}
                    >
                      <div className="flex items-center gap-2">
                        {patient.asap && (
                          <Sparkles className="w-4 h-4 text-amber-500" title="Jak najszybciej" />
                        )}
                        <User className="w-4 h-4 text-slate-400" />
                        <span className="font-medium text-slate-900 text-sm">{patient.first_name} {patient.last_name}</span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {patient.procedure_type || "Zabieg nieokreślony"}
                      </div>
                      {(patient.preferred_date_start || patient.preferred_date_end) && (
                        <div className="mt-1 text-xs text-teal-600">
                          Pref: {patient.preferred_date_start || "?"} - {patient.preferred_date_end || "?"}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 text-sm text-center py-4">Wszyscy pacjenci mają przypisane terminy</p>
              )}
            </div>
            <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-500">
              Przeciągnij pacjenta na dzień w kalendarzu. Możesz też przenosić zaplanowanych pacjentów.
            </div>
          </div>
        )}

        {/* Calendar */}
        <div className="flex-1">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>Kalendarz operacji</h1>
              <p className="text-slate-500 mt-1">Przeciągnij pacjentów na wybrane daty</p>
            </div>
            <button
              onClick={() => setShowUnassigned(!showUnassigned)}
              className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 font-medium text-sm"
            >
              {showUnassigned ? "Ukryj panel" : "Pokaż pacjentów"}
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <button
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                className="p-2 hover:bg-slate-100 rounded-lg"
                data-testid="prev-month"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h2 className="text-xl font-semibold text-slate-900 capitalize">{monthName}</h2>
              <button
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                className="p-2 hover:bg-slate-100 rounded-lg"
                data-testid="next-month"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-7 gap-2 mb-2">
                {DAY_NAMES.map((day) => (
                  <div key={day} className="text-center text-sm font-semibold text-slate-500 py-2">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2">
                {days.map((day, i) => {
                  const dayPatients = getPatientsByDate(day);
                  const slot = getSlotByDate(day);
                  const isToday = day && day.toDateString() === new Date().toDateString();
                  const isFull = slot?.is_full;
                  const hasSlot = !!slot;
                  
                  return (
                    <div
                      key={i}
                      onDragOver={day ? handleDragOver : undefined}
                      onDrop={day ? (e) => handleDrop(e, day) : undefined}
                      className={`min-h-[100px] p-2 rounded-lg border-2 transition-colors overflow-hidden ${
                        !day 
                          ? "border-transparent" 
                          : isFull 
                            ? "border-red-400 bg-red-100" 
                            : dayPatients.length > 0
                              ? "border-emerald-400 bg-emerald-50 hover:bg-emerald-100"
                              : hasSlot 
                                ? "border-amber-400 bg-amber-50 hover:bg-amber-100" 
                                : isToday 
                                  ? "border-teal-400 bg-teal-50" 
                                  : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                      } ${draggedPatient && day && !isFull ? "ring-2 ring-teal-400 ring-opacity-70" : ""} ${hasSlot && slot.location_name ? `border-l-4 ${getLocationColor(slot.location_name)?.border}` : ""}`}
                    >
                      {day && (
                        <>
                          <div 
                            className="flex items-center justify-between cursor-pointer"
                            onClick={() => (dayPatients.length > 0 || hasSlot) && setSelectedDay(day)}
                          >
                            <div className="flex items-center gap-1.5">
                              <p className={`text-sm font-medium ${isToday ? "text-teal-700" : "text-slate-600"}`}>
                                {day.getDate()}
                              </p>
                              {hasSlot && slot.location_name && (
                                <div 
                                  className={`w-2.5 h-2.5 rounded-full ${getLocationColor(slot.location_name)?.dot}`}
                                  title={slot.location_name}
                                />
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              {isFull && (
                                <span className="px-1.5 py-0.5 bg-red-200 text-red-800 text-[10px] font-medium rounded">
                                  Pełny
                                </span>
                              )}
                              {hasSlot && !isFull && !slot.assigned_patient_id && (
                                <span className="px-1.5 py-0.5 bg-teal-200 text-teal-800 text-[10px] font-medium rounded">
                                  Termin
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="mt-1 space-y-1">
                            {dayPatients.slice(0, 3).map((patient) => (
                              <div
                                key={patient.id}
                                draggable
                                onDragStart={(e) => {
                                  e.stopPropagation();
                                  handleDragStart(e, patient);
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/patients/${patient.id}`);
                                }}
                                className={`px-2 py-1 rounded text-xs text-white cursor-grab active:cursor-grabbing truncate shadow-sm hover:shadow-md transition-shadow ${getStatusColorBg(patient.status)}`}
                                title={`${patient.first_name} ${patient.last_name} - przeciągnij aby zmienić datę`}
                                data-testid={`calendar-event-${patient.id}`}
                              >
                                {patient.first_name} {patient.last_name[0]}.
                              </div>
                            ))}
                            {dayPatients.length > 3 && (
                              <p className="text-xs text-slate-500">+{dayPatients.length - 3} więcej</p>
                            )}
                            {(dayPatients.length > 0 || hasSlot) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedDay(day);
                                }}
                                className="w-full text-[10px] text-teal-600 hover:text-teal-700 font-medium mt-1 pt-1 border-t border-slate-200/50"
                              >
                                Szczegóły
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-slate-600 bg-white p-4 rounded-lg border border-slate-200">
            <span className="font-medium text-slate-700">Legenda:</span>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border-2 border-amber-400 bg-amber-50" />
              <span>Wolny termin</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border-2 border-emerald-400 bg-emerald-50" />
              <span>Z pacjentem</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border-2 border-red-400 bg-red-100" />
              <span>Pełny/Niedostępny</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-blue-600" />
              <span>Zaplanowany</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-emerald-600" />
              <span>Zoperowany</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-sm border-l-4 border-l-orange-500 bg-slate-100" />
              <span>Lokalizacja</span>
            </div>
          </div>
          
          <p className="mt-3 text-sm text-slate-500 text-center">
            Kliknij na dzień z pacjentami lub terminem, aby zobaczyć szczegóły
          </p>
        </div>
      </div>
      
      {/* Day Detail Modal */}
      {selectedDay && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedDay(null)}>
          <div 
            className="bg-white rounded-xl max-w-lg w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center sticky top-0 bg-white">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {selectedDay.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </h2>
                {(() => {
                  const slot = getSlotByDate(selectedDay);
                  return slot && (
                    <div className="flex items-center gap-2 mt-1">
                      {slot.is_full && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded">Pełny</span>
                      )}
                      {slot.location_name && (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-medium rounded flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {slot.location_name}
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>
              <button onClick={() => setSelectedDay(null)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              {(() => {
                const dayPatients = getPatientsByDate(selectedDay);
                const slot = getSlotByDate(selectedDay);
                
                if (dayPatients.length === 0 && slot) {
                  return (
                    <div className="text-center py-8">
                      <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-500">Brak umówionych pacjentów</p>
                      <p className="text-sm text-slate-400 mt-1">Ten termin jest dostępny do rezerwacji</p>
                    </div>
                  );
                }
                
                return (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
                      Umówieni pacjenci ({dayPatients.length})
                    </h3>
                    {dayPatients.map((patient) => (
                      <div 
                        key={patient.id}
                        className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
                        onClick={() => navigate(`/patients/${patient.id}`)}
                      >
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${getStatusColorBg(patient.status)}`}>
                          <User className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-900">{patient.first_name} {patient.last_name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                              {patient.procedure_type || "Zabieg nieokreślony"}
                            </span>
                            <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                              patient.status === 'planned' ? 'bg-blue-100 text-blue-800' :
                              patient.status === 'operated' ? 'bg-emerald-100 text-emerald-800' :
                              'bg-slate-100 text-slate-800'
                            }`}>
                              {STATUS_LABELS[patient.status] || patient.status}
                            </span>
                          </div>
                          {patient.phone && (
                            <p className="text-sm text-slate-500 mt-1 flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {patient.phone}
                            </p>
                          )}
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-400" />
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
            
            <div className="px-6 py-4 border-t border-slate-200 flex gap-3">
              <button
                onClick={() => setSelectedDay(null)}
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg hover:bg-slate-50 font-medium"
              >
                Zamknij
              </button>
              <button
                onClick={() => navigate('/planning')}
                className="flex-1 px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg font-medium"
              >
                Zarządzaj terminami
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarPage;

CALENDAREOF
echo "  - CalendarPage.jsx OK"

echo "=== Aktualizuję PatientsList.jsx ==="
cat > frontend/src/pages/PatientsList.jsx << 'PATIENTSEOF'
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { 
  Users, Search, Filter, Plus, ChevronRight, 
  X, Eye, Trash2, User, Sparkles, MapPin 
} from "lucide-react";
import api from "../utils/api";
import { STATUS_LABELS, getStatusColor, STATUS_OPTIONS } from "../utils/constants";
import AddPatientModal from "../components/modals/AddPatientModal";

const PatientsList = () => {
  const [patients, setPatients] = useState([]);
  const [locations, setLocations] = useState([]);
  const [procedureTypes, setProcedureTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilters, setStatusFilters] = useState([]);
  const [procedureFilters, setProcedureFilters] = useState([]);
  const [locationFilter, setLocationFilter] = useState("");
  const [asapFilter, setAsapFilter] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showProcedureDropdown, setShowProcedureDropdown] = useState(false);
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");
  const [showAddModal, setShowAddModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, [sortBy, sortOrder]);

  const loadData = async () => {
    try {
      const params = new URLSearchParams();
      params.append("sort_by", sortBy);
      params.append("sort_order", sortOrder);
      
      const [patientsRes, locationsRes, settingsRes] = await Promise.all([
        api.get(`/patients?${params.toString()}`),
        api.get("/locations"),
        api.get("/settings")
      ]);
      setPatients(patientsRes.data);
      setLocations(locationsRes.data);
      setProcedureTypes(settingsRes.data?.procedure_types || []);
    } catch (err) {
      toast.error("Nie udało się załadować pacjentów");
    } finally {
      setLoading(false);
    }
  };

  const toggleStatusFilter = (status) => {
    if (statusFilters.includes(status)) {
      setStatusFilters(statusFilters.filter(s => s !== status));
    } else {
      setStatusFilters([...statusFilters, status]);
    }
  };

  const toggleProcedureFilter = (procedure) => {
    if (procedureFilters.includes(procedure)) {
      setProcedureFilters(procedureFilters.filter(p => p !== procedure));
    } else {
      setProcedureFilters([...procedureFilters, procedure]);
    }
  };

  const clearStatusFilters = () => {
    setStatusFilters([]);
  };

  const clearProcedureFilters = () => {
    setProcedureFilters([]);
  };

  const filteredPatients = patients.filter((p) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = (
      p.first_name.toLowerCase().includes(query) ||
      p.last_name.toLowerCase().includes(query) ||
      (p.email && p.email.toLowerCase().includes(query)) ||
      (p.phone && p.phone.includes(query))
    );
    const matchesStatus = statusFilters.length === 0 || statusFilters.includes(p.status);
    const matchesProcedure = procedureFilters.length === 0 || procedureFilters.includes(p.procedure_type);
    const matchesLocation = !locationFilter || p.location_id === locationFilter;
    const matchesAsap = !asapFilter || p.asap === true;
    return matchesSearch && matchesStatus && matchesProcedure && matchesLocation && matchesAsap;
  });

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Czy na pewno chcesz usunąć tego pacjenta?")) return;
    try {
      await api.delete(`/patients/${id}`);
      toast.success("Pacjent usunięty");
      loadData();
    } catch (err) {
      toast.error("Nie udało się usunąć pacjenta");
    }
  };

  return (
    <div className="p-8" data-testid="patients-page">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>Pacjenci</h1>
          <p className="text-slate-500 mt-1">{patients.length} pacjentów łącznie</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-teal-700 hover:bg-teal-800 text-white px-4 py-2.5 rounded-lg font-medium transition-colors"
          data-testid="add-patient-button"
        >
          <Plus className="w-5 h-5" />
          Dodaj pacjenta
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Szukaj pacjentów..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              data-testid="search-input"
            />
          </div>
          
          <div className="relative">
            <button
              onClick={() => setShowStatusDropdown(!showStatusDropdown)}
              className="px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white flex items-center gap-2 min-w-[180px]"
              data-testid="status-filter-button"
            >
              <Filter className="w-4 h-4 text-slate-500" />
              <span className="text-slate-700">
                {statusFilters.length === 0 ? "Wszystkie statusy" : `Wybrano: ${statusFilters.length}`}
              </span>
              <ChevronRight className={`w-4 h-4 text-slate-400 ml-auto transition-transform ${showStatusDropdown ? 'rotate-90' : ''}`} />
            </button>
            
            {showStatusDropdown && (
              <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-slate-200 rounded-lg shadow-lg z-20" data-testid="status-dropdown">
                <div className="p-2 border-b border-slate-100">
                  <button
                    onClick={clearStatusFilters}
                    className="text-sm text-teal-600 hover:text-teal-700 font-medium"
                  >
                    Wyczyść filtry
                  </button>
                </div>
                <div className="p-2 space-y-1">
                  {STATUS_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 rounded-lg cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={statusFilters.includes(option.value)}
                        onChange={() => toggleStatusFilter(option.value)}
                        className="w-4 h-4 text-teal-600 border-slate-300 rounded focus:ring-teal-500"
                        data-testid={`status-checkbox-${option.value}`}
                      />
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusColor(option.value)}`}>
                        {option.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Procedure Type Filter */}
          <div className="relative">
            <button
              onClick={() => { setShowProcedureDropdown(!showProcedureDropdown); setShowStatusDropdown(false); }}
              className="px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white flex items-center gap-2 min-w-[180px]"
              data-testid="procedure-filter-button"
            >
              <Filter className="w-4 h-4 text-blue-500" />
              <span className="text-slate-700">
                {procedureFilters.length === 0 ? "Wszystkie zabiegi" : `Zabiegi: ${procedureFilters.length}`}
              </span>
              <ChevronRight className={`w-4 h-4 text-slate-400 ml-auto transition-transform ${showProcedureDropdown ? 'rotate-90' : ''}`} />
            </button>
            
            {showProcedureDropdown && (
              <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-slate-200 rounded-lg shadow-lg z-20" data-testid="procedure-dropdown">
                <div className="p-2 border-b border-slate-100">
                  <button
                    onClick={clearProcedureFilters}
                    className="text-sm text-teal-600 hover:text-teal-700 font-medium"
                  >
                    Wyczyść filtry
                  </button>
                </div>
                <div className="p-2 space-y-1 max-h-64 overflow-y-auto">
                  {procedureTypes.map((procedure) => (
                    <label
                      key={procedure}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 rounded-lg cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={procedureFilters.includes(procedure)}
                        onChange={() => toggleProcedureFilter(procedure)}
                        className="w-4 h-4 text-teal-600 border-slate-300 rounded focus:ring-teal-500"
                        data-testid={`procedure-checkbox-${procedure}`}
                      />
                      <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                        {procedure}
                      </span>
                    </label>
                  ))}
                  {procedureTypes.length === 0 && (
                    <p className="text-sm text-slate-400 px-3 py-2">Brak zdefiniowanych zabiegów</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            data-testid="location-filter"
          >
            <option value="">Wszystkie lokalizacje</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>

          <button
            onClick={() => setAsapFilter(!asapFilter)}
            className={`px-4 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-colors ${
              asapFilter 
                ? "bg-amber-500 text-white" 
                : "border border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
            data-testid="asap-filter"
          >
            <Sparkles className="w-4 h-4" />
            Jak najszybciej
          </button>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            data-testid="sort-by"
          >
            <option value="created_at">Data dodania</option>
            <option value="surgery_date">Data operacji</option>
            <option value="preferred_date_start">Preferowana data</option>
            <option value="last_name">Nazwisko</option>
            <option value="location_id">Lokalizacja</option>
            <option value="asap">Jak najszybciej</option>
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            className="px-4 py-2.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            data-testid="sort-order"
          >
            {sortOrder === "asc" ? "Rosnąco" : "Malejąco"}
          </button>
        </div>

        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2 flex-wrap">
            {statusFilters.map((status) => (
              <span
                key={status}
                className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full ${getStatusColor(status)}`}
              >
                {STATUS_LABELS[status]}
                <button onClick={() => toggleStatusFilter(status)} className="ml-1 hover:opacity-70">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {procedureFilters.map((procedure) => (
              <span
                key={procedure}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800"
              >
                {procedure}
                <button onClick={() => toggleProcedureFilter(procedure)} className="ml-1 hover:opacity-70">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {locationFilter && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">
                <MapPin className="w-3 h-3" />
                {locations.find(l => l.id === locationFilter)?.name || "Lokalizacja"}
                <button onClick={() => setLocationFilter("")} className="ml-1 hover:opacity-70">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {asapFilter && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800">
                <Sparkles className="w-3 h-3" />
                Jak najszybciej
                <button onClick={() => setAsapFilter(false)} className="ml-1 hover:opacity-70">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {(statusFilters.length > 0 || procedureFilters.length > 0 || locationFilter || asapFilter) && (
              <button
                onClick={() => { clearStatusFilters(); clearProcedureFilters(); setLocationFilter(""); setAsapFilter(false); }}
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                Wyczyść wszystko
              </button>
            )}
          </div>
          <div className="text-sm font-medium text-slate-600" data-testid="results-counter">
            Wyświetlono: <span className="text-teal-700">{filteredPatients.length}</span> z {patients.length}
          </div>
        </div>
      </div>

      {(showStatusDropdown || showProcedureDropdown) && (
        <div className="fixed inset-0 z-10" onClick={() => { setShowStatusDropdown(false); setShowProcedureDropdown(false); }} />
      )}

      {/* Patients Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-700" /></div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">Pacjent</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">Kontakt</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">Preferowana data</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">Data operacji</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">Zabieg</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-slate-600">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPatients.map((patient) => (
                  <tr 
                    key={patient.id} 
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/patients/${patient.id}`)}
                    data-testid={`patient-row-${patient.id}`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center">
                          <User className="w-5 h-5 text-teal-600" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{patient.first_name} {patient.last_name}</p>
                          {patient.date_of_birth && <p className="text-sm text-slate-500">Ur.: {patient.date_of_birth}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        {patient.email && <p className="text-slate-600">{patient.email}</p>}
                        {patient.phone && <p className="text-slate-500">{patient.phone}</p>}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-full ${getStatusColor(patient.status)}`}>
                          {STATUS_LABELS[patient.status] || patient.status}
                        </span>
                        {patient.asap && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-700" title="Jak najszybciej">
                            <Sparkles className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {patient.preferred_date_start || patient.preferred_date_end ? (
                        <div className="text-sm">
                          <p className="text-slate-600">{patient.preferred_date_start || "?"}</p>
                          <p className="text-slate-400">do {patient.preferred_date_end || "?"}</p>
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {patient.surgery_date || "-"}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {patient.procedure_type || "-"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/patients/${patient.id}`); }}
                          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                          data-testid={`view-${patient.id}`}
                        >
                          <Eye className="w-4 h-4 text-slate-600" />
                        </button>
                        <button
                          onClick={(e) => handleDelete(patient.id, e)}
                          className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                          data-testid={`delete-${patient.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredPatients.length === 0 && (
            <div className="p-12 text-center">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">Nie znaleziono pacjentów</p>
            </div>
          )}
        </div>
      )}

      {showAddModal && <AddPatientModal onClose={() => setShowAddModal(false)} onSuccess={() => { setShowAddModal(false); loadData(); }} />}
    </div>
  );
};

export default PatientsList;

PATIENTSEOF
echo "  - PatientsList.jsx OK"

echo "=== Aktualizuję StatsPage.jsx ==="
cat > frontend/src/pages/StatsPage.jsx << 'STATSEOF'
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Download, ChevronUp, ChevronDown, Users } from "lucide-react";
import api, { API_BASE } from "../utils/api";
import { MONTH_NAMES, STATUS_LABELS, getStatusColor } from "../utils/constants";

const StatsPage = () => {
  const [stats, setStats] = useState(null);
  const [waitingSummary, setWaitingSummary] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: 'count', direction: 'desc' });

  useEffect(() => {
    loadStats();
  }, [year]);

  const loadStats = async () => {
    try {
      const [statsRes, waitingRes] = await Promise.all([
        api.get(`/stats?year=${year}`),
        api.get("/stats/waiting-summary")
      ]);
      setStats(statsRes.data);
      setWaitingSummary(waitingRes.data);
    } catch (err) {
      toast.error("Nie udało się załadować statystyk");
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const sortedWaitingSummary = useMemo(() => {
    const sorted = [...waitingSummary];
    sorted.sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];
      
      if (sortConfig.key === 'status') {
        const order = { consultation: 1, planned: 2, awaiting: 3 };
        aVal = order[aVal] || 99;
        bVal = order[bVal] || 99;
      }
      
      if (typeof aVal === 'string') {
        return sortConfig.direction === 'asc' 
          ? aVal.localeCompare(bVal) 
          : bVal.localeCompare(aVal);
      }
      return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
    });
    return sorted;
  }, [waitingSummary, sortConfig]);

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return null;
    return sortConfig.direction === 'desc' 
      ? <ChevronDown className="w-4 h-4 inline ml-1" /> 
      : <ChevronUp className="w-4 h-4 inline ml-1" />;
  };

  const handleExport = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/export/patients?year=${year}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pacjenci_${year}.xlsx`;
      a.click();
      toast.success("Eksport pobrany");
    } catch (err) {
      toast.error("Nie udało się wyeksportować");
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-700" /></div>;

  const procedureData = MONTH_NAMES.map((month, i) => {
    const monthNum = String(i + 1).padStart(2, "0");
    const found = stats?.procedures_by_month?.find((p) => p.month === monthNum);
    return { month, count: found?.count || 0 };
  });

  const revenueData = MONTH_NAMES.map((month, i) => {
    const monthNum = String(i + 1).padStart(2, "0");
    const found = stats?.revenue_by_month?.find((p) => p.month === monthNum);
    return { month, revenue: found?.revenue || 0 };
  });

  return (
    <div className="p-8" data-testid="statistics-page">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>Statystyki</h1>
          <p className="text-slate-500 mt-1">Przegląd wyników praktyki</p>
        </div>
        <div className="flex gap-3">
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            data-testid="year-select"
          >
            {[2024, 2025, 2026].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 rounded-lg hover:bg-slate-50 font-medium transition-colors"
            data-testid="export-button"
          >
            <Download className="w-4 h-4" />
            Eksport Excel
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <p className="text-sm text-slate-500">Wszyscy pacjenci</p>
          <p className="text-3xl font-semibold text-slate-900 mt-2">{stats?.total_patients || 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <p className="text-sm text-slate-500">Zoperowani</p>
          <p className="text-3xl font-semibold text-emerald-600 mt-2">{stats?.by_status?.operated || 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <p className="text-sm text-slate-500">Zaplanowani</p>
          <p className="text-3xl font-semibold text-blue-600 mt-2">{stats?.by_status?.planned || 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <p className="text-sm text-slate-500">Oczekujący</p>
          <p className="text-3xl font-semibold text-amber-600 mt-2">{stats?.by_status?.awaiting || 0}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-6">Zabiegi wg miesiąca</h3>
          <div className="h-64 flex items-end gap-2">
            {procedureData.map((item, i) => {
              const maxCount = Math.max(...procedureData.map(d => d.count), 1);
              const height = (item.count / maxCount) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center">
                  <div
                    className="w-full bg-teal-500 rounded-t"
                    style={{ height: `${height}%`, minHeight: item.count > 0 ? "8px" : "0" }}
                  />
                  <p className="text-xs text-slate-500 mt-2">{item.month}</p>
                  <p className="text-xs font-medium text-slate-700">{item.count}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-6">Przychód wg miesiąca</h3>
          <div className="h-64 flex items-end gap-2">
            {revenueData.map((item, i) => {
              const maxRevenue = Math.max(...revenueData.map(d => d.revenue), 1);
              const height = (item.revenue / maxRevenue) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center">
                  <div
                    className="w-full bg-emerald-500 rounded-t"
                    style={{ height: `${height}%`, minHeight: item.revenue > 0 ? "8px" : "0" }}
                  />
                  <p className="text-xs text-slate-500 mt-2">{item.month}</p>
                  <p className="text-xs font-medium text-slate-700">{(item.revenue / 1000).toFixed(0)}k</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Procedures by Location */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-6">Zabiegi wg lokalizacji</h3>
        {stats?.procedures_by_location?.length > 0 ? (
          <div className="space-y-4">
            {stats.procedures_by_location.map((item, i) => {
              const maxCount = Math.max(...stats.procedures_by_location.map(l => l.count), 1);
              const width = (item.count / maxCount) * 100;
              return (
                <div key={i}>
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-700">{item.location}</span>
                    <span className="font-medium text-slate-900">{item.count} zabiegów</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3">
                    <div className="bg-teal-500 h-3 rounded-full" style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-slate-500 text-center py-8">Brak danych. Dodaj lokalizacje i wykonaj zabiegi, aby zobaczyć statystyki.</p>
        )}
      </div>

      {/* Waiting Summary Table */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mt-6">
        <div className="flex items-center gap-3 mb-6">
          <Users className="w-6 h-6 text-teal-600" />
          <h3 className="text-lg font-semibold text-slate-900">Podsumowanie oczekujących pacjentów</h3>
        </div>
        
        {sortedWaitingSummary.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="waiting-summary-table">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th 
                    className="px-4 py-3 text-left text-sm font-semibold text-slate-600 cursor-pointer hover:bg-slate-100"
                    onClick={() => handleSort('status')}
                  >
                    Status <SortIcon columnKey="status" />
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-sm font-semibold text-slate-600 cursor-pointer hover:bg-slate-100"
                    onClick={() => handleSort('procedure_type')}
                  >
                    Typ zabiegu <SortIcon columnKey="procedure_type" />
                  </th>
                  <th 
                    className="px-4 py-3 text-right text-sm font-semibold text-slate-600 cursor-pointer hover:bg-slate-100"
                    onClick={() => handleSort('count')}
                  >
                    Liczba pacjentów <SortIcon columnKey="count" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedWaitingSummary.map((item, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-full ${getStatusColor(item.status)}`}>
                        {STATUS_LABELS[item.status] || item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {item.procedure_type}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold text-slate-900">{item.count}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t border-slate-200">
                <tr>
                  <td colSpan="2" className="px-4 py-3 text-sm font-semibold text-slate-700">
                    Łącznie oczekujących
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-bold text-teal-700 text-lg">
                      {sortedWaitingSummary.reduce((sum, item) => sum + item.count, 0)}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <p className="text-slate-500 text-center py-8">Brak pacjentów oczekujących.</p>
        )}
      </div>
    </div>
  );
};

export default StatsPage;

STATSEOF
echo "  - StatsPage.jsx OK"

echo "=== Frontend zaktualizowany ==="

echo ""
echo "[5/5] Przebudowuję i uruchamiam kontenery..."
docker-compose build --no-cache
docker-compose up -d

echo ""
echo "============================================"
echo " AKTUALIZACJA ZAKONCZONA POMYSLNIE!"
echo "============================================"
echo ""
echo "Sprawdź logi: docker-compose logs -f backend"
echo "Sprawdź aplikację: http://aestheticamd.ovh"
echo ""
