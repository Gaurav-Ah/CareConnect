from datetime import datetime
from pydantic import BaseModel


class MoodCreate(BaseModel):
    mood_score: int


class MoodRead(BaseModel):
    id: int
    user_id: int
    mood_score: int
    created_at: datetime

    class Config:
        from_attributes = True
