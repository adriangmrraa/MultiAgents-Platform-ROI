from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import timedelta
import uuid

from app.core.database import get_db
from app.models.auth import User
from app.models.tenant import Tenant
from app.schemas.auth import UserRegister, UserLogin, Token
from app.core import security
from app.core.config import settings
from app.api.deps import get_current_user
from pydantic import BaseModel

router = APIRouter()

@router.get("/me")
async def read_users_me(current_user: User = Depends(get_current_user)):
    """
    Get current logged in user.
    """
    # Eager load tenant for convenience (should be handled by lazy="joined" in model but explicit is good for APIs)
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "role": current_user.role,
        "tenant_id": current_user.tenant_id,
        "store_name": current_user.tenant.store_name if current_user.tenant else None
    }

@router.post("/register", response_model=Token)
async def register(user_in: UserRegister, response: Response, db: AsyncSession = Depends(get_db)):
    """
    Register a new user and create a new Tenant (Sovereign Identity).
    """
    # 1. Check if user email exists
    result = await db.execute(select(User).where(User.email == user_in.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    # 2. Check or Create Tenant
    # Generate phone if missing
    phone = user_in.bot_phone_number
    if not phone:
        phone = f"pending_{uuid.uuid4().hex[:8]}"

    # Check if phone collision
    result = await db.execute(select(Tenant).where(Tenant.bot_phone_number == phone))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Phone number already registered. Please provide unique.")

    new_tenant = Tenant(
        store_name=user_in.store_name,
        bot_phone_number=phone,
        owner_email=user_in.email,
        is_active=True
    )
    db.add(new_tenant)
    await db.flush() # Get ID
    
    # 3. Create User
    verification_token = uuid.uuid4().hex
    new_user = User(
        email=user_in.email,
        password_hash=security.get_password_hash(user_in.password),
        tenant_id=new_tenant.id,
        role="owner",
        is_verified=False,
        verification_token=verification_token
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    
    # 4. Send Verification Email (Background)
    from app.core.email import EmailService
    # In a real app we would use BackgroundTasks, but here for simplicity we call it directly or via a fast wrapper.
    # Actually, BackgroundTasks IS supported by FastAPI if we add it to args.
    # But current signature is fixed. Let's do it sync for MVP resilience (fail fast if SMTP broken) 
    # OR wrap in a simple async ensure_future logic if we don't want to block everything.
    # Given the user requirement "Action: Ensure if SMTP fails it logs but doesnt crash server", 
    # EmailService already handles exception catching.
    
    EmailService.send_verification_email(new_user.email, verification_token)
    
    # 5. Return Success Message (No Token)
    return {"access_token": "pending_verification", "token_type": "bearer"} # Or 200 with message, but keeping schema partial compat

@router.post("/login", response_model=Token)
async def login(user_in: UserLogin, response: Response, db: AsyncSession = Depends(get_db)):
    # 1. Find User
    result = await db.execute(select(User).where(User.email == user_in.email))
    user = result.scalar_one_or_none()
    
    if not user or not security.verify_password(user_in.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
        
    # 2. Zero Trust Guard
    if not user.is_verified:
        raise HTTPException(status_code=403, detail="Email not verified. Please check your inbox.")
        
    # 3. Generate Token
    access_token_expires = timedelta(minutes=security.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        subject=user.id, expires_delta=access_token_expires
    )
    
    # 4. Set Cookie
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=security.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite="lax",
        secure=False 
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

class TokenSchema(BaseModel):
    token: str

@router.post("/verify-email")
async def verify_email(data: TokenSchema, db: AsyncSession = Depends(get_db)):
    """
    Verifies the email using the token.
    """
    result = await db.execute(select(User).where(User.verification_token == data.token))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired verification token")
        
    user.is_verified = True
    user.verification_token = None # One-time use
    await db.commit()
    
    return {"message": "Email verified successfully"}

@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token")
    return {"message": "Logged out"}
