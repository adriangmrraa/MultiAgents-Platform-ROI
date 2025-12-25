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
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from langchain.output_parsers import PydanticOutputParser
from langchain.tools import tool
import httpx

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

class AgentThinkRequest(BaseModel):
    tenant_id: int
    store_name: str
    user_input: str
    chat_history: List[Dict[str, str]] 
    system_prompt: str
    openai_api_key: str
    # Protocol Omega: Context passed dynamically
    tiendanube_store_id: Optional[str] = None
    tiendanube_access_token: Optional[SecretStr] = None
    tiendanube_service_url: str = "http://tiendanube_service:8002"
    internal_api_token: str
    mcp_url: Optional[str] = None

# --- Global Context (Thread-local equivalent for Tool calls during iinvoke) ---
# We use a simple object to hold context during the request lifetime
class Context:
    store_id: str = ""
    token: str = ""
    service_url: str = ""
    internal_token: str = ""

ctx = Context()

parser = PydanticOutputParser(pydantic_object=OrchestratorResponse)

# --- Dynamic Tool Context (Local to Thread/Execution) ---
# In a real microservice, we might use ContextVars or pass these to the tools.
# For simplicity, we'll use a wrapper or pass explicitly if needed.

# --- Tools Definitions ---
# These tools are extracted from the orchestrator and adapted for statelessness

async def call_tiendanube_api(endpoint: str, store_id: str, token: str, params: dict = None):
    url = f"https://api.tiendanube.com/v1/{store_id}{endpoint}"
    headers = {
        "Authentication": f"bearer {token}",
        "User-Agent": "Nexus-Agent-Service (Nexus v3)",
        "Content-Type": "application/json"
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(url, params=params, headers=headers)
        if response.status_code != 200:
            return f"Error API Tienda Nube: {response.status_code}"
        return response.json()

@tool
async def search_specific_products(q: str):
    """SEARCH for specific products in the store by name, category or brand."""
    payload = {
        "store_id": ctx.store_id,
        "access_token": ctx.token,
        "q": q
    }
    headers = {"X-Internal-Token": ctx.internal_token}
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            resp = await client.post(f"{ctx.service_url}/tools/productsq", json=payload, headers=headers)
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
        "store_id": ctx.store_id,
        "access_token": ctx.token
    }
    headers = {"X-Internal-Token": ctx.internal_token}
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            resp = await client.post(f"{ctx.service_url}/tools/productsall", json=payload, headers=headers)
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
        "store_id": ctx.store_id,
        "access_token": ctx.token,
        "category": category,
        "keyword": keyword
    }
    headers = {"X-Internal-Token": ctx.internal_token}
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            resp = await client.post(f"{ctx.service_url}/tools/productsq_category", json=payload, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("ok"): return data.get("data")
            return f"Error en categorías: {resp.text}"
        except Exception as e:
            return f"Excepción en herramienta: {str(e)}"

@tool
async def cupones_list():
    """LIST available discount coupons for the store."""
    payload = {"store_id": ctx.store_id, "access_token": ctx.token}
    headers = {"X-Internal-Token": ctx.internal_token}
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            resp = await client.post(f"{ctx.service_url}/tools/cupones_list", json=payload, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("ok"): return data.get("data")
            return f"Error en cupones: {resp.text}"
        except Exception as e:
            return f"Excepción en herramienta: {str(e)}"

@tool
async def orders(q: str):
    """CHECK the status of an order by number or customer name."""
    payload = {"store_id": ctx.store_id, "access_token": ctx.token, "q": q}
    headers = {"X-Internal-Token": ctx.internal_token}
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            resp = await client.post(f"{ctx.service_url}/tools/orders", json=payload, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("ok"): return data.get("data")
            return f"Error en órdenes: {resp.text}"
        except Exception as e:
            return f"Excepción en herramienta: {str(e)}"

@tool
async def derivhumano(reason: str):
    """ACTIVATE human handoff. Use when the user specifically asks for a person or is frustrated."""
    # This tool needs to tell the orchestrator to set human_override.
    # We'll return a specific marker that the orchestrator interprets.
    return f"HUMAN_HANDOFF_REQUESTED: {reason}"

# Update tools_list in think function

@app.get("/health")
async def health():
    return {"status": "ok", "service": "agent_service"}

@app.post("/v1/agent/execute")
async def execute_agent(request: AgentThinkRequest):
    logger.info("agent_execution_start", tenant_id=request.tenant_id, store=request.store_name)
    
    # 0. Hydrate Context for Tools (Protocol Omega)
    ctx.store_id = request.tiendanube_store_id or ""
    ctx.token = request.tiendanube_access_token.get_secret_value() if request.tiendanube_access_token else ""
    ctx.service_url = request.tiendanube_service_url
    ctx.internal_token = request.internal_api_token

    # 1. Prepare History
    # ...
    history = []
    for m in request.chat_history:
        if m['role'] == 'user':
            history.append(HumanMessage(content=m['content']))
        else:
            history.append(AIMessage(content=m['content']))
            
    # 2. Build Prompt
    prompt = ChatPromptTemplate.from_messages([
        SystemMessage(content=request.system_prompt),
        MessagesPlaceholder(variable_name="chat_history"),
        ("user", "{input}"),
        MessagesPlaceholder(variable_name="agent_scratchpad"),
    ]).partial(format_instructions=parser.get_format_instructions())
    
    # 3. Initialize LLM
    llm = ChatOpenAI(
        model="gpt-4o-mini",
        api_key=request.openai_api_key,
        temperature=0
    )
    
    # 4. Construct Agent
    tools_list = [
        search_specific_products, 
        browse_general_storefront, 
        search_by_category, 
        cupones_list, 
        orders, 
        derivhumano
    ]
    agent_def = create_openai_functions_agent(llm, tools_list, prompt)
    executor = AgentExecutor(agent=agent_def, tools=tools_list, verbose=True)
    
    # 5. Execute
    try:
        result = await executor.ainvoke({
            "input": request.user_input,
            "chat_history": history
        })
        
        output_text = result["output"]
        
        # 6. Parse Output into structured messages
        # We look for image URLs or specific markers
        messages = []
        
        # Extract metadata (Chain of Thought / Tool steps)
        metadata = {
            "intermediate_steps": [str(step) for step in result.get("intermediate_steps", [])],
            "agent_outcome": str(result.get("output", ""))
        }

        # Check for handoff
        if "HUMAN_HANDOFF_REQUESTED:" in output_text:
            messages.append(OrchestratorMessage(text=output_text, metadata=metadata))
        else:
            # Simple splitter for now (in the future, a more complex parser could be used)
            messages.append(OrchestratorMessage(text=output_text, metadata=metadata))
            
        return {"messages": [m.dict() for m in messages]}
        
    except Exception as e:
        logger.error("agent_thinking_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
