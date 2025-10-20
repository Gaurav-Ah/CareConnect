# CareConnect Backend

FastAPI backend for CareConnect.

## Quickstart

1. Create virtual environment and install dependencies

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2. Initialize the database (SQLite by default)

```bash
python -m backend.db.init_db
```

3. Run the server

```bash
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

## API

- GET `/api/health`
- POST `/api/auth/signup` {email, name, password}
- POST `/api/auth/login` (OAuth2 form: username=email, password)
- GET `/api/auth/me` (Bearer token)
- GET/POST `/api/journal/`
- GET/POST `/api/mood/`
- GET/POST/DELETE `/api/sessions/`
- GET `/api/activities/`

## Environment

Configure via `.env`:

```
SECRET_KEY=change-me
DATABASE_URL=sqlite:///./careconnect.db
CORS_ORIGINS=["http://localhost:3000","*"]
```
