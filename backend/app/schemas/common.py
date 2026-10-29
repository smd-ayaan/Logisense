from typing import Any, List, Optional
from pydantic import BaseModel


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    full_name: str
    email: str


class LoginRequest(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    user_id: str
    email: str
    full_name: str
    role: str
    is_active: bool


class DashboardKpis(BaseModel):
    machines_active: int
    machines_down: int
    open_alerts: int
    low_stock_items: int
    total_warehouses: int
    supplier_count: int


class InventoryBalanceItem(BaseModel):
    inventory_id: str
    warehouse_id: str
    warehouse_name: str
    part_id: str
    part_name: str
    category: str
    unit_cost: float
    reorder_point: int
    qty_on_hand: int
    surplus: int
    stock_status: str


class TransferRecommendationItem(BaseModel):
    part_id: str
    part_name: str
    category: str
    from_warehouse_id: str
    from_warehouse: str
    from_qty: int
    to_warehouse_id: str
    to_warehouse: str
    to_qty: int
    reorder_point: int
    suggested_qty: int
    transfer_value_usd: float


class SupplierScorecardItem(BaseModel):
    supplier_id: str
    supplier_name: str
    country: str
    payment_terms: Optional[str]
    lead_time_days: Optional[int]
    total_deliveries: int
    on_time_rate: float
    fill_rate: float
    avg_delay_days: float
    avg_unit_cost_usd: float
    cost_efficiency: float
    composite_score: float
    score_rank: int
