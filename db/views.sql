-- ============================================================
-- LogiSense — analytic views (LOGISENSE schema)
-- All heavy computation stays inside Exasol (window functions,
-- aggregations) — the API layer is a thin read-only consumer.
-- ============================================================

-- ============================================================
-- MODULE 1: DOWNTIME ANALYZER
-- ============================================================

-- V_SENSOR_PRE_FAILURE
-- Sensor readings in the 48 h window immediately before each downtime event.
-- Used to visualise anomaly build-up and identify precursor patterns.
CREATE OR REPLACE VIEW LOGISENSE.V_SENSOR_PRE_FAILURE AS
SELECT
    de.EVENT_ID,
    de.MACHINE_ID,
    m.MACHINE_NAME,
    m.MACHINE_TYPE,
    de.FAULT_CODE,
    de.START_TS                                                     AS FAILURE_TS,
    s.SENSOR_ID,
    s.SENSOR_TYPE,
    s.UNIT,
    s.THRESHOLD_WARN,
    s.THRESHOLD_CRIT,
    sr.TS                                                           AS READING_TS,
    sr.READING_VALUE,
    -- hours before the failure (positive = before event)
    -- HOURS_BETWEEN is the correct Exasol built-in (Exasol has no DATEDIFF)
    ROUND(HOURS_BETWEEN(sr.TS, de.START_TS), 2)                     AS APPROX_HOURS_BEFORE,
    CASE
        WHEN sr.READING_VALUE >= s.THRESHOLD_CRIT THEN 'CRITICAL'
        WHEN sr.READING_VALUE >= s.THRESHOLD_WARN THEN 'WARNING'
        ELSE 'NORMAL'
    END                                                             AS ALERT_LEVEL
FROM LOGISENSE.DOWNTIME_EVENTS   de
JOIN LOGISENSE.MACHINES           m  ON m.MACHINE_ID  = de.MACHINE_ID
JOIN LOGISENSE.SENSORS            s  ON s.MACHINE_ID  = de.MACHINE_ID
JOIN LOGISENSE.SENSOR_READINGS    sr ON sr.SENSOR_ID  = s.SENSOR_ID
WHERE sr.TS >= ADD_HOURS(de.START_TS, -48)
  AND sr.TS <  de.START_TS;


-- V_FAULT_ROOT_CAUSES
-- Aggregated fault statistics per machine type and fault code.
-- Ranked by total cost desc — surfaces the highest-impact fault patterns.
CREATE OR REPLACE VIEW LOGISENSE.V_FAULT_ROOT_CAUSES AS
SELECT
    m.MACHINE_TYPE,
    de.FAULT_CODE,
    de.ROOT_CAUSE,
    COUNT(*)                                    AS EVENT_COUNT,
    ROUND(AVG(de.DURATION_H), 2)               AS AVG_DURATION_H,
    ROUND(SUM(de.DURATION_H), 2)               AS TOTAL_DURATION_H,
    ROUND(SUM(de.MAINTENANCE_COST), 2)         AS TOTAL_COST,
    RANK() OVER (
        PARTITION BY m.MACHINE_TYPE
        ORDER BY SUM(de.MAINTENANCE_COST) DESC
    )                                           AS COST_RANK
FROM LOGISENSE.DOWNTIME_EVENTS de
JOIN LOGISENSE.MACHINES         m ON m.MACHINE_ID = de.MACHINE_ID
WHERE de.DURATION_H IS NOT NULL
GROUP BY m.MACHINE_TYPE, de.FAULT_CODE, de.ROOT_CAUSE;


