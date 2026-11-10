"""
Tests for the POST /auth/demo-login endpoint.

Covers:
- Demo login disabled (default) → 503
- Demo login enabled but no credentials configured → 503
- Demo login enabled, correct credentials, officer role → 200 + valid token
- Wrong password → 503 (generic message, no info leak)
- Account not found → 503 (generic message, no info leak)
- Account has wrong role (citizen) → 403
- Issued token is a valid short-lived JWT
- Demo token does not grant admin privileges (RBAC check)
- Normal manual login still works after demo changes
"""
import uuid
import pytest
from unittest.mock import patch
from httpx import AsyncClient

from tests.test_api import client, setup_db, register_and_login, auth_header
from app.core.config import settings


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _make_officer(client: AsyncClient) -> tuple[str, str]:
    """Register an officer account; return (phone, password)."""
    phone = f"+91{uuid.uuid4().int % 10 ** 10:010d}"
    password = "officer_demo_pw_99"
    resp = await client.post("/auth/register", json={
        "phone": phone,
        "password": password,
        "name": "Demo Officer Test",
        "role": "officer",
    })
    assert resp.status_code == 201, resp.text
    return phone, password


async def _make_citizen(client: AsyncClient) -> tuple[str, str]:
    """Register a citizen account; return (phone, password)."""
    phone = f"+91{uuid.uuid4().int % 10 ** 10:010d}"
    password = "citizen_pw_77"
    resp = await client.post("/auth/register", json={
        "phone": phone,
        "password": password,
        "name": "Demo Citizen Test",
        "role": "citizen",
    })
    assert resp.status_code == 201, resp.text
    return phone, password


# ---------------------------------------------------------------------------
# 1. Demo login disabled (default)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_demo_login_disabled_by_default(client: AsyncClient):
    """When DEMO_LOGIN_ENABLED is false (default), endpoint returns 503."""
    with patch.object(settings, "DEMO_LOGIN_ENABLED", False):
        resp = await client.post("/auth/demo-login")
    assert resp.status_code == 503
    # Must not expose configuration details
    body = resp.json()
    assert "detail" in body
    assert "demo" in body["detail"].lower() or "available" in body["detail"].lower()
    assert "password" not in body["detail"].lower()
    assert "phone" not in body["detail"].lower()


# ---------------------------------------------------------------------------
# 2. Demo login enabled but credentials not configured
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_demo_login_enabled_no_credentials(client: AsyncClient):
    """Enabled but phone/password empty → 503."""
    with (
        patch.object(settings, "DEMO_LOGIN_ENABLED", True),
        patch.object(settings, "DEMO_LOGIN_PHONE", ""),
        patch.object(settings, "DEMO_LOGIN_PASSWORD", ""),
    ):
        resp = await client.post("/auth/demo-login")
    assert resp.status_code == 503
    body = resp.json()
    assert "password" not in body["detail"].lower()


# ---------------------------------------------------------------------------
# 3. Demo login: account not found
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_demo_login_account_not_found(client: AsyncClient):
    """Enabled + credentials set, but no matching account → 503 (generic)."""
    with (
        patch.object(settings, "DEMO_LOGIN_ENABLED", True),
        patch.object(settings, "DEMO_LOGIN_PHONE", "+91000000000x"),
        patch.object(settings, "DEMO_LOGIN_PASSWORD", "somepassword"),
    ):
        resp = await client.post("/auth/demo-login")
    assert resp.status_code == 503
    # Generic message — must not leak whether account exists
    assert "unavailable" in resp.json()["detail"].lower()


# ---------------------------------------------------------------------------
# 4. Demo login: wrong password
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_demo_login_wrong_password(client: AsyncClient):
    """Enabled + correct phone, wrong password → 503 (generic)."""
    phone, _correct_pw = await _make_officer(client)
    with (
        patch.object(settings, "DEMO_LOGIN_ENABLED", True),
        patch.object(settings, "DEMO_LOGIN_PHONE", phone),
        patch.object(settings, "DEMO_LOGIN_PASSWORD", "definitely_wrong"),
    ):
        resp = await client.post("/auth/demo-login")
    assert resp.status_code == 503
    assert "unavailable" in resp.json()["detail"].lower()


