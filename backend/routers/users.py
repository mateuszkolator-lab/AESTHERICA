from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime, timezone
import uuid
import hashlib
import os

from models.database import get_db

router = APIRouter(prefix="/users", tags=["Users"])

# Password hashing
def hash_password(password: str) -> str:
    salt = os.environ.get("PASSWORD_SALT", "aesthetica-md-salt-2024")
    return hashlib.sha256(f"{password}{salt}".encode()).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    return hash_password(password) == hashed

# Models
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    role: str = "doctor"
    location_ids: List[str] = []
    global_access: bool = False

class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    location_ids: Optional[List[str]] = None
    global_access: Optional[bool] = None

class UserResponse(BaseModel):
    id: str
    email: str
    first_name: str
    last_name: str
    role: str
    is_active: bool
    location_ids: List[str] = []
    global_access: bool = False
    created_at: str
    last_login: Optional[str] = None

class PasswordReset(BaseModel):
    new_password: str

# Helper to get current user from token
from routers.auth import verify_token

def get_current_user(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Token required")
    return verify_token(authorization)

def require_admin(user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

# Endpoints
@router.get("/", response_model=List[UserResponse])
async def get_users(user: dict = Depends(require_admin)):
    """Get all users (admin only)"""
    db = get_db()
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(length=1000)
    return users

@router.get("/me", response_model=UserResponse)
async def get_current_user_info(user: dict = Depends(get_current_user)):
    """Get current user info"""
    db = get_db()
    db_user = await db.users.find_one({"id": user.get("user_id")}, {"_id": 0, "password_hash": 0})
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user

@router.post("/", response_model=UserResponse)
async def create_user(user_data: UserCreate, admin: dict = Depends(require_admin)):
    """Create new user (admin only)"""
    db = get_db()
    
    # Check if email exists
    existing = await db.users.find_one({"email": user_data.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Validate role
    if user_data.role not in ["admin", "doctor"]:
        raise HTTPException(status_code=400, detail="Invalid role. Must be 'admin' or 'doctor'")
    
    new_user = {
        "id": str(uuid.uuid4()),
        "email": user_data.email.lower(),
        "password_hash": hash_password(user_data.password),
        "first_name": user_data.first_name,
        "last_name": user_data.last_name,
        "role": user_data.role,
        "is_active": True,
        "location_ids": user_data.location_ids,
        "global_access": user_data.global_access,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_login": None
    }
    
    await db.users.insert_one(new_user)
    
    # Return without password_hash and _id
    return {
        "id": new_user["id"],
        "email": new_user["email"],
        "first_name": new_user["first_name"],
        "last_name": new_user["last_name"],
        "role": new_user["role"],
        "is_active": new_user["is_active"],
        "location_ids": new_user["location_ids"],
        "global_access": new_user["global_access"],
        "created_at": new_user["created_at"],
        "last_login": new_user["last_login"]
    }

@router.put("/{user_id}", response_model=UserResponse)
async def update_user(user_id: str, user_data: UserUpdate, admin: dict = Depends(require_admin)):
    """Update user (admin only)"""
    db = get_db()
    
    existing = await db.users.find_one({"id": user_id})
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Build update dict
    update_data = {}
    if user_data.first_name is not None:
        update_data["first_name"] = user_data.first_name
    if user_data.last_name is not None:
        update_data["last_name"] = user_data.last_name
    if user_data.role is not None:
        if user_data.role not in ["admin", "doctor"]:
            raise HTTPException(status_code=400, detail="Invalid role")
        update_data["role"] = user_data.role
    if user_data.is_active is not None:
        update_data["is_active"] = user_data.is_active
    if user_data.location_ids is not None:
        update_data["location_ids"] = user_data.location_ids
    if user_data.global_access is not None:
        update_data["global_access"] = user_data.global_access
    
    if update_data:
        await db.users.update_one({"id": user_id}, {"$set": update_data})
    
    updated = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    return updated

@router.delete("/{user_id}")
async def delete_user(user_id: str, admin: dict = Depends(require_admin)):
    """Delete user (admin only)"""
    db = get_db()
    
    existing = await db.users.find_one({"id": user_id})
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent deleting yourself
    if existing.get("id") == admin.get("user_id"):
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    # Prevent deleting last admin
    if existing.get("role") == "admin":
        admin_count = await db.users.count_documents({"role": "admin"})
        if admin_count <= 1:
            raise HTTPException(status_code=400, detail="Cannot delete the last admin")
    
    await db.users.delete_one({"id": user_id})
    return {"message": "User deleted"}

@router.post("/{user_id}/reset-password")
async def reset_user_password(user_id: str, data: PasswordReset, admin: dict = Depends(require_admin)):
    """Reset user password (admin only)"""
    db = get_db()
    
    existing = await db.users.find_one({"id": user_id})
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")
    
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"password_hash": hash_password(data.new_password)}}
    )
    
    return {"message": "Password reset successfully"}

@router.post("/change-password")
async def change_own_password(data: PasswordReset, user: dict = Depends(get_current_user)):
    """Change own password"""
    db = get_db()
    
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    await db.users.update_one(
        {"id": user.get("user_id")},
        {"$set": {"password_hash": hash_password(data.new_password)}}
    )
    
    return {"message": "Password changed successfully"}
