"""
generate_data.py — Synthetic data generator for LogiSense.

Planted patterns:
  1. Downtime Precursors:
     - Machines M-01 (Hydraulic Press 01) and M-03 (CNC Lathe A) have repeated failures.
     - In the 6–48 h window prior to each breakdown, vibration and temperature show
       sustained exponential / linear upward trends crossing WARNING and CRITICAL thresholds.
     - Fault code progressions follow E12 (Vibration Warning) -> E31 (Thermal Exceedance) -> E07 (Bearing Seizure).
     - Other machines operate within normal nominal noise bounds.

  2. Spare Parts Imbalances:
     - Overstocked warehouses (e.g. Mumbai, Pune) hold 3x-6x reorder point on critical parts (Bearings, Seals).
     - Deficit warehouses (e.g. Bengaluru, Chennai) sit below reorder point or near 0 for the exact same parts.
     - Triggers Exasol view V_TRANSFER_RECOMMENDATIONS with clear high-value transfer suggestions.

  3. Quality Defect Early-Warning:
     - For machines M-01 and M-04, EARLY-stage defect rate (SCRATCH, MISALIGN) spikes to 8-12%
       (vs 1-2% baseline) 3 to 5 days before FINAL-stage inspection detects high defect rates (>15%).
     - Surfaces in V_EARLY_WARNING_ALERTS with 'ALERT' status days ahead of final inspection.

  4. Messy Supplier Ingestion:
     - Historical deliveries in SUPPLIER_DELIVERIES with varied currencies (USD, EUR, INR, GBP)
       and delay profiles.
     - Generates 5 realistic "dirty" files in data/supplier_samples/ (CSV and XLSX) with
       scrambled column names, mixed date formats, currency symbols, and missing values.
"""

import argparse
import csv
import os
import random
import sys
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
from dotenv import load_dotenv

load_dotenv(REPO_ROOT / ".env")
sys.path.insert(0, str(REPO_ROOT / "backend"))

from app.db import get_connection

DATA_DIR = REPO_ROOT / "data"
SAMPLES_DIR = DATA_DIR / "supplier_samples"


def setup_cli() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate synthetic data for LogiSense.")
    parser.add_argument(
        "--size",
        choices=["small", "medium"],
        default="small",
        help="Dataset size: small (~50k-100k readings) or medium (~500k-1M readings).",
    )
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility.")
    parser.add_argument(
        "--truncate",
        action="store_true",
        default=True,
        help="Truncate existing data before loading (default: True).",
    )
    return parser.parse_args()


