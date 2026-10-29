"""
db.py — pyexasol connection helper for LogiSense.

Environment variables (loaded automatically from .env in repo root):
    EXA_HOST      e.g. snqxrcfu6bcknifnseuk3wohtu.clusters.exasol.com
    EXA_PORT      e.g. 8563
    EXA_USER      your SaaS username
    EXA_PASSWORD  your SaaS personal access token (PAT)
    EXA_SCHEMA    default schema (LOGISENSE)
"""

import os
import contextlib
from pathlib import Path

import pyexasol
from dotenv import load_dotenv

# Load .env from repo root (two levels up from backend/app/db.py)
_ENV_FILE = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(_ENV_FILE)


def _cfg(schema: str | None = "USE_ENV") -> dict:
    """Build pyexasol connection kwargs.

    Args:
        schema: Schema to open after connecting.
                - "USE_ENV"  (default) → reads EXA_SCHEMA env var
                - ""  or  None         → no schema opened (needed for setup
                                         before LOGISENSE schema is created)
                - any string           → opens that schema
    """
    missing = [k for k in ("EXA_HOST", "EXA_USER", "EXA_PASSWORD") if not os.environ.get(k)]
    if missing:
        raise EnvironmentError(
            f"Missing required environment variables: {', '.join(missing)}. "
            "Ensure they are set in your .env file or shell."
        )

    if schema == "USE_ENV":
        schema = os.environ.get("EXA_SCHEMA", "LOGISENSE")

    cfg: dict = {
        "dsn":        f"{os.environ['EXA_HOST']}:{os.environ.get('EXA_PORT', '8563')}",
        "user":       os.environ["EXA_USER"],
        "password":   os.environ["EXA_PASSWORD"],
        "fetch_dict": True,   # rows come back as dicts
        # websocket_sslopt=None → strict cert validation (pyexasol ≥ 1.0 default)
    }
    if schema:
        cfg["schema"] = schema
    return cfg


def get_connection(schema: str | None = "USE_ENV") -> pyexasol.ExaConnection:
    """Open and return a new pyexasol connection.

    Pass schema="" to connect without opening any schema (used by setup_db.py
    before LOGISENSE is created).  Caller must call .close() when done.
    """
    return pyexasol.connect(**_cfg(schema))


@contextlib.contextmanager
def connection(schema: str | None = "USE_ENV"):
    """Context manager that opens a connection and closes it on exit.

    Usage::

        with db.connection() as con:
            rows = con.execute("SELECT * FROM LOGISENSE.MACHINES").fetchall()
    """
    con = get_connection(schema)
    try:
        yield con
    finally:
        con.close()


def ping() -> bool:
    """Return True if a bare connection (no schema) can be established."""
    try:
        with connection(schema="") as con:
            con.execute("SELECT 1")
        return True
    except Exception as exc:  # noqa: BLE001
        print(f"[db.ping] connection failed: {exc}")
        return False
