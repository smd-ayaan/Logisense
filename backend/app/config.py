import os
from pathlib import Path
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(REPO_ROOT / ".env")


class Settings:
    EXA_HOST: str = os.environ.get("EXA_HOST", "")
    EXA_PORT: str = os.environ.get("EXA_PORT", "8563")
    EXA_USER: str = os.environ.get("EXA_USER", "")
    EXA_PASSWORD: str = os.environ.get("EXA_PASSWORD", "")
    EXA_SCHEMA: str = os.environ.get("EXA_SCHEMA", "LOGISENSE")

    JWT_SECRET_KEY: str = os.environ.get("JWT_SECRET_KEY", "logisense_dev_secret_key_change_in_prod")
    JWT_ALGORITHM: str = os.environ.get("JWT_ALGORITHM", "HS256")
    JWT_EXPIRE_MINUTES: int = int(os.environ.get("JWT_EXPIRE_MINUTES", "480"))

    CORS_ORIGIN: str = os.environ.get("CORS_ORIGIN", "http://localhost:5173")


settings = Settings()