def generate_all(size: str, seed: int):
    random.seed(seed)
    # Target scale based on size
    is_small = size == "small"
    days_readings = 7 if is_small else 21
    reading_interval_min = 10 if is_small else 3  # step in minutes

    now = datetime(2026, 10, 19, 12, 0, 0, tzinfo=timezone.utc)
    start_date = now - timedelta(days=days_readings)

    print(f"[*] Generating {size} dataset (seed={seed}, timespan={days_readings} days)...")

    # 1. WAREHOUSES
    warehouses_data = [
        ("WH-MUM", "Mumbai Central Distribution Center", "Mumbai, Maharashtra", 50000),
        ("WH-PUN", "Pune Automotive Logistics Hub", "Pune, Maharashtra", 35000),
        ("WH-BLR", "Bengaluru Electronics & Spares Depot", "Bengaluru, Karnataka", 30000),
        ("WH-CHN", "Chennai Port Logistics Hub", "Chennai, Tamil Nadu", 45000),
        ("WH-DEL", "Delhi NCR Northern Gateway", "Gurugram, Haryana", 40000),
        ("WH-AMD", "Ahmedabad Industrial Storage", "Ahmedabad, Gujarat", 25000),
    ]
    warehouses = [
        {
            "WAREHOUSE_ID": w[0],
            "WAREHOUSE_NAME": w[1],
            "LOCATION": w[2],
            "CAPACITY": w[3],
        }
        for w in warehouses_data
    ]

    # 2. PARTS CATALOG
    parts_data = [
        ("P-BRG-6205", "Deep Groove Ball Bearing 6205-2RS", "BEARING", 45.50, 7, 30),
        ("P-BRG-22212", "Spherical Roller Bearing 22212-E1", "BEARING", 185.00, 14, 20),
        ("P-BRG-30208", "Tapered Roller Bearing 30208", "BEARING", 68.20, 10, 25),
        ("P-BLT-V1050", "V-Belt Heavy-Duty V1050", "BELT", 28.00, 5, 40),
        ("P-BLT-SYN80", "Synchronous Timing Belt 800-8M", "BELT", 54.00, 7, 30),
        ("P-SEAL-O50", "Viton High-Temp O-Ring 50mm", "SEAL", 8.50, 4, 100),
        ("P-SEAL-HYD", "Hydraulic Cylinder Rod Seal 80x95", "SEAL", 32.00, 8, 35),
        ("P-FLT-HYD10", "High-Pressure Hydraulic Filter 10um", "FILTER", 65.00, 6, 25),
        ("P-FLT-AIR50", "Air Intake Cartridge Filter 50CFM", "FILTER", 42.00, 5, 30),
        ("P-FLT-OIL05", "Lubrication Oil Spin-On Filter", "FILTER", 24.50, 5, 50),
        ("P-SNS-VIB01", "Piezoelectric Vibration Sensor 100mV/g", "SENSOR_PART", 210.00, 15, 10),
        ("P-SNS-TMP01", "PT100 RTD Temperature Probe 1/2in", "SENSOR_PART", 95.00, 12, 15),
        ("P-MOT-7KW", "3-Phase Induction Motor 7.5kW", "MOTOR", 850.00, 21, 5),
        ("P-VLV-SOL24", "Directional Solenoid Valve 24VDC", "VALVE", 145.00, 10, 15),
        ("P-PMP-GR20", "Hydraulic Gear Pump 20cc/rev", "PUMP", 380.00, 18, 8),
    ]
    parts = [
        {
            "PART_ID": p[0],
            "PART_NAME": p[1],
            "CATEGORY": p[2],
            "UNIT_COST": p[3],
            "LEAD_TIME_DAYS": p[4],
            "REORDER_POINT": p[5],
        }
        for p in parts_data
    ]

    # 3. INVENTORY (Planted pattern 2: Severe imbalance across warehouses)
    inventory = []
    for p in parts:
        pid = p["PART_ID"]
        rop = p["REORDER_POINT"]
        for w in warehouses:
            wid = w["WAREHOUSE_ID"]
            # Plant imbalance:
            # WH-MUM & WH-PUN are EXCESS (3x to 6x ROP)
            # WH-BLR & WH-CHN are DEFICIT / STOCKOUT (< ROP or <= 2)
            if wid in ("WH-MUM", "WH-PUN") and pid in (
                "P-BRG-22212",
                "P-FLT-HYD10",
                "P-SEAL-HYD",
                "P-BRG-6205",
            ):
                qty = rop * random.randint(4, 7) + random.randint(5, 20)
            elif wid in ("WH-BLR", "WH-CHN") and pid in (
                "P-BRG-22212",
                "P-FLT-HYD10",
                "P-SEAL-HYD",
                "P-BRG-6205",
            ):
                qty = random.choice([0, 1, 2, 4, 6])  # well below ROP
            else:
                qty = max(0, int(random.gauss(rop * 1.5, rop * 0.4)))

            inventory.append(
                {
                    "INVENTORY_ID": str(uuid.uuid4()),
                    "WAREHOUSE_ID": wid,
                    "PART_ID": pid,
                    "QTY_ON_HAND": qty,
                    "LAST_UPDATED": now.strftime("%Y-%m-%d %H:%M:%S"),
                }
            )

    # 4. MACHINES
    machines_data = [
        ("M-01", "Hydraulic Stamping Press 500T", "PRESS", "Line A - Bay 1", "2021-03-15", "ACTIVE"),
        ("M-02", "Heavy Duty Transfer Press 800T", "PRESS", "Line A - Bay 2", "2020-08-10", "ACTIVE"),
        ("M-03", "CNC Turning Center Lathe A", "LATHE", "Line B - Cell 1", "2022-01-20", "ACTIVE"),
        ("M-04", "Multi-Axis CNC Milling Center B", "CNC", "Line B - Cell 2", "2021-11-05", "ACTIVE"),
        ("M-05", "Robotic Spot Welding Station 01", "WELDER", "Line C - Cell 3", "2023-04-12", "ACTIVE"),
        ("M-06", "Automated Roller Conveyor Main Line", "CONVEYOR", "Line A-B Transfer", "2019-06-25", "ACTIVE"),
        ("M-07", "High-Precision Grinding Machine", "LATHE", "Toolroom 02", "2022-07-18", "ACTIVE"),
        ("M-08", "Automatic Laser Cutting Unit", "CNC", "Line B - Prep", "2023-09-01", "ACTIVE"),
    ]
    machines = [
        {
            "MACHINE_ID": m[0],
            "MACHINE_NAME": m[1],
            "MACHINE_TYPE": m[2],
            "LOCATION": m[3],
            "INSTALL_DATE": m[4],
            "STATUS": m[5],
        }
        for m in machines_data
    ]

    # 5. SENSORS (VIBRATION, TEMPERATURE, PRESSURE, CURRENT)
    sensors = []
    sensor_map = {}  # (machine_id, sensor_type) -> sensor_dict
    for m in machines:
        mid = m["MACHINE_ID"]
        mtype = m["MACHINE_TYPE"]
        specs = [
            ("VIBRATION", "mm/s", 4.50, 7.20),
            ("TEMPERATURE", "°C", 72.00, 88.00),
            ("CURRENT", "A", 38.00, 52.00),
        ]
        if mtype in ("PRESS", "CONVEYOR"):
            specs.append(("PRESSURE", "bar", 190.00, 240.00))

        for stype, unit, twarn, tcrit in specs:
            sid = f"S-{mid}-{stype[:3]}"
            srecord = {
                "SENSOR_ID": sid,
                "MACHINE_ID": mid,
                "SENSOR_TYPE": stype,
                "UNIT": unit,
                "THRESHOLD_WARN": twarn,
                "THRESHOLD_CRIT": tcrit,
            }
            sensors.append(srecord)
            sensor_map[(mid, stype)] = srecord

    # 6. DOWNTIME EVENTS (Planted Pattern 1: Recurring failures on M-01 and M-03 with pre-failure timeline)
    # We plant 4 distinct events in the historical window:
    # Event 1: M-01, 4 days ago (Bearing failure E07)
    # Event 2: M-03, 2 days ago (Spindle overheating E07)
    # Event 3: M-01, 1 day ago (Hydraulic seal blowout E12)
    # Event 4: M-05, 5 days ago (Weld head current spike E31 - random/isolated)
    dt_e1_start = now - timedelta(days=4, hours=6)
    dt_e2_start = now - timedelta(days=2, hours=3)
    dt_e3_start = now - timedelta(days=1, hours=8)
    dt_e4_start = now - timedelta(days=5, hours=14)

    events_data = [
        (
            "EVT-101",
            "M-01",
            dt_e1_start,
            dt_e1_start + timedelta(hours=5, minutes=30),
            5.50,
            "E07",
            "Drive Main Bearing Seizure caused by sustained severe vibration",
            8450.00,
        ),
        (
            "EVT-102",
            "M-03",
            dt_e2_start,
            dt_e2_start + timedelta(hours=3, minutes=45),
            3.75,
            "E07",
            "Spindle Bearing Overheating and thermal seizure",
            5200.00,
        ),
        (
            "EVT-103",
            "M-01",
            dt_e3_start,
            dt_e3_start + timedelta(hours=4, minutes=15),
            4.25,
            "E12",
            "Excessive High Vibration causing hydraulic seal displacement",
            3900.00,
        ),
        (
            "EVT-104",
            "M-05",
            dt_e4_start,
            dt_e4_start + timedelta(hours=2, minutes=10),
            2.17,
            "E31",
            "Thermal overload trip during high-duty welding cycle",
            1850.00,
        ),
    ]
    downtime_events = [
        {
            "EVENT_ID": e[0],
            "MACHINE_ID": e[1],
            "START_TS": e[2].strftime("%Y-%m-%d %H:%M:%S"),
            "END_TS": e[3].strftime("%Y-%m-%d %H:%M:%S"),
            "DURATION_H": e[4],
            "FAULT_CODE": e[5],
            "ROOT_CAUSE": e[6],
            "MAINTENANCE_COST": e[7],
        }
        for e in events_data
    ]

    # 7. WORK ORDERS
    work_orders = []
    for ev in events_data:
        work_orders.append(
            {
                "WO_ID": f"WO-{ev[0]}",
                "MACHINE_ID": ev[1],
                "EVENT_ID": ev[0],
                "WO_TYPE": "CORRECTIVE",
                "STATUS": "CLOSED",
                "ASSIGNED_TO": random.choice(["Rajesh Patel", "Anil Deshmukh", "Vikram Singh"]),
                "OPENED_AT": ev[2].strftime("%Y-%m-%d %H:%M:%S"),
                "CLOSED_AT": ev[3].strftime("%Y-%m-%d %H:%M:%S"),
                "NOTES": f"Investigated fault {ev[5]}. Root cause: {ev[6]}. Replaced damaged components.",
            }
        )

    # Add a couple preventive work orders
    work_orders.append(
        {
            "WO_ID": "WO-PRV-201",
            "MACHINE_ID": "M-02",
            "EVENT_ID": None,
            "WO_TYPE": "PREVENTIVE",
            "STATUS": "COMPLETED",
            "ASSIGNED_TO": "Rajesh Patel",
            "OPENED_AT": (now - timedelta(days=6)).strftime("%Y-%m-%d %H:%M:%S"),
            "CLOSED_AT": (now - timedelta(days=6, hours=-2)).strftime("%Y-%m-%d %H:%M:%S"),
            "NOTES": "Scheduled 500-hour hydraulic oil check and filter replacement.",
        }
    )

    # 8. SENSOR READINGS (Planted Pattern 1: Anomaly build-up in 48h pre-failure window)
    print("  -> Generating sensor time-series with planted precursor anomalies...")
    readings = []
    step = timedelta(minutes=reading_interval_min)

    # Map failures: machine -> list of failure datetimes
    failure_lookup = {
        "M-01": [dt_e1_start, dt_e3_start],
        "M-03": [dt_e2_start],
        "M-05": [dt_e4_start],
    }

    for s in sensors:
        sid = s["SENSOR_ID"]
        mid = s["MACHINE_ID"]
        stype = s["SENSOR_TYPE"]
        twarn = float(s["THRESHOLD_WARN"])
        tcrit = float(s["THRESHOLD_CRIT"])

        # Base nominal levels
        if stype == "VIBRATION":
            base_mean, base_sd = 2.1, 0.4
        elif stype == "TEMPERATURE":
            base_mean, base_sd = 52.0, 3.2
        elif stype == "PRESSURE":
            base_mean, base_sd = 150.0, 8.0
        else:  # CURRENT
            base_mean, base_sd = 28.0, 2.5

        t = start_date
        m_failures = failure_lookup.get(mid, [])

        while t <= now:
            val = random.gauss(base_mean, base_sd)

            # Check if t is in 48h pre-failure window for this machine
            for f_time in m_failures:
                if f_time - timedelta(hours=48) <= t < f_time:
                    # Hours before failure (48 down to 0)
                    hrs_before = (f_time - t).total_seconds() / 3600.0

                    if stype in ("VIBRATION", "TEMPERATURE"):
                        # Build-up starts subtly around 36h, accelerates sharply inside 18h
                        if hrs_before <= 12:
                            # CRITICAL exceedance
                            factor = 1.0 + (12 - hrs_before) / 12.0 * 0.8
                            val = tcrit * factor + random.gauss(0, 0.3)
                        elif hrs_before <= 30:
                            # WARNING zone
                            progress = (30 - hrs_before) / 18.0
                            val = twarn + progress * (tcrit - twarn) * 0.95 + random.gauss(0, 0.3)
                        else:
                            # Mild elevation
                            val = base_mean + (twarn - base_mean) * 0.5 + random.gauss(0, 0.4)

            # Keep values positive
            val = max(0.1, round(val, 4))
            readings.append(
                {
                    "READING_ID": str(uuid.uuid4()),
                    "SENSOR_ID": sid,
                    "TS": t.strftime("%Y-%m-%d %H:%M:%S"),
                    "READING_VALUE": val,
                }
            )
            t += step

    print(f"  -> Generated {len(readings)} sensor readings.")

    # 9. QUALITY CHECKS (Planted Pattern 3: EARLY stage spikes 2-5 days before FINAL inspection)
    print("  -> Generating quality inspection data with early-warning defect trends...")
    quality_checks = []
    # 2 checks per day per machine across stages EARLY, MID, FINAL over the last 14 days
    qc_days = 14
    for d_idx in range(qc_days, 0, -1):
        check_date = now - timedelta(days=d_idx)
        for m in machines:
            mid = m["MACHINE_ID"]
            sample_size = random.randint(80, 150)

            for stage in ("EARLY", "MID", "FINAL"):
                # Planted anomaly for M-01 and M-04:
                # Days 6 to 3 ago: EARLY defect rate elevated to 8-12% (SCRATCH)
                # Days 2 to 0 ago: FINAL defect rate spikes to 12-16%
                defect_type = "SCRATCH" if mid in ("M-01", "M-04") else random.choice(["CRACK", "MISALIGN", "OVERSIZE"])

                if mid in ("M-01", "M-04") and defect_type == "SCRATCH":
                    if stage == "EARLY" and 3 <= d_idx <= 6:
                        rate = random.uniform(0.085, 0.125)
                    elif stage == "MID" and 2 <= d_idx <= 4:
                        rate = random.uniform(0.060, 0.095)
                    elif stage == "FINAL" and d_idx <= 2:
                        rate = random.uniform(0.120, 0.165)
                    else:
                        rate = random.uniform(0.008, 0.025)
                else:
                    rate = random.uniform(0.005, 0.022)

                defects = int(round(sample_size * rate))
                actual_rate = round(defects / sample_size, 5)

                quality_checks.append(
                    {
                        "CHECK_ID": str(uuid.uuid4()),
                        "MACHINE_ID": mid,
                        "CHECK_STAGE": stage,
                        "TS": (check_date + timedelta(hours=random.randint(8, 17))).strftime("%Y-%m-%d %H:%M:%S"),
                        "DEFECT_TYPE": defect_type,
                        "DEFECT_COUNT": defects,
                        "SAMPLE_SIZE": sample_size,
                        "DEFECT_RATE": actual_rate,
                    }
                )

    # 10. SUPPLIERS & DELIVERIES (Planted Pattern 4: Mixed currencies, reliable vs erratic suppliers)
    suppliers_data = [
        ("SUP-01", "Apex Precision Bearings Ltd", "Germany", "orders@apex-bearings.de", "NET30", 12, 0.94, 0.96),
        ("SUP-02", "Bharat Industrial Fasteners", "India", "supply@bharatfasteners.in", "NET45", 5, 0.88, 0.91),
        ("SUP-03", "Precision Seals & Gaskets Co", "Japan", "sales@tokyo-precisionseals.jp", "NET30", 14, 0.96, 0.98),
        ("SUP-04", "Vanguard Belts & Drive Systems", "USA", "b2b@vanguardbelts.com", "NET60", 21, 0.76, 0.84),
        ("SUP-05", "Kalyani Hydraulics & Valves", "India", "dispatch@kalyanihyd.com", "NET30", 6, 0.92, 0.89),
        ("SUP-06", "EuroFilter Technologies S.A.", "France", "logistics@eurofilter.eu", "NET45", 16, 0.82, 0.90),
        ("SUP-07", "Sinotech Motor Drives Corp", "Taiwan", "export@sinotech-drives.tw", "NET60", 25, 0.71, 0.78),
    ]
    suppliers = [
        {
            "SUPPLIER_ID": s[0],
            "SUPPLIER_NAME": s[1],
            "COUNTRY": s[2],
            "CONTACT_EMAIL": s[3],
            "PAYMENT_TERMS": s[4],
            "LEAD_TIME_DAYS": s[5],
            "ON_TIME_RATE": s[6],
            "QUALITY_SCORE": s[7],
        }
        for s in suppliers_data
    ]

    deliveries = []
    currencies = ["USD", "EUR", "INR", "GBP"]
    for s in suppliers:
        sid = s["SUPPLIER_ID"]
        ontime_prob = float(s["ON_TIME_RATE"])
        num_deliveries = random.randint(15, 25)

        for _ in range(num_deliveries):
            p = random.choice(parts)
            pid = p["PART_ID"]
            order_dt = date(2026, random.randint(7, 9), random.randint(1, 28))
            lead = s["LEAD_TIME_DAYS"] + random.randint(-1, 2)
            exp_dt = order_dt + timedelta(days=lead)

            is_ontime = random.random() < ontime_prob
            if is_ontime:
                delay = random.randint(-2, 0)
            else:
                delay = random.randint(2, 12)

            act_dt = exp_dt + timedelta(days=delay)
            qty_ordered = random.choice([25, 50, 100, 200, 500])
            qty_received = qty_ordered if random.random() < 0.9 else int(qty_ordered * random.uniform(0.8, 0.98))
            currency = "EUR" if s["COUNTRY"] in ("Germany", "France") else ("INR" if s["COUNTRY"] == "India" else "USD")

            deliveries.append(
                {
                    "DELIVERY_ID": str(uuid.uuid4()),
                    "SUPPLIER_ID": sid,
                    "PART_ID": pid,
                    "ORDER_DATE": order_dt.isoformat(),
                    "EXPECTED_DATE": exp_dt.isoformat(),
                    "ACTUAL_DATE": act_dt.isoformat(),
                    "QTY_ORDERED": qty_ordered,
                    "QTY_RECEIVED": qty_received,
                    "UNIT_COST": round(float(p["UNIT_COST"]) * random.uniform(0.95, 1.05), 4),
                    "CURRENCY": currency,
                    "DELAY_DAYS": delay,
                }
            )

    # 11. STOCK TRANSFERS (Initial seed records)
    transfers = [
        {
            "TRANSFER_ID": str(uuid.uuid4()),
            "FROM_WAREHOUSE_ID": "WH-MUM",
            "TO_WAREHOUSE_ID": "WH-BLR",
            "PART_ID": "P-BRG-22212",
            "QTY": 25,
            "REQUESTED_AT": (now - timedelta(days=2)).strftime("%Y-%m-%d %H:%M:%S"),
            "COMPLETED_AT": (now - timedelta(days=1)).strftime("%Y-%m-%d %H:%M:%S"),
            "STATUS": "COMPLETED",
        }
    ]

    return {
        "warehouses": warehouses,
        "parts": parts,
        "inventory": inventory,
        "machines": machines,
        "sensors": sensors,
        "downtime_events": downtime_events,
        "work_orders": work_orders,
        "readings": readings,
        "quality_checks": quality_checks,
        "suppliers": suppliers,
        "deliveries": deliveries,
        "transfers": transfers,
    }


