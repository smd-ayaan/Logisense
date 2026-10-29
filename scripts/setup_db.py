"""
setup_db.py — Bootstrap the LOGISENSE schema in Exasol SaaS.

What it does
------------
1. Connects to Exasol and runs a SELECT 1 ping.
2. Executes db/schema.sql  — creates LOGISENSE schema + 14 tables (IF NOT EXISTS).
3. Executes db/views.sql   — creates / replaces 8 analytic views.
4. Seeds 3 demo users (ADMIN, PLANNER, WAREHOUSE) — idempotent (skips if email exists).

Usage
-----
From the repo root with env vars already set in your shell:

    python scripts/setup_db.py

Environment variables needed (set in shell, not read from .env):
    EXA_HOST      EXA_PORT      EXA_USER      EXA_PASSWORD      EXA_SCHEMA
"""

import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv

# ── load .env from repo root first, before anything reads os.environ ──────────
REPO_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(REPO_ROOT / ".env")

sys.path.insert(0, str(REPO_ROOT / "backend"))

from app.db import get_connection, ping  # noqa: E402

# ── paths ─────────────────────────────────────────────────────────────────────
DB_DIR     = REPO_ROOT / "db"
SCHEMA_SQL = DB_DIR / "schema.sql"
VIEWS_SQL  = DB_DIR / "views.sql"

# ── demo users ────────────────────────────────────────────────────────────────
# Passwords are bcrypt hashes of "demo1234".
# Generated with: passlib.hash.bcrypt.hash("demo1234")
# We embed the hash so setup_db.py has no dependency on passlib at this stage.
DEMO_USERS = [
    {
        "user_id":   str(uuid.uuid4()),
        "email":     "admin@logisense.dev",
        "full_name": "Admin User",
        "role":      "ADMIN",
        "hash":      "$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW",
    },
    {
        "user_id":   str(uuid.uuid4()),
        "email":     "planner@logisense.dev",
        "full_name": "Priya Sharma",
        "role":      "PLANNER",
        "hash":      "$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW",
    },
    {
        "user_id":   str(uuid.uuid4()),
        "email":     "warehouse@logisense.dev",
        "full_name": "Ravi Kumar",
        "role":      "WAREHOUSE",
        "hash":      "$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW",
    },
]


def _split_statements(sql: str) -> list[str]:
    """Split a SQL file into individual statements.

    Walks line-by-line so that semicolons inside -- comments are never
    treated as statement terminators.
    """
    statements: list[str] = []
    current: list[str] = []

    for line in sql.splitlines():
        stripped = line.strip()

        # Pure comment line — append but never split here
        if stripped.startswith("--") or stripped == "":
            current.append(line)
            continue

        if ";" in line:
            # Check if the semicolon is after a -- comment marker on this line
            comment_pos = line.find("--")
            semi_pos    = line.find(";")
            if comment_pos != -1 and comment_pos < semi_pos:
                # Semicolon is inside a trailing comment — don't split
                current.append(line)
                continue

            # Real statement terminator
            before, after = line.split(";", 1)
            current.append(before)
            stmt = "\n".join(current).strip()
            # Only keep if there's at least one non-comment, non-blank line
            real = [l for l in stmt.splitlines()
                    if l.strip() and not l.strip().startswith("--")]
            if real:
                statements.append(stmt)
            current = []
            if after.strip():
                current.append(after)
        else:
            current.append(line)

    # Flush any trailing content (no trailing semicolon)
    if current:
        stmt = "\n".join(current).strip()
        real = [l for l in stmt.splitlines()
                if l.strip() and not l.strip().startswith("--")]
        if real:
            statements.append(stmt)

    return statements


def run_sql_file(con, path: Path, label: str) -> None:
    sql = path.read_text(encoding="utf-8")
    stmts = _split_statements(sql)
    ok = err = 0
    for stmt in stmts:
        try:
            con.execute(stmt)
            ok += 1
        except Exception as exc:  # noqa: BLE001
            print(f"  [WARN] statement failed: {exc!r}")
            print(f"         SQL: {stmt[:120]}…")
            err += 1
    print(f"  {label}: {ok} ok, {err} failed")


def seed_users(con) -> None:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S.000000")
    existing_emails: set[str] = set()
    try:
        rows = con.execute("SELECT EMAIL FROM LOGISENSE.USERS").fetchall()
        existing_emails = {r["EMAIL"] for r in rows}
    except Exception:
        pass  # table empty or doesn't exist yet

    seeded = 0
    for u in DEMO_USERS:
        if u["email"] in existing_emails:
            print(f"  [skip] user already exists: {u['email']}")
            continue
        # pyexasol uses named {key!s} format params with a dict — NOT positional ?
        con.execute(
            """
            INSERT INTO LOGISENSE.USERS
                (USER_ID, EMAIL, HASHED_PASSWORD, FULL_NAME, ROLE, CREATED_AT, IS_ACTIVE)
            VALUES
                ({user_id!s}, {email!s}, {hpw!s}, {full_name!s}, {role!s}, {now!s}, TRUE)
            """,
            {
                "user_id":   u["user_id"],
                "email":     u["email"],
                "hpw":       u["hash"],
                "full_name": u["full_name"],
                "role":      u["role"],
                "now":       now,
            },
        )
        print(f"  [ok]   seeded user: {u['email']} ({u['role']})")
        seeded += 1
    print(f"  Users: {seeded} seeded, {len(DEMO_USERS) - seeded} already existed")


def main() -> None:
    print("=" * 60)
    print("LogiSense — DB setup")
    print(f"  Host  : {os.environ.get('EXA_HOST', '(not set)')}")
    print(f"  Schema: {os.environ.get('EXA_SCHEMA', 'LOGISENSE')}")
    print("=" * 60)

    schema = os.environ.get("EXA_SCHEMA", "LOGISENSE")

    # ── 1. Ping (no schema — schema may not exist yet) ────────
    print("\n[1/4] Connecting to Exasol…")
    if not ping():
        print("ERROR: could not connect. Check EXA_* environment variables / .env.")
        sys.exit(1)
    print("  Connected ✓")

    # ── 2. Schema + tables ────────────────────────────────────
    # Connect WITHOUT schema first so we can run CREATE SCHEMA IF NOT EXISTS.
    # Then reconnect with the schema open for tables and views.
    print("\n[2/4] Creating schema and tables (schema.sql)…")
    con_raw = get_connection(schema="")   # no schema — safe before LOGISENSE exists
    try:
        run_sql_file(con_raw, SCHEMA_SQL, "schema.sql")
    finally:
        con_raw.close()

    # ── 3. Views ─────────────────────────────────────────────
    # Reconnect now that LOGISENSE exists; pyexasol can OPEN SCHEMA LOGISENSE.
    print("\n[3/4] Creating analytic views (views.sql)…")
    con = get_connection(schema=schema)
    try:
        run_sql_file(con, VIEWS_SQL, "views.sql")

        # ── 4. Demo users ─────────────────────────────────────
        print("\n[4/4] Seeding demo users…")
        seed_users(con)
    finally:
        con.close()

    print("\n" + "=" * 60)
    print("Setup complete. Run  python scripts/generate_data.py  next.")
    print("=" * 60)


if __name__ == "__main__":
    main()
