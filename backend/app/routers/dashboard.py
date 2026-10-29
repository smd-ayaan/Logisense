from fastapi import APIRouter, Depends
from app.auth import get_current_user
from app.db import get_connection
from app.schemas.common import DashboardKpis

router = APIRouter(prefix="/api/v1/dashboard", tags=["dashboard"])


@router.get("/kpis", response_model=DashboardKpis)
def get_dashboard_kpis(current_user: dict = Depends(get_current_user)):
    with get_connection() as con:
        m_active = con.execute("SELECT COUNT(*) AS C FROM LOGISENSE.MACHINES WHERE STATUS = 'ACTIVE'").fetchone()["C"]
        m_down = con.execute("SELECT COUNT(*) AS C FROM LOGISENSE.MACHINES WHERE STATUS IN ('INACTIVE', 'MAINTENANCE')").fetchone()["C"]
        open_alerts = con.execute("SELECT COUNT(*) AS C FROM LOGISENSE.V_EARLY_WARNING_ALERTS WHERE ALERT_LEVEL = 'ALERT'").fetchone()["C"]
        low_stock = con.execute("SELECT COUNT(*) AS C FROM LOGISENSE.V_INVENTORY_BALANCE WHERE STOCK_STATUS IN ('LOW', 'STOCKOUT')").fetchone()["C"]
        warehouses = con.execute("SELECT COUNT(*) AS C FROM LOGISENSE.WAREHOUSES").fetchone()["C"]
        suppliers = con.execute("SELECT COUNT(*) AS C FROM LOGISENSE.SUPPLIERS").fetchone()["C"]

    return {
        "machines_active": m_active,
        "machines_down": m_down,
        "open_alerts": open_alerts,
        "low_stock_items": low_stock,
        "total_warehouses": warehouses,
        "supplier_count": suppliers,
    }


@router.get("/recent-events")
def get_recent_events(limit: int = 5, current_user: dict = Depends(get_current_user)):
    with get_connection() as con:
        events = con.execute(
            """
            SELECT de.EVENT_ID, de.MACHINE_ID, m.MACHINE_NAME, de.FAULT_CODE,
                   de.START_TS, de.DURATION_H, de.ROOT_CAUSE, de.MAINTENANCE_COST
            FROM LOGISENSE.DOWNTIME_EVENTS de
            JOIN LOGISENSE.MACHINES m ON m.MACHINE_ID = de.MACHINE_ID
            ORDER BY de.START_TS DESC
            LIMIT {lim!s}
            """,
            {"lim": limit},
        ).fetchall()
    return events
