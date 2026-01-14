from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import timedelta
import uuid
import logging

logger = logging.getLogger(__name__)

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
        "store_name": current_user.tenant.store_name if current_user.tenant else None,
        "full_name": current_user.full_name,
        "avatar_url": current_user.avatar_url
    }

@router.post("/register", response_model=Token)
async def register(user_in: UserRegister, response: Response, db: AsyncSession = Depends(get_db)):
    """
    Register a new user and create a new Tenant (Sovereign Identity).
    """
    # 1. Check if user email exists
    # 1. Check if user email exists
    logger.info("register_check_email", email=user_in.email)
    result = await db.execute(select(User).where(User.email == user_in.email))
    existing_user = result.scalar_one_or_none()
    
    if existing_user:
        if existing_user.is_verified:
            logger.warning("register_conflict_email_exists", email=user_in.email)
            raise HTTPException(status_code=409, detail="Email already registered")
        else:
            # Idempotency / Resend Logic for Unverified Users
            # Ensure token exists
            if not existing_user.verification_token:
                existing_user.verification_token = uuid.uuid4().hex
                await db.commit()
            
            # Resend Email (catch exceptions safely in Service)
            from app.core.email import EmailService
            EmailService.send_verification_email(existing_user.email, existing_user.verification_token)
            
            return {"access_token": "pending_verification", "token_type": "bearer"}

    # 2. Check or Create Tenant
    # Generate phone if missing
    phone = user_in.bot_phone_number
    if not phone:
        phone = f"pending_{uuid.uuid4().hex[:8]}"

    # Check if phone collision
    result = await db.execute(select(Tenant).where(Tenant.bot_phone_number == phone))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Phone number already registered. Please provide unique.")

    # Check if store name collision (Optional but good UX)
    # result = await db.execute(select(Tenant).where(Tenant.store_name == user_in.store_name))
    # if result.scalar_one_or_none():
    #     raise HTTPException(status_code=400, detail="Store name already taken.")

    new_tenant = Tenant(
        store_name=user_in.store_name,
        bot_phone_number=phone,
        owner_email=user_in.email,
        is_active=True
    )
    db.add(new_tenant)
    try:
        await db.flush() # Get ID
    except Exception as e:
        await db.rollback()
        # Parse IntegrityError if possible, or generic
        str_e = str(e).lower()
        if "bot_phone_number" in str_e:
            raise HTTPException(status_code=400, detail="Phone number already registered.")
        if "store_name" in str_e: # If unique constraint exists
             raise HTTPException(status_code=400, detail="Store name already registered.")
        if "users_email_key" in str_e or "unique constraint" in str_e: # Fallback
             raise HTTPException(status_code=400, detail="Resource already exists (Email or Phone).")
        raise HTTPException(status_code=500, detail=f"Database Error: {str(e)}")
    
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

@router.post("/resend-verification")
async def resend_verification(user_in: UserLogin, db: AsyncSession = Depends(get_db)):
    """
    Resends the verification email if the user exists and is not verified.
    """
    result = await db.execute(select(User).where(User.email == user_in.email))
    user = result.scalar_one_or_none()
    
    # Security: Always return 200 to prevent email enumeration, unless we want to be helpful for MVP
    if not user:
         return {"message": "If account exists, verification email sent."}
         
    if user.is_verified:
        return {"message": "Account already verified."}

    # Ensure token exists
    if not user.verification_token:
        user.verification_token = uuid.uuid4().hex
        await db.commit()
    
    # Send Email
    # Send Email
    from app.core.email import EmailService
    try:
        EmailService.send_verification_email(user.email, user.verification_token)
    except Exception as e:
        logger.error("smtp_resend_error", error=str(e))
        # Return 503 so frontend shows the message (500 is masked by useApi)
        raise HTTPException(status_code=503, detail="Error al enviar correo: Verifique configuración SMTP")
    
    return {"message": "If account exists, verification email sent."}

@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token")
    return {"message": "Logged out"}

class UserUpdate(BaseModel):
    full_name: str | None = None
    password: str | None = None
    avatar_url: str | None = None

@router.put("/profile")
async def update_profile(data: UserUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Update user profile (Self-Service).
    """
    if data.full_name is not None:
        current_user.full_name = data.full_name
        
    if data.avatar_url is not None:
        current_user.avatar_url = data.avatar_url
        
    if data.password:
        current_user.password_hash = security.get_password_hash(data.password)
        
    await db.commit()
    await db.refresh(current_user)
    
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "full_name": current_user.full_name,
        "avatar_url": current_user.avatar_url
    }
