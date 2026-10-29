import os
import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "backend"))

from app.auth import create_access_token, verify_password, get_password_hash
from app.main import app

client = TestClient(app)


def test_password_hashing():
    pw = "demo1234"
    h = get_password_hash(pw)
    assert verify_password(pw, h)
    assert not verify_password("wrongpassword", h)


def test_jwt_token_creation():
    token = create_access_token(data={"sub": "admin@logisense.dev", "role": "ADMIN"})
    assert isinstance(token, str)
    assert len(token) > 20


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "online"


def test_auth_rejection_without_token():
    response = client.get("/api/v1/dashboard/kpis")
    assert response.status_code == 401


def test_fuzzy_header_matching():
    from app.routers.ingest import auto_map_headers

    dirty_headers = ["PO_Num", "Part_Ref", "Delivered_Qty", "Unit_Rate", "Arrival_DT"]
    mapping = auto_map_headers(dirty_headers)

    assert mapping["Part_Ref"] == "PART_ID"
    assert mapping["Delivered_Qty"] == "QTY_RECEIVED"
    assert mapping["Unit_Rate"] == "UNIT_COST"
    assert mapping["Arrival_DT"] == "ACTUAL_DATE"

