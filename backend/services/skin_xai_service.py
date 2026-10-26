
import base64
import io
from pathlib import Path

import numpy as np
from PIL import Image

from services.skin_service import get_model, CLASS_NAMES
from services.skin_service import DISEASE_NAMES
from services.skin_service import MODEL_PATH

# Import the existing Grad-CAM functions without changing the original file.
import sys

SKIN_PROJECT_DIR = Path(
    r"D:\SKIN_BRAIN_DIABETIC_LUNG\SKIN_DISEASE_GITHUB_PROJECT\SKIN_DISEASE_GITHUB_PROJECT_UPDATED\SKIN_DISEASE_GITHUB_PROJECT"
)

if str(SKIN_PROJECT_DIR) not in sys.path:
    sys.path.insert(0, str(SKIN_PROJECT_DIR))

from xai import make_gradcam_heatmap, overlay_heatmap


def generate_skin_explanation(image_bytes: bytes) -> dict:
    """Generate a Grad-CAM overlay for an uploaded skin image."""

    with Image.open(io.BytesIO(image_bytes)) as source:
        original_image = source.convert("RGB")
        resized = original_image.resize((128, 128))

        image_array = np.asarray(
            resized, dtype=np.float32
        ) / 255.0

    batch = np.expand_dims(image_array, axis=0)
    model = get_model()

    predictions = np.asarray(
        model.predict(batch, verbose=0)[0],
        dtype=np.float32,
    )

    class_index = int(np.argmax(predictions))

    heatmap = make_gradcam_heatmap(
        batch,
        model,
        class_index,
    )

    overlay = overlay_heatmap(
        resized,
        heatmap,
    )

    buffer = io.BytesIO()
    overlay.save(buffer, format="PNG")

    encoded_image = base64.b64encode(
        buffer.getvalue()
    ).decode("ascii")

    return {
        "predicted_class": CLASS_NAMES[class_index],
        "disease_name": DISEASE_NAMES[CLASS_NAMES[class_index]],
        "model_score": float(predictions[class_index]),
        "gradcam_overlay": f"data:image/png;base64,{encoded_image}",
        "explanation_notice": (
            "Grad-CAM highlights image regions associated with the model's "
            "prediction. It does not establish a diagnosis or prove that "
            "the highlighted region is medically significant."
        ),
    }
