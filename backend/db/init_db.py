from sqlalchemy import text
from backend.db.session import engine
from backend.db.base import Base

# Import all models so that Base.metadata.create_all sees them
from backend.models.user import User  # noqa
from backend.models.journal import JournalEntry  # noqa
from backend.models.mood import MoodEntry  # noqa
from backend.models.session import TherapySession  # noqa


def init_db() -> None:
    Base.metadata.create_all(bind=engine)


if __name__ == "__main__":
    init_db()
    with engine.connect() as conn:
        result = conn.execute(text("SELECT 1")).scalar()
        print("DB ready:", result)
