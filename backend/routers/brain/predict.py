
from typing import Annotated

import jwt
from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    UploadFile,
    status,
)
from fastapi.security import OAuth2PasswordBearer

from auth import User, SessionLocal, decode_access_token
from services.brain_service import generate_brain_explanation
from services.history_service import save_analysis_history


router = APIRouter(
    prefix="/api/brain",
    tags=["Brain Tumor"],
)

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/auth/login"
)

MAX_IMAGE_SIZE = 10 * 1024 * 1024

ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
}


def get_brain_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
) -> User:
    """Authenticate an active staff or admin account."""

    try:
        payload = decode_access_token(token)
        user_id = int(payload["sub"])

    except (
        jwt.InvalidTokenError,
        ValueError,
        KeyError,
        TypeError,
    ) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    db = SessionLocal()

    try:
        user = db.query(User).filter(User.id == user_id).first()

        if user is None or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account is unavailable.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        return user

    finally:
        db.close()


@router.post("/explain")
async def explain_brain_prediction(
    image: UploadFile = File(
        ...,
        description="Upload a brain MRI image",
    ),
    user: User = Depends(get_brain_current_user),
):
    """Return an MRI prediction and save its metadata to history."""

    if image.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Upload a JPEG, PNG, or WebP image.",
        )

    try:
        contents = await image.read(MAX_IMAGE_SIZE + 1)

        if not contents:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The uploaded image is empty.",
            )

        if len(contents) > MAX_IMAGE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Image size must not exceed 10 MB.",
            )

        result = generate_brain_explanation(contents)

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The brain model checkpoint is unavailable.",
        ) from exc

    finally:
        await image.close()

    result["requested_by"] = user.username

    # Save prediction metadata only, not the uploaded MRI image.
    save_analysis_history("brain", result, user)

    return result