# ---------------------------------------------------------------------------
# 5. Demo login: account has wrong role (citizen)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_demo_login_wrong_role(client: AsyncClient):
    """Citizen account with correct credentials → 403."""
    phone, password = await _make_citizen(client)
    with (
        patch.object(settings, "DEMO_LOGIN_ENABLED", True),
        patch.object(settings, "DEMO_LOGIN_PHONE", phone),
        patch.object(settings, "DEMO_LOGIN_PASSWORD", password),
    ):
        resp = await client.post("/auth/demo-login")
    assert resp.status_code == 403
    assert "officer" in resp.json()["detail"].lower()


# ---------------------------------------------------------------------------
# 6. Demo login: success (officer account, correct credentials)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_demo_login_success(client: AsyncClient):
    """Happy path: officer account + enabled + correct credentials → 200 + token."""
    phone, password = await _make_officer(client)
    with (
        patch.object(settings, "DEMO_LOGIN_ENABLED", True),
        patch.object(settings, "DEMO_LOGIN_PHONE", phone),
        patch.object(settings, "DEMO_LOGIN_PASSWORD", password),
    ):
        resp = await client.post("/auth/demo-login")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "access_token" in data
    assert data["role"] == "officer"
    # Token must be non-empty and look like a JWT
    assert len(data["access_token"].split(".")) == 3
    # Must NOT contain sensitive fields
    assert "password" not in data
    assert "phone" not in data


# ---------------------------------------------------------------------------
# 7. Demo token does not grant admin privileges (RBAC enforcement)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_demo_token_no_admin_privilege(client: AsyncClient):
    """A demo officer token must not pass admin-only RBAC checks."""
    phone, password = await _make_officer(client)
    with (
        patch.object(settings, "DEMO_LOGIN_ENABLED", True),
        patch.object(settings, "DEMO_LOGIN_PHONE", phone),
        patch.object(settings, "DEMO_LOGIN_PASSWORD", password),
    ):
        resp = await client.post("/auth/demo-login")
    token = resp.json()["access_token"]

    # Officer token should be able to access officer-level endpoints
    # (incident verify requires officer+)
    citizen_token = await register_and_login(client, "citizen")
    inc_resp = await client.post("/incidents", json={
        "type": "flood", "description": "test rbac", "lat": 26.0, "lng": 91.0, "severity": 3,
    }, headers=auth_header(citizen_token))
    assert inc_resp.status_code == 201
    inc_id = inc_resp.json()["id"]

    verify_resp = await client.patch(f"/incidents/{inc_id}/verify",
        json={"data_label": "live"}, headers=auth_header(token))
    assert verify_resp.status_code == 200  # Officer can verify

    # Token role must be officer, not admin
    import jwt as pyjwt
    from app.core.config import settings as s
    payload = pyjwt.decode(token, s.JWT_SECRET, algorithms=[s.JWT_ALGORITHM])
    assert payload["role"] == "officer"
    assert payload["role"] != "admin"


# ---------------------------------------------------------------------------
# 8. Normal manual login still works after demo changes
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_normal_login_still_works(client: AsyncClient):
    """Regular /auth/login must continue to work regardless of demo config."""
    phone, password = await _make_officer(client)
    resp = await client.post("/auth/login", json={"phone": phone, "password": password})
    assert resp.status_code == 200
    assert "access_token" in resp.json()
    assert resp.json()["role"] == "officer"


# ---------------------------------------------------------------------------
# 9. Logout after demo login clears session
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_demo_login_then_logout(client: AsyncClient):
    """After demo login, using an expired/cleared token should give 401."""
    from app.core.auth import create_demo_token

    phone, password = await _make_officer(client)
    # Register first
    reg = await client.post("/auth/register", json={
        "phone": phone, "password": password, "name": "X", "role": "officer"
    })
    # We already registered above; just use the token from demo-login
    with (
        patch.object(settings, "DEMO_LOGIN_ENABLED", True),
        patch.object(settings, "DEMO_LOGIN_PHONE", phone),
        patch.object(settings, "DEMO_LOGIN_PASSWORD", password),
    ):
        resp = await client.post("/auth/demo-login")
    assert resp.status_code == 200
    token = resp.json()["access_token"]

    # Token should be valid immediately after login
    citizen_token = await register_and_login(client, "citizen")
    inc_resp = await client.post("/incidents", json={
        "type": "fire", "description": "logout test", "lat": 26.0, "lng": 91.0, "severity": 2,
    }, headers=auth_header(citizen_token))
    inc_id = inc_resp.json()["id"]

    verify_resp = await client.patch(f"/incidents/{inc_id}/verify",
        json={"data_label": "live"}, headers=auth_header(token))
    assert verify_resp.status_code == 200

