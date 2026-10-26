
from services.history_service import save_analysis_history
from services.skin_xai_service import generate_skin_explanation
from typing import Annotated

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
from services.skin_service import predict_skin_image


router = APIRouter(
    prefix="/api/skin",
    tags=["Skin Disease"],
)

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/auth/login"
)

MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10 MB

ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
}


def get_skin_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
) -> User:
    """Authenticate a user using the existing JWT token."""

    payload = decode_access_token(token)

    if not payload or not payload.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_id = int(payload["sub"])
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user ID in authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    db = SessionLocal()

    try:
        user = db.query(User).filter(User.id == user_id).first()

        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        return user

    finally:
        db.close()


@router.post("/predict")
async def predict_skin(
    image: Annotated[
        UploadFile,
        File(description="Upload a skin image"),
    ],
    user: Annotated[User, Depends(get_skin_current_user)],
):
    """Predict a skin-image class for an authenticated user."""

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

        result = predict_skin_image(contents)

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The skin model file is unavailable.",
        ) from exc

    finally:
        await image.close()

    result["requested_by"] = user.username
    return result


@router.post("/explain")
async def explain_skin_prediction(
    image: Annotated[
        UploadFile,
        File(description="Upload a skin image for Grad-CAM explanation"),
    ],
    user: Annotated[User, Depends(get_skin_current_user)],
):
    """Return a skin prediction, Grad-CAM visualization, and save history."""

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

        result = generate_skin_explanation(contents)

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The skin model file is unavailable.",
        ) from exc

    finally:
        await image.close()

    result["requested_by"] = user.username

    # Save prediction metadata only; do not save the uploaded image.
    save_analysis_history("skin", result, user)

    return result
