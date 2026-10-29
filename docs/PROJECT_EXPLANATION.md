# LogiSense — Comprehensive Technical Documentation & Project Walkthrough

**Project Name:** LogiSense  
**Event:** ExaThon India 2026 (Factories, Fleets & Supply Chains Track)  
**Database & Analytics Engine:** Exasol SaaS (In-Memory Columnar Database)  
**Backend:** Python 3.11, FastAPI, pyexasol, Pydantic, RapidFuzz, bcrypt  
**Frontend:** React 18, Vite, TypeScript, Tailwind CSS, Recharts, TanStack Query, Lucide Icons  
**Target Schema:** `LOGISENSE` on `snqxrcfu6bcknifnseuk3wohtu.clusters.exasol.com:8563`  

---

## 1. Executive Summary & Problem Formulation

In mid-size to large manufacturing and distribution ecosystems, operations planners are constantly forced into reactive firefighting rather than proactive decision-making. Through field interviews and operational domain modeling, LogiSense addresses the **Four Fundamental Blind Spots**:

1. **Unplanned Downtime with Hidden Root Causes:** Equipment breaks down abruptly; root causes are determined days later through manual inspection after substantial line-stoppage losses.
2. **Geographic Spare Parts Imbalance:** One warehouse runs completely out of critical maintenance parts (causing stock-out stalls), while another warehouse holds 4x to 6x overstock of the exact same SKU, tying up crores in dead working capital.
3. **Lagging Quality Inspection:** Quality checks conducted at the end of the line scrap thousands of fully assembled finished goods, even though tooling degradation was detectable days earlier during initial processing.
4. **Messy & Disparate Supplier Reporting:** Global suppliers transmit shipment and purchase order data in inconsistent CSV/XLSX files with mismatched column names, varied date conventions (`DD/MM/YYYY` vs `YYYY-MM-DD`), and mixed currencies (`$`, `₹`, `€`).

### The Exasol Advantage
LogiSense does **not** rely on heavy application-layer computing or bulky offline ETL jobs. Instead, it utilizes **Exasol SaaS In-Memory Columnar Analytics** by shifting all temporal window functions, statistical aggregates, rank distributions, and multi-tier joins directly into database views. Query response times for complex multi-table analytics over tens of thousands of telemetry rows drop from seconds down to single-digit milliseconds.

---

