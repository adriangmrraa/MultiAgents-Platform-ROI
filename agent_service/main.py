import os
from dotenv import load_dotenv

load_dotenv()

import json
import uuid
import structlog
from typing import Any, Dict, List, Optional, Literal
from fastapi import FastAPI, HTTPException, Header, Depends, Body
from pydantic import BaseModel, Field, SecretStr
from langchain.agents import AgentExecutor, create_openai_functions_agent
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from langchain.output_parsers import PydanticOutputParser
from langchain.tools import tool
import httpx
from contextvars import ContextVar # Protocol Omega: Isolation

# --- Initialize Structlog ---
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer()
    ],
    logger_factory=structlog.PrintLoggerFactory(),
)
logger = structlog.get_logger()

app = FastAPI(title="Agent Core Service", version="1.0.0")

# --- Common Models (Shared logically with Orchestrator) ---
class OrchestratorMessage(BaseModel):
    part: Optional[int] = None
    total: Optional[int] = None
    text: Optional[str] = None
    imageUrl: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

class OrchestratorResponse(BaseModel):
    messages: List[OrchestratorMessage] = Field(description="List of messages to send to the user.")

class AgentContext(BaseModel):
    store_name: str
    system_prompt: str

class AgentCredentials(BaseModel):
    openai_api_key: Optional[str] = None
    google_api_key: Optional[str] = None
    tiendanube_store_id: Optional[str] = None
    tiendanube_access_token: Optional[SecretStr] = None
    tiendanube_service_url: str = "http://tiendanube-service:8003"

class AgentConfig(BaseModel):
    tools: Optional[List[str]] = None
    tool_instructions: Optional[List[str]] = None
    knowledge_sources: Optional[List[str]] = []
    model: Optional[Dict[str, Any]] = None

class AgentThinkRequest(BaseModel):
    tenant_id: int
    user_id: Optional[str] = None # Strict Isolation Context (Nexus v5.10)
    message: str
    history: List[Dict[str, str]]
    context: AgentContext
    credentials: AgentCredentials
    agent_config: Optional[AgentConfig] = None
    # internal_secret removed - passed via header

# --- Dynamic Tool Context (Protocol Omega: ContextVars) ---
ctx_store_id: ContextVar[str] = ContextVar("ctx_store_id", default="")
ctx_token: ContextVar[str] = ContextVar("ctx_token", default="")
ctx_service_url: ContextVar[str] = ContextVar("ctx_service_url", default="")
ctx_internal_token: ContextVar[str] = ContextVar("ctx_internal_token", default="")
ctx_knowledge_sources: ContextVar[List[str]] = ContextVar("ctx_knowledge_sources", default=[])
ctx_user_id: ContextVar[str] = ContextVar("ctx_user_id", default="") # Strict Isolation (v5.10)

parser = PydanticOutputParser(pydantic_object=OrchestratorResponse)

# --- Tools Definitions ---

