from pydantic import BaseModel, SecretStr, Field
from typing import Optional, Dict

class TiendaNubeCreds(BaseModel):
    store_id: str = Field(..., description="Public Store ID (e.g. 12345)")
    access_token: SecretStr = Field(..., description="Private Access Token")

    def __repr__(self):
        return f"<TiendaNubeCreds store_id={self.store_id} token=***>"

class TenantContext(BaseModel):
    id: int
    store_name: str
    bot_phone_number: str
    
    tiendanube_creds: Optional[TiendaNubeCreds] = None
    openai_key: Optional[SecretStr] = None
    
    system_prompt_template: Optional[str] = None
    store_catalog_knowledge: Optional[str] = None
    store_description: Optional[str] = None
    
    handoff_policy: Dict = Field(default_factory=dict)
    tool_config: Dict = Field(default_factory=dict)
    
    def __repr__(self):
        # Override repr to ensure no keys leak in logs
        return f"<TenantContext id={self.id} name='{self.store_name}' phone={self.bot_phone_number}>"
