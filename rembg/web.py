import asyncio
import os
import time
from contextlib import asynccontextmanager

# lichte module-imports; zware libs (rembg/onnxruntime/numpy/PIL) laden lazy
from fastapi import FastAPI, Query, Request, Response

DEFAULT_MODEL = os.environ.get("REMBG_MODEL", "isnet-general-use")
IDLE_TTL = float(os.environ.get("MODEL_TTL_SECONDS", "3600"))  # idle → proces afsluiten, docker herstart vers

ALLOWED_MODELS = {"isnet-general-use", "birefnet-general"}

_sessions = {}
_last_used = time.monotonic()
_inflight = 0  # actieve model-requests; de reaper sluit nooit af terwijl er werk loopt
_model_lock = asyncio.Lock()  # één inferentie tegelijk: twee birefnet-runs passen niet in het geheugen


def _touch():
    global _last_used
    _last_used = time.monotonic()


def get_session(model: str):
    from rembg import new_session

    if model not in _sessions:
        _sessions[model] = new_session(model)
    _touch()
    return _sessions[model]


@asynccontextmanager
async def lifespan(app: FastAPI):
    # sluit het proces af na IDLE_TTL zonder gebruik (docker herstart vers)
    async def reaper():
        while True:
            await asyncio.sleep(min(IDLE_TTL, 300))
            if _sessions and _inflight == 0 and time.monotonic() - _last_used > IDLE_TTL:
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
    _inflight += 1
    try:
        data = await request.body()
        async with _model_lock:
            png = await asyncio.to_thread(_remove, data, m)
        return Response(content=png, media_type="image/png")
    finally:
        _inflight -= 1


# buiten de event loop, zodat /health blijft antwoorden tijdens een cutout
def _remove(data: bytes, model: str) -> bytes:
    from rembg import remove

    return remove(data, session=get_session(model))
