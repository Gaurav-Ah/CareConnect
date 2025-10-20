from fastapi import APIRouter

from backend.api.routes.health import router as health_router
from backend.api.routes.auth import router as auth_router
from backend.api.routes.journal import router as journal_router
from backend.api.routes.mood import router as mood_router
from backend.api.routes.sessions import router as sessions_router
from backend.api.routes.activities import router as activities_router

api_router = APIRouter()

api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(journal_router)
api_router.include_router(mood_router)
api_router.include_router(sessions_router)
api_router.include_router(activities_router)
