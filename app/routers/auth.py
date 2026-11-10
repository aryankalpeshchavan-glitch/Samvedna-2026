from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.auth import hash_password, verify_password, create_token, create_demo_token
from app.core.config import settings
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin, UserOut, Token

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=201)
async def register(data: UserCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.phone == data.phone))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Phone already registered")

    user = User(
        phone=data.phone,
        password_hash=hash_password(data.password),
        name=data.name,
        role=data.role.value,
        lang=data.lang,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


@router.post("/login", response_model=Token)
async def login(data: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.phone == data.phone))
    user = result.scalar_one_or_none()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_token(user.id, user.role)
    return Token(access_token=token, role=user.role)


@router.post("/demo-login", response_model=Token)
async def demo_login(db: AsyncSession = Depends(get_db)):
    """One-click demo login for demonstration purposes.

    Security guarantees:
    - Disabled by default (DEMO_LOGIN_ENABLED must be explicitly set to 'true').
    - Credentials are read server-side from environment variables only.
    - Never creates, registers or elevates accounts.
    - Only succeeds if the account has the 'officer' role in the database.
    - Issues a short-lived JWT (DEMO_LOGIN_TOKEN_MINUTES, default 30 min).
    - Never returns passwords, hashes, or configuration values.
    """
    # 1. Gate: feature must be explicitly enabled server-side.
    if not settings.DEMO_LOGIN_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Demo access is not available.",
        )

    # 2. Gate: credentials must be configured server-side (non-empty).
    if not settings.DEMO_LOGIN_PHONE or not settings.DEMO_LOGIN_PASSWORD:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Demo access is not configured.",
        )

    # 3. Locate existing account — never create one.
    result = await db.execute(select(User).where(User.phone == settings.DEMO_LOGIN_PHONE))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Demo account unavailable. Contact the administrator.",
        )

    # 4. Verify password using the existing hashing mechanism.
    if not verify_password(settings.DEMO_LOGIN_PASSWORD, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Demo account unavailable. Contact the administrator.",
        )

    # 5. Confirm the account has the expected officer role — never elevate.
    if user.role != "officer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Demo account does not have the required officer role.",
        )

    # 6. Issue a short-lived JWT using the existing authentication mechanism.
    token = create_demo_token(user.id, user.role)
    return Token(access_token=token, role=user.role)
