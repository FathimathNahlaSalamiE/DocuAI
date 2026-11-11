import hashlib
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, Header, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app import config
from app.db import User, get_db

bearer = HTTPBearer(auto_error=False)


# ---------- passwords ----------

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except ValueError:  # e.g. password longer than bcrypt's 72-byte limit
        return False


def _fingerprint(password_hash: str) -> str:
    """Short digest of the current password hash. Baked into reset links so a link stops
    working the moment the password changes (i.e. reset links are single-use)."""
    return hashlib.sha256(password_hash.encode()).hexdigest()[:16]


# ---------- tokens ----------
# Every token carries a "purpose" claim. A verification or reset link can never be used as a
# login session, and a login session can never be used as a reset link.

def _encode(user_id: int, purpose: str, minutes: int, **extra) -> str:
    expires = datetime.now(timezone.utc) + timedelta(minutes=minutes)
    payload = {"sub": str(user_id), "purpose": purpose, "exp": expires, **extra}
    return jwt.encode(payload, config.JWT_SECRET, algorithm="HS256")


def _decode(token: str, purpose: str) -> dict:
    """Returns the payload, or raises ValueError if the token is bad, expired or the wrong kind."""
    try:
        payload = jwt.decode(token, config.JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise ValueError("invalid or expired token")
    if payload.get("purpose") != purpose:
        raise ValueError("wrong token type")
    return payload


def create_token(user_id: int) -> str:
    """Login session token."""
    return _encode(user_id, "session", config.TOKEN_HOURS * 60)


def create_verify_token(user: User) -> str:
    return _encode(user.id, "verify", config.VERIFY_MINUTES, email=user.email)


def create_reset_token(user: User) -> str:
    return _encode(user.id, "reset", config.RESET_MINUTES, pwd=_fingerprint(user.password_hash))


def user_from_verify_token(token: str, db: Session) -> User:
    payload = _decode(token, "verify")
    user = db.get(User, int(payload["sub"]))
    if user is None or user.email != payload.get("email"):
        raise ValueError("account not found")
    return user


def user_from_reset_token(token: str, db: Session) -> User:
    payload = _decode(token, "reset")
    user = db.get(User, int(payload["sub"]))
    if user is None or payload.get("pwd") != _fingerprint(user.password_hash):
        raise ValueError("link already used or account not found")
    return user


# ---------- dependency for protected routes ----------

def current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    """Resolves the signed-in user from the Authorization header, or raises 401."""
    if creds is None:
        raise HTTPException(401, "Not signed in")
    try:
        payload = _decode(creds.credentials, "session")
        user = db.get(User, int(payload["sub"]))
    except (ValueError, KeyError):
        raise HTTPException(401, "Session expired. Please sign in again.")
    if user is None:
        raise HTTPException(401, "Account not found. Please sign in again.")
    return user


# ---------- who is making this request: a signed-in user, or a guest ----------

GUEST_ID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")


@dataclass
class Owner:
    key: str            # "u:12" for an account, "g:<uuid>" for a guest; used to scope all data
    is_guest: bool
    user: User | None = None


def current_owner(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    x_guest_id: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Owner:
    """A valid login token wins. A bad or expired token is a 401 (never silently downgraded to
    guest). With no token, a well-formed X-Guest-Id header identifies a guest."""
    if creds is not None:
        user = current_user(creds, db)
        return Owner(key=f"u:{user.id}", is_guest=False, user=user)
    if x_guest_id and GUEST_ID_RE.match(x_guest_id):
        return Owner(key=f"g:{x_guest_id}", is_guest=True)
    raise HTTPException(401, "Missing session. Reload the page.")