-- V_PRECURSOR_ANOMALIES
-- Per failure event: count of WARNING/CRITICAL sensor readings
-- in each 6-hour bucket inside the 48 h pre-failure window.
-- Drives the "anomaly build-up" timeline chart.
CREATE OR REPLACE VIEW LOGISENSE.V_PRECURSOR_ANOMALIES AS
SELECT
    pf.EVENT_ID,
    pf.MACHINE_ID,
    pf.MACHINE_NAME,
    pf.FAULT_CODE,
    pf.FAILURE_TS,
    pf.SENSOR_TYPE,
    -- bucket: 0 = last 6 h, 1 = 6-12 h before, …, 7 = 42-48 h before
    FLOOR(pf.APPROX_HOURS_BEFORE / 6)          AS HOURS_BUCKET,
    pf.ALERT_LEVEL,
    COUNT(*)                                    AS READING_COUNT
FROM LOGISENSE.V_SENSOR_PRE_FAILURE pf
WHERE pf.ALERT_LEVEL IN ('WARNING', 'CRITICAL')
GROUP BY
    pf.EVENT_ID, pf.MACHINE_ID, pf.MACHINE_NAME,
    pf.FAULT_CODE, pf.FAILURE_TS, pf.SENSOR_TYPE,
    FLOOR(pf.APPROX_HOURS_BEFORE / 6), pf.ALERT_LEVEL;


-- ============================================================
-- MODULE 2: SPARE PARTS OPTIMIZER
-- ============================================================

-- V_INVENTORY_BALANCE
-- Current stock vs reorder point for every warehouse × part combination.
-- Surplus = qty_on_hand − reorder_point (positive = overstocked, negative = short).
CREATE OR REPLACE VIEW LOGISENSE.V_INVENTORY_BALANCE AS
SELECT
    i.INVENTORY_ID,
    w.WAREHOUSE_ID,
    w.WAREHOUSE_NAME,
    w.LOCATION                                  AS WAREHOUSE_LOCATION,
    p.PART_ID,
    p.PART_NAME,
    p.CATEGORY,
    p.UNIT_COST,
    p.REORDER_POINT,
    p.LEAD_TIME_DAYS,
    i.QTY_ON_HAND,
    i.QTY_ON_HAND - p.REORDER_POINT            AS SURPLUS,
    CASE
        WHEN i.QTY_ON_HAND <= 0              THEN 'STOCKOUT'
        WHEN i.QTY_ON_HAND < p.REORDER_POINT THEN 'LOW'
        WHEN i.QTY_ON_HAND > p.REORDER_POINT * 3 THEN 'EXCESS'
        ELSE 'OK'
    END                                         AS STOCK_STATUS,
    i.LAST_UPDATED
FROM LOGISENSE.INVENTORY     i
JOIN LOGISENSE.WAREHOUSES    w ON w.WAREHOUSE_ID = i.WAREHOUSE_ID
JOIN LOGISENSE.PARTS_CATALOG p ON p.PART_ID      = i.PART_ID;


-- V_TRANSFER_RECOMMENDATIONS
-- For each part that has at least one LOW/STOCKOUT warehouse and one EXCESS
-- warehouse, suggests a transfer: move QTY from the most-overstocked to the
-- most-understocked location.
CREATE OR REPLACE VIEW LOGISENSE.V_TRANSFER_RECOMMENDATIONS AS
WITH ranked AS (
    SELECT
        PART_ID,
        PART_NAME,
        CATEGORY,
        WAREHOUSE_ID,
        WAREHOUSE_NAME,
        WAREHOUSE_LOCATION,
        QTY_ON_HAND,
        SURPLUS,
        STOCK_STATUS,
        REORDER_POINT,
        UNIT_COST,
        RANK() OVER (PARTITION BY PART_ID ORDER BY SURPLUS DESC) AS EXCESS_RANK,
        RANK() OVER (PARTITION BY PART_ID ORDER BY SURPLUS ASC)  AS SHORT_RANK
    FROM LOGISENSE.V_INVENTORY_BALANCE
)
SELECT
    e.PART_ID,
    e.PART_NAME,
    e.CATEGORY,
    e.WAREHOUSE_ID                              AS FROM_WAREHOUSE_ID,
    e.WAREHOUSE_NAME                            AS FROM_WAREHOUSE,
    e.WAREHOUSE_LOCATION                        AS FROM_LOCATION,
    e.QTY_ON_HAND                               AS FROM_QTY,
    s.WAREHOUSE_ID                              AS TO_WAREHOUSE_ID,
    s.WAREHOUSE_NAME                            AS TO_WAREHOUSE,
    s.WAREHOUSE_LOCATION                        AS TO_LOCATION,
    s.QTY_ON_HAND                               AS TO_QTY,
    s.REORDER_POINT,
    -- suggested transfer qty: enough to bring dest to reorder_point, capped at surplus
    LEAST(e.SURPLUS, s.REORDER_POINT - s.QTY_ON_HAND) AS SUGGESTED_QTY,
    LEAST(e.SURPLUS, s.REORDER_POINT - s.QTY_ON_HAND) * e.UNIT_COST AS TRANSFER_VALUE_USD
