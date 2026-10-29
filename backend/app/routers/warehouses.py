from fastapi import APIRouter, Depends
from app.auth import get_current_user
from app.db import get_connection

router = APIRouter(prefix="/api/v1/warehouses", tags=["warehouses"])


@router.get("")
def list_warehouses(current_user: dict = Depends(get_current_user)):
    with get_connection() as con:
        rows = con.execute("SELECT * FROM LOGISENSE.WAREHOUSES ORDER BY WAREHOUSE_NAME").fetchall()
    return rows


@router.get("/{warehouse_id}")
def get_warehouse_detail(warehouse_id: str, current_user: dict = Depends(get_current_user)):
    with get_connection() as con:
        wh = con.execute(
            "SELECT * FROM LOGISENSE.WAREHOUSES WHERE WAREHOUSE_ID = {wid!s}",
            {"wid": warehouse_id},
        ).fetchone()
        items = con.execute(
            """
            SELECT p.PART_NAME, p.CATEGORY, i.QTY_ON_HAND, p.REORDER_POINT,
                   CASE WHEN i.QTY_ON_HAND <= 0 THEN 'STOCKOUT'
                        WHEN i.QTY_ON_HAND < p.REORDER_POINT THEN 'LOW'
                        ELSE 'OK' END AS STATUS
            FROM LOGISENSE.INVENTORY i
            JOIN LOGISENSE.PARTS_CATALOG p ON p.PART_ID = i.PART_ID
            WHERE i.WAREHOUSE_ID = {wid!s}
            ORDER BY i.QTY_ON_HAND ASC
            """,
            {"wid": warehouse_id},
        ).fetchall()
    return {"warehouse": wh, "inventory": items}
