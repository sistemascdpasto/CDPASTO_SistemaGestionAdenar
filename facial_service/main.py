"""
main.py - API FastAPI para ADENAR SG-SST.

Endpoints:
  GET  /health                  estado del servicio (detalle solo con API key)
  POST /galeria/sincronizar     carga colaboradores en memoria (para tiempo real)
  POST /reconocer               foto única (compatible con Laravel)
  POST /frame                   un fotograma suelto (fallback HTTP del modo en vivo)
  WS   /ws/reconocer?token=...  video en vivo: envía JPEG binario, recibe JSON

Variables de entorno útiles:
  FACIAL_API_KEY        token compartido con Laravel y el frontend (OBLIGATORIO en producción)
  FACIAL_CORS           orígenes permitidos separados por coma (también se valida en el WebSocket)
  FACIAL_WORKERS        hilos de inferencia simultáneos (por defecto 2)
  FACIAL_MAX_UPLOAD     bytes máximos de la foto (por defecto 5 MB)
  FACIAL_MAX_FRAME      bytes máximos por fotograma (por defecto 1 MB)
  FACIAL_MAX_WS         conexiones WebSocket simultáneas (por defecto 4)
  FACIAL_WS_IDLE        segundos sin fotogramas antes de cerrar el socket (por defecto 30)
  FACIAL_MAX_CANDIDATES máximo de candidatos por petición (por defecto 5000)
  FACIAL_IDENTIFY_EVERY identificar cada N fotogramas (por defecto 1)

Ejecutar:  uvicorn facial_service.main:app --host 127.0.0.1 --port 8001
(un solo proceso: la galería vive en memoria; escala con FACIAL_WORKERS)
"""

import asyncio
import hmac
import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from typing import Optional

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import (Depends, FastAPI, File, Form, Header, HTTPException, Request, UploadFile,
                     WebSocket, WebSocketDisconnect)
from fastapi.middleware.cors import CORSMiddleware

from facial_core import FaceEngine, decode_image, log

VERSION = "2.1.0"


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except ValueError:
        return default


API_KEY = os.environ.get("FACIAL_API_KEY", "")
MAX_UPLOAD = _env_int("FACIAL_MAX_UPLOAD", 5 * 1024 * 1024)
MAX_FRAME = _env_int("FACIAL_MAX_FRAME", 1024 * 1024)
MAX_WS = _env_int("FACIAL_MAX_WS", 4)
WS_IDLE = _env_int("FACIAL_WS_IDLE", 30)
MAX_CANDIDATES = _env_int("FACIAL_MAX_CANDIDATES", 5000)
WORKERS = max(1, _env_int("FACIAL_WORKERS", 2))
IDENTIFY_EVERY = max(1, _env_int("FACIAL_IDENTIFY_EVERY", 1))
ORIGINS = [o.strip() for o in os.environ.get("FACIAL_CORS", "*").split(",") if o.strip()]
ANY_ORIGIN = "*" in ORIGINS

if not API_KEY:
    log("[ADVERTENCIA] FACIAL_API_KEY no está definida: el servicio queda SIN autenticación. "
        "Úsalo así solo en desarrollo.")
elif ANY_ORIGIN:
    log("[ADVERTENCIA] FACIAL_CORS='*': define los orígenes permitidos en producción.")

engine = FaceEngine()
executor = ThreadPoolExecutor(max_workers=WORKERS, thread_name_prefix="facial")
_ws_active = 0


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield
    executor.shutdown(wait=False, cancel_futures=True)


app = FastAPI(title="ADENAR Facial Recognition Service", version=VERSION, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if ANY_ORIGIN else ORIGINS,
    allow_credentials=False,          # la autenticación va por cabecera/token, no por cookies
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-API-Key"],
)


# ------------------------------------------------------------------ utilidades
async def run(fn, *args):
    """Ejecuta trabajo pesado (decodificación, inferencia) fuera del event loop."""
    return await asyncio.get_running_loop().run_in_executor(executor, fn, *args)


def _valid_key(provided: Optional[str]) -> bool:
    if not API_KEY:
        return True
    return bool(provided) and hmac.compare_digest(provided, API_KEY)


