import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from app.auth import get_current_user
from app.db import get_connection

router = APIRouter(prefix="/api/v1/spareparts", tags=["spareparts"])


class TransferApprovalRequest(BaseModel):
    part_id: str
    from_warehouse_id: str
    to_warehouse_id: str
    qty: int


@router.get("/balance-heatmap")
def get_balance_heatmap(current_user: dict = Depends(get_current_user)):
    """Fetches all warehouse x part stock levels and status from V_INVENTORY_BALANCE."""
    sql = """
    SELECT
        INVENTORY_ID,
        WAREHOUSE_ID,
        WAREHOUSE_NAME,
        WAREHOUSE_LOCATION,
        PART_ID,
        PART_NAME,
        CATEGORY,
        UNIT_COST,
        REORDER_POINT,
        LEAD_TIME_DAYS,
        QTY_ON_HAND,
        SURPLUS,
        STOCK_STATUS
    FROM LOGISENSE.V_INVENTORY_BALANCE
    ORDER BY CATEGORY, PART_NAME, WAREHOUSE_NAME
    """
    with get_connection() as con:
        rows = con.execute(sql).fetchall()
    return rows


@router.get("/recommendations")
def get_recommendations(current_user: dict = Depends(get_current_user)):
    """Fetches Exasol in-database transfer recommendations from V_TRANSFER_RECOMMENDATIONS."""
    sql = """
    SELECT
        PART_ID,
        PART_NAME,
        CATEGORY,
        FROM_WAREHOUSE_ID,
        FROM_WAREHOUSE,
        FROM_LOCATION,
        FROM_QTY,
        TO_WAREHOUSE_ID,
        TO_WAREHOUSE,
        TO_LOCATION,
        TO_QTY,
        REORDER_POINT,
        SUGGESTED_QTY,
        TRANSFER_VALUE_USD
    FROM LOGISENSE.V_TRANSFER_RECOMMENDATIONS
    ORDER BY TRANSFER_VALUE_USD DESC
    """
    with get_connection() as con:
        rows = con.execute(sql).fetchall()
    return rows


@router.post("/approve-transfer")
def approve_transfer(
    payload: TransferApprovalRequest,
    current_user: dict = Depends(get_current_user),
):
    """Executes a recommended stock transfer: inserts a STOCK_TRANSFERS record and updates INVENTORY."""
    transfer_id = str(uuid.uuid4())
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

    with get_connection() as con:
        # Check source inventory has enough surplus
        source = con.execute(
            """
            SELECT INVENTORY_ID, QTY_ON_HAND
            FROM LOGISENSE.INVENTORY
            WHERE WAREHOUSE_ID = {wid!s} AND PART_ID = {pid!s}
            """,
            {"wid": payload.from_warehouse_id, "pid": payload.part_id},
        ).fetchone()

        if not source or source["QTY_ON_HAND"] < payload.qty:
            raise HTTPException(status_code=400, detail="Insufficient stock at source warehouse")

        dest = con.execute(
            """
            SELECT INVENTORY_ID, QTY_ON_HAND
            FROM LOGISENSE.INVENTORY
            WHERE WAREHOUSE_ID = {wid!s} AND PART_ID = {pid!s}
            """,
            {"wid": payload.to_warehouse_id, "pid": payload.part_id},
        ).fetchone()

        # 1. Insert into STOCK_TRANSFERS
        con.execute(
            """
            INSERT INTO LOGISENSE.STOCK_TRANSFERS
                (TRANSFER_ID, FROM_WAREHOUSE_ID, TO_WAREHOUSE_ID, PART_ID, QTY, REQUESTED_AT, STATUS)
            VALUES
                ({tid!s}, {fwid!s}, {twid!s}, {pid!s}, {qty!s}, {now!s}, 'IN_TRANSIT')
            """,
            {
                "tid": transfer_id,
                "fwid": payload.from_warehouse_id,
                "twid": payload.to_warehouse_id,
                "pid": payload.part_id,
                "qty": payload.qty,
                "now": now_str,
            },
        )

        # 2. Update source inventory
        new_source_qty = source["QTY_ON_HAND"] - payload.qty
        con.execute(
            """
            UPDATE LOGISENSE.INVENTORY
            SET QTY_ON_HAND = {qty!s}, LAST_UPDATED = {now!s}
            WHERE INVENTORY_ID = {iid!s}
            """,
            {"qty": new_source_qty, "now": now_str, "iid": source["INVENTORY_ID"]},
        )

        # 3. Update destination inventory
        if dest:
            new_dest_qty = dest["QTY_ON_HAND"] + payload.qty
            con.execute(
                """
                UPDATE LOGISENSE.INVENTORY
                SET QTY_ON_HAND = {qty!s}, LAST_UPDATED = {now!s}
                WHERE INVENTORY_ID = {iid!s}
                """,
                {"qty": new_dest_qty, "now": now_str, "iid": dest["INVENTORY_ID"]},
            )
        else:
            new_inv_id = str(uuid.uuid4())
            con.execute(
                """
                INSERT INTO LOGISENSE.INVENTORY
                    (INVENTORY_ID, WAREHOUSE_ID, PART_ID, QTY_ON_HAND, LAST_UPDATED)
                VALUES
                    ({iid!s}, {wid!s}, {pid!s}, {qty!s}, {now!s})
                """,
                {
                    "iid": new_inv_id,
                    "wid": payload.to_warehouse_id,
                    "pid": payload.part_id,
                    "qty": payload.qty,
                    "now": now_str,
                },
            )

    return {
        "status": "success",
        "transfer_id": transfer_id,
        "message": f"Transferred {payload.qty} units from {payload.from_warehouse_id} to {payload.to_warehouse_id}",
    }


@router.get("/metrics")
def get_optimizer_metrics(current_user: dict = Depends(get_current_user)):
    """Computes aggregate inventory savings and stockout prevention KPIs."""
    sql = """
    SELECT
        COUNT(CASE WHEN STOCK_STATUS = 'STOCKOUT' THEN 1 END) AS STOCKOUT_COUNT,
        COUNT(CASE WHEN STOCK_STATUS = 'LOW' THEN 1 END) AS LOW_STOCK_COUNT,
        COUNT(CASE WHEN STOCK_STATUS = 'EXCESS' THEN 1 END) AS EXCESS_COUNT,
        COALESCE(SUM(CASE WHEN STOCK_STATUS = 'EXCESS' THEN SURPLUS * UNIT_COST ELSE 0 END), 0) AS TIED_UP_CAPITAL_USD
    FROM LOGISENSE.V_INVENTORY_BALANCE
    """
    with get_connection() as con:
        row = con.execute(sql).fetchone()

    with get_connection() as con:
        recs = con.execute(
            "SELECT COUNT(*) AS REC_COUNT, COALESCE(SUM(TRANSFER_VALUE_USD), 0) AS TOTAL_SAVINGS FROM LOGISENSE.V_TRANSFER_RECOMMENDATIONS"
        ).fetchone()

    return {
        "stockout_count": row["STOCKOUT_COUNT"],
        "low_stock_count": row["LOW_STOCK_COUNT"],
        "excess_count": row["EXCESS_COUNT"],
        "tied_up_capital_usd": round(row["TIED_UP_CAPITAL_USD"], 2),
        "transfer_recommendation_count": recs["REC_COUNT"],
        "rebalance_savings_usd": round(recs["TOTAL_SAVINGS"], 2),
    }
