from typing import List, Optional
from pydantic import BaseModel


class MachineHealthItem(BaseModel):
    machine_id: str
    machine_name: str
    machine_type: str
    location: str
    status: str
    install_date: str
    anomaly_status: str  # NORMAL, WARNING, CRITICAL
    critical_sensors: int
    warning_sensors: int
    recent_event_count: int


class PreFailureReading(BaseModel):
    event_id: str
    machine_id: str
    machine_name: str
    fault_code: str
    sensor_id: str
    sensor_type: str
    unit: str
    threshold_warn: float
    threshold_crit: float
    reading_ts: str
    reading_value: float
    approx_hours_before: float
    alert_level: str


class RootCauseItem(BaseModel):
    machine_type: str
    fault_code: str
    root_cause: str
    event_count: int
    avg_duration_h: float
    total_duration_h: float
    total_cost: float
    cost_rank: int
    confidence_pct: int
    sequence_pattern: Optional[str] = None


class PrecursorBucket(BaseModel):
    hours_bucket: int
    alert_level: str
    reading_count: int
