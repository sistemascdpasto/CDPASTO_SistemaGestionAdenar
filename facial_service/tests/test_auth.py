import asyncio
import base64
import hashlib
import hmac
import json
import time

import pytest
from fastapi import HTTPException

from facial_service import main as api


SECRET = "clave_de_prueba_segura_de_32_caracteres"


def create_token(payload=None, secret=SECRET):
    now = int(time.time())

    claims = payload or {
        "aud": "adenar-facial-service",
        "scope": "facial:stream",
        "iat": now,
        "exp": now + 120,
        "jti": "test-token",
    }

    encoded_payload = base64.urlsafe_b64encode(
        json.dumps(claims).encode("utf-8")
    ).rstrip(b"=").decode("ascii")

    signature = hmac.new(
        secret.encode("utf-8"),
        encoded_payload.encode("ascii"),
        hashlib.sha256,
    ).digest()

    encoded_signature = base64.urlsafe_b64encode(
        signature
    ).rstrip(b"=").decode("ascii")

    return f"{encoded_payload}.{encoded_signature}"


def test_master_key_fails_closed_when_missing(monkeypatch):
    monkeypatch.setattr(api, "API_KEY", "")

    assert api._valid_key(None) is False
    assert api._valid_key("cualquier-clave") is False


def test_master_key_accepts_only_correct_key(monkeypatch):
    monkeypatch.setattr(api, "API_KEY", "clave-maestra-de-prueba")

    assert api._valid_key("clave-maestra-de-prueba") is True
    assert api._valid_key("clave-incorrecta") is False
    assert api._valid_key(None) is False


def test_valid_temporary_token_is_accepted(monkeypatch):
    monkeypatch.setattr(api, "TOKEN_SECRET", SECRET)

    token = create_token()

    assert api._valid_stream_token(token) is True


def test_temporary_token_is_rejected_without_secret(monkeypatch):
    monkeypatch.setattr(api, "TOKEN_SECRET", "")

    assert api._valid_stream_token(create_token()) is False


def test_temporary_token_is_rejected_with_short_secret(monkeypatch):
    monkeypatch.setattr(api, "TOKEN_SECRET", "secreto-corto")

    assert api._valid_stream_token(create_token()) is False


def test_expired_token_is_rejected(monkeypatch):
    monkeypatch.setattr(api, "TOKEN_SECRET", SECRET)

    now = int(time.time())
    token = create_token({
        "aud": "adenar-facial-service",
        "scope": "facial:stream",
        "iat": now - 120,
        "exp": now - 1,
    })

    assert api._valid_stream_token(token) is False


def test_wrong_audience_is_rejected(monkeypatch):
    monkeypatch.setattr(api, "TOKEN_SECRET", SECRET)

    token = create_token({"aud": "otro-servicio", "scope": "facial:stream",
                          "iat": int(time.time()), "exp": int(time.time()) + 120})

    assert api._valid_stream_token(token) is False


def test_wrong_scope_is_rejected(monkeypatch):
    monkeypatch.setattr(api, "TOKEN_SECRET", SECRET)

    now = int(time.time())
    token = create_token({
        "aud": "adenar-facial-service",
        "scope": "otro-permiso",
        "iat": now,
        "exp": now + 120,
    })

    assert api._valid_stream_token(token) is False


def test_modified_signature_is_rejected(monkeypatch):
    monkeypatch.setattr(api, "TOKEN_SECRET", SECRET)

    token = create_token()
    modified = token[:-1] + ("A" if token[-1] != "A" else "B")

    assert api._valid_stream_token(modified) is False


def test_malformed_token_is_rejected(monkeypatch):
    monkeypatch.setattr(api, "TOKEN_SECRET", SECRET)

    assert api._valid_stream_token("no-es-un-token") is False
    assert api._valid_stream_token(None) is False


def test_bearer_header_accepts_valid_token(monkeypatch):
    monkeypatch.setattr(api, "TOKEN_SECRET", SECRET)

    token = create_token()

    asyncio.run(api.require_stream_token(f"Bearer {token}"))


def test_bearer_header_rejects_invalid_token(monkeypatch):
    monkeypatch.setattr(api, "TOKEN_SECRET", SECRET)

    with pytest.raises(HTTPException) as error:
        asyncio.run(api.require_stream_token("Bearer token-invalido"))

    assert error.value.status_code == 401


def test_bearer_header_rejects_missing_scheme():
    with pytest.raises(HTTPException) as error:
        asyncio.run(api.require_stream_token("token-sin-bearer"))

    assert error.value.status_code == 401

from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect


def test_frame_endpoint_rejects_request_without_token(monkeypatch):
    monkeypatch.setattr(api, "TOKEN_SECRET", SECRET)

    with TestClient(api.app) as client:
        response = client.post("/frame")

    assert response.status_code == 401


def test_gallery_endpoint_rejects_request_without_master_key(monkeypatch):
    monkeypatch.setattr(api, "API_KEY", "")

    with TestClient(api.app) as client:
        response = client.post("/galeria/sincronizar", json={})

    assert response.status_code == 401


def test_websocket_rejects_invalid_token(monkeypatch):
    monkeypatch.setattr(api, "TOKEN_SECRET", SECRET)

    with TestClient(api.app) as client:
        with pytest.raises(WebSocketDisconnect) as error:
            with client.websocket_connect("/ws/reconocer?token=invalido"):
                pass

    assert error.value.code == 4401
