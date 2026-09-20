import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db import Base, SessionLocal, engine
from .routers import channels, discover, favorites, niches, outliers, refresh, status
from .scheduler import start_scheduler
from .seed import ensure_default_niches

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Outlier Finder — YouTube", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(niches.router)
app.include_router(channels.router)
app.include_router(outliers.router)
app.include_router(discover.router)
app.include_router(favorites.router)
app.include_router(refresh.router)
app.include_router(status.router)


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        ensure_default_niches(db)
    finally:
        db.close()
    start_scheduler()


@app.get("/")
def root():
    return {"name": "Outlier Finder — YouTube", "status": "ok"}
