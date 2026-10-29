from fastapi import APIRouter, Depends
from app.auth import get_current_user
from app.db import get_connection

router = APIRouter(prefix="/api/v1/suppliers", tags=["suppliers"])


@router.get("")
def list_suppliers(current_user: dict = Depends(get_current_user)):
    with get_connection() as con:
        rows = con.execute("SELECT * FROM LOGISENSE.SUPPLIERS ORDER BY SUPPLIER_NAME").fetchall()
    return rows


@router.get("/scorecard")
def get_supplier_scorecard(current_user: dict = Depends(get_current_user)):
    with get_connection() as con:
        rows = con.execute(
            "SELECT * FROM LOGISENSE.V_SUPPLIER_SCORECARD ORDER BY SCORE_RANK ASC"
        ).fetchall()
    return rows
