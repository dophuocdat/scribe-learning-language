"""
🐸 Scribe TTS Server — Multi-Engine
=============================================
FastAPI server running on localhost:8100

Endpoints:
  GET /api/tts?text=...&speaker=p225             → VITS (fast, 1-2s, 109 voices)
  GET /api/tts-piper?text=...&voice=amy          → Piper (fast, natural voices)
  GET /api/tts-hq?text=...&lang=en               → XTTS v2 (slow, voice cloning)
  GET /api/voices                                → List all available voices
  GET /api/clone-voices                          → List voice clone references
  GET /health                                    → Health check

Models:
  - VITS (tts_models/en/vctk/vits) — real-time, 109 speakers
  - Piper (en_US-amy, en_US-ryan) — natural, fast, ONNX-based
  - XTTS v2 (tts_models/multilingual/multi-dataset/xtts_v2) — voice cloning
"""

import io
import os
import sys
import time
import hashlib
import logging
from pathlib import Path
from typing import Optional

# ─── CRITICAL: Set up espeak-ng BEFORE any TTS imports ─────
# espeak-ng is required by Coqui TTS for phonemization.
# We must ensure it's in PATH even if the server is started
# from a shell that doesn't have the updated PATH.
ESPEAK_PATHS = [
    r"C:\Program Files\eSpeak NG",
    r"C:\Program Files (x86)\eSpeak NG",
]
for p in ESPEAK_PATHS:
    if os.path.isdir(p) and p not in os.environ.get("PATH", ""):
        os.environ["PATH"] = p + os.pathsep + os.environ.get("PATH", "")
        # Also set the library path for phonemizer
        dll = os.path.join(p, "libespeak-ng.dll")
        if os.path.isfile(dll):
            os.environ["PHONEMIZER_ESPEAK_LIBRARY"] = dll
        break

# Accept Coqui TOS automatically
os.environ["COQUI_TOS_AGREED"] = "1"

import torch
import numpy as np
import soundfile as sf
from fastapi import FastAPI, Query, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

# ─── Config ────────────────────────────────────────────────
HOST = "0.0.0.0"
PORT = 8100
CACHE_DIR = Path(__file__).parent / "cache"
VOICES_DIR = Path(__file__).parent / "voices"
PIPER_VOICES_DIR = Path(__file__).parent / "piper-voices"

# Create dirs
CACHE_DIR.mkdir(exist_ok=True)
VOICES_DIR.mkdir(exist_ok=True)
PIPER_VOICES_DIR.mkdir(exist_ok=True)

# ─── Logging ───────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("tts-server")

# ─── App ───────────────────────────────────────────────────
app = FastAPI(
    title="🐸 Scribe TTS Server",
    description="Local Coqui TTS server for Scribe learning app",
    version="1.0.0",
)

# CORS — allow all origins for local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Global model holders ──────────────────────────────────
vits_model = None
xtts_model = None
piper_voices: dict = {}  # name → PiperVoice instance

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
logger.info(f"Device: {DEVICE}")

# ─── Piper voice config ───────────────────────────────────
PIPER_VOICE_MAP = {
    "amy": "en_US-amy-medium",
    "ryan": "en_US-ryan-medium",
}

def get_piper_voice(name: str):
    """Lazy-load a Piper ONNX voice model"""
    if name in piper_voices:
        return piper_voices[name]
    
    model_id = PIPER_VOICE_MAP.get(name, name)
    model_path = PIPER_VOICES_DIR / f"{model_id}.onnx"
    config_path = PIPER_VOICES_DIR / f"{model_id}.onnx.json"
    
    if not model_path.exists():
        raise FileNotFoundError(f"Piper model not found: {model_path}")
    
    logger.info(f"Loading Piper voice: {name} ({model_id})...")
    from piper import PiperVoice
    start = time.time()
    voice = PiperVoice.load(str(model_path), config_path=str(config_path) if config_path.exists() else None)
    elapsed = time.time() - start
    logger.info(f"Piper voice '{name}' loaded in {elapsed:.1f}s")
    piper_voices[name] = voice
    return voice


