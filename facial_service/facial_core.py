"""
facial_core.py - Lógica compartida de reconocimiento facial (ADENAR SG-SST).

Motor: OpenCV YuNet (detección + 5 puntos) + SFace (embedding de 128 dimensiones)
       + MiniFASNet (liveness PASIVO anti-foto / anti-pantalla).
- Sin TensorFlow: arranque en ~1 s e inferencia en CPU de pocos milisegundos.
- Detección sobre imagen reducida; alineación y embedding sobre la imagen original.
- Liveness pasivo: se evalúa en el mismo fotograma, sin pedir nada a la persona.
  Si el rostro no es "real", NO se calcula el embedding ni se identifica.
- Galería en memoria (matriz NumPy) para identificar en tiempo real.
- Caché en disco de embeddings de los colaboradores (se invalida por mtime).

Motor central utilizado por la API FastAPI (main.py).

Modelos de liveness (deben estar en MODELS_DIR, exportados a ONNX 1x3x80x80):
    minifasnet_v2_2.7_80x80.onnx     (MiniFASNetV2,   recorte escala 2.7)
    minifasnet_v1se_4.0_80x80.onnx   (MiniFASNetV1SE, recorte escala 4.0)
Si FACIAL_LIVENESS=1 (por defecto) y faltan, el motor NO arranca (falla cerrado).
"""

import os
import sys

# Deben definirse ANTES de importar cv2 (el límite de píxeles se lee al importar).
os.environ.setdefault("PYTHONUTF8", "1")
os.environ.setdefault("PYTHONIOENCODING", "utf-8")
os.environ.setdefault("OPENCV_IO_MAX_IMAGE_PIXELS", str(64_000_000))  # evita "decompression bombs"

import hashlib
import json
import shutil
import threading
import time
import urllib.request
import uuid
from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np

if sys.platform == "win32":
    for _s in (sys.stdout, sys.stderr):
        if hasattr(_s, "reconfigure"):
            _s.reconfigure(encoding="utf-8", errors="replace")


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, default))
    except ValueError:
        return default


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except ValueError:
        return default


# --------------------------------------------------------------- configuración
BASE_DIR = os.path.realpath(os.path.join(os.path.dirname(__file__), ".."))

# Solo se leen imágenes de colaboradores dentro de esta carpeta
ALLOWED_DIR = os.path.realpath(
    os.environ.get("FACIAL_ALLOWED_DIR", os.path.join(BASE_DIR, "storage", "app", "public"))
)

DEFAULT_CACHE_FILE = os.environ.get(
    "FACIAL_CACHE_FILE", os.path.join(BASE_DIR, "storage", "app", "facial_cache.json")
)

MODELS_DIR = os.environ.get(
    "FACIAL_MODELS_DIR", os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")
)
DET_MODEL = "face_detection_yunet_2023mar.onnx"
REC_MODEL = "face_recognition_sface_2021dec.onnx"
MODEL_URLS = {
    DET_MODEL: "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/" + DET_MODEL,
    REC_MODEL: "https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/" + REC_MODEL,
    "minifasnet_v2_2.7_80x80.onnx": "https://github.com/QingHeYang/Silent-Face-Anti-Spoofing-onnx/raw/main/onnx/2.7_80x80_MiniFASNetV2.onnx",
    "minifasnet_v1se_4.0_80x80.onnx": "https://github.com/QingHeYang/Silent-Face-Anti-Spoofing-onnx/raw/main/onnx/4_0_0_80x80_MiniFASNetV1SE.onnx",
}
DOWNLOAD_TIMEOUT = 30  # segundos
# Cambia si cambias el modelo: invalida el caché automáticamente
MODEL_TAG = "sface_2021dec"

# Detección
DET_SCORE = _env_float("FACIAL_DET_SCORE", 0.80)       # confianza mínima del detector
DET_MAX_SIDE = _env_int("FACIAL_DET_MAX_SIDE", 480)    # lado mayor al que se reduce para detectar
MIN_FACE = _env_int("FACIAL_MIN_FACE", 60)             # ancho mínimo del rostro (px, imagen original)
MAX_FACES = _env_int("FACIAL_MAX_FACES", 5)            # rostros que se identifican por fotograma (acota CPU)