FROM ranked e
JOIN ranked s ON s.PART_ID = e.PART_ID AND s.SHORT_RANK = 1
WHERE e.EXCESS_RANK = 1
  AND e.STOCK_STATUS = 'EXCESS'
  AND s.STOCK_STATUS IN ('LOW', 'STOCKOUT')
  AND LEAST(e.SURPLUS, s.REORDER_POINT - s.QTY_ON_HAND) > 0;


-- ============================================================
-- MODULE 3: QUALITY WATCH
-- ============================================================

-- V_QUALITY_TREND
-- 7-day rolling average defect rate per machine × stage × defect_type.
-- Uses a window function; Exasol evaluates this in-database.
CREATE OR REPLACE VIEW LOGISENSE.V_QUALITY_TREND AS
SELECT
    qc.MACHINE_ID,
    m.MACHINE_NAME,
    m.MACHINE_TYPE,
    qc.CHECK_STAGE,
    qc.DEFECT_TYPE,
    CAST(qc.TS AS DATE)                         AS CHECK_DATE,
    ROUND(AVG(qc.DEFECT_RATE), 5)              AS DAILY_AVG_DEFECT_RATE,
    ROUND(
        AVG(AVG(qc.DEFECT_RATE)) OVER (
            PARTITION BY qc.MACHINE_ID, qc.CHECK_STAGE, qc.DEFECT_TYPE
            ORDER BY CAST(qc.TS AS DATE)
            ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
        ), 5
    )                                           AS ROLLING_7D_DEFECT_RATE,
    COUNT(*)                                    AS CHECKS_ON_DAY
FROM LOGISENSE.QUALITY_CHECKS qc
JOIN LOGISENSE.MACHINES         m ON m.MACHINE_ID = qc.MACHINE_ID
GROUP BY
    qc.MACHINE_ID, m.MACHINE_NAME, m.MACHINE_TYPE,
    qc.CHECK_STAGE, qc.DEFECT_TYPE,
    CAST(qc.TS AS DATE);


-- V_EARLY_WARNING_ALERTS
-- Flags machine × defect_type combinations where the 7-day rolling EARLY defect
-- rate has risen ≥ 50 % above its own 30-day baseline — a leading indicator of
-- FINAL stage failures.
CREATE OR REPLACE VIEW LOGISENSE.V_EARLY_WARNING_ALERTS AS
WITH early_trend AS (
    SELECT
        MACHINE_ID,
        MACHINE_NAME,
        MACHINE_TYPE,
        DEFECT_TYPE,
        CHECK_DATE,
        ROLLING_7D_DEFECT_RATE,
        AVG(ROLLING_7D_DEFECT_RATE) OVER (
            PARTITION BY MACHINE_ID, DEFECT_TYPE
            ORDER BY CHECK_DATE
            ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
        ) AS BASELINE_30D
    FROM LOGISENSE.V_QUALITY_TREND
    WHERE CHECK_STAGE = 'EARLY'
)
SELECT
    MACHINE_ID,
    MACHINE_NAME,
    MACHINE_TYPE,
    DEFECT_TYPE,
    CHECK_DATE,
    ROUND(ROLLING_7D_DEFECT_RATE, 5)            AS CURRENT_RATE,
    ROUND(BASELINE_30D, 5)                       AS BASELINE_30D_RATE,
    ROUND(
        (ROLLING_7D_DEFECT_RATE - BASELINE_30D) / NULLIFZERO(BASELINE_30D) * 100,
    1)                                           AS PCT_ABOVE_BASELINE,
    CASE
        WHEN ROLLING_7D_DEFECT_RATE >= BASELINE_30D * 1.5 THEN 'ALERT'
        WHEN ROLLING_7D_DEFECT_RATE >= BASELINE_30D * 1.2 THEN 'WATCH'
        ELSE 'NORMAL'
    END                                          AS ALERT_LEVEL
