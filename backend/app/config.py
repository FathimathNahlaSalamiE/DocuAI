import os
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
MODEL = "openai/gpt-oss-120b"
CHROMA_DIR = os.environ.get("CHROMA_DIR", "./chroma_db")
UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "./uploads")
EMBED_CACHE = os.environ.get("EMBED_CACHE", "./models")
CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",")

# --- Auth ---
JWT_SECRET = os.environ.get("JWT_SECRET")
if not JWT_SECRET:
    raise RuntimeError(
        "JWT_SECRET is not set. Add a line like JWT_SECRET=<random string> to backend/.env. "
        'Generate one with: python -c "import secrets; print(secrets.token_hex(32))"'
    )
TOKEN_HOURS = int(os.environ.get("TOKEN_HOURS", "168"))  # sessions last 7 days by default
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./users.db")

# --- Email (verification + password reset) ---
# Any SMTP provider works. Leave SMTP_HOST empty for dev mode: emails are printed to the
# backend terminal instead of being sent.
SMTP_HOST = os.environ.get("SMTP_HOST", "")                  # e.g. smtp-relay.brevo.com
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
EMAIL_FROM = os.environ.get("EMAIL_FROM", SMTP_USER)         # must be a sender your provider allows
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173").rstrip("/")
VERIFY_MINUTES = int(os.environ.get("VERIFY_MINUTES", "1440"))   # verification link lasts 24 hours
RESET_MINUTES = int(os.environ.get("RESET_MINUTES", "30"))       # reset link lasts 30 minutes
EMAIL_COOLDOWN_SECONDS = int(os.environ.get("EMAIL_COOLDOWN_SECONDS", "60"))

# --- Guest mode (use the app without an account) ---
GUEST_TTL_HOURS = int(os.environ.get("GUEST_TTL_HOURS", "24"))            # guest documents + chats are deleted after this
GUEST_MAX_DOCS = int(os.environ.get("GUEST_MAX_DOCS", "2"))               # documents a guest may keep at once
GUEST_MAX_UPLOAD_MB = int(os.environ.get("GUEST_MAX_UPLOAD_MB", "10"))
USER_MAX_UPLOAD_MB = int(os.environ.get("USER_MAX_UPLOAD_MB", "25"))
GUEST_ASKS_PER_HOUR = int(os.environ.get("GUEST_ASKS_PER_HOUR", "20"))    # per guest
GUEST_ASKS_GLOBAL_PER_HOUR = int(os.environ.get("GUEST_ASKS_GLOBAL_PER_HOUR", "200"))   # all guests combined
GUEST_UPLOADS_GLOBAL_PER_HOUR = int(os.environ.get("GUEST_UPLOADS_GLOBAL_PER_HOUR", "60"))