def get_vits_model():
    """Lazy-load VITS model (fast, multi-speaker English)"""
    global vits_model
    if vits_model is None:
        logger.info("Loading VITS model (tts_models/en/vctk/vits)...")
        from TTS.api import TTS
        start = time.time()
        vits_model = TTS("tts_models/en/vctk/vits").to(DEVICE)
        logger.info(f"VITS model loaded in {time.time() - start:.1f}s")
    return vits_model


def get_xtts_model():
    """Lazy-load XTTS v2 model (slow on CPU, best quality)"""
    global xtts_model
    if xtts_model is None:
        logger.info("Loading XTTS v2 model...")
        from TTS.api import TTS
        start = time.time()
        xtts_model = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(DEVICE)
        logger.info(f"XTTS v2 model loaded in {time.time() - start:.1f}s")
    return xtts_model


def text_hash(text: str, speaker: str = "") -> str:
    """Create a short hash for caching"""
    return hashlib.md5(f"{text}|{speaker}".encode()).hexdigest()[:12]


def wav_to_streaming_response(wav_data: list | np.ndarray, sample_rate: int = 22050) -> StreamingResponse:
    """Convert wav data to streaming audio response"""
    buf = io.BytesIO()
    if isinstance(wav_data, list):
        wav_data = np.array(wav_data)
    sf.write(buf, wav_data, sample_rate, format="WAV")
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="audio/wav",
        headers={
            "Cache-Control": "public, max-age=86400",
            "Content-Disposition": "inline; filename=tts.wav",
        },
    )


# ─── Endpoints ─────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "device": DEVICE,
        "vits_loaded": vits_model is not None,
        "xtts_loaded": xtts_model is not None,
    }


@app.get("/api/voices")
async def list_voices():
    """List all available voices across all engines"""
    try:
        model = get_vits_model()
        speakers = model.speakers if hasattr(model, 'speakers') and model.speakers else []
        
        # Piper voices
        piper_available = []
        for name, model_id in PIPER_VOICE_MAP.items():
            model_path = PIPER_VOICES_DIR / f"{model_id}.onnx"
            piper_available.append({
                "name": name,
                "model": model_id,
                "installed": model_path.exists(),
                "endpoint": f"/api/tts-piper?text=Hello&voice={name}",
            })

        return {
            "vits": {
                "model": "tts_models/en/vctk/vits",
                "speakers": speakers,
                "total": len(speakers),
                "recommended": {
                    "en-US": "p243",
                    "en-GB-female": "p225",
                    "en-GB-male": "p226",
                    "en-default": "p225",
                },
            },
            "piper": {
                "voices": piper_available,
                "total": len(piper_available),
                "description": "Natural-sounding voices, very fast (~0.5s)",
            },
        }
    except Exception as e:
        logger.error(f"Error listing voices: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/clone-voices")
async def list_clone_voices():
    """
    🎙️ List available voice references for XTTS v2 cloning.
    
    Drop .wav files (6-10 seconds of clear speech) into the `voices/` folder.
    They will automatically appear here and can be used with /api/tts-hq.
    
    Naming convention:
      - voices/my_teacher.wav     → voice name: "my_teacher"
      - voices/en_default.wav     → auto-used as default for lang=en
      - voices/vi_default.wav     → auto-used as default for lang=vi
    """
    voice_files = list(VOICES_DIR.glob("*.wav"))
    voices = []
    for f in voice_files:
        name = f.stem  # filename without extension
        size_kb = f.stat().st_size / 1024
        voices.append({
            "name": name,
            "file": f.name,
            "size_kb": round(size_kb, 1),
            "is_default": name.endswith("_default"),
            "usage": f"/api/tts-hq?text=Hello&lang=en&voice={name}",
        })
    return {
        "voices_dir": str(VOICES_DIR),
        "voices": voices,
        "total": len(voices),
        "how_to_add": "Drop a .wav file (6-10s of clear speech) into the voices/ folder.",
    }


