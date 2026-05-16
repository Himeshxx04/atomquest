from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .core.config import settings

app = FastAPI(
    title="AtomQuest — Goal Setting & Tracking Portal",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "version": "1.0.0"}


# Routes will be registered here as each feature is built
# from .api.routes import auth, goals, checkins, manager, admin, analytics, reports
