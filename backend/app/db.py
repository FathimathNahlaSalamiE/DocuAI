from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, create_engine
from sqlalchemy.orm import declarative_base, relationship, sessionmaker

from app import config

# SQLite needs this flag because FastAPI handles requests on different threads.
connect_args = {"check_same_thread": False} if config.DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(config.DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False)
Base = declarative_base()


def utcnow() -> datetime:
    """Naive UTC time (what SQLite stores), without the deprecated datetime.utcnow()."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    email_verified = Column(Boolean, nullable=False, default=False)
    last_email_at = Column(DateTime, nullable=True)  # when we last sent this user a link
    created_at = Column(DateTime, default=utcnow)


class Conversation(Base):
    """One chat thread. `owner` is "u:<user id>" for accounts or "g:<guest id>" for guests."""
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True)
    owner = Column(String(64), index=True, nullable=False)
    title = Column(String(120), nullable=False, default="New chat")
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, index=True)
    messages = relationship("Message", cascade="all, delete-orphan", order_by="Message.id")


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), index=True, nullable=False)
    role = Column(String(8), nullable=False)      # "user" or "ai"
    text = Column(Text, nullable=False)
    sources = Column(Text, nullable=True)         # JSON list of {"file", "page"}
    created_at = Column(DateTime, default=utcnow)


def init_db() -> None:
    Base.metadata.create_all(engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()