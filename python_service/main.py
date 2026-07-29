"""AgriSmart AI — TensorFlow CNN leaf-disease service.

Run:
    pip install -r requirements.txt
    uvicorn main:app --host 0.0.0.0 --port 8000

Then set the backend secret CNN_SERVICE_URL to this service's public URL
(and optionally CNN_SERVICE_TOKEN to require a bearer token).

Contract expected by /api/public/ai/disease-scan:
    POST /predict   multipart form-data: file=<image>
    -> {"disease": str, "crop": str|null, "confidence": float(0-100), "top_k": [...]}
"""

import io
import os

import numpy as np
import tensorflow as tf
from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from PIL import Image

MODEL_PATH = os.getenv("MODEL_PATH", "model/plant_disease_cnn.keras")
LABELS_PATH = os.getenv("LABELS_PATH", "model/labels.txt")
IMG_SIZE = int(os.getenv("IMG_SIZE", "224"))
SERVICE_TOKEN = os.getenv("CNN_SERVICE_TOKEN")

app = FastAPI(title="AgriSmart CNN")

model = tf.keras.models.load_model(MODEL_PATH)
with open(LABELS_PATH, "r", encoding="utf-8") as fh:
    LABELS = [line.strip() for line in fh if line.strip()]


def preprocess(raw: bytes) -> np.ndarray:
    img = Image.open(io.BytesIO(raw)).convert("RGB").resize((IMG_SIZE, IMG_SIZE))
    arr = np.asarray(img, dtype=np.float32) / 255.0
    return np.expand_dims(arr, axis=0)


def split_label(label: str):
    # PlantVillage labels look like "Tomato___Late_blight"
    if "___" in label:
        crop, disease = label.split("___", 1)
    else:
        crop, disease = None, label
    return (
        crop.replace("_", " ").strip() if crop else None,
        disease.replace("_", " ").strip(),
    )


@app.get("/health")
def health():
    return {"ok": True, "classes": len(LABELS)}


@app.post("/predict")
async def predict(file: UploadFile = File(...), authorization: str = Header(default="")):
    if SERVICE_TOKEN and authorization != f"Bearer {SERVICE_TOKEN}":
        raise HTTPException(status_code=401, detail="Unauthorized")

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty file")

    preds = model.predict(preprocess(raw), verbose=0)[0]
    order = np.argsort(preds)[::-1][:3]
    crop, disease = split_label(LABELS[int(order[0])])

    return {
        "disease": disease,
        "crop": crop,
        "confidence": round(float(preds[int(order[0])]) * 100, 2),
        "top_k": [
            {
                "label": LABELS[int(i)],
                "confidence": round(float(preds[int(i)]) * 100, 2),
            }
            for i in order
        ],
    }
