import asyncio
import io
import os
import time
from contextlib import asynccontextmanager

# lichte module-imports; zware libs (rembg/onnxruntime/numpy/PIL) laden lazy
from fastapi import FastAPI, Query, Request, Response

DEFAULT_MODEL = os.environ.get("REMBG_MODEL", "isnet-general-use")
CLIP_PATH = "/models/clip-vision.onnx"
IDLE_TTL = float(os.environ.get("MODEL_TTL_SECONDS", "3600"))  # idle → proces afsluiten, docker herstart vers

ALLOWED_MODELS = {"isnet-general-use", "birefnet-general"}

_sessions = {}
_clip = None
_last_used = time.monotonic()
_inflight = 0  # actieve model-requests; de reaper sluit nooit af terwijl er werk loopt


def _touch():
    global _last_used
    _last_used = time.monotonic()


def get_session(model: str):
    from rembg import new_session

    if model not in _sessions:
        _sessions[model] = new_session(model)
    _touch()
    return _sessions[model]


def get_clip():
    global _clip
    if _clip is None:
        import onnxruntime as ort

        _clip = ort.InferenceSession(CLIP_PATH, providers=["CPUExecutionProvider"])
    _touch()
    return _clip


def clip_preprocess(data: bytes):
    import numpy as np
    from PIL import Image

    img = Image.open(io.BytesIO(data)).convert("RGB").resize((224, 224), Image.BICUBIC)
    arr = np.asarray(img, dtype=np.float32) / 255.0
    mean = np.array([0.48145466, 0.4578275, 0.40821073], dtype=np.float32)
    std = np.array([0.26862954, 0.26130258, 0.27577711], dtype=np.float32)
    arr = (arr - mean) / std
    return arr.transpose(2, 0, 1)[None].astype(np.float32)  # (1,3,224,224)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # sluit het proces af na IDLE_TTL zonder gebruik (docker herstart vers)
    async def reaper():
        while True:
            await asyncio.sleep(min(IDLE_TTL, 300))
            loaded = bool(_sessions) or _clip is not None
            if loaded and _inflight == 0 and time.monotonic() - _last_used > IDLE_TTL:
                os._exit(0)

    task = asyncio.create_task(reaper())
    try:
        yield
    finally:
        task.cancel()


app = FastAPI(lifespan=lifespan)


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/cutout")
async def cutout(request: Request, model: str | None = Query(default=None)):
    global _inflight
    m = model or DEFAULT_MODEL
    if m not in ALLOWED_MODELS:
        return Response(status_code=400, content=b"unknown model")
    from rembg import remove

    _inflight += 1
    try:
        data = await request.body()
        return Response(content=remove(data, session=get_session(m)), media_type="image/png")
    finally:
        _inflight -= 1


@app.post("/embed")
async def embed(request: Request):
    import numpy as np

    global _inflight
    _inflight += 1
    try:
        data = await request.body()
        if not data:
            return Response(status_code=400, content=b"empty body")
        sess = get_clip()
        x = clip_preprocess(data)
        out = sess.run(None, {sess.get_inputs()[0].name: x})[0][0].astype(np.float32)
        norm = float(np.linalg.norm(out))
        vec = (out / norm) if norm > 0 else out  # L2-normaliseren → cosine = dot
        return {"embedding": vec.tolist()}
    finally:
        _inflight -= 1