@tool
async def search_specific_products(q: str):
    """SEARCH for specific products in the store by name, category or brand."""
    payload = {
        "store_id": ctx_store_id.get(),
        "access_token": ctx_token.get(),
        "q": q
    }
    headers = {"X-Internal-Secret": ctx_internal_token.get()}
    async with httpx.AsyncClient(timeout=300.0) as client: # Protocol Omega: 300s Timeout
        try:
            resp = await client.post(f"{ctx_service_url.get()}/tools/productsq", json=payload, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("ok"): return data.get("data")
            return f"Error en búsqueda: {resp.text}"
        except Exception as e:
            return f"Excepción en herramienta: {str(e)}"

@tool
async def browse_general_storefront():
    """Browse the generic storefront (latest items). Use for vague requests like 'show me what you have'."""
    payload = {
        "store_id": ctx_store_id.get(),
        "access_token": ctx_token.get()
    }
    headers = {"X-Internal-Secret": ctx_internal_token.get()}
    async with httpx.AsyncClient(timeout=300.0) as client:
        try:
            resp = await client.post(f"{ctx_service_url.get()}/tools/productsall", json=payload, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("ok"): return data.get("data")
            return f"Error en catálogo: {resp.text}"
        except Exception as e:
            return f"Excepción en herramienta: {str(e)}"

@tool
async def search_by_category(category: str, keyword: str = ""):
    """SEARCH products by category name and optionally a keyword to refine."""
    payload = {
        "store_id": ctx_store_id.get(),
        "access_token": ctx_token.get(),
        "category": category,
        "keyword": keyword
    }
    headers = {"X-Internal-Secret": ctx_internal_token.get()}
    async with httpx.AsyncClient(timeout=300.0) as client:
        try:
            resp = await client.post(f"{ctx_service_url.get()}/tools/productsq_category", json=payload, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("ok"): return data.get("data")
            return f"Error en categorías: {resp.text}"
        except Exception as e:
            return f"Excepción en herramienta: {str(e)}"

@tool
async def cupones_list():
    """LIST available discount coupons for the store."""
    payload = {"store_id": ctx_store_id.get(), "access_token": ctx_token.get()}
    headers = {"X-Internal-Secret": ctx_internal_token.get()}
    async with httpx.AsyncClient(timeout=300.0) as client:
        try:
            resp = await client.post(f"{ctx_service_url.get()}/tools/cupones_list", json=payload, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("ok"): return data.get("data")
            return f"Error en cupones: {resp.text}"
        except Exception as e:
            return f"Excepción en herramienta: {str(e)}"

@tool
async def orders(q: str):
    """CHECK the status of an order by number or customer name."""
    payload = {"store_id": ctx_store_id.get(), "access_token": ctx_token.get(), "q": q}
    headers = {"X-Internal-Secret": ctx_internal_token.get()}
    async with httpx.AsyncClient(timeout=300.0) as client:
        try:
            resp = await client.post(f"{ctx_service_url.get()}/tools/orders", json=payload, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("ok"): return data.get("data")
            return f"Error en órdenes: {resp.text}"
        except Exception as e:
            return f"Excepción en herramienta: {str(e)}"

@tool
async def search_knowledge_base(q: str):
    """
    SEARCH the internal knowledge base for policies, brand information, or specific non-product data.
    Use this for questions about 'how do you handle X' or 'what is the return policy'.
    """
    # We call the orchestrator's RAG search endpoint through the BFF/Bridge or directly if allowed.
    # In this architecture, we call the orchestrator (which holds the RAGCore).
    # We use ctx_service_url as a base, but orchestrator is usually at 8000.
    orch_url = os.getenv("ORCHESTRATOR_URL", "http://orchestrator_service:8000")
    headers = {"X-Internal-Secret": ctx_internal_token.get(), "x-admin-token": os.getenv("ADMIN_TOKEN", "admin-secret-99")}
    
    # Protocol Omega: Inject filters (v5.10)
    ks = ctx_knowledge_sources.get()
    source_ids = ",".join(ks) if ks else None
    user_id = ctx_user_id.get()
    
    params = {"tenant_id": ctx_store_id.get(), "q": q}
    if user_id:
        params["user_id"] = user_id # Mandamiento de Búsqueda
    if source_ids:
        params["source_ids"] = source_ids
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.get(f"{orch_url}/admin/rag/search", params=params, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("ok"): return data.get("context")
            return f"Error en búsqueda de conocimiento: {resp.text}"
        except Exception as e:
            return f"Excepción en herramienta RAG: {str(e)}"

@tool
async def derivhumano(reason: str):
    """ACTIVATE human handoff. Use when the user specifically asks for a person or is frustrated."""
    return f"HUMAN_HANDOFF_REQUESTED: {reason}"

@app.get("/health")
async def health():
    return {"status": "ok", "service": "agent_service"}

@app.post("/v1/agent/execute")
async def execute_agent(
    request: AgentThinkRequest,
    x_internal_secret: str = Header(None, alias="X-Internal-Secret") # Protocol Omega: Header Handshake
):
    # Security Check
    env_secret = os.getenv("INTERNAL_API_TOKEN")
    if env_secret and x_internal_secret != env_secret:
        raise HTTPException(status_code=401, detail="Invalid Internal Secret")

    logger.info("agent_execution_start", tenant_id=request.tenant_id, store=request.context.store_name)
    
    # 0. Hydrate Context for Tools (Protocol Omega: ContextVars)
    ctx_store_id.set(request.credentials.tiendanube_store_id or "")
    ctx_token.set(request.credentials.tiendanube_access_token.get_secret_value() if request.credentials.tiendanube_access_token else "")
    ctx_service_url.set(request.credentials.tiendanube_service_url)
    ctx_internal_token.set(x_internal_secret or "")
    ctx_knowledge_sources.set(request.agent_config.knowledge_sources if request.agent_config else [])
    ctx_user_id.set(request.user_id or "")

    # 1. Prepare History
    history = []
    for m in request.history:
        if m['role'] == 'user':
            history.append(HumanMessage(content=m['content']))
        elif m['role'] == 'assistant':
            history.append(AIMessage(content=m['content']))
            
    # 2. Build Prompt
    # Protocol Omega: Inject Tool Instructions
    final_system_prompt = request.context.system_prompt
    if request.agent_config and request.agent_config.tool_instructions:
        final_system_prompt += "\n\n### PROTOCOLO DE HERRAMIENTAS ACTIVAS:"
        for instr in request.agent_config.tool_instructions:
            final_system_prompt += f"\n- {instr}"

    prompt = ChatPromptTemplate.from_messages([
        SystemMessage(content=final_system_prompt),
        MessagesPlaceholder(variable_name="chat_history"),
        ("user", "{input}"),
        MessagesPlaceholder(variable_name="agent_scratchpad"),
    ]).partial(format_instructions=parser.get_format_instructions())
    
    # 3. Detect Provider and Resolve API Key (Lazy Resolution)
    model_name = "gpt-4o-mini" # Default
    if request.agent_config and request.agent_config.model and "name" in request.agent_config.model:
        model_name = request.agent_config.model["name"]

    provider = "openai"
    if model_name.startswith("gemini"):
        provider = "google"
    
    # Priority: 1. Request Credentials (Tenant) 2. Environment (Global)
    resolved_api_key = None
    if provider == "openai":
        resolved_api_key = request.credentials.openai_api_key or os.getenv("OPENAI_API_KEY")
    else:
        resolved_api_key = request.credentials.google_api_key or os.getenv("GOOGLE_API_KEY")

    if not resolved_api_key:
        logger.warning("agent_execution_paused_missing_key", provider=provider, tenant_id=request.tenant_id)
        raise HTTPException(
            status_code=400, 
            detail=f"Execution Paused: Missing {provider.capitalize()} Credentials. Please configure them in Settings."
        )

    # 4. Initialize LLM (with Tier-based Timeout)
    # Premium models (o3, Deep Think) get more time for CoT, but need validation
    llm_timeout = 60 # Standard 2026 timeout
    if model_name in ["o3-high", "gemini-3-deep-think"]:
        llm_timeout = 180 # Extended for Reasoning
        
    if provider == "google":
        llm = ChatGoogleGenerativeAI(
            model=model_name,
            google_api_key=resolved_api_key,
            temperature=0,
            timeout=llm_timeout
        )
    else:
        llm = ChatOpenAI(
            model=model_name,
            api_key=resolved_api_key,
            temperature=0,
            timeout=llm_timeout
        )
    
    # 4. Construct Agent

    all_tools = [
        search_specific_products, 
        browse_general_storefront, 
        search_by_category, 
        cupones_list, 
        orders, 
        search_knowledge_base,
        derivhumano
    ]
    
    # Filter tools if config provided
    if request.agent_config and request.agent_config.tools is not None:
        allowed_names = set(request.agent_config.tools)
        tools_list = [t for t in all_tools if t.name in allowed_names]
        if not tools_list and allowed_names:
             # Fallback: If verification fails or all disabled, maybe minimal tools? 
             # Or respect "no tools".
             # User expectation: "Solamente en ese caso". So if empty, then empty.
             pass 
    else:
        tools_list = all_tools

    agent_def = create_openai_functions_agent(llm, tools_list, prompt)
    executor = AgentExecutor(agent=agent_def, tools=tools_list, verbose=True)
    
    # 5. Execute with Intelligent Fallback
    fallback_taken = False
    try:
        result = await executor.ainvoke({
            "input": request.message,
            "chat_history": history
        })
    except Exception as e:
        logger.error("agent_execution_primary_failed", model=model_name, error=str(e))
        
        # Fallback Strategy (Premium -> Advanced)
        fallback_model = None
        if model_name == "o3-high": fallback_model = "gpt-5.2"
        elif model_name == "gemini-3-deep-think": fallback_model = "gemini-3-pro"
        
        if fallback_model:
            logger.info("triggering_intelligent_fallback", from_model=model_name, to_model=fallback_model)
            fallback_taken = True
            
            # Re-initialize LLM with Fallback
            if fallback_model.startswith("gemini"):
                llm = ChatGoogleGenerativeAI(model=fallback_model, google_api_key=resolved_api_key, temperature=0)
            else:
                llm = ChatOpenAI(model=fallback_model, api_key=resolved_api_key, temperature=0)
            
            agent_def = create_openai_functions_agent(llm, tools_list, prompt)
            executor = AgentExecutor(agent=agent_def, tools=tools_list, verbose=True)
            
            result = await executor.ainvoke({
                "input": request.message,
                "chat_history": history
            })
        else:
            # No fallback possible (already at economy or economy failed)
            raise e

    try:
        output_text = result["output"]
        
        # 6. Parse Output into structured messages
        messages = []
        
        if fallback_taken:
            messages.append(OrchestratorMessage(
                text="⚠️ Usando modelo estándar por alta demanda.",
                metadata={"fallback_event": True, "original_model": model_name}
            ))
        
        # Extract metadata (Chain of Thought / Tool steps)
        metadata = {
            "intermediate_steps": [str(step) for step in result.get("intermediate_steps", [])],
            "agent_outcome": str(result.get("output", ""))
        }

        # Check for handoff
        if "HUMAN_HANDOFF_REQUESTED:" in output_text:
            messages.append(OrchestratorMessage(text=output_text, metadata=metadata))
        else:
            # Protocol Omega: Multi-Bubble Support (|||) & Image Extraction
            import re
            
            # Split by explicit delimiter first
            raw_parts = output_text.split("|||")
            
            for i, raw_part in enumerate(raw_parts):
                clean_part = raw_part.strip()
                if not clean_part:
                    continue

                # Metadata strategy: Only last bubble gets the full metadata (CoT)
                is_last_main_part = (i == len(raw_parts) - 1)
                
                # Regex for Markdown Images: ![alt](url)
                image_pattern = r'!\[(.*?)\]\((.*?)\)'
                matches = list(re.finditer(image_pattern, clean_part))
                
                last_idx = 0
                for j, match in enumerate(matches):
                    # 1. Text before image
                    pre_text = clean_part[last_idx:match.start()].strip()
                    if pre_text:
                        messages.append(OrchestratorMessage(text=pre_text))
                    
                    # 2. The Image
                    image_url = match.group(2)
                    messages.append(OrchestratorMessage(imageUrl=image_url))
                    
                    last_idx = match.end()
                
                # 3. Text after last image
                remaining_text = clean_part[last_idx:].strip()
                if remaining_text:
                    msg_meta = metadata if is_last_main_part else {}
                    messages.append(OrchestratorMessage(text=remaining_text, metadata=msg_meta))
                elif is_last_main_part and not matches:
                    if messages:
                         messages[-1].metadata = metadata
            
        return {"messages": [m.dict() for m in messages]}
        
    except Exception as e:
        logger.error("agent_thinking_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
