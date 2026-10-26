
import logging

from auth import AnalysisHistory, SessionLocal, User

logger = logging.getLogger(__name__)


def save_analysis_history(
    module: str,
    result: dict,
    user: User,
) -> bool:
    """Save prediction metadata without storing the uploaded image."""

    db = SessionLocal()

    try:
        record = AnalysisHistory(
            module=module,
            predicted_class=str(result["predicted_class"]),
            model_score=float(result["model_score"]),
            staff_username=user.username,
        )

        db.add(record)
        db.commit()
        return True

    except Exception:
        db.rollback()
        logger.exception(
            "Failed to save %s analysis history for staff user %s",
            module,
            user.username,
        )
        return False

    finally:
        db.close()
