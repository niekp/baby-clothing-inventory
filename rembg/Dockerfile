FROM python:3.11-slim
WORKDIR /app

# onnxruntime/rembg runtime-libs
RUN apt-get update && apt-get install -y --no-install-recommends \
      libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

ENV U2NET_HOME=/models

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# modellen in het image bakken (geen runtime-download): isnet (eager) + birefnet (recutout)
# + CLIP ViT-B/32 vision-encoder voor item-embeddings (dubbel-detectie)
RUN mkdir -p /models \
    && python -c "from rembg import new_session; new_session('isnet-general-use'); new_session('birefnet-general')" \
    && python -c "import urllib.request; urllib.request.urlretrieve('https://huggingface.co/Qdrant/clip-ViT-B-32-vision/resolve/main/model.onnx', '/models/clip-vision.onnx')" \
    && chmod -R a+rX /models

COPY web.py .
# numba (via pymatting) cachet @njit naast de bron in site-packages; als uid 1000
# is dat read-only -> "no locator available". Schrijfbare cache-dir lost dit op.
ENV NUMBA_CACHE_DIR=/tmp/numba-cache
EXPOSE 28872
CMD ["uvicorn", "web:app", "--host", "0.0.0.0", "--port", "28872"]
