from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class PatientBase(BaseModel):
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    status: str = "consultation"
    procedure_type: Optional[str] = None
    preferred_date_start: Optional[str] = None
    preferred_date_end: Optional[str] = None
    surgery_date: Optional[str] = None
    location_id: Optional[str] = None
    price: Optional[float] = None
    notes: Optional[str] = None
    asap: bool = False

class PatientCreate(PatientBase):
    pass

class PatientUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    status: Optional[str] = None
    procedure_type: Optional[str] = None
    preferred_date_start: Optional[str] = None
    preferred_date_end: Optional[str] = None
    surgery_date: Optional[str] = None
    location_id: Optional[str] = None
    price: Optional[float] = None
    notes: Optional[str] = None
    asap: Optional[bool] = None

class VisitBase(BaseModel):
    date: str
    type: str = "consultation"
    notes: Optional[str] = None

class VisitCreate(VisitBase):
    pass

class PhotoBase(BaseModel):
    data: str
    filename: Optional[str] = None
    category: Optional[str] = None
    caption: Optional[str] = None

class PhotoCreate(PhotoBase):
    pass

class SurgerySlotBase(BaseModel):
    date: str
    location_id: Optional[str] = None
    notes: Optional[str] = None
    is_full: bool = False

class SurgerySlotCreate(SurgerySlotBase):
    pass

class SurgerySlotUpdate(BaseModel):
    location_id: Optional[str] = None
    notes: Optional[str] = None
    is_full: Optional[bool] = None

class LocationBase(BaseModel):
    name: str
    address: Optional[str] = None

class LocationCreate(LocationBase):
    pass

class ProcedureTypeBase(BaseModel):
    name: str
    description: Optional[str] = None
    default_price: Optional[float] = None

class ProcedureTypeCreate(ProcedureTypeBase):
    pass
