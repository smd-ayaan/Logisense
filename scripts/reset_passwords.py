import sys
import bcrypt
from pathlib import Path
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(REPO_ROOT / ".env")
sys.path.insert(0, str(REPO_ROOT / "backend"))

from app.db import get_connection

# Generate a fresh, valid bcrypt hash for "demo1234"
hashed = bcrypt.hashpw(b"demo1234", bcrypt.gensalt(12)).decode("utf-8")

print(f"[*] Resetting password hashes to fresh bcrypt for 'demo1234'...")
with get_connection() as con:
    con.execute(
        "UPDATE LOGISENSE.USERS SET HASHED_PASSWORD = {hpw!s}",
        {"hpw": hashed}
    )
    rows = con.execute("SELECT EMAIL, HASHED_PASSWORD FROM LOGISENSE.USERS").fetchall()
    for r in rows:
        matches = bcrypt.checkpw(b"demo1234", r["HASHED_PASSWORD"].encode("utf-8"))
        print(f"  ✓ {r['EMAIL']}: verified={matches}")

print("[*] Passwords updated successfully!")