# Similitud COSENO (1 = idéntico). El valor de referencia de SFace es 0.363. CALIBRAR con fotos reales.
STRICT_SIM = _env_float("FACIAL_STRICT", 0.45)         # >= : coincidencia confiable
UNCERTAIN_SIM = _env_float("FACIAL_UNCERTAIN", 0.363)  # >= : incierto (confirmar); < : no identificado
AMBIGUITY_MARGIN = _env_float("FACIAL_MARGIN", 0.05)   # si el 2.º candidato está a menos de esto, confirmar
CONFIDENCE_TOP = 0.75                                  # similitud que se muestra como 100 %

# Liveness pasivo (anti-foto / anti-pantalla). CALIBRAR con tus cámaras y tu iluminación.
LIVE_MODELS = [
    ("minifasnet_v2_2.7_80x80.onnx", 2.7),
    ("minifasnet_v1se_4.0_80x80.onnx", 4.0),
]
LIVE_ENABLED = os.environ.get("FACIAL_LIVENESS", "1") != "0"
LIVE_REAL = _env_float("FACIAL_LIVE_REAL", 0.70)       # >= : persona real
LIVE_FAKE = _env_float("FACIAL_LIVE_FAKE", 0.35)       # <  : foto/pantalla; entre ambos: dudoso
LIVE_MIN_FACE = _env_int("FACIAL_LIVE_MIN_FACE", 70)   # ancho mínimo (px) para poder evaluar liveness


def log(msg: str) -> None:
    """Los logs van a stderr para no contaminar el JSON de stdout del CLI."""
    print(msg, file=sys.stderr, flush=True)


# ------------------------------------------------------------------- utilidades
def read_image(path: str) -> Optional[np.ndarray]:
    """Lee una imagen (soporta rutas con tildes en Windows). Devuelve BGR o None."""
    try:
        data = np.fromfile(path, dtype=np.uint8)
        if data.size == 0:
            return None
        return cv2.imdecode(data, cv2.IMREAD_COLOR)
    except Exception as e:
        log(f"[Aviso] No se pudo leer {path}: {e}")
        return None


def decode_image(data: bytes) -> Optional[np.ndarray]:
    arr = np.frombuffer(data, dtype=np.uint8)
    if arr.size == 0:
        return None
    try:
        return cv2.imdecode(arr, cv2.IMREAD_COLOR)
    except cv2.error as e:
        log(f"[Aviso] Imagen no decodificable: {e}")
        return None


def path_allowed(path: str) -> bool:
    try:
        real = os.path.realpath(path)
        return os.path.commonpath([real, ALLOWED_DIR]) == ALLOWED_DIR
    except ValueError:
        return False


def _ensure_model(name: str) -> str:
    path = os.path.join(MODELS_DIR, name)
    if os.path.isfile(path) and os.path.getsize(path) > 0:
        return path
    os.makedirs(MODELS_DIR, exist_ok=True)
    tmp = f"{path}.{uuid.uuid4().hex}.part"
    log(f"[Info] Descargando modelo {name} ...")
    try:
        with urllib.request.urlopen(MODEL_URLS[name], timeout=DOWNLOAD_TIMEOUT) as resp, open(tmp, "wb") as out:
            shutil.copyfileobj(resp, out)
        os.replace(tmp, path)
    except Exception as e:
        if os.path.exists(tmp):
            os.remove(tmp)
        raise RuntimeError(
            f"No se pudo descargar {name}: {e}. Descárgalo manualmente de "
            f"{MODEL_URLS[name]} y guárdalo en {MODELS_DIR}"
        ) from e
    return path


def _normalize(v: np.ndarray) -> np.ndarray:
    v = v.astype(np.float32).flatten()
    return v / max(float(np.linalg.norm(v)), 1e-9)


