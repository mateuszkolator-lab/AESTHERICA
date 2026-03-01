from fastapi import APIRouter, Depends, Header
import uuid
import random
from datetime import datetime, timezone, timedelta

from models.database import get_db
from routers.auth import verify_token

router = APIRouter(tags=["Utilities"])

def get_auth(authorization: str = Header(None)):
    return verify_token(authorization)

@router.get("/")
async def root():
    return {"message": "AestheticaMD API", "version": "2.0.0"}

@router.post("/generate-test-patients")
async def generate_test_patients(count: int = 30, user: dict = Depends(get_auth)):
    """Generate test patients for development/testing"""
    db = get_db()
    
    first_names_male = ["Adam", "Piotr", "Jan", "Tomasz", "Krzysztof", "Andrzej", "Michał", "Marcin", "Paweł", "Marek", "Robert", "Jakub", "Łukasz", "Kamil", "Grzegorz"]
    first_names_female = ["Anna", "Maria", "Katarzyna", "Małgorzata", "Agnieszka", "Barbara", "Ewa", "Krystyna", "Elżbieta", "Monika", "Joanna", "Magdalena", "Dorota", "Zofia", "Karolina"]
    last_names = ["Nowak", "Kowalski", "Wiśniewski", "Wójcik", "Kowalczyk", "Kamiński", "Lewandowski", "Zieliński", "Szymański", "Woźniak", "Dąbrowski", "Kozłowski", "Jankowski", "Mazur", "Kwiatkowski", "Krawczyk", "Piotrowski", "Grabowski", "Nowakowski", "Pawłowski"]
    
    procedures = ["Rinoplastyka", "Blefaroplastyka", "Lifting twarzy", "Otoplastyka", "Liposukcja", "Korekta nosa", "Odmładzanie twarzy"]
    statuses = ["consultation", "planned", "awaiting", "operated"]
    
    # Get locations
    locations = await db.locations.find({}, {"_id": 0}).to_list(10)
    location_ids = [loc["id"] for loc in locations] if locations else []
    
    created_patients = []
    
    for i in range(count):
        is_female = random.random() > 0.5
        first_name = random.choice(first_names_female if is_female else first_names_male)
        last_name = random.choice(last_names)
        
        # Generate random dates
        today = datetime.now(timezone.utc)
        birth_year = random.randint(1955, 2000)
        birth_month = random.randint(1, 12)
        birth_day = random.randint(1, 28)
        dob = f"{birth_year}-{birth_month:02d}-{birth_day:02d}"
        
        # Status distribution: more consultations and awaiting
        status = random.choices(statuses, weights=[35, 25, 30, 10])[0]
        
        # Surgery date for planned/operated
        surgery_date = None
        if status in ["planned", "operated"]:
            surgery_offset = random.randint(-30 if status == "operated" else 1, 90)
            surgery_dt = today + timedelta(days=surgery_offset)
            surgery_date = surgery_dt.strftime("%Y-%m-%d")
        
        # Preferred dates
        pref_start = None
        pref_end = None
        if status in ["consultation", "awaiting"]:
            pref_offset = random.randint(7, 60)
            pref_start_dt = today + timedelta(days=pref_offset)
            pref_end_dt = pref_start_dt + timedelta(days=random.randint(14, 60))
            pref_start = pref_start_dt.strftime("%Y-%m-%d")
            pref_end = pref_end_dt.strftime("%Y-%m-%d")
        
        # ASAP flag - more common for awaiting patients
        asap = False
        if status == "awaiting":
            asap = random.random() > 0.4  # 60% chance
        elif status == "planned":
            asap = random.random() > 0.7  # 30% chance
        elif status == "consultation":
            asap = random.random() > 0.85  # 15% chance
        
        patient_data = {
            "id": str(uuid.uuid4()),
            "first_name": first_name,
            "last_name": last_name,
            "email": f"{first_name.lower()}.{last_name.lower()}@example.com",
            "phone": f"+48 {random.randint(500, 799)} {random.randint(100, 999)} {random.randint(100, 999)}",
            "date_of_birth": dob,
            "gender": "female" if is_female else "male",
            "status": status,
            "procedure_type": random.choice(procedures),
            "preferred_date_start": pref_start,
            "preferred_date_end": pref_end,
            "surgery_date": surgery_date,
            "location_id": random.choice(location_ids) if location_ids and random.random() > 0.3 else None,
            "price": random.choice([5000, 7500, 10000, 12500, 15000, 20000, None]),
            "notes": random.choice([None, "Pacjent wymaga dodatkowej konsultacji", "Alergia na lateks", "VIP", "Polecony przez innego pacjenta", None, None]),
            "asap": asap,
            "visits": [],
            "google_calendar_event_id": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.patients.insert_one(patient_data)
        created_patients.append({"id": patient_data["id"], "name": f"{first_name} {last_name}", "status": status, "asap": asap})
    
    return {
        "message": f"Utworzono {count} testowych pacjentów",
        "patients": created_patients,
        "asap_count": sum(1 for p in created_patients if p["asap"])
    }
