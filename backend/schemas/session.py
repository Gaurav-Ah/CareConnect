from datetime import datetime
from pydantic import BaseModel


class TherapySessionBase(BaseModel):
    title: str
    scheduled_at: datetime


class TherapySessionCreate(TherapySessionBase):
    pass


class TherapySessionRead(TherapySessionBase):
    id: int
    user_id: int

    class Config:
        from_attributes = True
