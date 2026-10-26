
from routers.retinopathy.predict import router as retinopathy_router
from routers.skin.predict import router as skin_router
from routers.brain.predict import router as brain_router
from routers.lung.predict import router as lung_router

from contextlib import asynccontextmanager
from typing import Annotated

import jwt
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from auth import (
    AnalysisHistory,
    SessionLocal,
    User,
    create_access_token,
    create_user,
    decode_access_token,
    init_db,
    verify_password,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="MedGuardian AI",
    description="Hospital staff medical-imaging research application API",
    version="0.2.0",
    lifespan=lifespan,
)

# Register all prediction routers.
app.include_router(skin_router)
app.include_router(brain_router)
app.include_router(retinopathy_router)
app.include_router(lung_router)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired access token.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = decode_access_token(token)
        user_id = int(payload["sub"])
    except (jwt.InvalidTokenError, ValueError, KeyError, TypeError):
        raise credentials_error

    user = db.get(User, user_id)

    if user is None or not user.is_active:
        raise credentials_error

    return user


def require_admin(
    user: Annotated[User, Depends(get_current_user)],
) -> User:
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator access required.",
        )
    return user


# --------------------------------------------------
# ANALYSIS HISTORY
# --------------------------------------------------

ALLOWED_HISTORY_MODULES = {"skin", "brain", "retina", "lung"}


@app.get("/api/history")
def get_analysis_history(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    module: str | None = None,
    limit: int = 100,
):
    """Return recent analysis history for the authenticated user only."""

    if module is not None and module not in ALLOWED_HISTORY_MODULES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Module must be skin, brain, retina, or lung.",
        )

    # Keep the requested limit within the allowed range.
    limit = max(1, min(limit, 500))

    # IMPORTANT: Only return this user's history.
    query = select(AnalysisHistory).where(
        AnalysisHistory.staff_username == user.username
    )

    if module is not None:
        query = query.where(AnalysisHistory.module == module)

    query = query.order_by(
        AnalysisHistory.id.desc()
    ).limit(limit)

    records = db.scalars(query).all()

    return [
        {
            "id": record.id,
            "module": record.module,
            "predicted_class": record.predicted_class,
            "model_score": record.model_score,
            "staff_username": record.staff_username,
            "created_at": (
                record.created_at.isoformat()
                if record.created_at
                else None
            ),
        }
        for record in records
    ]


@app.get("/api/history/summary")
def get_analysis_history_summary(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Return this user's total analyses and counts by module."""

    rows = db.execute(
        select(
            AnalysisHistory.module,
            func.count(AnalysisHistory.id),
        )
        .where(AnalysisHistory.staff_username == user.username)
        .group_by(AnalysisHistory.module)
    ).all()

    counts = {
        "skin": 0,
        "brain": 0,
        "retina": 0,
        "lung": 0,
    }

    for module_name, count in rows:
        if module_name in counts:
            counts[module_name] = count

    return {
        "total": sum(counts.values()),
        "by_module": counts,
    }


# --------------------------------------------------
# AVAILABLE MODULES
# --------------------------------------------------

MODULES = [
    {
        "id": "skin",
        "name": "Skin Disease",
        "status": "existing_model_pending_integration",
    },
    {
        "id": "brain",
        "name": "Brain Tumor",
        "status": "in_development",
    },
    {
        "id": "retina",
        "name": "Diabetic Retinopathy",
        "status": "in_development",
    },
    {
        "id": "lung",
        "name": "Lung Disease",
        "status": "in_development",
    },
]


class StaffCreateRequest(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=12, max_length=128)


# --------------------------------------------------
# HEALTH CHECK
# --------------------------------------------------

@app.get("/api/health")
def health_check():
    return {
        "application": "MedGuardian AI",
        "status": "running",
        "environment": "development",
    }


# --------------------------------------------------
# AUTHENTICATION
# --------------------------------------------------

@app.post("/api/auth/login")
def login(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Annotated[Session, Depends(get_db)],
):
    user = db.scalar(
        select(User).where(
            User.username == form_data.username.strip()
        )
    )

    if (
        user is None
        or not user.is_active
        or not verify_password(
            form_data.password,
            user.password_hash,
        )
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return {
        "access_token": create_access_token(user),
        "token_type": "bearer",
        "username": user.username,
        "role": user.role,
    }


@app.get("/api/auth/me")
def get_me(
    user: Annotated[User, Depends(get_current_user)],
):
    return {
        "id": user.id,
        "username": user.username,
        "role": user.role,
        "is_active": user.is_active,
    }


# --------------------------------------------------
# MODULE API
# --------------------------------------------------

@app.get("/api/modules")
def get_modules(
    user: Annotated[User, Depends(get_current_user)],
):
    return {
        "modules": MODULES,
        "note": "Module status does not indicate clinical readiness.",
    }


# --------------------------------------------------
# ADMIN: CREATE STAFF ACCOUNTS
# --------------------------------------------------

@app.post(
    "/api/admin/staff",
    status_code=status.HTTP_201_CREATED,
)
def add_staff(
    request: StaffCreateRequest,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_admin)],
):
    try:
        staff = create_user(
            db,
            username=request.username,
            password=request.password,
            role="staff",
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    return {
        "message": "Staff account created successfully.",
        "username": staff.username,
        "role": staff.role,
    }