def _origin_allowed(origin: Optional[str]) -> bool:
    """CORS no aplica a WebSocket: se valida el Origin a mano (clientes sin navegador no lo envían)."""
    return ANY_ORIGIN or origin is None or origin in ORIGINS


async def require_key(x_api_key: Optional[str] = Header(default=None)):
    if not _valid_key(x_api_key):
        raise HTTPException(status_code=401, detail="No autorizado")


# ------------------------------------------------------------------- endpoints
@app.get("/health")
def health(x_api_key: Optional[str] = Header(default=None)):
    info = {"status": "online", "version": VERSION}
    if _valid_key(x_api_key):
        info.update({"service": "ADENAR Facial Recognition", "model": engine.model,
                     "detector": engine.detector, "gallery": engine.gallery_size,
                     "cached_faces": len(engine.cache)})
    return info


@app.post("/galeria/sincronizar", dependencies=[Depends(require_key)])
async def sincronizar(request: Request):
    """
    Acepta dos formatos de petición:

    1. Multipart (nuevo — usado por Laravel):
       - Campo  "candidates_json": JSON con [{id, nombres, apellidos, cedula, cargo}, ...]
       - Archivos "foto_{id}":     bytes de la fotografía de cada colaborador
       No requiere acceso al sistema de archivos de Laravel.

    2. JSON legacy (compatibilidad):
       - Body: {"candidates": [{"id": 1, "image_path": "/ruta/foto.jpg"}, ...]}
       Solo funciona cuando FastAPI corre en el mismo servidor que Laravel.
    """
    content_type = request.headers.get("content-type", "")

    # ── Formato multipart (fotografías reales enviadas desde Laravel) ──────────
    if "multipart/form-data" in content_type:
        form = await request.form()

        candidates_json_raw = form.get("candidates_json")
        if not candidates_json_raw:
            raise HTTPException(status_code=422, detail="Se espera el campo 'candidates_json'")

        try:
            meta_list = json.loads(candidates_json_raw)
            if not isinstance(meta_list, list):
                raise ValueError("debe ser una lista")
        except Exception as e:
            raise HTTPException(status_code=422, detail=f"candidates_json inválido: {e}")

        if len(meta_list) > MAX_CANDIDATES:
            raise HTTPException(status_code=413, detail=f"Máximo {MAX_CANDIDATES} candidatos por petición")

        # Leer los bytes de cada foto adjunta (foto_{id}) e incluirlos en el candidato
        candidates: list[dict] = []
        for meta in meta_list:
            cid = meta.get("id")
            field_name = f"foto_{cid}"
            upload: Optional[UploadFile] = form.get(field_name)  # type: ignore[assignment]
            if upload is None:
                log(f"[Aviso] /galeria/sincronizar: no se recibió '{field_name}' para el candidato {cid}")
                continue
            foto_bytes = await upload.read()
            if not foto_bytes:
                continue
            candidates.append({
                "id":         cid,
                "nombres":    meta.get("nombres"),
                "apellidos":  meta.get("apellidos"),
                "cedula":     meta.get("cedula"),
                "cargo":      meta.get("cargo"),
                "image_bytes": foto_bytes,   # bytes crudos; facial_core los decodifica
            })

        if not candidates:
            raise HTTPException(status_code=422, detail="No se recibió ninguna fotografía válida")

        return await run(engine.load_gallery, candidates)

    # ── Formato JSON legacy (image_path — solo mismo servidor) ────────────────
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=422, detail="Body inválido: se espera JSON o multipart/form-data")

    candidates_legacy = payload.get("candidates")
    if not isinstance(candidates_legacy, list):
        raise HTTPException(status_code=422, detail="Se espera 'candidates' como lista")
    if len(candidates_legacy) > MAX_CANDIDATES:
        raise HTTPException(status_code=413, detail=f"Máximo {MAX_CANDIDATES} candidatos por petición")
    return await run(engine.load_gallery, candidates_legacy)


