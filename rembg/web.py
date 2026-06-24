import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Query, Request, Response
from rembg import new_session, remove

DEFAULT_MODEL = os.environ.get("REMBG_MODEL", "isnet-general-use")

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
    get_session(DEFAULT_MODEL)  # default-model warmen zodat de eerste call snel is
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
