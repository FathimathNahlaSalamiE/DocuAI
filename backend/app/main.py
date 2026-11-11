import asyncio
import json
import os
import shutil
import tempfile
import time
from contextlib import asynccontextmanager
from datetime import timedelta

from fastapi import BackgroundTasks, Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import config, limits, mailer, rag
from app.auth import (
    Owner,
    create_reset_token,
    create_token,
    create_verify_token,
    current_owner,
    current_user,
    hash_password,
    user_from_reset_token,
    user_from_verify_token,
    verify_password,
)
from app.db import Conversation, Message, SessionLocal, User, get_db, init_db, utcnow

init_db()  # creates any missing tables on startup

HOUR = 3600


# ---------- guest cleanup ----------

def purge_guests() -> None:
    """Delete guest chats and guest document chunks older than GUEST_TTL_HOURS."""
    cutoff = utcnow() - timedelta(hours=config.GUEST_TTL_HOURS)
    with SessionLocal() as db:
        for conv in db.query(Conversation).filter(
            Conversation.owner.like("g:%"), Conversation.updated_at < cutoff
        ):
            db.delete(conv)
        db.commit()
    rag.purge_guest_chunks(int(time.time()) - config.GUEST_TTL_HOURS * HOUR)


async def _purge_loop():
    while True:
        try:
            await asyncio.to_thread(purge_guests)
        except Exception as e:  # noqa: BLE001 - cleanup must never crash the server
            print(f"[purge] guest cleanup failed: {e}", flush=True)
        await asyncio.sleep(HOUR)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    task = asyncio.create_task(_purge_loop())
    yield
    task.cancel()


app = FastAPI(title="DocuAI", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],  # includes the X-Guest-Id header the frontend sends in guest mode
)


# ---------- request bodies ----------

def _check_password(v: str) -> str:
    if len(v) < 8:
        raise ValueError("Password must be at least 8 characters.")
    if len(v.encode()) > 72:
        raise ValueError("Password is too long (72 bytes maximum).")
    return v


class RegisterBody(BaseModel):
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def password_rules(cls, v: str) -> str:
        return _check_password(v)


class LoginBody(BaseModel):
    email: EmailStr
    password: str


class EmailBody(BaseModel):
    email: EmailStr


class TokenBody(BaseModel):
    token: str


class ResetBody(BaseModel):
    token: str
    password: str

    @field_validator("password")
    @classmethod
    def password_rules(cls, v: str) -> str:
        return _check_password(v)


class Query(BaseModel):
    question: str
    sources: list[str] | None = None   # restrict to these files; None/[] = all of the owner's files
    conversation_id: int | None = None  # continue this chat; None starts a new one


# ---------- helpers ----------

def _cooldown_ok(user: User) -> bool:
    """False if we emailed this user very recently (stops the send buttons being used to spam)."""
    if user.last_email_at is None:
        return True
    return utcnow() - user.last_email_at >= timedelta(seconds=config.EMAIL_COOLDOWN_SECONDS)


def _queue_verification(user: User, db: Session, background: BackgroundTasks) -> None:
    link = f"{config.FRONTEND_URL}/?verify={create_verify_token(user)}"
    user.last_email_at = utcnow()
    db.commit()
    background.add_task(mailer.send_verification_email, user.email, link)


def _queue_reset(user: User, db: Session, background: BackgroundTasks) -> None:
    link = f"{config.FRONTEND_URL}/?reset={create_reset_token(user)}"
    user.last_email_at = utcnow()
    db.commit()
    background.add_task(mailer.send_reset_email, user.email, link)


def _get_conversation(db: Session, conv_id: int, owner: Owner) -> Conversation:
    conv = db.get(Conversation, conv_id)
    if conv is None or conv.owner != owner.key:  # someone else's chat looks exactly like a missing one
        raise HTTPException(404, "Chat not found. It may have expired or been deleted.")
    return conv


def _title(question: str) -> str:
    t = " ".join(question.split())
    return t if len(t) <= 60 else t[:57].rstrip() + "…"


# ---------- public routes ----------

@app.get("/")
def root():
    return {"message": "DocuAI API is running. See /docs for endpoints."}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/register", status_code=201)
def register(body: RegisterBody, background: BackgroundTasks, db: Session = Depends(get_db)):
    email = body.email.lower()
    taken = "An account with this email already exists. Try signing in."
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(409, taken)
    user = User(email=email, password_hash=hash_password(body.password), email_verified=False)
    db.add(user)
    try:
        db.commit()
    except IntegrityError:  # two sign-ups with the same email at the same moment
        db.rollback()
        raise HTTPException(409, taken)
    db.refresh(user)
    _queue_verification(user, db, background)
    return {"message": "Account created. Check your email to verify it."}


@app.post("/verify-email")
def verify_email(body: TokenBody, db: Session = Depends(get_db)):
    try:
        user = user_from_verify_token(body.token, db)
    except ValueError:
        raise HTTPException(400, "This verification link is invalid or has expired.")
    if not user.email_verified:
        user.email_verified = True
        db.commit()
    # Proving you own the mailbox also signs you in.
    return {"token": create_token(user.id), "email": user.email}


@app.post("/resend-verification")
def resend_verification(body: EmailBody, background: BackgroundTasks, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email.lower()).first()
    if user and not user.email_verified and _cooldown_ok(user):
        _queue_verification(user, db, background)
    # Same answer whether or not the account exists, so this can't be used to probe for emails.
    return {"message": "If that account is waiting for verification, we've sent a new link."}