def generate_dirty_supplier_files():
    """Generates 5 messy test files for Module 4 (Supplier Ingestion)."""
    SAMPLES_DIR.mkdir(parents=True, exist_ok=True)
    print(f"[*] Generating messy sample files in {SAMPLES_DIR}...")

    # File 1: CSV with informal headers & DD/MM/YYYY dates
    f1 = SAMPLES_DIR / "sample_alpha_deliveries.csv"
    with open(f1, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["PO_Num", "Part_Ref", "Delivered_Qty", "Unit_Rate", "Currency", "Order_Date", "Received_Date"])
        writer.writerow(["PO-9812", "P-BRG-6205", "100", "44.50", "USD", "15/08/2026", "22/08/2026"])
        writer.writerow(["PO-9813", "P-BRG-22212", "20", "182.00", "USD", "18/08/2026", "02/09/2026"])
        writer.writerow(["PO-9814", "P-SEAL-HYD", "50", "31.50", "USD", "20/08/2026", "28/08/2026"])
        writer.writerow(["PO-9815", "P-FLT-HYD10", "30", "63.00", "USD", "25/08/2026", "31/08/2026"])

    # File 2: CSV with all-caps messy headers, currency symbols, and month name dates
    f2 = SAMPLES_DIR / "sample_beta_supplies.csv"
    with open(f2, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["VENDOR_CODE", "ITEM_CODE", "QTY_SUPPLIED", "PRICE_EACH", "PURCHASE_DT", "ARRIVAL_DT"])
        writer.writerow(["SUP-02", "P-BLT-V1050", "150", "INR 2250", "12-Sep-2026", "17-Sep-2026"])
        writer.writerow(["SUP-02", "P-SEAL-O50", "400", "INR 680", "14-Sep-2026", "19-Sep-2026"])
        writer.writerow(["SUP-02", "P-FLT-AIR50", "60", "INR 3400", "16-Sep-2026", "24-Sep-2026"])

    # File 3: CSV with missing fields and dirty formats
    f3 = SAMPLES_DIR / "sample_gamma_irregular.csv"
    with open(f3, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["Supplier", "Part", "Count", "Price", "Date_Ordered", "Date_Rcvd"])
        writer.writerow(["SUP-05", "P-VLV-SOL24", "15", "$142.00", "2026-09-01", "2026-09-08"])
        writer.writerow(["SUP-05", "P-PMP-GR20", "8", "$375.50", "2026-09-03", "2026-09-12"])
        writer.writerow(["SUP-05", "P-MOT-7KW", "", "$840.00", "2026-09-05", ""])  # deliberate blank qty/date

    # File 4: Excel workbook using openpyxl (if installed)
    try:
        import openpyxl

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Shipment Manifest"
        headers = ["Invoice No", "Part Number", "Quantity Received", "Unit Price", "Currency", "Order Date", "Delivery Date"]
        ws.append(headers)
        ws.append(["INV-4401", "P-BRG-22212", 15, 185.0, "EUR", "2026-09-10", "2026-09-24"])
        ws.append(["INV-4402", "P-FLT-HYD10", 40, 64.5, "EUR", "2026-09-12", "2026-09-26"])
        ws.append(["INV-4403", "P-BRG-30208", 50, 67.0, "EUR", "2026-09-15", "2026-09-25"])
        f4 = SAMPLES_DIR / "sample_euro_manifest.xlsx"
        wb.save(f4)
    except Exception as exc:
        print(f"  [Notice] Skipping XLSX creation: {exc}")

    print("  -> Sample dirty files created successfully.")


