from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.db.session import get_db
from backend.models.journal import JournalEntry
from backend.schemas.journal import JournalCreate, JournalRead
from backend.api.routes.auth import get_current_user, User

router = APIRouter(prefix="/journal", tags=["journal"]) 


@router.get("/", response_model=List[JournalRead])
def list_journals(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(JournalEntry).filter(JournalEntry.user_id == current_user.id).order_by(JournalEntry.created_at.desc()).all()


@router.post("/", response_model=JournalRead)
def create_journal(payload: JournalCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    entry = JournalEntry(user_id=current_user.id, title=payload.title, content=payload.content)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/{entry_id}")
def delete_journal(entry_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    entry = db.query(JournalEntry).filter(JournalEntry.id == entry_id, JournalEntry.user_id == current_user.id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    db.delete(entry)
    db.commit()
    return {"ok": True}
