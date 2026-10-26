
import base64
import io
from pathlib import Path

import numpy as np
import tensorflow as tf
from PIL import Image, UnidentifiedImageError


MODEL_PATH = (
    Path(__file__).resolve().parents[1]
    / "models"
    / "retinopathy"
    / "diabetic_retinopathy_model.keras"
)

IMG_SIZE = 160

CLASS_NAMES = [
    "No DR",
    "Mild",
    "Moderate",
    "Severe",
    "Proliferative DR",
]

GRADCAM_LAYER_NAME = "out_relu"

_model = None
_gradcam_model = None


def get_retinopathy_model():
    """Load the trained model once and reuse it."""
    global _model

    if _model is not None:
        return _model

    if not MODEL_PATH.is_file():
        raise FileNotFoundError(
            f"Diabetic retinopathy model not found: {MODEL_PATH}"
        )

    _model = tf.keras.models.load_model(
        str(MODEL_PATH),
        compile=False,
    )

    if tuple(_model.input_shape[1:]) != (160, 160, 3):
        _model = None
        raise ValueError(
            "Unexpected model input shape. Expected 160x160 RGB images."
        )

    if _model.output_shape[-1] != len(CLASS_NAMES):
        _model = None
        raise ValueError(
            "Unexpected model output shape. Expected five classes."
        )

    return _model


def get_retinopathy_gradcam_model():
    """Build a graph exposing the final convolutional features."""
    global _gradcam_model

    if _gradcam_model is None:
        model = get_retinopathy_model()
        target_layer = model.get_layer(GRADCAM_LAYER_NAME)

        _gradcam_model = tf.keras.Model(
            inputs=model.inputs,
            outputs=[target_layer.output, model.output],
        )

    return _gradcam_model


def _encode_gradcam_overlay(original_image, heatmap):
    """Blend a normalized heatmap with the resized retinal image."""
    heatmap_image = Image.fromarray(
        np.uint8(np.clip(heatmap, 0, 1) * 255)
    ).resize(original_image.size, Image.Resampling.BILINEAR)

    values = np.asarray(heatmap_image, dtype=np.float32) / 255.0

    red = np.clip(1.5 - np.abs(4 * values - 3), 0, 1)
    green = np.clip(1.5 - np.abs(4 * values - 2), 0, 1)
    blue = np.clip(1.5 - np.abs(4 * values - 1), 0, 1)

    rgb_heatmap = Image.fromarray(
        np.uint8(np.stack([red, green, blue], axis=-1) * 255)
    )

    overlay = Image.blend(original_image, rgb_heatmap, alpha=0.4)

    buffer = io.BytesIO()
    overlay.save(buffer, format="PNG")

    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def _generate_retinopathy_gradcam(batch, original_image, class_index):
    """Generate Grad-CAM for the selected class."""
    gradcam_model = get_retinopathy_gradcam_model()

    with tf.GradientTape() as tape:
        feature_maps, predictions = gradcam_model(
            tf.convert_to_tensor(batch),
            training=False,
        )
        target_score = predictions[:, class_index]

    gradients = tape.gradient(target_score, feature_maps)

    if gradients is None:
        raise RuntimeError(
            "Could not calculate retinopathy Grad-CAM gradients."
        )

    weights = tf.reduce_mean(gradients, axis=(1, 2), keepdims=True)
    cam = tf.reduce_sum(weights * feature_maps, axis=-1)[0]
    cam = tf.nn.relu(cam)

    maximum = tf.reduce_max(cam)
    cam = tf.where(
        maximum > 0,
        cam / tf.maximum(maximum, tf.keras.backend.epsilon()),
        tf.zeros_like(cam),
    )

    return _encode_gradcam_overlay(original_image, cam.numpy())


def predict_retinopathy(image_bytes: bytes) -> dict:
    """Predict a retinopathy grade and generate a Grad-CAM overlay."""
    if not image_bytes:
        raise ValueError("The uploaded image is empty.")

    try:
        with Image.open(io.BytesIO(image_bytes)) as source:
            image = source.convert("RGB").resize((IMG_SIZE, IMG_SIZE))

    except (UnidentifiedImageError, OSError) as exc:
        raise ValueError(
            "Could not read the image. Upload a valid retinal image."
        ) from exc

    array = np.asarray(image, dtype=np.float32)
    array = tf.keras.applications.mobilenet_v2.preprocess_input(array)
    batch = np.expand_dims(array, axis=0)

    model = get_retinopathy_model()
    output = np.asarray(model.predict(batch, verbose=0))

    if output.ndim != 2 or output.shape != (1, len(CLASS_NAMES)):
        raise ValueError("The model returned an unexpected prediction shape.")

    scores = output[0].astype(float)

    if not np.all(np.isfinite(scores)):
        raise ValueError("The model returned invalid prediction scores.")

    predicted_index = int(np.argmax(scores))
    predicted_class = CLASS_NAMES[predicted_index]

    gradcam_overlay = _generate_retinopathy_gradcam(
        batch, image, predicted_index
    )

    return {
        "predicted_class": predicted_class,
        "model_score": float(scores[predicted_index]),
        "class_scores": {
            name: float(score)
            for name, score in zip(CLASS_NAMES, scores)
        },
        "model_name": "Diabetic Retinopathy Model",
        "image_size": IMG_SIZE,
        "gradcam_overlay": gradcam_overlay,
        "explanation_notice": (
            "Grad-CAM highlights image regions associated with the model's "
            "prediction. It is an AI explanation, not a confirmed diagnosis "
            "or proof that a highlighted region is medically significant."
        ),
    }