def bulk_load_to_exasol(data: dict, truncate: bool):
    schema = os.environ.get("EXA_SCHEMA", "LOGISENSE")
    print(f"\n[*] Connecting to Exasol (Schema: {schema}) to load data...")
    con = get_connection(schema=schema)

    tables_in_order = [
        ("SENSOR_READINGS", data["readings"]),
        ("QUALITY_CHECKS", data["quality_checks"]),
        ("WORK_ORDERS", data["work_orders"]),
        ("DOWNTIME_EVENTS", data["downtime_events"]),
        ("STOCK_TRANSFERS", data["transfers"]),
        ("INVENTORY", data["inventory"]),
        ("SUPPLIER_DELIVERIES", data["deliveries"]),
        ("SENSORS", data["sensors"]),
        ("MACHINES", data["machines"]),
        ("PARTS_CATALOG", data["parts"]),
        ("WAREHOUSES", data["warehouses"]),
        ("SUPPLIERS", data["suppliers"]),
    ]

    try:
        if truncate:
            print("[*] Clearing existing operational tables...")
            for table_name, _ in tables_in_order:
                try:
                    con.execute(f"TRUNCATE TABLE {schema}.{table_name}")
                except Exception as exc:
                    print(f"    [warn] could not truncate {table_name}: {exc}")

        # Reverse back to parent-first insertion
        insertion_order = list(reversed(tables_in_order))

        for table_name, rows in insertion_order:
            if not rows:
                continue
            print(f"  -> Loading {len(rows):,} rows into {schema}.{table_name}...")
            # Convert list of dicts to iterable of tuples
            cols = list(rows[0].keys())
            tuple_rows = [[r[c] for c in cols] for r in rows]

            # pyexasol expects tuple (schema, table_name)
            con.import_from_iterable(tuple_rows, (schema, table_name))
            print(f"     ✓ {table_name} loaded.")

        print("\n[*] Data load completed successfully!")

        # Run verification queries on analytic views
        print("\n[*] Verifying analytic views with planted patterns...")
        v1 = con.execute("SELECT COUNT(*) AS CNT FROM LOGISENSE.V_SENSOR_PRE_FAILURE").fetchone()
        print(f"  ✓ V_SENSOR_PRE_FAILURE: {v1['CNT']} precursor readings detected")

        v2 = con.execute("SELECT COUNT(*) AS CNT FROM LOGISENSE.V_FAULT_ROOT_CAUSES").fetchone()
        print(f"  ✓ V_FAULT_ROOT_CAUSES: {v2['CNT']} fault root cause aggregations computed")

        v3 = con.execute("SELECT COUNT(*) AS CNT FROM LOGISENSE.V_TRANSFER_RECOMMENDATIONS").fetchone()
        print(f"  ✓ V_TRANSFER_RECOMMENDATIONS: {v3['CNT']} actionable transfer recommendations surfaced")

        v4 = con.execute("SELECT COUNT(*) AS CNT FROM LOGISENSE.V_EARLY_WARNING_ALERTS WHERE ALERT_LEVEL = 'ALERT'").fetchone()
        print(f"  ✓ V_EARLY_WARNING_ALERTS: {v4['CNT']} early-warning alerts triggered")

        v5 = con.execute("SELECT COUNT(*) AS CNT FROM LOGISENSE.V_SUPPLIER_SCORECARD").fetchone()
        print(f"  ✓ V_SUPPLIER_SCORECARD: {v5['CNT']} suppliers evaluated and ranked")

    finally:
        con.close()


def main():
    args = setup_cli()
    dataset = generate_all(size=args.size, seed=args.seed)
    generate_dirty_supplier_files()
    bulk_load_to_exasol(dataset, truncate=args.truncate)


if __name__ == "__main__":
    main()
