from fastapi import APIRouter, Depends, HTTPException
from app.auth import get_current_user
from app.db import get_connection

router = APIRouter(prefix="/api/v1/assets", tags=["assets"])


@router.get("/machines")
def list_machines(current_user: dict = Depends(get_current_user)):
    with get_connection() as con:
        rows = con.execute("SELECT * FROM LOGISENSE.MACHINES ORDER BY MACHINE_ID").fetchall()
    return rows


@router.get("/machines/{machine_id}")
def get_machine_detail(machine_id: str, current_user: dict = Depends(get_current_user)):
    with get_connection() as con:
        machine = con.execute(
            "SELECT * FROM LOGISENSE.MACHINES WHERE MACHINE_ID = {mid!s}",
            {"mid": machine_id},
        ).fetchone()
        if not machine:
            raise HTTPException(status_code=404, detail="Machine not found")

        sensors = con.execute(
            "SELECT * FROM LOGISENSE.SENSORS WHERE MACHINE_ID = {mid!s}",
            {"mid": machine_id},
        ).fetchall()

        events = con.execute(
            "SELECT * FROM LOGISENSE.DOWNTIME_EVENTS WHERE MACHINE_ID = {mid!s} ORDER BY START_TS DESC",
            {"mid": machine_id},
        ).fetchall()

    return {"machine": machine, "sensors": sensors, "downtime_events": events}