FROM early_trend
WHERE BASELINE_30D IS NOT NULL;


-- ============================================================
-- MODULE 4: SUPPLIER SCORECARD
-- ============================================================

-- V_SUPPLIER_SCORECARD
-- Weighted composite score per supplier from live delivery history.
-- Score = 0.4 × on_time + 0.4 × quality + 0.2 × cost_efficiency (1 - norm_cost)
CREATE OR REPLACE VIEW LOGISENSE.V_SUPPLIER_SCORECARD AS
WITH delivery_stats AS (
    SELECT
        sd.SUPPLIER_ID,
        COUNT(*)                                                AS TOTAL_DELIVERIES,
        ROUND(AVG(CASE WHEN sd.DELAY_DAYS <= 0 THEN 1.0 ELSE 0.0 END), 3)
                                                                AS ON_TIME_RATE,
        ROUND(AVG(CASE WHEN sd.QTY_RECEIVED >= sd.QTY_ORDERED THEN 1.0
                       ELSE CAST(sd.QTY_RECEIVED AS DECIMAL) / NULLIFZERO(sd.QTY_ORDERED)
                  END), 3)                                      AS FILL_RATE,
        ROUND(AVG(sd.DELAY_DAYS), 1)                           AS AVG_DELAY_DAYS,
        ROUND(AVG(sd.UNIT_COST), 4)                            AS AVG_UNIT_COST_USD
    FROM LOGISENSE.SUPPLIER_DELIVERIES sd
    GROUP BY sd.SUPPLIER_ID
),
cost_bounds AS (
    SELECT
        MIN(AVG_UNIT_COST_USD) AS MIN_COST,
        MAX(AVG_UNIT_COST_USD) AS MAX_COST
    FROM delivery_stats
)
SELECT
    s.SUPPLIER_ID,
    s.SUPPLIER_NAME,
    s.COUNTRY,
    s.PAYMENT_TERMS,
    s.LEAD_TIME_DAYS,
    d.TOTAL_DELIVERIES,
    d.ON_TIME_RATE,
    d.FILL_RATE,
    d.AVG_DELAY_DAYS,
    d.AVG_UNIT_COST_USD,
    -- cost efficiency: 1 = cheapest, 0 = most expensive
    ROUND(
        1 - (d.AVG_UNIT_COST_USD - c.MIN_COST) / NULLIFZERO(c.MAX_COST - c.MIN_COST),
    3)                                              AS COST_EFFICIENCY,
    -- composite score (higher = better supplier)
    ROUND(
        0.4 * d.ON_TIME_RATE
      + 0.4 * d.FILL_RATE
      + 0.2 * (1 - (d.AVG_UNIT_COST_USD - c.MIN_COST) / NULLIFZERO(c.MAX_COST - c.MIN_COST)),
    3)                                              AS COMPOSITE_SCORE,
    RANK() OVER (ORDER BY
        0.4 * d.ON_TIME_RATE
      + 0.4 * d.FILL_RATE
      + 0.2 * (1 - (d.AVG_UNIT_COST_USD - c.MIN_COST) / NULLIFZERO(c.MAX_COST - c.MIN_COST))
    DESC)                                           AS SCORE_RANK
FROM LOGISENSE.SUPPLIERS     s
JOIN delivery_stats           d ON d.SUPPLIER_ID = s.SUPPLIER_ID
CROSS JOIN cost_bounds        c;