def decide(ids: list, matrix: np.ndarray, emb: np.ndarray) -> dict:
    """Compara un embedding normalizado contra la matriz normalizada (N, 128)."""
    sims = matrix @ emb
    order = np.argsort(-sims)
    best = int(order[0])
    best_sim = float(sims[best])
    second_sim = float(sims[order[1]]) if len(order) > 1 else None

    if best_sim < UNCERTAIN_SIM:
        return {"status": "no_match", "match": False, "similarity": round(best_sim, 4),
                "distance": round(1.0 - best_sim, 4),
                "message": "Persona no identificada entre los colaboradores registrados."}

    confidence = round(max(0.0, min(100.0, (best_sim - UNCERTAIN_SIM)
                                    / (CONFIDENCE_TOP - UNCERTAIN_SIM) * 100)), 1)
    ambiguous = second_sim is not None and (best_sim - second_sim) < AMBIGUITY_MARGIN

    if best_sim >= STRICT_SIM and not ambiguous:
        status, message = "match", f"Coincidencia confiable ({confidence}% de confianza)."
    elif ambiguous:
        status, message = "uncertain", "Hay más de un candidato muy parecido. Confirma la identidad manualmente."
    else:
        status, message = "uncertain", f"Resultado incierto ({confidence}% de confianza). Confirma la identidad."

    return {"status": status, "match": status == "match", "confidence": confidence,
            "similarity": round(best_sim, 4), "distance": round(1.0 - best_sim, 4),
            "colaborador_id": ids[best], "message": message}


# --------------------------------------------------------------------- liveness
def _crop_scaled(img: np.ndarray, box, scale: float, out: int = 80) -> Optional[np.ndarray]:
    """Recorte centrado en el rostro con margen (mismo criterio que Silent-Face-Anti-Spoofing)."""
    H, W = img.shape[:2]
    x, y, bw, bh = [float(v) for v in box]
    if bw <= 1 or bh <= 1 or H < 2 or W < 2:
        return None
    scale = min((H - 1) / bh, (W - 1) / bw, scale)
    nw, nh = bw * scale, bh * scale
    cx, cy = x + bw / 2.0, y + bh / 2.0
    l, t, r, b = cx - nw / 2.0, cy - nh / 2.0, cx + nw / 2.0, cy + nh / 2.0
    if l < 0:
        r -= l
        l = 0.0
    if t < 0:
        b -= t
        t = 0.0
    if r > W - 1:
        l -= r - (W - 1)
        r = float(W - 1)
    if b > H - 1:
        t -= b - (H - 1)
        b = float(H - 1)
    l, t = max(l, 0.0), max(t, 0.0)
    crop = img[int(t):int(b) + 1, int(l):int(r) + 1]
    if crop.size == 0:
        return None
    return cv2.resize(crop, (out, out))


class PassiveLiveness:
    """Anti-spoofing pasivo con MiniFASNet (ONNX vía cv2.dnn). Un conjunto de redes por hilo."""

    def __init__(self, models_dir: str = MODELS_DIR):
        self._local = threading.local()
        self._specs: List[Tuple[str, float]] = []
        for name, scale in LIVE_MODELS:
            path = _ensure_model(name)
            self._specs.append((path, scale))

    def _nets(self):
        loc = self._local
        if not hasattr(loc, "nets"):
            loc.nets = [(cv2.dnn.readNetFromONNX(p), s) for p, s in self._specs]
        return loc.nets

    def score(self, img: np.ndarray, face_row: np.ndarray) -> Optional[float]:
        """Probabilidad de rostro REAL (0-1): promedio de los modelos. None si no se pudo evaluar."""
        probs = []
        for net, scale in self._nets():
            crop = _crop_scaled(img, face_row[:4], scale)
            if crop is None:
                return None
            # El modelo original usa BGR en 0-255, SIN dividir entre 255
            blob = cv2.dnn.blobFromImage(crop, 1.0, (80, 80), (0, 0, 0), swapRB=False)
            net.setInput(blob)
            logits = net.forward().flatten().astype(np.float64)
            e = np.exp(logits - logits.max())
            probs.append(float((e / e.sum())[1]))   # índice 1 = real
        return sum(probs) / len(probs) if probs else None

    def check(self, img: np.ndarray, face_row: np.ndarray) -> dict:
        if float(face_row[2]) < LIVE_MIN_FACE:
            return {"live": False, "status": "too_small", "score": 0.0,
                    "message": "Acércate a la cámara."}
        s = self.score(img, face_row)
        if s is None:
            return {"live": False, "status": "liveness_uncertain", "score": 0.0,
                    "message": "No se pudo evaluar el rostro. Intenta de nuevo."}
        if s >= LIVE_REAL:
            return {"live": True, "status": "live", "score": round(s, 3)}
        if s < LIVE_FAKE:
            return {"live": False, "status": "spoof", "score": round(s, 3),
                    "message": "Posible fotografía o pantalla. Acceso rechazado."}
        return {"live": False, "status": "liveness_uncertain", "score": round(s, 3),
                "message": "No se pudo verificar que sea una persona real. Intenta de nuevo."}


