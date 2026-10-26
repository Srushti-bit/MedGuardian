
import base64
import io
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from PIL import Image, UnidentifiedImageError
from torchvision import models, transforms


MODEL_PATH = (
    Path(__file__).resolve().parents[1]
    / "models"
    / "brain"
    / "EfficientNet_B0.pth"
)

CLASS_NAMES = [
    "glioma",
    "meningioma",
    "notumor",
    "pituitary",
]

DEVICE = torch.device("cpu")

IMAGE_TRANSFORM = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.Grayscale(num_output_channels=3),
    transforms.ToTensor(),
    transforms.Normalize(
        [0.485, 0.456, 0.406],
        [0.229, 0.224, 0.225],
    ),
])

_model = None


def get_brain_model():
    """Load the original EfficientNet-B0 checkpoint once."""
    global _model

    if _model is not None:
        return _model

    if not MODEL_PATH.is_file():
        raise FileNotFoundError(
            f"Brain model checkpoint not found: {MODEL_PATH}"
        )

    model = models.efficientnet_b0(weights=None)
    model.classifier[1] = nn.Linear(
        model.classifier[1].in_features,
        len(CLASS_NAMES),
    )

    state_dict = torch.load(
        MODEL_PATH,
        map_location=DEVICE,
        weights_only=True,
    )

    model.load_state_dict(state_dict, strict=True)
    model.to(DEVICE)
    model.eval()

    _model = model
    return _model


def _make_jet_heatmap(cam):
    """Convert a normalized CAM array into an RGB heatmap."""
    values = np.clip(cam, 0.0, 1.0)

    red = np.clip(1.5 - np.abs(4 * values - 3), 0, 1)
    green = np.clip(1.5 - np.abs(4 * values - 2), 0, 1)
    blue = np.clip(1.5 - np.abs(4 * values - 1), 0, 1)

    heatmap = np.stack([red, green, blue], axis=-1)
    return np.uint8(heatmap * 255)


def generate_brain_explanation(image_bytes: bytes) -> dict:
    """Predict a brain MRI class and create its Grad-CAM overlay."""
    try:
        with Image.open(io.BytesIO(image_bytes)) as source:
            original_image = source.convert("RGB")
            input_tensor = IMAGE_TRANSFORM(
                original_image
            ).unsqueeze(0).to(DEVICE)

    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise ValueError(
            "Upload a valid brain MRI image in JPEG, PNG, or WebP format."
        ) from exc

    model = get_brain_model()

    activations = []
    gradients = []
    target_layer = model.features[-1]

    def forward_hook(module, inputs, output):
        activations.append(output)
        output.register_hook(
            lambda gradient: gradients.append(gradient)
        )

    handle = target_layer.register_forward_hook(forward_hook)

    try:
        model.zero_grad(set_to_none=True)

        outputs = model(input_tensor)
        probabilities = torch.softmax(outputs, dim=1)[0]
        predicted_index = int(probabilities.argmax().item())

        outputs[0, predicted_index].backward()

        if not activations or not gradients:
            raise RuntimeError(
                "Could not generate Grad-CAM for this image."
            )

        feature_maps = activations[0].detach()
        grads = gradients[0].detach()
        weights = grads.mean(dim=(2, 3), keepdim=True)

        cam_tensor = torch.relu(
            (weights * feature_maps).sum(dim=1)
        )[0]

        cam = cam_tensor.cpu().numpy()
        cam_min = float(cam.min())
        cam_max = float(cam.max())

        if cam_max > cam_min:
            cam = (cam - cam_min) / (cam_max - cam_min)
        else:
            cam = np.zeros_like(cam)

        cam_image = Image.fromarray(
            np.uint8(cam * 255)
        ).resize(
            original_image.size,
            Image.Resampling.BILINEAR,
        )

        cam_resized = np.asarray(
            cam_image, dtype=np.float32
        ) / 255.0

        heatmap = Image.fromarray(
            _make_jet_heatmap(cam_resized)
        )

        overlay = Image.blend(
            original_image,
            heatmap,
            alpha=0.4,
        )

        buffer = io.BytesIO()
        overlay.save(buffer, format="PNG")

        encoded_overlay = base64.b64encode(
            buffer.getvalue()
        ).decode("ascii")

        scores = probabilities.detach().cpu().numpy()

        return {
            "predicted_class": CLASS_NAMES[predicted_index],
            "disease_name": CLASS_NAMES[predicted_index],
            "model_score": float(scores[predicted_index]),
            "confidence_percent": float(
                scores[predicted_index] * 100
            ),
            "class_scores": [
                {
                    "class": name,
                    "score": float(score),
                    "score_percent": float(score * 100),
                }
                for name, score in zip(CLASS_NAMES, scores)
            ],
            "gradcam_overlay": (
                f"data:image/png;base64,{encoded_overlay}"
            ),
            "explanation_notice": (
                "Grad-CAM highlights image regions associated with "
                "the model's prediction. It does not establish a "
                "diagnosis. Model scores are not calibrated clinical "
                "probabilities. Research use only."
            ),
        }

    finally:
        handle.remove()
        model.zero_grad(set_to_none=True)
