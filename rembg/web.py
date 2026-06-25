import io
import os
from contextlib import asynccontextmanager

import numpy as np
import onnxruntime as ort
from fastapi import FastAPI, Query, Request, Response
from PIL import Image
from rembg import new_session, remove

DEFAULT_MODEL = os.environ.get("REMBG_MODEL", "isnet-general-use")

# CLIP ViT-B/32 vision-encoder (embeddings voor dubbel-detectie). Lazy geladen.
CLIP_PATH = "/models/clip-vision.onnx"
CLIP_MEAN = np.array([0.48145466, 0.4578275, 0.40821073], dtype=np.float32)
CLIP_STD = np.array([0.26862954, 0.26130258, 0.27577711], dtype=np.float32)
_clip = None


def get_clip():
    global _clip
    if _clip is None:
        _clip = ort.InferenceSession(CLIP_PATH, providers=["CPUExecutionProvider"])
    return _clip


def clip_preprocess(data: bytes) -> np.ndarray:
    img = Image.open(io.BytesIO(data)).convert("RGB").resize((224, 224), Image.BICUBIC)
    arr = np.asarray(img, dtype=np.float32) / 255.0
    arr = (arr - CLIP_MEAN) / CLIP_STD
    return arr.transpose(2, 0, 1)[None].astype(np.float32)  # (1,3,224,224)

# Alleen de in het image gebakken modellen toestaan; een onbekende naam zou
# anders new_session() een download laten proberen (en is user-controlled via de API).
ALLOWED_MODELS = {"isnet-general-use", "birefnet-general"}

_sessions = {}


def get_session(model: str):
    if model not in _sessions:
        _sessions[model] = new_session(model)
    return _sessions[model]


@asynccontextmanager
async def lifespan(app: FastAPI):
    # geen eager model-load: zo accepteert uvicorn (en /health) direct → snel healthy.
    # modellen laden lazy bij de eerste /cutout resp. /embed (async, niet kritiek).
    yield


app = FastAPI(lifespan=lifespan)


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/cutout")
async def cutout(request: Request, model: str | None = Query(default=None)):
    m = model or DEFAULT_MODEL
    if m not in ALLOWED_MODELS:
        return Response(status_code=400, content=b"unknown model")
    data = await request.body()
    out = remove(data, session=get_session(m))
    return Response(content=out, media_type="image/png")


@app.post("/embed")
async def embed(request: Request):
    data = await request.body()
    if not data:
        return Response(status_code=400, content=b"empty body")
    sess = get_clip()
    x = clip_preprocess(data)
    out = sess.run(None, {sess.get_inputs()[0].name: x})[0][0].astype(np.float32)
    norm = float(np.linalg.norm(out))
    vec = (out / norm) if norm > 0 else out  # L2-normaliseren → cosine = dot
    return {"embedding": vec.tolist()}