@app.post("/login")
def login(body: LoginBody, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email.lower()).first()
    # One generic message for both "no such email" and "wrong password".
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Incorrect email or password.")
    if not user.email_verified:
        raise HTTPException(403, "Please verify your email before signing in. Check your inbox for the link.")
    return {"token": create_token(user.id), "email": user.email}


@app.post("/forgot-password")
def forgot_password(body: EmailBody, background: BackgroundTasks, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email.lower()).first()
    if user and _cooldown_ok(user):
        _queue_reset(user, db, background)
    # Same answer whether or not the account exists.
    return {"message": "If an account exists for that email, we've sent a reset link."}


@app.post("/reset-password")
def reset_password(body: ResetBody, db: Session = Depends(get_db)):
    try:
        user = user_from_reset_token(body.token, db)
    except ValueError:
        raise HTTPException(400, "This reset link is invalid, expired or has already been used.")
    user.password_hash = hash_password(body.password)
    user.email_verified = True  # they just proved they control this mailbox
    db.commit()
    return {"message": "Password updated. You can sign in now."}


# ---------- account-only route ----------

@app.get("/me")
def me(user: User = Depends(current_user)):
    return {"email": user.email}


# ---------- routes for accounts AND guests ----------

@app.post("/upload")
def upload(file: UploadFile = File(...), owner: Owner = Depends(current_owner)):
    name = os.path.basename(file.filename or "")
    if not name.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are supported")

    file.file.seek(0, os.SEEK_END)
    size = file.file.tell()
    file.file.seek(0)
    max_mb = config.GUEST_MAX_UPLOAD_MB if owner.is_guest else config.USER_MAX_UPLOAD_MB
    if size > max_mb * 1024 * 1024:
        raise HTTPException(413, f"That file is too large. The limit is {max_mb} MB per PDF.")

    if owner.is_guest:
        if not limits.allow("uploads:guests", config.GUEST_UPLOADS_GLOBAL_PER_HOUR, HOUR):
            raise HTTPException(429, "Guest uploads are busy right now. Try again later, or sign in.")
        existing = rag.list_sources(owner.key)
        if name not in existing and len(existing) >= config.GUEST_MAX_DOCS:
            raise HTTPException(
                403,
                f"Guests can keep up to {config.GUEST_MAX_DOCS} documents. "
                "Remove one, or sign in to add more.",
            )

    # The PDF is only needed while we index it, so it goes in a temp folder that is wiped after.
    with tempfile.TemporaryDirectory() as tmp:
        path = os.path.join(tmp, name)
        with open(path, "wb") as f:
            shutil.copyfileobj(file.file, f)
        try:
            n = rag.ingest_pdf(path, owner.key)
        except ValueError as e:
            raise HTTPException(422, str(e))
    return {"file": name, "chunks": n}


@app.post("/ask")
def ask(q: Query, owner: Owner = Depends(current_owner), db: Session = Depends(get_db)):
    if not q.question.strip():
        raise HTTPException(400, "Empty question")

    if owner.is_guest:
        if not limits.allow(f"ask:{owner.key}", config.GUEST_ASKS_PER_HOUR, HOUR) or not limits.allow(
            "ask:guests", config.GUEST_ASKS_GLOBAL_PER_HOUR, HOUR
        ):
            raise HTTPException(
                429,
                f"Guest question limit reached ({config.GUEST_ASKS_PER_HOUR} per hour). "
                "Sign in to keep going, or try again later.",
            )

    conv = _get_conversation(db, q.conversation_id, owner) if q.conversation_id is not None else None

    try:
        result = rag.answer(q.question, owner.key, sources=q.sources)
    except Exception as e:
        # Nothing is saved when the model fails, so history never holds a question with no answer.
        raise HTTPException(503, f"LLM error (possibly rate limit): {e}")

    if conv is None:
        conv = Conversation(owner=owner.key, title=_title(q.question))
        db.add(conv)
        db.flush()
    db.add(Message(conversation_id=conv.id, role="user", text=q.question))
    db.add(
        Message(
            conversation_id=conv.id,
            role="ai",
            text=result["answer"],
            sources=json.dumps(result["sources"]),
        )
    )
    conv.updated_at = utcnow()
    db.commit()
    return {**result, "conversation_id": conv.id, "title": conv.title}


@app.get("/conversations")
def list_conversations(owner: Owner = Depends(current_owner), db: Session = Depends(get_db)):
    rows = (
        db.query(Conversation)
        .filter(Conversation.owner == owner.key)
        .order_by(Conversation.updated_at.desc())
        .limit(100)
        .all()
    )
    return {"conversations": [{"id": c.id, "title": c.title} for c in rows]}


@app.get("/conversations/{conv_id}")
def get_conversation(conv_id: int, owner: Owner = Depends(current_owner), db: Session = Depends(get_db)):
    conv = _get_conversation(db, conv_id, owner)
    return {
        "id": conv.id,
        "title": conv.title,
        "messages": [
            {"role": m.role, "text": m.text, "sources": json.loads(m.sources) if m.sources else None}
            for m in conv.messages
        ],
    }


@app.delete("/conversations/{conv_id}")
def delete_conversation(conv_id: int, owner: Owner = Depends(current_owner), db: Session = Depends(get_db)):
    conv = _get_conversation(db, conv_id, owner)
    db.delete(conv)
    db.commit()
    return {"deleted": conv_id}


@app.get("/documents")
def documents(owner: Owner = Depends(current_owner)):
    return {"files": rag.list_sources(owner.key)}


@app.delete("/documents/{filename}")
def delete_document(filename: str, owner: Owner = Depends(current_owner)):
    n = rag.delete_source(filename, owner.key)
    if n == 0:
        raise HTTPException(404, f"No chunks found for '{filename}'")
    return {"file": filename, "chunks_deleted": n}