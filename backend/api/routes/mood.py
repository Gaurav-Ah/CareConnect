from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.db.session import get_db
from backend.models.mood import MoodEntry
from backend.schemas.mood import MoodCreate, MoodRead
from backend.api.routes.auth import get_current_user, User

router = APIRouter(prefix="/mood", tags=["mood"]) 


@router.get("/", response_model=List[MoodRead])
def list_moods(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(MoodEntry).filter(MoodEntry.user_id == current_user.id).order_by(MoodEntry.created_at.desc()).all()


@router.post("/", response_model=MoodRead)
def create_mood(payload: MoodCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    entry = MoodEntry(user_id=current_user.id, mood_score=payload.mood_score)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry
