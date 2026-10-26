import os
from datetime import datetime, timedelta, timezone

import jwt
from dotenv import load_dotenv
from pwdlib import PasswordHash
from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    Integer,
    String,
    create_engine,
    select,
)
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    mapped_column,
    sessionmaker,
)

load_dotenv()

SECRET_KEY = os.getenv("JWT_SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("JWT_SECRET_KEY is missing from backend/.env")

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./medguardian.db")
ALGORITHM = "HS256"
TOKEN_EXPIRE_MINUTES = 30

password_hash = PasswordHash.recommended()

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
    if DATABASE_URL.startswith("sqlite")
    else {},
)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
    )
    username: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        index=True,
    )
    password_hash: Mapped[str] = mapped_column(String(500))
    role: Mapped[str] = mapped_column(
        String(20),
        default="staff",
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
    )


class AnalysisHistory(Base):
    """Stores a record of a successful medical-image analysis."""

    __tablename__ = "analysis_history"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
    )
    module: Mapped[str] = mapped_column(
        String(30),
        index=True,
    )
    predicted_class: Mapped[str] = mapped_column(String(200))
    model_score: Mapped[float] = mapped_column(Float)
    staff_username: Mapped[str] = mapped_column(
        String(100),
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )


def init_db():
    """Create any missing database tables without deleting existing data."""
    Base.metadata.create_all(bind=engine)


def create_user(db, username: str, password: str, role: str = "staff"):
    username = username.strip()

    if not username:
        raise ValueError("Username cannot be empty.")

    if len(password) < 12:
        raise ValueError("Password must contain at least 12 characters.")

    if role not in {"admin", "staff"}:
        raise ValueError("Role must be admin or staff.")

    existing = db.scalar(
        select(User).where(User.username == username)
    )
    if existing:
        raise ValueError("That username already exists.")

    user = User(
        username=username,
        password_hash=password_hash.hash(password),
        role=role,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def verify_password(password: str, hashed_password: str) -> bool:
    return password_hash.verify(password, hashed_password)


def create_access_token(user: User) -> str:
    now = datetime.now(timezone.utc)

    payload = {
        "sub": str(user.id),
        "username": user.username,
        "role": user.role,
        "iat": now,
        "exp": now + timedelta(minutes=TOKEN_EXPIRE_MINUTES),
    }

    return jwt.encode(
        payload,
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


def decode_access_token(token: str) -> dict:
    return jwt.decode(
        token,
        SECRET_KEY,
        algorithms=[ALGORITHM],
    )
