from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel, EmailStr
import jwt
from datetime import datetime, timezone, timedelta
import os
import hashlib

from models.database import get_db

router = APIRouter(prefix="/auth", tags=["Authentication"])

SECRET_KEY = os.environ.get("JWT_SECRET", "aesthetica-md-secret-2024-secure-key")
ALGORITHM = "HS256"

# Password hashing (same as in users.py)
def hash_password(password: str) -> str:
    salt = os.environ.get("PASSWORD_SALT", "aesthetica-md-salt-2024")
    return hashlib.sha256(f"{password}{salt}".encode()).hexdigest()

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    token: str
    user: dict

def create_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=30)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def verify_token(authorization: str = None):
    if not authorization:
        raise HTTPException(status_code=401, detail="Token required")
    
    try:
        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def get_current_user(authorization: str = Header(None)):
    return verify_token(authorization)

@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest):
    db = get_db()
    
    # Find user by email (async with motor)
    user = await db.users.find_one({"email": request.email.lower()})
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Check password
    if user.get("password_hash") != hash_password(request.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Check if active
    if not user.get("is_active", True):
        raise HTTPException(status_code=401, detail="Account is disabled")
    
    # Update last login
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"last_login": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Create token
    token = create_token({
        "sub": user["email"],
        "user_id": user["id"],
        "role": user["role"],
        "location_ids": user.get("location_ids", []),
        "global_access": user.get("global_access", False)
    })
    
    # Return user info (without password)
    user_info = {
        "id": user["id"],
        "email": user["email"],
        "first_name": user["first_name"],
        "last_name": user["last_name"],
        "role": user["role"],
        "location_ids": user.get("location_ids", []),
        "global_access": user.get("global_access", False)
    }
    
    return {"token": token, "user": user_info}

@router.get("/verify")
async def verify(authorization: str = Header(None)):
    payload = verify_token(authorization)
    
    # Get fresh user data
    db = get_db()
    user = await db.users.find_one({"id": payload.get("user_id")}, {"_id": 0, "password_hash": 0})
    
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    if not user.get("is_active", True):
        raise HTTPException(status_code=401, detail="Account is disabled")
    
    return {"status": "valid", "user": user}

# Initialize default admin - this will be called from server.py
async def init_default_admin():
    db = get_db()
    
    # Check if any users exist (motor is async)
    user_count = await db.users.count_documents({})
    if user_count > 0:
        return
    
    # Create default admin
    default_admin = {
        "id": "admin-001",
        "email": "mateusz.kolator@gmail.com",
        "password_hash": hash_password("Matikolati123!"),
        "first_name": "Mateusz",
        "last_name": "Kolator",
        "role": "admin",
        "is_active": True,
        "location_ids": [],
        "global_access": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_login": None
    }
    
    await db.users.insert_one(default_admin)
    print("✅ Default admin created: mateusz.kolator@gmail.com")



def get_patient_location_filter(user: dict) -> dict:
    """Returns MongoDB query filter for patients based on user's location access.
    Admin and global_access users see everything.
    Others see patients assigned to their locations + unassigned patients."""
    if user.get("role") == "admin" or user.get("global_access"):
        return {}
    location_ids = user.get("location_ids", [])
    if not location_ids:
        return {"location_id": "__impossible__"}
    return {"$or": [
        {"location_id": {"$in": location_ids}},
        {"location_id": None},
        {"location_id": ""}
    ]}

def get_slot_location_filter(user: dict) -> dict:
    """Returns MongoDB query filter for surgery slots based on user's location access."""
    if user.get("role") == "admin" or user.get("global_access"):
        return {}
    location_ids = user.get("location_ids", [])
    if not location_ids:
        return {"location_id": "__impossible__"}
    return {"location_id": {"$in": location_ids}}

async def migrate_users_location_fields():
    """Add location_ids and global_access to existing users that don't have them."""
    db = get_db()
    await db.users.update_many(
        {"location_ids": {"$exists": False}},
        {"$set": {"location_ids": [], "global_access": False}}
    )
    # Ensure admins have global_access
    await db.users.update_many(
        {"role": "admin", "global_access": {"$ne": True}},
        {"$set": {"global_access": True}}
    )