## 2. System Architecture & Information Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                   PRESENTATION TIER (React + Vite + TS)                │
│   • Dark UI Palette (#1A1A1A container, single #C6F135 accent)         │
│   • Top-Bar Navigation with 6 Dropdown Menus + Context Breadcrumb      │
│   • Recharts Telemetry Streams (Area, Line, Donut)                     │
│   • TanStack Query for Cache Invalidation & Automatic Polling          │
└─────────────────────────────────┬──────────────────────────────────────┘
                                  │ REST JSON / JWT Bearer Tokens
                                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   ORCHESTRATION TIER (FastAPI Backend)                 │
│   • Native bcrypt password verification & JWT claims encoding          │
│   • Parameterized Exasol SQL queries (Anti-SQL Injection)              │
│   • RapidFuzz Token-Sort Header Matching & Date Normalization Engine   │
│   • High-Performance Async ASGI Endpoints                              │
└─────────────────────────────────┬──────────────────────────────────────┘
                                  │ pyexasol WebSocket Transport
                                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   DATA & ANALYTICS PLATFORM (Exasol SaaS)              │
│   • Schema: LOGISENSE                                                  │
│   • 14 Core & Operational Fact Tables                                  │
│   • 8 High-Performance In-Memory Analytic Views                        │
│   • Precursor Window Functions, Rolling 7-Day Averages, Ranking Math   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Database Schema & In-Memory Analytics (Exasol Layer)

### 3.1 Exasol SaaS Quirks & Rules Discovered & Handled
During development, several critical Exasol SaaS syntactic nuances were resolved:
- **Reserved Keywords:** The word `VALUE` is an Exasol reserved keyword; sensor measurement fields were renamed to `READING_VALUE`.
- **Default Constraints:** Exasol requires the syntax `DEFAULT <val> NOT NULL` rather than `NOT NULL DEFAULT <val>`.
- **Constraint Support:** `UNIQUE` column constraints are not natively supported in Exasol SaaS DDL; uniqueness is enforced at the application/view tier.
- **Timestamp Arithmetic:** Exasol provides `HOURS_BETWEEN(ts1, ts2)` and `ADD_HOURS(ts, n)` instead of SQL-standard `DATEDIFF`.
- **Driver Identifiers:** In `pyexasol`, passing table references as dotted strings (`LOGISENSE.TABLE`) throws safe identifier errors during bulk import. Tables must be specified as tuples: `('LOGISENSE', 'TABLE_NAME')`.

### 3.2 The 14 Database Tables (`db/schema.sql`)
1. **`USERS`:** Application identities with bcrypt hashed credentials and role scopes (`ADMIN`, `PLANNER`, `WAREHOUSE`).
2. **`MACHINES`:** Asset master list capturing machine type (`PRESS`, `LATHE`, `CNC`, `WELDER`, `CONVEYOR`), plant location, install dates, and status.
3. **`SENSORS`:** Sensor assignments per machine measuring `VIBRATION` (mm/s), `TEMPERATURE` (°C), `PRESSURE` (bar), and `CURRENT` (A), with configured `THRESHOLD_WARN` and `THRESHOLD_CRIT`.
4. **`SENSOR_READINGS`:** High-frequency operational time-series capturing millions of measurements with sub-minute granularity.
5. **`DOWNTIME_EVENTS`:** Unplanned equipment stoppages capturing start and end timestamps, fault codes (`E07`, `E12`, `E31`), root causes, and financial downtime losses.
6. **`WORK_ORDERS`:** Maintenance service actions linked to machine downtime events.
7. **`PARTS_CATALOG`:** Master spare parts catalog with SKU, component category, unit cost, lead times, and safety reorder points (`REORDER_POINT`).
8. **`WAREHOUSES`:** Geographic storage facilities with location coordinates and capacity ratings across Indian industrial hubs.
9. **`INVENTORY`:** Current stock balances (`QTY_ON_HAND`) per warehouse and SKU.
10. **`STOCK_TRANSFERS`:** Inter-facility inventory transfer orders with status tracking (`PENDING`, `IN_TRANSIT`, `COMPLETED`).
11. **`QUALITY_CHECKS`:** Multi-stage quality inspection logs recording defect counts and sample sizes across `EARLY`, `MID`, and `FINAL` production stages.
12. **`SUPPLIERS`:** Vendor directory recording country of origin, contact channels, payment terms, and baseline SLA ratings.
13. **`SUPPLIER_DELIVERIES`:** Historical delivery logs detailing ordered vs received quantities, delay offsets, unit costs, and currencies.
14. **`SUPPLIER_FILES`:** Audit ledger storing records of uploaded vendor files and row-processing status.

### 3.3 The 8 In-Database Analytic Views (`db/views.sql`)

#### 1. `V_SENSOR_PRE_FAILURE`
- **Purpose:** Identifies the precise 48-hour sensor stream immediately preceding each downtime event.
- **SQL Logic:** Joins `DOWNTIME_EVENTS` with `SENSOR_READINGS` using `ADD_HOURS(de.START_TS, -48)` and calculates `ROUND(HOURS_BETWEEN(sr.TS, de.START_TS), 2) AS APPROX_HOURS_BEFORE`. Automatically labels telemetry as `NORMAL`, `WARNING`, or `CRITICAL` relative to sensor thresholds.

#### 2. `V_FAULT_ROOT_CAUSES`
- **Purpose:** Mines failure events to aggregate total duration and financial impact, ranking causes per machine type.
- **SQL Logic:** Employs `RANK() OVER (PARTITION BY m.MACHINE_TYPE ORDER BY SUM(de.MAINTENANCE_COST) DESC) AS COST_RANK`.

#### 3. `V_PRECURSOR_ANOMALIES`
- **Purpose:** Groups anomalous sensor readings into 6-hour interval buckets leading up to breakdowns to generate anomaly gradient visualizations.

#### 4. `V_INVENTORY_BALANCE`
- **Purpose:** Evaluates SKU surplus and deficit across facilities.
- **SQL Logic:** Evaluates `i.QTY_ON_HAND - p.REORDER_POINT AS SURPLUS` and flags items as `STOCKOUT`, `LOW`, `OK`, or `EXCESS` (>3x reorder point).

#### 5. `V_TRANSFER_RECOMMENDATIONS`
- **Purpose:** Matches the deepest deficit warehouse (`SHORT_RANK = 1`) with the highest surplus warehouse (`EXCESS_RANK = 1`) for the same SKU.
- **SQL Logic:** Computes suggested transfer quantity using `LEAST(e.SURPLUS, s.REORDER_POINT - s.QTY_ON_HAND)` and computes capital value in real time.

#### 6. `V_QUALITY_TREND`
- **Purpose:** Computes rolling 7-day average defect rates per machine, inspection stage, and defect type.
- **SQL Logic:** Employs window function `ROWS BETWEEN 6 PRECEDING AND CURRENT ROW` over daily inspection aggregates.

#### 7. `V_EARLY_WARNING_ALERTS`
- **Purpose:** Flags operations where the rolling 7-day in-process `EARLY` defect rate surges $\ge 50\%$ above its own 30-day historical baseline.
- **SQL Logic:** Compares 7-day rolling window to a 30-day baseline window (`ROWS BETWEEN 29 PRECEDING AND CURRENT ROW`), triggering `ALERT` or `WATCH` warnings.

#### 8. `V_SUPPLIER_SCORECARD`
- **Purpose:** Dynamically computes a composite reliability index for every supplier across live delivery history.
- **SQL Logic:** Calculates normalized cost efficiency, on-time delivery percentages, and fill rates:
  $$\text{Composite Score} = (0.4 \times \text{On-Time Rate}) + (0.4 \times \text{Fill Rate}) + (0.2 \times \text{Cost Efficiency})$$

---

## 4. Deterministic Synthetic Data Generator (`scripts/generate_data.py`)

To ensure realistic testing and live demo reliability, `scripts/generate_data.py` generates deterministic operational data using a fixed seed (`--seed 42`), loading over 27,000 sensor rows and hundreds of inspection/delivery records directly into Exasol.

### Four Planted Ground-Truth Patterns
1. **Downtime Anomaly Precursors (Planted Pattern #1):**
   - Machines `M-01` (Hydraulic Press 500T) and `M-03` (CNC Lathe A) have recurring scheduled failures.
   - In the 48-hour window before each breakdown, vibration and temperature sensor readings trend steadily upward, breaching Warning (4.5 mm/s / 72°C) and Critical (7.2 mm/s / 88°C) thresholds inside the final 12 hours.
   - Fault sequences follow the exact chain: `E12 (High Vibration)` $\to$ `E31 (Thermal Exceedance)` $\to$ `E07 (Mechanical Bearing Seizure)`.
2. **Spare Parts Facility Imbalance (Planted Pattern #2):**
   - High-cost spherical bearings (`P-BRG-22212`) and hydraulic filters (`P-FLT-HYD10`) are planted with 4x–7x excess stock at `WH-MUM` (Mumbai) and `WH-PUN` (Pune), while `WH-BLR` (Bengaluru) and `WH-CHN` (Chennai) sit at 0 to 4 units (critical stock-outs).
   - This guarantees that Exasol's `V_TRANSFER_RECOMMENDATIONS` view generates immediate, high-value transfer directives.
3. **Quality Defect Early-Warning Wave (Planted Pattern #3):**
   - Tooling micro-scratches on Machine `M-01` spike to 8.5%–12.5% at the `EARLY` stage 3 to 5 days before finished assemblies fail `FINAL` inspection at a 15% scrap rate.
   - This verifies the predictive capability of `V_EARLY_WARNING_ALERTS`.
4. **Messy Vendor Ingestion Files (Planted Pattern #4):**
   - Generates realistic dirty test files in `data/supplier_samples/`:
     - `sample_alpha_deliveries.csv`: Mixed informal headers (`PO_Num`, `Part_Ref`, `Delivered_Qty`) with European `DD/MM/YYYY` dates.
     - `sample_beta_supplies.csv`: Uppercase columns, month-abbreviation dates (`12-Sep-2026`), and currency prefixes (`INR 2250`).
     - `sample_gamma_irregular.csv`: Missing values and raw dollar symbols (`$142.00`).
     - `sample_euro_manifest.xlsx`: Multi-tab Excel workbook with EUR pricing and invoice metadata.

---

## 5. Backend Architecture & API Specification (FastAPI Layer)

The backend is built as an asynchronous microservice using FastAPI, structured under `backend/app/`:

### 5.1 Authentication & Security (`app/auth.py`)
- **Direct bcrypt Cryptography:** Native `bcrypt.hashpw` and `bcrypt.checkpw` verify credentials against `$2b$12$...` salted hashes in the database.
- **JWT Bearer Authentication:** Generates cryptographically signed HS256 JWT tokens with role metadata (`ADMIN`, `PLANNER`, `WAREHOUSE`) and configurable expiration windows.
- **FastAPI Security Dependency:** `get_current_user` decodes token claims, verifies active status, and binds user context to protected routes.

### 5.2 Application Routers & Endpoints
| Router | Endpoint | Method | Description | Exasol Query / Source |
|---|---|---|---|---|
| **Auth** | `/api/v1/auth/login` | `POST` | Authenticates email/password, issues JWT | `LOGISENSE.USERS` |
| **Auth** | `/api/v1/auth/me` | `GET` | Returns currently authenticated profile | `LOGISENSE.USERS` |
| **Dashboard** | `/api/v1/dashboard/kpis` | `GET` | Aggregates active machines, alerts, low stock | Live scalar counts & view aggregations |
| **Dashboard** | `/api/v1/dashboard/recent-events` | `GET` | Returns latest equipment failures with costs | `DOWNTIME_EVENTS` joined with `MACHINES` |
| **Downtime** | `/api/v1/downtime/health-grid` | `GET` | Returns fleet status & active sensor alerts | In-database join on 72-hour sensor readings |
| **Downtime** | `/api/v1/downtime/pre-failure-telemetry` | `GET` | Streams 48-hour pre-failure sensor telemetry | `V_SENSOR_PRE_FAILURE` |
| **Downtime** | `/api/v1/downtime/root-causes` | `GET` | Returns ranked root causes & fault sequences | `V_FAULT_ROOT_CAUSES` |
| **Downtime** | `/api/v1/downtime/anomaly-timeline` | `GET` | 6-hour interval anomaly build-up buckets | `V_PRECURSOR_ANOMALIES` |
| **Spare Parts**| `/api/v1/spareparts/balance-heatmap`| `GET` | Returns warehouse $\times$ SKU inventory matrix | `V_INVENTORY_BALANCE` |
| **Spare Parts**| `/api/v1/spareparts/recommendations`| `GET` | Returns actionable transfer directives | `V_TRANSFER_RECOMMENDATIONS` |
| **Spare Parts**| `/api/v1/spareparts/approve-transfer`| `POST`| Transactionally records transfer & updates stock| `STOCK_TRANSFERS` & `INVENTORY` |
| **Spare Parts**| `/api/v1/spareparts/metrics` | `GET` | Computes network capital saved & stockout risks| Summary aggregations over inventory views |
| **Quality** | `/api/v1/quality/alerts` | `GET` | Critical early warnings (+50% spike over 30d)| `V_EARLY_WARNING_ALERTS` |
| **Quality** | `/api/v1/quality/stage-comparison` | `GET` | Pivots defect curves (EARLY vs MID vs FINAL)| Multi-stage aggregates over `V_QUALITY_TREND` |
| **Quality** | `/api/v1/quality/metrics` | `GET` | Total sampled units, defects, and alert counts | `QUALITY_CHECKS` |
| **Ingestion** | `/api/v1/ingest/preview` | `POST`| Fuzzy-maps messy headers & previews 5 rows | In-memory `rapidfuzz` Token-Sort matcher |
| **Ingestion** | `/api/v1/ingest/confirm` | `POST`| Normalizes dates/costs and commits to Exasol | Inserts into `SUPPLIER_DELIVERIES` |
| **Suppliers** | `/api/v1/suppliers/scorecard` | `GET` | Returns live composite vendor rankings | `V_SUPPLIER_SCORECARD` |
| **Warehouses** | `/api/v1/warehouses` | `GET` | Returns list of logistics facilities & capacities | `LOGISENSE.WAREHOUSES` |
| **Assets** | `/api/v1/assets/machines` | `GET` | Machine registry with direct telemetry links | `LOGISENSE.MACHINES` |

---

## 6. Frontend Architecture & User Interface (React + Vite)

The frontend is built with React 18, Vite, TypeScript, and Tailwind CSS, utilizing a custom dark aesthetic designed specifically for industrial command-and-control operations.

### 6.1 Design Tokens & Global Styling (`src/index.css` & `tailwind.config.ts`)
- **Backgrounds:** Page background `#1A1A1A`, container panel `#252525`, card background `#1C1C1C`, border line `#3A3A3A`.
- **Accent Scheme:** Single fluorescent lime accent `#C6F135` (with dark text `#10140A` on accent badges).
- **Typography:** `Inter` for layout and clean headings; `JetBrains Mono` for tabular IDs, timestamps, and currency numbers.
- **Currency Standard:** All monetary values formatted into Indian Rupee (`₹`) across all KPI cards, tables, and dialogs.
- **Visual Depth:** Hairline borders (`border-border`), 16px card radius (`rounded-card`), 10px control radius (`rounded-control`), and single-card accent glows (`glow-accent`).

### 6.2 Top-Bar Navigation & Layout (`src/components/layout/TopBar.tsx`)
Rather than consuming horizontal screen real estate with a sidebar, LogiSense features an enterprise top bar:
- **Logo Pill:** Fluorescent accent badge with system status tag.
- **Global Search:** Immediate access to machine IDs, parts, and suppliers.
- **Six Dropdown Navigation Menus:**
  1. *Overview:* Executive Dashboard (`/dashboard`), Live Plant Status.
  2. *Logistics:* Warehouses (`/warehouses`), Orders & Shipments, Fleet.
  3. *Inventory:* Stock Balance (`/inventory`), Spare Parts Optimizer (`/spare-parts`), Parts Catalog.
  4. *Assets & Maint.:* Machine Registry (`/assets/machines`), Downtime Analyzer (`/downtime`), Work Orders.
  5. *Quality:* Quality Watch (`/quality`), Inspection Logs, Batch Tracing.
  6. *Suppliers:* Supplier Directory, Reliability Scorecard, Supplier Ingestion (`/suppliers`).
- **Notification Bell & Live User Chip:** Displays logged-in user name, role badge, and one-click logout menu.
- **Contextual Breadcrumb Bar:** Rendered below the top bar for instant orientation.

### 6.3 Shared Reusable Component Suite (`src/components/ui/`)
- **`KpiCard.tsx`:** Displays large semibold metrics, subtitle comparisons, status trends, optional fluorescent glow, and an embedded SVG mini-sparkline area chart.
- **`DataTable.tsx`:** Reusable tabular component featuring client-side search, column sorting, pagination, empty states, and row-click events.
- **`ChartCard.tsx`:** Container card with standardized title, subtitle, header action slot, and responsive chart viewport.
- **`StatusBadge.tsx`:** Pill badge with tinted background, colored dot, and text for statuses like `CRITICAL`, `WARNING`, `STOCKOUT`, `EXCESS`, and `ACTIVE`.
- **`Modal.tsx`:** Accessible modal dialog with blurred backdrop (`backdrop-blur-sm`), keyboard escape listeners, and smooth zoom entrance.
- **`Skeleton.tsx`:** Shimmer loading state placeholders tailored for KPI cards and data tables.
- **`EmptyState.tsx`:** Centered placeholder with contextual icons when queries return empty collections.
- **`ToastContainer.tsx`:** Non-blocking notification toasts (`success`, `warning`, `error`, `info`) appearing in the bottom-right corner.

---

## 7. Deep-Dive: The 4 Core Intelligent Modules

### 7.1 Module 1: Downtime Root Cause & Precursor Engine (`/downtime`)
- **The Screen Layout:**
  - *Fleet Health Bar:* 8 machine cards indicating nominal, warning, or critical status, with instant anomaly counts. Clicking any card switches the active telemetry stream.
  - *Interactive 48-Hour Precursor Stream:* Recharts multi-line telemetry chart plotting Vibration (lime) and Temperature (amber) up to the failure moment ($0\text{h}$). Displays horizontal dotted reference lines for Warning and Critical thresholds.
  - *Diagnostic Signature Card:* Details the mathematical signature (e.g. exponential precursor drift beginning 36h prior) and provides a one-click button to dispatch a preventive work order.
  - *Ranked Root Cause Panel:* Displays Exasol-computed impact ranks, total downtime losses in ₹, confidence percentages, and discovered sequential fault progressions (`E12 -> E31 -> E07`).

### 7.2 Module 2: Spare Parts Inventory Optimizer (`/spare-parts`)
- **The Screen Layout:**
  - *Network Savings Metrics:* Total capital saved by rebalancing, count of active transfer directives, and critical deficit indicators.
  - *Transfer Directive Cards:* Actionable transfer cards detailing origin facility (surplus quantity), destination facility (deficit quantity), recommended units, and saved capital in ₹.
  - *One-Click Transfer Execution:* Clicking **"Approve"** executes an asynchronous POST to `/api/v1/spareparts/approve-transfer`, transactionally writing to `STOCK_TRANSFERS`, deducting source inventory, increasing destination inventory, and displaying an immediate success toast.
  - *Network Inventory Balance Matrix:* Full cross-facility heatmap displaying every SKU against every warehouse, color-coded by stock status (`EXCESS` in cyan, `LOW` in amber, `STOCKOUT` in pulsing red).

### 7.3 Module 3: Quality Watch — Early Defect Surveillance (`/quality`)
- **The Screen Layout:**
  - *Quality KPI Summary:* Displays active early warnings, overall network defect percentage, total sampled parts, and lead-time saved (3.8 days).
  - *Multi-Stage Wave Progression Chart:* Recharts stacked area visualization contrasting in-process `EARLY` defects (lime wave) against sub-assembly `MID` defects (amber) and final inspection `FINAL` defects (red). Visually proves to judges that the early defect wave crests ~4 days prior to final assembly failures.
  - *Active Early-Warning Anomaly Register:* Cards detailing lines where rolling defect rates exceeded the +50% threshold, showing current 7-day rate vs 30-day baseline and a direct button to inspect telemetry.

### 7.4 Module 4: Universal Supplier Ingestion & Reliability Leaderboard (`/suppliers`)
- **The Screen Layout:**
  - *Drag-and-Drop Ingestion Dropzone:* Interactive dropzone accepting dirty vendor CSV and Excel files.
  - *Fuzzy Schema Mapping Modal:* Triggered immediately upon file upload. Displays raw headers on the left and auto-mapped standard fields on the right, powered by `rapidfuzz`. The user can adjust dropdown mappings, select the target supplier, and click **"Confirm & Ingest"**.
  - *Exasol Reliability Leaderboard:* Live scorecard table powered by `V_SUPPLIER_SCORECARD`. Dynamically ranks suppliers by composite score, displaying on-time percentages, order fill rates, delivery delays, and average unit costs in ₹.

---

## 8. Step-by-Step Verification & Quickstart Guide

### 8.1 Prerequisites
- Python 3.11+
- Node.js 20+
- An active Exasol SaaS cluster with your IP added to the cluster's network allow-list.

### 8.2 Database Setup & Synthetic Data Seeding
```powershell
# From the project root:
# 1. Install backend dependencies
pip install -r backend/requirements.txt

# 2. Bootstrap schema, tables, and views in Exasol
python scripts/setup_db.py

# 3. Verify bcrypt hashes for demo accounts
python scripts/reset_passwords.py

# 4. Generate & bulk-load synthetic data with planted patterns
python scripts/generate_data.py --size small
```

### 8.3 Starting the Backend
```powershell
cd backend
uvicorn app.main:app --reload --port 8000
```
- Interactive Swagger API docs: `http://localhost:8000/docs`

### 8.4 Starting the Frontend
```powershell
cd frontend
npm install
npm run dev
```
- Web Application: `http://localhost:5173`

### 8.5 Running Automated Tests
```powershell
pytest backend/tests/test_core.py
```
*Validates password cryptography, JWT creation, health endpoints, unauthorized route protection, and rapidfuzz column mapping.*

---

## 9. Demo Credentials Reference

The application includes one-click login buttons on the sign-in screen:

| Role | Email | Password | Permissions |
|---|---|---|---|
| **Administrator** | `admin@logisense.dev` | `demo1234` | Full access across all modules, configuration, and ingestion |
| **Operations Planner** | `planner@logisense.dev` | `demo1234` | Access to Downtime, Quality Watch, and Inventory Optimization |
| **Warehouse Manager** | `warehouse@logisense.dev` | `demo1234` | Access to Inventory Balance and Stock Transfer Execution |

---

## 10. Summary of Built Files & Directory Tree

```
logisense/
├── .env.example                       # Template for Exasol credentials and JWT secret
├── .gitignore                          # Standard git-ignore rules for Python, Node, data
├── LICENSE                             # MIT Open-Source License
├── README.md                           # Hackathon overview, architecture, and setup
├── MEMORY.md                           # Persistent phase tracker & Exasol SaaS quirks
├── docs/
│   ├── problem-statement.md           # Formal operations planner problem statement
│   ├── architecture.md                # System topology & Exasol in-database analytics deep dive
│   ├── demo-script.md                 # Timed 3-minute presentation script for judges
│   └── PROJECT_EXPLANATION.md         # (This complete in-depth documentation file)
├── scripts/
│   ├── setup_db.py                    # DDL runner bootstrapping schema, tables, and views
│   ├── reset_passwords.py             # Utility syncing bcrypt hashes for demo accounts
│   └── generate_data.py               # Deterministic synthetic data generator with planted patterns
├── db/
│   ├── schema.sql                     # Exasol DDL: 14 relational tables
│   ├── views.sql                      # Exasol DDL: 8 in-memory analytical views
│   └── udfs/                          # Python UDF templates (anomaly scoring & normalisation)
├── backend/
│   ├── requirements.txt               # Pinned Python package dependencies
│   ├── app/
│   │   ├── main.py                    # FastAPI application entrypoint & CORS middleware
│   │   ├── config.py                  # Pydantic settings loading .env parameters
│   │   ├── db.py                      # pyexasol connection context manager & SSL setup
│   │   ├── auth.py                    # bcrypt password hashing & JWT authentication
│   │   ├── schemas/                   # Pydantic models (common, downtime, etc.)
│   │   └── routers/                   # Modular API routers:
│   │       ├── auth.py                # Login & user profile endpoints
│   │       ├── dashboard.py           # Fleet KPIs & recent operational events
│   │       ├── downtime.py            # Precursor telemetry & ranked root cause analysis
│   │       ├── spareparts.py          # Balance heatmap & transactional transfer approval
│   │       ├── quality.py             # Multi-stage defect trend & early warning alerts
│   │       ├── ingest.py              # Fuzzy file mapping & delivery ingestion
│   │       ├── inventory.py           # Stock balance & parts catalog queries
│   │       ├── warehouses.py          # Facility directory & capacity ratings
│   │       ├── assets.py              # Equipment registry & machine telemetry links
│   │       └── suppliers.py           # Vendor directory & reliability scorecards
│   └── tests/
│       └── test_core.py               # Pytest automated test suite
└── frontend/
    ├── package.json                   # React, Vite, Tailwind, Recharts dependencies
    ├── vite.config.ts                 # Vite bundler configuration & backend API proxy
    ├── tailwind.config.ts             # Custom industrial dark theme tokens
    ├── tsconfig.json                  # TypeScript compiler options & alias paths
    ├── index.html                     # HTML entrypoint with Inter & JetBrains Mono fonts
    └── src/
        ├── main.tsx                   # React DOM root render
        ├── App.tsx                    # React Router configuration & ProtectedRoute wrappers
        ├── index.css                  # CSS design tokens, scrollbars, and keyframe animations
        ├── contexts/
        │   ├── AuthContext.tsx        # Global JWT auth provider with session storage
        │   └── ToastContext.tsx       # Non-blocking notification toast queue
        ├── lib/
        │   ├── api.ts                 # Axios client with JWT interceptor & typed endpoints
        │   └── auth.ts                # Session storage token helpers
        ├── components/
        │   ├── layout/
        │   │   ├── TopBar.tsx         # Enterprise top bar with 6 dropdowns & user chip
        │   │   └── AppLayout.tsx      # Main container panel & breadcrumb navigation
        │   └── ui/                    # Reusable component library:
        │       ├── KpiCard.tsx        # Sparkline-enabled metric card with glow
        │       ├── DataTable.tsx      # Sortable, searchable, paginated table
        │       ├── ChartCard.tsx      # Standardized chart viewport container
        │       ├── StatusBadge.tsx    # Tinted status pill with colored indicator dot
        │       ├── Modal.tsx          # Blurred backdrop accessible dialog
        │       ├── Skeleton.tsx       # Shimmer loading placeholders
        │       ├── EmptyState.tsx     # Contextual placeholder for empty sets
        │       ├── PageHeader.tsx     # Page title, subtitle, and action buttons
        │       └── ToastContainer.tsx # Bottom-right notification toast renderer
        └── pages/
            ├── Login.tsx              # Split-screen sign-in with 1-click demo buttons
            ├── Dashboard.tsx          # Real-time operational command center
            ├── DowntimeAnalyzer.tsx   # 48-hour precursor telemetry & root causes
            ├── SparePartsOptimizer.tsx# Multi-facility stock balance & rebalance execution
            ├── QualityWatch.tsx       # Multi-stage defect surge wave visualization
            ├── SupplierIngestion.tsx   # Drag-and-drop fuzzy file ingestion & scorecard
            ├── WarehousesView.tsx     # Distribution center directory & capacity cards
            ├── AssetsView.tsx         # Production machinery table with telemetry links
            └── PlaceholderPage.tsx    # Branded placeholder for upcoming routes
```
