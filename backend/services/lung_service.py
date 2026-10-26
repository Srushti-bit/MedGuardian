
import base64
import io
import logging
import threading
from pathlib import Path

import numpy as np
import tensorflow as tf
from PIL import Image, UnidentifiedImageError

logger = logging.getLogger(__name__)

MODEL_DIRECTORY = Path(r"D:\LUNG_CANCER\lung_model.keras")
IMAGE_SIZE = (224, 224)

_model = None
_gradcam_model = None
_model_lock = threading.Lock()


def get_lung_model():
    """Load the existing lung model architecture and weights once."""
    global _model

    if _model is None:
        with _model_lock:
            if _model is None:
                config_path = MODEL_DIRECTORY / "config.json"
                weights_path = MODEL_DIRECTORY / "model.weights.h5"

                if not config_path.is_file() or not weights_path.is_file():
                    raise FileNotFoundError(
                        "Lung model config.json or model.weights.h5 was not "
                        f"found inside {MODEL_DIRECTORY}"
                    )

                config_text = config_path.read_text(encoding="utf-8")
                model = tf.keras.models.model_from_json(config_text)
                model.load_weights(str(weights_path))
                _model = model

                logger.info("Existing lung model loaded successfully.")

    return _model


def get_lung_gradcam_model():
    """Build connected feature-extractor and prediction-head models."""
    global _gradcam_model

    if _gradcam_model is None:
        model = get_lung_model()
        backbone = model.get_layer("mobilenetv2_1.00_224")
        target_layer = backbone.get_layer("out_relu")

        feature_model = tf.keras.Model(
            inputs=backbone.input,
            outputs=[target_layer.output, backbone.output],
            name="lung_feature_extractor",
        )

        head_input = tf.keras.Input(
            shape=tuple(backbone.output.shape[1:]),
            name="lung_head_input",
        )
        x = head_input
        backbone_index = model.layers.index(backbone)

        for layer in model.layers[backbone_index + 1:]:
            x = layer(x)

        prediction_head = tf.keras.Model(
            inputs=head_input,
            outputs=x,
            name="lung_prediction_head",
        )

        _gradcam_model = (feature_model, prediction_head)

    return _gradcam_model

def _make_lung_overlay(original_image, cam):
    """Convert a normalized CAM into a PNG data URL."""
    cam_image = Image.fromarray(
        np.uint8(np.clip(cam, 0, 1) * 255)
    ).resize(original_image.size, Image.Resampling.BILINEAR)

    values = np.asarray(cam_image, dtype=np.float32) / 255.0

    red = np.clip(1.5 - np.abs(4 * values - 3), 0, 1)
    green = np.clip(1.5 - np.abs(4 * values - 2), 0, 1)
    blue = np.clip(1.5 - np.abs(4 * values - 1), 0, 1)

    heatmap = Image.fromarray(
        np.uint8(np.stack([red, green, blue], axis=-1) * 255)
    )

    overlay = Image.blend(original_image, heatmap, alpha=0.4)

    buffer = io.BytesIO()
    overlay.save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")

    return f"data:image/png;base64,{encoded}"


def _generate_lung_gradcam(batch, original_image, class_index):
    """Generate Grad-CAM through the connected nested backbone."""
    feature_model, prediction_head = get_lung_gradcam_model()

    with tf.GradientTape() as tape:
        feature_maps, backbone_output = feature_model(
            tf.convert_to_tensor(batch),
            training=False,
        )
        raw_output = prediction_head(backbone_output, training=False)
        cancer_score = tf.reshape(raw_output, [-1])[0]

        target_score = (
            cancer_score if class_index == 1 else 1.0 - cancer_score
        )

    gradients = tape.gradient(target_score, feature_maps)

    if gradients is None:
        raise RuntimeError("Could not calculate lung Grad-CAM gradients.")

    weights = tf.reduce_mean(gradients, axis=(1, 2), keepdims=True)
    cam = tf.reduce_sum(weights * feature_maps, axis=-1)[0]
    cam = tf.nn.relu(cam)

    maximum = tf.reduce_max(cam)
    cam = tf.where(
        maximum > 0,
        cam / tf.maximum(maximum, tf.keras.backend.epsilon()),
        tf.zeros_like(cam),
    )

    return _make_lung_overlay(original_image, cam.numpy())

def generate_lung_explanation(image_bytes: bytes) -> dict:
    """
    Classify an image with the existing binary lung model and generate
    a Grad-CAM overlay. Scores are not clinically validated probabilities.
    """
    if not image_bytes:
        raise ValueError("The uploaded image is empty.")

    try:
        with Image.open(io.BytesIO(image_bytes)) as source:
            original_image = source.convert("RGB").resize(IMAGE_SIZE)
            image_array = np.asarray(original_image, dtype=np.float32)

    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise ValueError(
            "Upload a valid lung image in JPEG, PNG, or WebP format."
        ) from exc

    batch = np.expand_dims(image_array, axis=0)
    batch = tf.keras.applications.mobilenet_v2.preprocess_input(batch)

    try:
        model = get_lung_model()
        raw_output = model.predict(batch, verbose=0)
        cancer_score = float(np.asarray(raw_output).reshape(-1)[0])

        if not np.isfinite(cancer_score):
            raise ValueError("The lung model returned a non-finite score.")

        cancer_score = max(0.0, min(1.0, cancer_score))
        no_cancer_score = 1.0 - cancer_score

        class_index = 1 if cancer_score >= 0.5 else 0

        if class_index == 1:
            predicted_class = "Cancer Detected"
            model_score = cancer_score
        else:
            predicted_class = "No Cancer Detected"
            model_score = no_cancer_score

        gradcam_overlay = _generate_lung_gradcam(
            batch, original_image, class_index
        )

        return {
            "disease_name": predicted_class,
            "predicted_class": predicted_class,
            "model_score": float(model_score),
            "cancer_score": float(cancer_score),
            "class_scores": [
                {
                    "class": "No Cancer Detected",
                    "score": float(no_cancer_score),
                },
                {
                    "class": "Cancer Detected",
                    "score": float(cancer_score),
                },
            ],
            "gradcam_overlay": gradcam_overlay,
            "explanation_notice": (
                "Grad-CAM highlights image regions associated with the "
                "model's prediction. These scores are not clinically "
                "validated probabilities and must not be used alone to "
                "diagnose or rule out lung cancer. A qualified healthcare "
                "professional must interpret the medical image."
            ),
        }

    except Exception:
        logger.exception("Lung image analysis failed.")
        raise