# ------------------------------------------------------------------------ motor
class FaceEngine:
    def __init__(self, cache_file: str = DEFAULT_CACHE_FILE):
        self.cache_file = cache_file
        self.model = MODEL_TAG
        self.detector = "yunet"
        self._local = threading.local()          # un detector/reconocedor por hilo
        self._cache_lock = threading.Lock()
        self.cache: Dict[str, dict] = {}
        self._cache_mtime = 0.0
        self._dirty = False                      # solo se toca con _cache_lock tomado
        self._det_path = _ensure_model(DET_MODEL)
        self._rec_path = _ensure_model(REC_MODEL)
        self.liveness: Optional[PassiveLiveness] = PassiveLiveness() if LIVE_ENABLED else None
        if not LIVE_ENABLED:
            log("[ALERTA] Liveness DESACTIVADO: el sistema aceptará fotografías.")
        # Galería en memoria: (ids, matriz) se reemplaza de forma atómica
        self._gallery: Tuple[list, Optional[np.ndarray], Dict[str, dict]] = ([], None, {})
        self._load_cache()

    # ------------------------------------------------------------------ caché
    def _load_cache(self) -> None:
        try:
            if os.path.exists(self.cache_file):
                mtime = os.path.getmtime(self.cache_file)
                with open(self.cache_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                self.cache = data if isinstance(data, dict) else {}
                self._cache_mtime = mtime
        except Exception as e:
            log(f"[Aviso] No se pudo leer el caché: {e}")
            self.cache = {}

    def _save_cache(self) -> None:
        tmp = f"{self.cache_file}.{uuid.uuid4().hex}.tmp"
        try:
            os.makedirs(os.path.dirname(os.path.abspath(self.cache_file)), exist_ok=True)
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(self.cache, f, separators=(",", ":"))
            os.replace(tmp, self.cache_file)
            self._cache_mtime = os.path.getmtime(self.cache_file)
        except Exception as e:
            log(f"[Aviso] No se pudo guardar el caché: {e}")
            if os.path.exists(tmp):
                os.remove(tmp)

    # ---------------------------------------------------------------- modelos
    def _models(self):
        loc = self._local
        if not hasattr(loc, "det"):
            loc.det = cv2.FaceDetectorYN.create(self._det_path, "", (320, 320), DET_SCORE, 0.3, 5000)
            loc.rec = cv2.FaceRecognizerSF.create(self._rec_path, "")
        return loc.det, loc.rec

    def detect(self, img: np.ndarray) -> np.ndarray:
        """Rostros (n, 15) en coordenadas de la imagen original, el más grande primero."""
        det, _ = self._models()
        h, w = img.shape[:2]
        scale = min(1.0, DET_MAX_SIDE / max(h, w))
        small = img if scale >= 1.0 else cv2.resize(
            img, (max(1, int(w * scale)), max(1, int(h * scale))), interpolation=cv2.INTER_AREA)
        sh, sw = small.shape[:2]
        det.setInputSize((sw, sh))
        _, faces = det.detect(small)
        if faces is None or len(faces) == 0:
            return np.empty((0, 15), dtype=np.float32)
        faces = faces.copy()
        faces[:, :14] /= scale                      # volver a coordenadas originales
        faces = faces[faces[:, 2] >= MIN_FACE]
        if len(faces) == 0:
            return faces
        return faces[np.argsort(-(faces[:, 2] * faces[:, 3]))]

    def embed(self, img: np.ndarray, face_row: np.ndarray) -> np.ndarray:
        _, rec = self._models()
        aligned = rec.alignCrop(img, face_row)
        return _normalize(rec.feature(aligned))

    def embedding_largest(self, img: np.ndarray) -> Optional[np.ndarray]:
        """Embedding del rostro más grande. SIN liveness: se usa también para fotos de registro."""
        faces = self.detect(img)
        if len(faces) == 0:
            return None
        return self.embed(img, faces[0])

    # ---------------------------------------------------------------- galería
    def _candidate_embedding_from_path(self, path: str) -> Optional[np.ndarray]:
        """Embedding desde archivo en disco, con caché por mtime.
        Requiere _cache_lock tomado (modifica self.cache y self._dirty)."""
        real = os.path.realpath(path)
        mtime = os.path.getmtime(real)
        cached = self.cache.get(real)
        if cached and cached.get("mtime") == mtime and cached.get("model") == MODEL_TAG:
            return np.asarray(cached["embedding"], dtype=np.float32)

        img = read_image(real)
        if img is None:
            return None
        emb = self.embedding_largest(img)
        if emb is not None:
            self.cache[real] = {"mtime": mtime, "embedding": np.round(emb, 6).tolist(), "model": MODEL_TAG}
            self._dirty = True
        return emb

    def _candidate_embedding_from_bytes(self, data: bytes, cache_key: str) -> Optional[np.ndarray]:
        """Embedding desde bytes crudos recibidos en memoria, con caché por SHA-256.
        Requiere _cache_lock tomado (modifica self.cache y self._dirty)."""
        cached = self.cache.get(cache_key)
        if cached and cached.get("model") == MODEL_TAG:
            return np.asarray(cached["embedding"], dtype=np.float32)

        img = decode_image(data)
        if img is None:
            return None
        emb = self.embedding_largest(img)
        if emb is not None:
            self.cache[cache_key] = {"sha256": cache_key, "embedding": np.round(emb, 6).tolist(), "model": MODEL_TAG}
            self._dirty = True
        return emb

    def _build(self, candidates: List[dict], prune: bool = False) -> Tuple[list, Optional[np.ndarray], int]:
        """Construye (ids, matriz) desde candidatos que pueden traer 'image_bytes' (bytes crudos)
        o 'image_path' (ruta en disco). Devuelve también cuántas fotos fallaron."""
        ids, vectors, failed = [], [], 0
        with self._cache_lock:
            self._dirty = False
            if os.path.exists(self.cache_file) and os.path.getmtime(self.cache_file) != self._cache_mtime:
                self._load_cache()                  # otro proceso (CLI/API) lo actualizó
            used = set()
            for cand in candidates:
                if not isinstance(cand, dict):
                    failed += 1
                    continue

                image_bytes: Optional[bytes] = cand.get("image_bytes")
                path: Optional[str] = cand.get("image_path")

                try:
                    if image_bytes:
                        # ── Nuevo camino: bytes recibidos directamente desde Laravel ──
                        sha = hashlib.sha256(image_bytes).hexdigest()
                        cache_key = f"sha256:{sha}"
                        emb = self._candidate_embedding_from_bytes(image_bytes, cache_key)
                        used.add(cache_key)
                    elif path and os.path.isfile(path) and path_allowed(path):
                        # ── Camino legacy: ruta en disco (mismo servidor) ──────────
                        emb = self._candidate_embedding_from_path(path)
                        used.add(os.path.realpath(path))
                    else:
                        log(f"[Aviso] Candidato {cand.get('id')} sin imagen válida (ni bytes ni ruta accesible)")
                        failed += 1
                        continue
                except Exception as e:
                    log(f"[Aviso] Falló embedding del candidato {cand.get('id')}: {e}")
                    emb = None

                if emb is None:
                    failed += 1
                    continue
                ids.append(cand.get("id"))
                vectors.append(emb)

            if prune:
                # Solo eliminar entradas de ruta (no de sha256) que ya no están en uso
                for key in [k for k in self.cache if not k.startswith("sha256:") and k not in used]:
                    del self.cache[key]
                    self._dirty = True
            if self._dirty:
                self._save_cache()
        matrix = np.vstack(vectors).astype(np.float32) if vectors else None
        return ids, matrix, failed

    def load_gallery(self, candidates: List[dict]) -> dict:
        """Carga la lista de colaboradores en memoria para identificar en tiempo real."""
        start = time.time()
        ids, matrix, failed = self._build(candidates, prune=True)
        valid_ids = {str(cid) for cid in ids}
        names = {
            str(candidate["id"]): {
                "nombres": candidate.get("nombres"),
                "apellidos": candidate.get("apellidos"),
            }
            for candidate in candidates
            if isinstance(candidate, dict)
            and candidate.get("id") is not None
            and str(candidate["id"]) in valid_ids
        }
        self._gallery = (ids, matrix, names)         # reemplazo atómico
        return {"success": True, "loaded": len(ids), "failed": failed,
                "elapsed_seconds": round(time.time() - start, 2)}

    @property
    def gallery_size(self) -> int:
        return len(self._gallery[0])

    # ------------------------------------------------------------ tiempo real
    def analyze_frame(self, img: np.ndarray, identify: bool = True) -> dict:
        """Detecta rostros en un fotograma, verifica liveness e identifica cada uno contra la galería.

        Orden por rostro: liveness -> (solo si es real) embedding + decide.
        `identity` (nivel superior) es la mejor coincidencia confiable Y viva; si no hay ninguna,
        la del rostro principal. Incluye `face_index` para asociarla a su recuadro en `faces`.
        El cliente/servidor solo debe registrar asistencia con status == "match" y live == True.
        """
        start = time.time()
        h, w = img.shape[:2]
        faces = self.detect(img)[:MAX_FACES]
        ids, matrix, names = self._gallery
        can_identify = identify and matrix is not None and len(ids) > 0

        out_faces = []
        best_idx: Optional[int] = None
        best_conf = -1.0

        for i, f in enumerate(faces):
            identity = None
            live = None
            if can_identify:
                try:
                    if self.liveness is not None:
                        live = self.liveness.check(img, f)
                    else:
                        live = {"live": True, "status": "live", "score": None}

                    if live["live"]:
                        identity = decide(ids, matrix, self.embed(img, f))
                        identity["live"] = True
                        identity["liveness_score"] = live["score"]
                        collaborator_name = names.get(str(identity.get("colaborador_id")))
                        if collaborator_name:
                            identity.update(collaborator_name)
                    else:
                        identity = {"status": live["status"], "match": False, "live": False,
                                    "liveness_score": live["score"], "message": live.get("message")}
                except Exception as e:              # un rostro defectuoso no tumba el fotograma
                    log(f"[Aviso] Falló el rostro {i}: {e}")
                    identity = None

                if identity and identity.get("status") == "match" and identity.get("confidence", 0) > best_conf:
                    best_idx, best_conf = i, identity["confidence"]

            out_faces.append({
                "box": [int(f[0]), int(f[1]), int(f[2]), int(f[3])],
                "score": round(float(f[14]), 3),
                "liveness": live["score"] if live else None,
                "identity": identity,
            })

        if best_idx is None and out_faces and out_faces[0]["identity"]:
            best_idx = 0                            # sin coincidencia confiable: rostro principal
        top = {**out_faces[best_idx]["identity"], "face_index": best_idx} if best_idx is not None else None

        return {
            "type": "faces",
            "v": 1,
            "w": w,
            "h": h,
            "faces": out_faces,
            "identity": top,
            "ms": int((time.time() - start) * 1000),
        }

    # --------------------------------------------------------------- comparar
    def comparar(self, target_img: Optional[np.ndarray], candidates: Optional[List[dict]] = None) -> dict:
        """Foto única contra una lista de candidatos (o contra la galería en memoria si no se pasa lista).

        Con liveness activo, una fotografía de una foto/pantalla es rechazada antes de identificar.
        """
        start = time.time()

        def elapsed() -> float:
            return round(time.time() - start, 2)

        if target_img is None:
            return {"success": False, "status": "error", "target_face_detected": False,
                    "message": "No se pudo leer la fotografía enviada."}

        faces = self.detect(target_img)
        if len(faces) == 0:
            return {"success": False, "status": "no_face", "target_face_detected": False,
                    "message": "No se detectó ningún rostro en la fotografía. "
                               "Colócate de frente y con buena iluminación.",
                    "elapsed_seconds": elapsed()}
        face = faces[0]

        if self.liveness is not None:
            lv = self.liveness.check(target_img, face)
            if not lv["live"]:
                return {"success": False, "status": lv["status"], "match": False, "live": False,
                        "liveness_score": lv["score"], "target_face_detected": True,
                        "message": lv.get("message"), "elapsed_seconds": elapsed()}
            live_score = lv["score"]
        else:
            live_score = None

        target_emb = self.embed(target_img, face)

        if candidates:
            ids, matrix, _ = self._build(candidates)
        else:
            ids, matrix, _ = self._gallery

        if matrix is None or not ids:
            return {"success": False, "status": "sin_candidatos", "target_face_detected": True,
                    "message": "No hay fotografías de colaboradores procesables para comparar.",
                    "elapsed_seconds": elapsed()}

        result = decide(ids, matrix, target_emb)
        result.update({"success": True, "target_face_detected": True, "live": True,
                       "liveness_score": live_score, "threshold": STRICT_SIM,
                       "elapsed_seconds": elapsed()})
        return result