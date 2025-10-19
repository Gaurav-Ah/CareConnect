from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.db.session import get_db
from backend.models.session import TherapySession
from backend.schemas.session import TherapySessionCreate, TherapySessionRead
from backend.api.routes.auth import get_current_user, User

router = APIRouter(prefix="/sessions", tags=["sessions"]) 


@router.get("/", response_model=List[TherapySessionRead])
def list_sessions(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(TherapySession).filter(TherapySession.user_id == current_user.id).order_by(TherapySession.scheduled_at.desc()).all()


@router.post("/", response_model=TherapySessionRead)
def create_session(payload: TherapySessionCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    s = TherapySession(user_id=current_user.id, title=payload.title, scheduled_at=payload.scheduled_at)
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


@router.delete("/{session_id}")
def delete_session(session_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    s = db.query(TherapySession).filter(TherapySession.id == session_id, TherapySession.user_id == current_user.id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    db.delete(s)
    db.commit()
    return {"ok": True}
