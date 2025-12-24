from pydantic import BaseModel, ConfigDict, SecretStr, Field
from typing import Optional, List, Dict
from datetime import datetime

class TenantBase(BaseModel):
    store_name: str
    bot_phone_number: str
    is_active: bool = True
    system_prompt_template: Optional[str] = None
    store_catalog_knowledge: Optional[str] = None
    store_description: Optional[str] = None

class TenantCreate(TenantBase):
    tiendanube_store_id: Optional[str] = None
    tiendanube_access_token: Optional[SecretStr] = None
    openai_api_key: Optional[SecretStr] = None

class TenantRead(TenantBase):
    id: int
    created_at: datetime
    updated_at: datetime
    # Secrets excluded by default in Read models usually, 
    # but we might include them masked or just exclude them.
    # For internal logic we need them, for API response we don't.
    # Let's keep them hidden from basic Read.
    
    model_config = ConfigDict(from_attributes=True)

class TenantInternal(TenantRead):
    """Internal schema including secrets for the Agent Logic."""
    tiendanube_store_id: Optional[str] = None
    tiendanube_access_token: Optional[SecretStr] = None
    openai_api_key: Optional[SecretStr] = None

class HandoffConfig(BaseModel):
    enabled: bool = False
    triggers: Dict = Field(default_factory=dict)
    handoff_message: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)
