from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import assets, auth, dashboard, downtime, ingest, inventory, quality, spareparts, suppliers, warehouses

app = FastAPI(
    title="LogiSense API",
    description="Intelligent Operations & Logistics Platform powered by Exasol",
    version="1.0.0",
)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.CORS_ORIGIN, "http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router)
app.include_router(dashboard.router)
app.include_router(downtime.router)
app.include_router(spareparts.router)
app.include_router(quality.router)
app.include_router(ingest.router)
app.include_router(inventory.router)
app.include_router(warehouses.router)
app.include_router(assets.router)
app.include_router(suppliers.router)


@app.get("/")
def root():
    return {
        "app": "LogiSense API",
        "status": "online",
        "docs": "/docs",
        "data_platform": "Exasol SaaS",
    }


@app.get("/health")
def healthcheck():
    return {"status": "healthy"}
