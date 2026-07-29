# AgriSmart AI — Python TensorFlow CNN service

Leaf-disease classifier called by the backend route
`POST /api/public/ai/disease-scan`.

## 1. Model files

Place your trained PlantVillage CNN here:

```
python_service/model/plant_disease_cnn.keras
python_service/model/labels.txt      # one class per line, e.g. Tomato___Late_blight
```

Any Keras classifier works as long as it takes `224x224x3` inputs scaled to
`0..1` and outputs softmax probabilities in the same order as `labels.txt`.

## 2. Run

```bash
cd python_service
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

Optional env: `MODEL_PATH`, `LABELS_PATH`, `IMG_SIZE`, `CNN_SERVICE_TOKEN`.

## 3. Connect it to the app

Expose the service publicly (Render, Railway, Fly.io, Cloud Run, or an ngrok
tunnel while testing) and add these backend secrets:

- `CNN_SERVICE_URL` — e.g. `https://agrismart-cnn.onrender.com`
- `CNN_SERVICE_TOKEN` — optional shared bearer token

When `CNN_SERVICE_URL` is unset the backend automatically falls back to the
vision LLM, so the Flutter screen keeps working either way.

## 4. Request / response contract

```
POST /predict      multipart/form-data: file=<jpeg|png|webp>
200  {"disease":"Late blight","crop":"Tomato","confidence":96.4,
      "top_k":[{"label":"Tomato___Late_blight","confidence":96.4}, ...]}
```
