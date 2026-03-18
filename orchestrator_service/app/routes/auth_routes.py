from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timedelta
import uuid
import structlog

logger = structlog.get_logger()

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
async def read_users_me(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """
    Get current logged in user.
    """
    # Eager load tenant for convenience (should be handled by lazy="joined" in model but explicit is good for APIs)
    # DEBUG: Log the actual value from DB
    logger.info("auth_me_check", user_id=str(current_user.id), is_verified=current_user.is_verified)
    
    # Fetch subscription info
    sub_info = {}
    try:
        from app.models.billing import Subscription, Plan
        sub_result = await db.execute(
            select(Subscription).where(Subscription.tenant_id == current_user.tenant_id)
        )
        sub = sub_result.scalar_one_or_none()
        if sub:
            plan_result = await db.execute(select(Plan).where(Plan.id == sub.plan_id))
            plan = plan_result.scalar_one_or_none()
            sub_info = {
                "plan_name": plan.name if plan else "unknown",
                "plan_display_name": plan.display_name if plan else "Unknown",
                "subscription_status": sub.status,
                "trial_ends_at": sub.trial_ends_at.isoformat() if sub.trial_ends_at else None,
                "trial_days_remaining": max(0, (sub.trial_ends_at.replace(tzinfo=None) - datetime.utcnow()).days) if sub.trial_ends_at else None
            }
    except Exception:
        pass

    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "role": current_user.role,
        "tenant_id": current_user.tenant_id,
        "is_verified": current_user.is_verified,
        "store_name": current_user.tenant.store_name if current_user.tenant else None,
        "full_name": current_user.full_name,
        "avatar_url": current_user.avatar_url,
        **sub_info
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
            from datetime import datetime
            email_sent = True
            try:
                await EmailService.send_verification_email(existing_user.email, existing_user.verification_token, tenant_id=existing_user.tenant_id)
                existing_user.last_verification_email_at = datetime.utcnow()
                await db.commit()
                message = "Verification email resent. Check your inbox."
            except Exception as e:
                logger.error("smtp_register_resend_error", error=str(e))
                email_sent = False
                message = f"SMTP Failed: {str(e)}"
            
            return {
                "access_token": "pending_verification", 
                "token_type": "bearer",
                "email_sent": email_sent,
                "message": message
            }

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

    # 3b. Create Trial Subscription (10 days free)
    try:
        from app.models.billing import Plan, Subscription
        from datetime import timedelta
        free_plan = (await db.execute(select(Plan).where(Plan.name == "free"))).scalar_one_or_none()
        if free_plan:
            trial_sub = Subscription(
                tenant_id=new_tenant.id,
                plan_id=free_plan.id,
                status="trialing",
                trial_ends_at=datetime.utcnow() + timedelta(days=10)
            )
            db.add(trial_sub)
            await db.commit()
            logger.info("trial_subscription_created", tenant_id=new_tenant.id, trial_days=10)
    except Exception as sub_err:
        logger.warning("trial_subscription_skip", error=str(sub_err))

    # 4. Send Verification Email (BLOCKING per User Debug Protocol)
    from app.core.email import EmailService
    from datetime import datetime
    
    email_sent = True
    try:
        # Sync call (blocking) to catch errors immediately
        await EmailService.send_verification_email(new_user.email, verification_token, tenant_id=new_user.tenant_id)
        new_user.last_verification_email_at = datetime.utcnow()
        await db.commit()
    except Exception as e:
        logger.error("smtp_register_error", error=str(e))
        email_sent = False
        message = "Cuenta creada exitosamente. El email de verificacion puede demorar unos minutos."
    else:
        message = "User created. System in Spectator Mode until verified."
    
    # 5. Return Success with Email Status
    return {
        "access_token": "pending_verification", 
        "token_type": "bearer",
        "email_sent": email_sent,
        "message": message
    }

@router.post("/login", response_model=Token)
async def login(user_in: UserLogin, response: Response, db: AsyncSession = Depends(get_db)):
    # 1. Find User
    result = await db.execute(select(User).where(User.email == user_in.email))
    user = result.scalar_one_or_none()
    
    if not user or not security.verify_password(user_in.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
        
    # 2. Zero Trust Guard -> MODIFIED: Allow login for Spectator Mode
    # We no longer block login. The frontend/backend will restrict actions instead.
    # if not user.is_verified:
    #     raise HTTPException(status_code=403, detail="Email not verified. Please check your inbox.")
        
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
        samesite="none",
        secure=True  # Required for samesite="none"
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
async def resend_verification(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Resends the verification email with a 60-second cooldown block.
    """
    logger.info("resend_verification_initiated", user_id=str(current_user.id), email=current_user.email, is_verified=current_user.is_verified)
    
    if current_user.is_verified:
        logger.info("resend_verification_skipped_already_verified", user_id=str(current_user.id))
        return {"message": "Account already verified."}

    # 1. Cooldown Check (60 seconds)
    if current_user.last_verification_email_at:
        delta = datetime.utcnow() - current_user.last_verification_email_at
        logger.info("resend_verification_cooldown_check", seconds_passed=delta.total_seconds())
        if delta.total_seconds() < 60:
            logger.warning("resend_verification_cooldown_block", seconds_remaining=60 - int(delta.total_seconds()))
            raise HTTPException(
                status_code=429, 
                detail=f"Please wait {60 - int(delta.total_seconds())} seconds before trying again."
            )

    # 2. Prepare Token
    if not current_user.verification_token:
        current_user.verification_token = uuid.uuid4().hex
        logger.info("resend_verification_token_generated")
    
    # 3. Send Email (BLOCKING per User Debug Protocol)
    from app.core.email import EmailService
    from datetime import datetime
    try:
        # Sync call (blocking) to catch errors immediately
        await EmailService.send_verification_email(current_user.email, current_user.verification_token, tenant_id=current_user.tenant_id)
        current_user.last_verification_email_at = datetime.utcnow()
        await db.commit()
    except Exception as e:
        logger.error("smtp_resend_error", error=str(e))
        # CRITICAL: Raise detail as requested by user
        raise HTTPException(
            status_code=500, 
            detail=f"DEBUG SMTP ERROR: {str(e)}"
        )
    
    return {"message": "Verification email sent successfully."}

class GoogleAuthRequest(BaseModel):
    credential: str  # Google ID token from frontend


@router.post("/google")
async def google_auth(data: GoogleAuthRequest, response: Response, db: AsyncSession = Depends(get_db)):
    """
    Google OAuth: verify ID token, create or login user.
    Single endpoint for both login and register via Google.
    """
    import httpx

    # 1. Verify the Google ID token
    google_client_id = settings.GOOGLE_OAUTH_CLIENT_ID
    if not google_client_id:
        raise HTTPException(status_code=503, detail="Google OAuth not configured")

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"https://oauth2.googleapis.com/tokeninfo?id_token={data.credential}"
            )
            if resp.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid Google token")
            google_user = resp.json()
    except httpx.HTTPError:
        raise HTTPException(status_code=401, detail="Failed to verify Google token")

    # Verify audience matches our client ID
    if google_user.get("aud") != google_client_id:
        raise HTTPException(status_code=401, detail="Token audience mismatch")

    if not google_user.get("email_verified", False):
        raise HTTPException(status_code=401, detail="Google email not verified")

    email = google_user["email"]
    full_name = google_user.get("name", "")
    avatar_url = google_user.get("picture", "")

    # 2. Check if user exists
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user:
        # LOGIN: Existing user — update profile from Google if missing
        if not user.full_name and full_name:
            user.full_name = full_name
        if not user.avatar_url and avatar_url:
            user.avatar_url = avatar_url
        if not user.is_verified:
            user.is_verified = True  # Google-verified email
        await db.commit()
        logger.info("google_login", user_id=str(user.id), email=email)
    else:
        # REGISTER: Create new tenant + user
        phone = f"google_{uuid.uuid4().hex[:8]}"
        store_name = full_name or email.split("@")[0]

        new_tenant = Tenant(
            store_name=store_name,
            bot_phone_number=phone,
            owner_email=email,
            is_active=True
        )
        db.add(new_tenant)
        await db.flush()

        user = User(
            email=email,
            password_hash=security.get_password_hash(uuid.uuid4().hex),  # Random password (Google auth only)
            tenant_id=new_tenant.id,
            role="owner",
            is_verified=True,  # Google-verified
            full_name=full_name,
            avatar_url=avatar_url
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

        # Create trial subscription
        try:
            from app.models.billing import Plan, Subscription
            free_plan = (await db.execute(select(Plan).where(Plan.name == "free"))).scalar_one_or_none()
            if free_plan:
                trial_sub = Subscription(
                    tenant_id=new_tenant.id,
                    plan_id=free_plan.id,
                    status="trialing",
                    trial_ends_at=datetime.utcnow() + timedelta(days=10)
                )
                db.add(trial_sub)
                await db.commit()
        except Exception as sub_err:
            logger.warning("google_register_trial_skip", error=str(sub_err))

        logger.info("google_register", user_id=str(user.id), email=email)

    # 3. Issue JWT cookie (same as regular login)
    access_token_expires = timedelta(minutes=security.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        subject=user.id, expires_delta=access_token_expires
    )

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=security.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite="none",
        secure=True
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "is_new_user": user.created_at and (datetime.utcnow() - user.created_at.replace(tzinfo=None)).seconds < 10
    }


class ForgotPasswordSchema(BaseModel):
    email: str

@router.post("/forgot-password")
async def forgot_password(data: ForgotPasswordSchema, db: AsyncSession = Depends(get_db)):
    """
    Request a password reset link. Always returns success to prevent email enumeration.
    """
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if user:
        reset_token = uuid.uuid4().hex
        user.verification_token = reset_token
        await db.commit()

        try:
            from app.core.email import EmailService
            await EmailService.send_password_reset_email(user.email, reset_token)
            logger.info("password_reset_email_sent", email=data.email)
        except Exception as e:
            logger.error("password_reset_email_failed", error=str(e))
    else:
        logger.info("password_reset_no_user", email=data.email)

    return {"message": "Si el email existe, recibiras un enlace para restablecer tu contrasena."}


class ResetPasswordSchema(BaseModel):
    token: str
    new_password: str

@router.post("/reset-password")
async def reset_password(data: ResetPasswordSchema, db: AsyncSession = Depends(get_db)):
    """
    Reset password using the token from forgot-password email.
    """
    result = await db.execute(select(User).where(User.verification_token == data.token))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=400, detail="Token invalido o expirado.")

    user.password_hash = security.get_password_hash(data.new_password)
    user.verification_token = None
    await db.commit()

    logger.info("password_reset_success", user_id=str(user.id))
    return {"message": "Contrasena actualizada exitosamente. Ya puedes iniciar sesion."}


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
        
    try:
        await db.commit()
        await db.refresh(current_user)
    except Exception as e:
        await db.rollback()
        logger.error("profile_update_db_error", error=str(e))
        raise HTTPException(503, "No se pudo actualizar el perfil. Intente nuevamente.")
    
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "full_name": current_user.full_name,
        "avatar_url": current_user.avatar_url
    }
