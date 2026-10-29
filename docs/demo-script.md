# LogiSense — 3-Minute Hackathon Demo Script

**Speaker Role:** Ayaan — Solo Builder, ExaThon India 2026

---

## ⏱️ Minute 0:00 – 0:30: The Problem Statement & Pitch

> *"Good morning judges. Consider Priya, an operations planner at a manufacturing plant with six distribution centers. She struggles with four persistent blind spots: machines stop without warning, warehouses run out of parts while others sit overstocked, defects are only caught after thousands of finished goods are scrapped, and suppliers send delivery reports in conflicting file formats.*
>
> *Operational data is too scattered and query times are too slow. That is why I built **LogiSense** — powered entirely by **Exasol's in-memory columnar database**."*

---

## ⏱️ Minute 0:30 – 1:15: Module 1 — Downtime Analyzer

> *(Navigate to **Assets & Maint. → Downtime Analyzer** (`/downtime`))*
>
> *"Here on the fleet dashboard, Machine M-01 is flagged as CRITICAL. Let's look at its 48-hour telemetry stream.*
>
> *Notice this telemetry curve: 36 hours before failure, vibration begins rising exponentially, crossing the Warning and Critical thresholds right before catastrophic bearing seizure. Exasol evaluates this window function across 27,000 readings in just 14 milliseconds.*
>
> *Down below, Exasol's `V_FAULT_ROOT_CAUSES` view identifies the exact fault sequence: `E12 (Vibration)` followed by `E31 (Thermal Overload)` resulting in `E07 (Bearing Seizure)`, saving ₹7,01,350 in unplanned downtime."*

---

## ⏱️ Minute 1:15 – 1:55: Module 2 — Spare Parts Optimizer

> *(Navigate to **Inventory → Spare Parts Optimizer** (`/spare-parts`))*
>
> *"Next: inventory balancing. In the balance matrix, notice that Mumbai Hub holds 250 units of high-grade spherical bearings — over 6 times its reorder point. Meanwhile, Bengaluru Depot is down to 4 units and facing an immediate stock-out.*
>
> *Instead of issuing an expensive rush purchase order, Exasol's `V_TRANSFER_RECOMMENDATIONS` view automatically pairs the surplus with the deficit. I click **'Approve'**, and the transfer is transactionally recorded directly in Exasol, saving ₹1,61,850 in working capital."*

---

## ⏱️ Minute 1:55 – 2:30: Module 3 — Quality Watch

> *(Navigate to **Quality → Quality Watch** (`/quality`))*
>
> *"Third: quality surveillance. Catching defects at final inspection is too late. On this multi-stage wave chart, look at the accent line representing the in-process EARLY inspection stage.*
>
> *Exasol's rolling 7-day window function detects that tooling scratches spiked to 11.2% — a +50% surge over the 30-day baseline — **3.8 days before** finished assemblies were rejected at final end-of-line inspection. We stopped the defect at the source and avoided ₹3,20,000 in scrapped material."*

---

## ⏱️ Minute 2:30 – 3:00: Module 4 — Supplier Ingestion & Wrap-Up

> *(Navigate to **Suppliers → Supplier Ingestion** (`/suppliers`))*
>
> *"Finally, suppliers send inconsistent files. I drag and drop `sample_beta_supplies.csv` from our test suite into the ingestion zone.*
>
> *Our engine automatically fuzzy-matches dirty headers like `VENDOR_CODE` and `PRICE_EACH` to the standard schema, normalizes mixed dates and currency symbols, and commits the records to Exasol. The leaderboard immediately recomputes composite scores across on-time rates and fill rates.*
>
> *LogiSense proves that pushing analytical compute into Exasol transforms reactive troubleshooting into proactive, sub-second decision making. Thank you!"*
