
from pathlib import Path

import numpy as np
import tensorflow as tf
from PIL import Image, UnidentifiedImageError


MODEL_PATH = Path(
    r"D:\SKIN_BRAIN_DIABETIC_LUNG\SKIN_DISEASE_GITHUB_PROJECT\SKIN_DISEASE_GITHUB_PROJECT_UPDATED\skin_disease_model_mobilenetv2_final.keras"
)

CLASS_NAMES = ["bkl", "nv", "df", "mel", "vasc", "bcc", "akiec"]

DISEASE_NAMES = {
    "bkl": "Benign keratosis-like lesions",
    "nv": "Melanocytic nevi",
    "df": "Dermatofibroma",
    "mel": "Melanoma",
    "vasc": "Vascular lesions",
    "bcc": "Basal cell carcinoma",
    "akiec": "Actinic keratoses and related lesions",
}

_model = None


def get_model():
    """Load the model once, on the first prediction request."""
    global _model

    if _model is None:
        if not MODEL_PATH.is_file():
            raise FileNotFoundError(
                f"Skin model not found: {MODEL_PATH}"
            )

        loaded_model = tf.keras.models.load_model(
            MODEL_PATH,
            compile=False,
        )

        if tuple(loaded_model.input_shape[1:]) != (128, 128, 3):
            raise RuntimeError(
                f"Unexpected model input shape: {loaded_model.input_shape}"
            )

        if loaded_model.output_shape[-1] != len(CLASS_NAMES):
            raise RuntimeError(
                f"Unexpected model output shape: {loaded_model.output_shape}"
            )

        _model = loaded_model

    return _model


def predict_skin_image(image_bytes: bytes) -> dict:
    """Classify an uploaded image using the trained seven-class model."""
    try:
        with Image.open(__import__("io").BytesIO(image_bytes)) as source:
            image = source.convert("RGB")
            image = image.resize((128, 128))

            # The original training preprocessing used RGB pixels in [0, 1].
            image_array = np.asarray(image, dtype=np.float32) / 255.0

    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise ValueError(
            "Upload a valid image file, such as JPEG or PNG."
        ) from exc

    model = get_model()
    batch = np.expand_dims(image_array, axis=0)

    scores = np.asarray(
        model.predict(batch, verbose=0)[0],
        dtype=np.float64,
    )

    if scores.shape != (len(CLASS_NAMES),) or not np.isfinite(scores).all():
        raise RuntimeError("The model returned invalid prediction scores.")

    # Display scores as returned by the model; do not silently reinterpret
    # them as calibrated clinical probabilities.
    class_index = int(np.argmax(scores))
    top_class = CLASS_NAMES[class_index]

    return {
        "predicted_class": top_class,
        "disease_name": DISEASE_NAMES[top_class],
        "model_score": float(scores[class_index]),
        "class_scores": [
            {
                "class": name,
                "disease_name": DISEASE_NAMES[name],
                "score": float(score),
            }
            for name, score in zip(CLASS_NAMES, scores)
        ],
        "notice": (
            "Research demonstration only. Model scores are not a clinical "
            "diagnosis or a substitute for evaluation by a qualified clinician."
        ),
    }
