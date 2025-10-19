from fastapi import APIRouter

router = APIRouter(prefix="/activities", tags=["activities"]) 


@router.get("/")
def list_activities():
    # Simple curated activities list
    return {
        "activities": [
            {"id": 1, "title": "Deep Breathing", "category": "Mindfulness"},
            {"id": 2, "title": "Light Stretching", "category": "Physical"},
            {"id": 3, "title": "Gratitude Journal", "category": "Reflection"},
            {"id": 4, "title": "Short Walk", "category": "Physical"},
            {"id": 5, "title": "Guided Meditation", "category": "Mindfulness"},
        ]
    }
