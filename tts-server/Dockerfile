# ─── Stage 1: Build ───────────────────────────────────────
FROM python:3.11-slim AS builder

# Install espeak-ng (required by Coqui TTS for phonemization)
RUN apt-get update && apt-get install -y --no-install-recommends \
    espeak-ng \
    libespeak-ng1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps (CPU-only PyTorch)
COPY requirements-docker.txt .
RUN pip install --no-cache-dir -r requirements-docker.txt

# ─── Stage 2: Runtime ─────────────────────────────────────
FROM python:3.11-slim

# Install espeak-ng runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    espeak-ng \
    libespeak-ng1 \
    && rm -rf /var/lib/apt/lists/*

# Copy Python packages from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

WORKDIR /app

# Copy server code
COPY server.py .

# Create cache & voices directories  
RUN mkdir -p /app/cache /app/voices

# Set environment
ENV COQUI_TOS_AGREED=1
ENV PHONEMIZER_ESPEAK_LIBRARY=/usr/lib/x86_64-linux-gnu/libespeak-ng.so.1
ENV PORT=8100

# Expose port
EXPOSE 8100

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8100/health')" || exit 1

# Pre-download VITS model at build time (cache in image)
RUN python -c "import os; os.environ['COQUI_TOS_AGREED']='1'; from TTS.api import TTS; TTS('tts_models/en/vctk/vits')" || true

# Start server
CMD ["python", "server.py"]