@app.post("/reconocer", dependencies=[Depends(require_key)])
async def reconocer(foto: UploadFile = File(...), candidates_json: Optional[str] = Form(default=None)):
    candidates = None
    if candidates_json:
        try:
            candidates = json.loads(candidates_json)
            if not isinstance(candidates, list):
                raise ValueError("debe ser una lista")
            if len(candidates) > MAX_CANDIDATES:
                raise ValueError(f"máximo {MAX_CANDIDATES} candidatos")
        except Exception as e:
            return {"success": False, "status": "error", "message": f"Formato inválido de candidatos: {e}"}

    data = await foto.read(MAX_UPLOAD + 1)
    if len(data) > MAX_UPLOAD:
        raise HTTPException(status_code=413, detail="La fotografía supera el tamaño permitido")

    try:
        img = await run(decode_image, data)    # en memoria: la foto capturada no se escribe en disco
        return await run(engine.comparar, img, candidates)
    except Exception as e:
        log(f"[Error] /reconocer: {e}")
        return {"success": False, "status": "error", "message": "Error en el servidor biométrico."}


@app.post("/frame", dependencies=[Depends(require_key)])
async def analizar_frame(foto: UploadFile = File(...)):
    """Analiza un fotograma único en vivo y devuelve rostros y coincidencia."""
    data = await foto.read(MAX_FRAME + 1)
    if len(data) > MAX_FRAME:
        raise HTTPException(status_code=413, detail="Fotograma demasiado grande")
    img = await run(decode_image, data)
    if img is None:
        raise HTTPException(status_code=400, detail="Fotograma inválido")
    try:
        return await run(engine.analyze_frame, img, True)
    except Exception as e:
        log(f"[Error] /frame: {e}")
        raise HTTPException(status_code=500, detail="Error procesando el fotograma")


@app.websocket("/ws/reconocer")
async def ws_reconocer(ws: WebSocket, token: Optional[str] = None):
    """
    Protocolo: el cliente envía un JPEG binario y espera la respuesta antes de enviar el siguiente
    (así nunca se acumulan fotogramas viejos). Respuesta:
      {"type":"faces","v":1,"w":640,"h":480,
       "faces":[{"box":[x,y,w,h],"score":0.97,"identity":{...}|null}],
       "identity":{"status":"match","colaborador_id":12,"confidence":87.5,"face_index":0,...}|null,
       "ms":24}
    Errores: {"type":"error","v":1,"message":"..."}
    Códigos de cierre: 4401 no autorizado, 4403 origen no permitido, 4408 inactividad, 4429 sin cupo.
    """
    global _ws_active

    if not _origin_allowed(ws.headers.get("origin")):
        await ws.close(code=4403)
        return
    if not _valid_key(token):
        await ws.close(code=4401)
        return
    if _ws_active >= MAX_WS:                   # sin await entre comprobar e incrementar: sin carrera
        await ws.close(code=4429)
        return

    _ws_active += 1
    try:
        await ws.accept()
        await _frame_loop(ws)
    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        _ws_active -= 1


async def _frame_loop(ws: WebSocket) -> None:
    counter = 0
    while True:
        try:
            data = await asyncio.wait_for(ws.receive_bytes(), timeout=WS_IDLE)
        except asyncio.TimeoutError:
            await ws.close(code=4408)
            return
        except KeyError:                       # llegó un mensaje de texto en vez de binario
            await ws.send_json({"type": "error", "v": 1, "message": "Se esperaba un fotograma binario"})
            continue

        if len(data) > MAX_FRAME:
            await ws.send_json({"type": "error", "v": 1, "message": "Fotograma demasiado grande"})
            continue

        try:
            img = await run(decode_image, data)
            if img is None:
                await ws.send_json({"type": "error", "v": 1, "message": "Fotograma inválido"})
                continue
            counter += 1
            identify = (counter % IDENTIFY_EVERY == 0)
            await ws.send_json(await run(engine.analyze_frame, img, identify))
        except (WebSocketDisconnect, RuntimeError):
            raise
        except Exception as e:
            log(f"[Error] ws: {e}")
            await ws.send_json({"type": "error", "v": 1, "message": "Error procesando el fotograma"})