@app.get("/api/tts-piper")
async def tts_piper(
    text: str = Query(..., description="Text to synthesize", max_length=1000),
    voice: str = Query("amy", description="Piper voice name (amy, ryan)"),
):
    """
    🎙️ Piper TTS — Fast, natural-sounding voices (~0.5-1s)
    
    Available voices: amy (female), ryan (male)
    Very fast inference using ONNX runtime.
    """
    if not text.strip():
        raise HTTPException(status_code=400, detail="Text is required")

    # Check cache
    h = text_hash(text, voice)
    cache_path = CACHE_DIR / f"piper_{h}.wav"
    if cache_path.exists():
        logger.info(f"Piper cache hit: {cache_path.name}")
        return StreamingResponse(
            open(cache_path, "rb"),
            media_type="audio/wav",
            headers={"Cache-Control": "public, max-age=86400", "X-Cache": "HIT"},
        )

    try:
        piper_voice = get_piper_voice(voice)
        start = time.time()
        logger.info(f"Piper generating: '{text[:50]}...' voice={voice}")

        # Synthesize — returns iterable of AudioChunk
        chunks = list(piper_voice.synthesize(text))
        audio_bytes = b''.join(c.audio_int16_bytes for c in chunks)
        sample_rate = piper_voice.config.sample_rate

        elapsed = time.time() - start
        logger.info(f"Piper generated in {elapsed:.2f}s")

        # Build WAV in memory
        import struct
        data_size = len(audio_bytes)
        wav_header = b'RIFF' + struct.pack('<I', 36 + data_size) + b'WAVEfmt '
        wav_header += struct.pack('<IHHIIHH', 16, 1, 1, sample_rate, sample_rate * 2, 2, 16)
        wav_header += b'data' + struct.pack('<I', data_size)
        wav_data = wav_header + audio_bytes

        # Cache to disk
        with open(cache_path, "wb") as f:
            f.write(wav_data)

        return StreamingResponse(
            io.BytesIO(wav_data),
            media_type="audio/wav",
            headers={
                "Cache-Control": "public, max-age=86400",
                "X-Generation-Time": f"{elapsed:.2f}s",
                "X-Voice": voice,
            },
        )

    except FileNotFoundError as e:
        available = list(PIPER_VOICE_MAP.keys())
        raise HTTPException(
            status_code=404,
            detail=f"{str(e)}. Available voices: {available}"
        )
    except Exception as e:
        logger.error(f"Piper error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/tts")
async def tts_vits(
    text: str = Query(..., description="Text to synthesize", max_length=500),
    speaker: str = Query("p225", description="VITS speaker ID (e.g. p225, p226, p243)"),
    speed: float = Query(1.0, description="Speech speed multiplier", ge=0.5, le=2.0),
):
    """
    🔊 VITS TTS — Fast real-time synthesis (~1-2s on CPU)
    
    Good for: on-demand text, short sentences, vocabulary
    """
    if not text.strip():
        raise HTTPException(status_code=400, detail="Text is required")

    # Check cache
    h = text_hash(text, speaker)
    cache_path = CACHE_DIR / f"vits_{h}.wav"
    if cache_path.exists():
        logger.info(f"Cache hit: {cache_path.name}")
        return StreamingResponse(
            open(cache_path, "rb"),
            media_type="audio/wav",
            headers={"Cache-Control": "public, max-age=86400", "X-Cache": "HIT"},
        )

    try:
        model = get_vits_model()
        start = time.time()
        
        logger.info(f"VITS generating: '{text[:50]}...' speaker={speaker}")
        wav = model.tts(text=text, speaker=speaker)
        elapsed = time.time() - start
        logger.info(f"VITS generated in {elapsed:.2f}s")

        # Convert to numpy
        wav_np = np.array(wav, dtype=np.float32)

        # Cache to disk
        sf.write(str(cache_path), wav_np, 22050, format="WAV")

        return wav_to_streaming_response(wav_np, 22050)

    except Exception as e:
        logger.error(f"VITS error: {e}")
        raise HTTPException(status_code=500, detail=f"TTS generation failed: {str(e)}")


