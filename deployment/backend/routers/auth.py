from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import jwt
from datetime import datetime, timezone, timedelta
import os

router = APIRouter(prefix="/auth", tags=["Authentication"])

SECRET_KEY = os.environ.get("JWT_SECRET", "aesthetica-md-secret-2024-secure-key")
ALGORITHM = "HS256"
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "doctor2024")

class LoginRequest(BaseModel):
    password: str

class TokenResponse(BaseModel):
    token: str

def create_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=30)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def verify_token(authorization: str = None):
    if not authorization:
        from fastapi import Header
        raise HTTPException(status_code=401, detail="Token required")
    
    try:
        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest):
    if request.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid password")
    
    token = create_token({"sub": "admin", "role": "admin"})
    return {"token": token}

@router.get("/verify")
async def verify(user: dict = Depends(verify_token)):
    return {"status": "valid", "user": user}
