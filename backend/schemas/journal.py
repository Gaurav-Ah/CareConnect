from datetime import datetime
from pydantic import BaseModel


class JournalBase(BaseModel):
    title: str
    content: str


class JournalCreate(JournalBase):
    pass


class JournalRead(JournalBase):
    id: int
    user_id: int
    created_at: datetime

    class Config:
        from_attributes = True
