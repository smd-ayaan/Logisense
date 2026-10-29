from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from app.auth import get_current_user
from app.db import get_connection

router = APIRouter(prefix="/api/v1/quality", tags=["quality"])


@router.get("/alerts")
def get_quality_alerts(current_user: dict = Depends(get_current_user)):
    """Fetches early-warning alerts where rolling EARLY defect rate spiked >=50% over baseline from V_EARLY_WARNING_ALERTS."""
    sql = """
    SELECT
        MACHINE_ID,
        MACHINE_NAME,
        MACHINE_TYPE,
        DEFECT_TYPE,
        CAST(CHECK_DATE AS VARCHAR(10)) AS CHECK_DATE,
        CURRENT_RATE,
        BASELINE_30D_RATE,
        PCT_ABOVE_BASELINE,
        ALERT_LEVEL
    FROM LOGISENSE.V_EARLY_WARNING_ALERTS
    WHERE ALERT_LEVEL IN ('ALERT', 'WATCH')
    ORDER BY
        CASE WHEN ALERT_LEVEL = 'ALERT' THEN 1 ELSE 2 END,
        PCT_ABOVE_BASELINE DESC
    """
    with get_connection() as con:
        rows = con.execute(sql).fetchall()
    return rows


@router.get("/trend")
def get_quality_trend(
    machine_id: Optional[str] = Query(None),
    stage: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    """Fetches 7-day rolling average defect rates across stages from V_QUALITY_TREND."""
    sql = """
    SELECT
        MACHINE_ID,
        MACHINE_NAME,
        MACHINE_TYPE,
        CHECK_STAGE,
        DEFECT_TYPE,
        CAST(CHECK_DATE AS VARCHAR(10)) AS CHECK_DATE,
        DAILY_AVG_DEFECT_RATE,
        ROLLING_7D_DEFECT_RATE,
        CHECKS_ON_DAY
    FROM LOGISENSE.V_QUALITY_TREND
    WHERE 1=1
    """
    params = {}
    if machine_id:
        sql += " AND MACHINE_ID = {mid!s}"
        params["mid"] = machine_id
    if stage:
        sql += " AND CHECK_STAGE = {stg!s}"
        params["stg"] = stage

    sql += " ORDER BY CHECK_DATE ASC, CHECK_STAGE ASC"

    with get_connection() as con:
        rows = con.execute(sql, params).fetchall()
    return rows


@router.get("/stage-comparison")
def get_stage_comparison(
    machine_id: str = Query("M-01"),
    defect_type: str = Query("SCRATCH"),
    current_user: dict = Depends(get_current_user),
):
    """Pivots defect rates across EARLY, MID, and FINAL stages to visualize the 3-5 day lead-time warning pattern."""
    sql = """
    SELECT
        CAST(CHECK_DATE AS VARCHAR(10)) AS CHECK_DATE,
        ROUND(AVG(CASE WHEN CHECK_STAGE = 'EARLY' THEN ROLLING_7D_DEFECT_RATE * 100 END), 2) AS EARLY_RATE,
        ROUND(AVG(CASE WHEN CHECK_STAGE = 'MID' THEN ROLLING_7D_DEFECT_RATE * 100 END), 2) AS MID_RATE,
        ROUND(AVG(CASE WHEN CHECK_STAGE = 'FINAL' THEN ROLLING_7D_DEFECT_RATE * 100 END), 2) AS FINAL_RATE
    FROM LOGISENSE.V_QUALITY_TREND
    WHERE MACHINE_ID = {mid!s} AND DEFECT_TYPE = {dt!s}
    GROUP BY CAST(CHECK_DATE AS VARCHAR(10))
    ORDER BY CHECK_DATE ASC
    """
    with get_connection() as con:
        rows = con.execute(sql, {"mid": machine_id, "dt": defect_type}).fetchall()
    return rows


@router.get("/metrics")
def get_quality_metrics(current_user: dict = Depends(get_current_user)):
    """Computes overall quality metrics across recent checks."""
    sql = """
    SELECT
        COUNT(*) AS TOTAL_INSPECTIONS,
        COALESCE(SUM(DEFECT_COUNT), 0) AS TOTAL_DEFECTS,
        COALESCE(SUM(SAMPLE_SIZE), 0) AS TOTAL_SAMPLED,
        ROUND(COALESCE(SUM(DEFECT_COUNT), 0) / NULLIFZERO(SUM(SAMPLE_SIZE)) * 100, 2) AS OVERALL_DEFECT_PCT
    FROM LOGISENSE.QUALITY_CHECKS
    """
    with get_connection() as con:
        row = con.execute(sql).fetchone()

    with get_connection() as con:
        alert_count = con.execute(
            "SELECT COUNT(*) AS ALERTS FROM LOGISENSE.V_EARLY_WARNING_ALERTS WHERE ALERT_LEVEL = 'ALERT'"
        ).fetchone()["ALERTS"]

    return {
        "total_inspections": row["TOTAL_INSPECTIONS"],
        "total_defects": row["TOTAL_DEFECTS"],
        "total_sampled": row["TOTAL_SAMPLED"],
        "overall_defect_pct": row["OVERALL_DEFECT_PCT"],
        "active_early_warnings": alert_count,
    }