@app.get("/api/tts-hq")
async def tts_xtts(
    text: str = Query(..., description="Text to synthesize", max_length=1000),
    lang: str = Query("en", description="Language code (en, es, fr, de, ...)"),
    voice: Optional[str] = Query(None, description="Voice name from voices/ folder (e.g. 'my_teacher')"),
    speaker_wav: Optional[str] = Query(None, description="Full path to speaker WAV (advanced)"),
    speaker: Optional[str] = Query(None, description="Built-in XTTS speaker name"),
):
    """
    🎙️ XTTS v2 TTS — High quality synthesis (30-60s on CPU!)
    
    ⚠️ WARNING: Very slow on CPU! Use for batch pre-generation only.
    Good for: pre-generating exercise audio, voice cloning
    """
    if not text.strip():
        raise HTTPException(status_code=400, detail="Text is required")

    # Check cache
    h = text_hash(text, f"{lang}_{speaker or speaker_wav or 'default'}")
    cache_path = CACHE_DIR / f"xtts_{h}.wav"
    if cache_path.exists():
        logger.info(f"Cache hit: {cache_path.name}")
        return StreamingResponse(
            open(cache_path, "rb"),
            media_type="audio/wav",
            headers={"Cache-Control": "public, max-age=86400", "X-Cache": "HIT"},
        )

    try:
        model = get_xtts_model()
        start = time.time()

        logger.info(f"XTTS generating: '{text[:50]}...' lang={lang}")

        # Determine speaker source — priority: voice name > speaker_wav > lang default
        ref_wav = None
        if voice:
            # Look up by name in voices/ directory
            voice_path = VOICES_DIR / f"{voice}.wav"
            if voice_path.exists():
                ref_wav = str(voice_path)
                logger.info(f"Using cloned voice: {voice}")
            else:
                raise HTTPException(status_code=404, detail=f"Voice '{voice}' not found. Available: {[f.stem for f in VOICES_DIR.glob('*.wav')]}")
        elif speaker_wav:
            ref_wav = speaker_wav
        else:
            # Check voices directory for language default
            default_ref = VOICES_DIR / f"{lang}_default.wav"
            if default_ref.exists():
                ref_wav = str(default_ref)
                logger.info(f"Using default voice for {lang}")

        if ref_wav:
            wav = model.tts(text=text, speaker_wav=ref_wav, language=lang)
        elif speaker:
            wav = model.tts(text=text, speaker=speaker, language=lang)
        else:
            # Use a built-in speaker
            wav = model.tts(text=text, language=lang, speaker="Ana Florence")

        elapsed = time.time() - start
        logger.info(f"XTTS generated in {elapsed:.2f}s")

        wav_np = np.array(wav, dtype=np.float32)

        # Cache to disk
        sf.write(str(cache_path), wav_np, 24000, format="WAV")

        return wav_to_streaming_response(wav_np, 24000)

    except Exception as e:
        logger.error(f"XTTS error: {e}")
        raise HTTPException(status_code=500, detail=f"TTS-HQ generation failed: {str(e)}")


@app.get("/api/preload")
async def preload_models(model: str = Query("vits", description="Model to preload: vits or xtts")):
    """Pre-load a model into memory"""
    try:
        if model == "vits":
            get_vits_model()
            return {"status": "ok", "model": "vits", "message": "VITS model loaded"}
        elif model == "xtts":
            get_xtts_model()
            return {"status": "ok", "model": "xtts", "message": "XTTS v2 model loaded"}
        else:
            raise HTTPException(status_code=400, detail="Invalid model. Use 'vits' or 'xtts'")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Main ──────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    logger.info(f"🐸 Starting Scribe TTS Server on http://localhost:{PORT}")
    logger.info(f"📖 API docs: http://localhost:{PORT}/docs")
    logger.info(f"🔧 Device: {DEVICE}")
    
    uvicorn.run(app, host=HOST, port=PORT, log_level="info")
