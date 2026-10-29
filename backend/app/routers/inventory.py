from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from app.auth import get_current_user
from app.db import get_connection

router = APIRouter(prefix="/api/v1/inventory", tags=["inventory"])


@router.get("/balance")
def get_inventory_balance(
    warehouse_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = 100,
    current_user: dict = Depends(get_current_user),
):
    sql = "SELECT * FROM LOGISENSE.V_INVENTORY_BALANCE WHERE 1=1"
    params = {"lim": limit}
    if warehouse_id:
        sql += " AND WAREHOUSE_ID = {wid!s}"
        params["wid"] = warehouse_id
    if status:
        sql += " AND STOCK_STATUS = {st!s}"
        params["st"] = status
    sql += " ORDER BY SURPLUS ASC LIMIT {lim!s}"

    with get_connection() as con:
        rows = con.execute(sql, params).fetchall()
    return rows


@router.get("/transfer-recommendations")
def get_transfer_recommendations(current_user: dict = Depends(get_current_user)):
    with get_connection() as con:
        rows = con.execute(
            "SELECT * FROM LOGISENSE.V_TRANSFER_RECOMMENDATIONS ORDER BY TRANSFER_VALUE_USD DESC"
        ).fetchall()
    return rows


@router.get("/catalog")
def get_parts_catalog(current_user: dict = Depends(get_current_user)):
    with get_connection() as con:
        rows = con.execute("SELECT * FROM LOGISENSE.PARTS_CATALOG ORDER BY CATEGORY, PART_NAME").fetchall()
    return rows
