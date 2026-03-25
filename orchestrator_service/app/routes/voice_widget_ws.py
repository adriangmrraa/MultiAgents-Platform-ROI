"""
Voice Widget WebSocket Handler — Voice Pipeline
Supports:
  - OpenAI Realtime API (unified speech-to-speech)
  - NVIDIA Riva NIM (ASR → NexusEngine → TTS)
"""
import os
import json
import time
import base64
import asyncio
import logging
from datetime import datetime

from fastapi import WebSocket, WebSocketDisconnect

from db import db, redis_client

logger = logging.getLogger(__name__)


async def voice_websocket_handler(websocket: WebSocket, session_id: str):
    """Main WebSocket handler for voice widget sessions."""
    # 1. Validate session
    raw = await redis_client.get(f"voice_session:{session_id}")
    if not raw:
        await websocket.close(code=4001, reason="Invalid session")
        return

    config = json.loads(raw)
    await websocket.accept()

    start_time = time.time()
    abuse_detected = False

    try:
        provider = config.get("realtime_provider", "openai")
        pipeline = config.get("voice_pipeline", "realtime")

        if pipeline == "realtime" and provider == "openai":
            abuse_detected = await handle_openai_realtime(websocket, config)
        elif pipeline == "realtime" and provider == "nvidia":
            abuse_detected = await handle_nvidia_riva(websocket, config)
        else:
            # Cascaded pipeline (future implementation)
            abuse_detected = await handle_openai_realtime(websocket, config)

    except WebSocketDisconnect:
        logger.info("voice_ws_client_disconnected", session_id=session_id)
    except Exception as e:
        logger.error("voice_ws_error", session_id=session_id, error=str(e))
    finally:
        # Record usage
        duration = int(time.time() - start_time)
        await record_voice_usage(config, session_id, duration, abuse_detected)

        # If abuse detected, block the IP
        if abuse_detected:
            visitor_ip = config.get("visitor_ip", "unknown")
            widget_token = await _get_widget_token(config.get("widget_id"))
            if widget_token:
                await redis_client.setex(
                    f"voice_blocked:{widget_token}:{visitor_ip}",
                    3600,  # 1 hour block
                    "abuse"
                )
            try:
                await websocket.close(code=4003, reason="Abuse detected")
            except Exception:
                pass


async def handle_openai_realtime(websocket: WebSocket, config: dict) -> bool:
    """
    OpenAI Realtime API bridge.
    Bidirectional: client audio ↔ backend ↔ OpenAI Realtime.
    Returns True if abuse was detected.
    """
    try:
        import websockets
    except ImportError:
        logger.error("websockets_not_installed")
        await websocket.send_text(json.dumps({"error": "Server configuration error"}))
        return False

    api_key = config.get("api_key", "")
    if not api_key:
        logger.error("voice_no_api_key", tenant_id=config.get("tenant_id"))
        return False

    url = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "OpenAI-Beta": "realtime=v1"
    }

    abuse_detected = False

    try:
        async with websockets.connect(url, additional_headers=headers) as openai_ws:
            # Configure session
            session_config = {
                "type": "session.update",
                "session": {
                    "instructions": config.get("system_prompt", ""),
                    "voice": config.get("voice_model", "alloy"),
                    "input_audio_format": "pcm16",
                    "output_audio_format": "pcm16",
                    "turn_detection": {
                        "type": "server_vad",
                        "threshold": 0.5,
                        "prefix_padding_ms": 300,
                        "silence_duration_ms": 500
                    }
                }
            }

            # Add tools if available
            tools = config.get("tools", [])
            if tools and isinstance(tools, list):
                session_config["session"]["tools"] = convert_tools_to_openai_format(tools)

            await openai_ws.send(json.dumps(session_config))

            max_duration = config.get("max_duration", 300)
            start = time.time()

            async def client_to_openai():
                """Forward audio from browser to OpenAI."""
                try:
                    while True:
                        data = await websocket.receive_bytes()
                        audio_b64 = base64.b64encode(data).decode()
                        await openai_ws.send(json.dumps({
                            "type": "input_audio_buffer.append",
                            "audio": audio_b64
                        }))
                except (WebSocketDisconnect, Exception):
                    pass

            async def openai_to_client():
                """Forward audio and events from OpenAI to browser."""
                nonlocal abuse_detected
                try:
                    async for message in openai_ws:
                        event = json.loads(message)
                        event_type = event.get("type", "")

                        # Audio response
                        if event_type == "response.audio.delta":
                            audio_b64 = event.get("delta", "")
                            if audio_b64:
                                audio_bytes = base64.b64decode(audio_b64)
                                await websocket.send_bytes(audio_bytes)

                        # Check for abuse in text responses
                        elif event_type == "response.text.delta":
                            text = event.get("delta", "")
                            if "[ABUSE_DETECTED]" in text:
                                abuse_detected = True

                        elif event_type == "response.done":
                            # Check full response for abuse
                            output = event.get("response", {}).get("output", [])
                            for item in output:
                                content = item.get("content", [])
                                for c in content:
                                    if c.get("type") == "text" and "[ABUSE_DETECTED]" in c.get("text", ""):
                                        abuse_detected = True

                            if abuse_detected:
                                # Let the final audio play, then close
                                await asyncio.sleep(2)
                                return

                        # Function calling
                        elif event_type == "response.function_call_arguments.done":
                            call_id = event.get("call_id", "")
                            fn_name = event.get("name", "")
                            fn_args = event.get("arguments", "{}")
                            result = await execute_tool(config, fn_name, fn_args)
                            await openai_ws.send(json.dumps({
                                "type": "conversation.item.create",
                                "item": {
                                    "type": "function_call_output",
                                    "call_id": call_id,
                                    "output": json.dumps(result)
                                }
                            }))
                            await openai_ws.send(json.dumps({"type": "response.create"}))

                except (WebSocketDisconnect, Exception):
                    pass

            async def timeout_watchdog():
                """Close session when max duration reached."""
                await asyncio.sleep(max_duration)

            # Run all tasks, cancel on first completion
            done, pending = await asyncio.wait(
                [
                    asyncio.create_task(client_to_openai()),
                    asyncio.create_task(openai_to_client()),
                    asyncio.create_task(timeout_watchdog()),
                ],
                return_when=asyncio.FIRST_COMPLETED
            )
            for task in pending:
                task.cancel()

    except Exception as e:
        logger.error("openai_realtime_error", error=str(e))

    return abuse_detected


async def handle_nvidia_riva(websocket: WebSocket, config: dict) -> bool:
    """
    NVIDIA Riva NIM pipeline: ASR → NexusEngine → TTS.
    Uses the same NexusEngine + tools the agent already has.
    """
    try:
        import websockets
    except ImportError:
        logger.error("websockets_not_installed")
        return False

    ngc_key = config.get("api_key", "")
    if not ngc_key:
        logger.error("voice_no_nvidia_key", tenant_id=config.get("tenant_id"))
        return False

    riva_endpoint = os.getenv("RIVA_NIM_ENDPOINT", "grpc.nvcf.nvidia.com:443")
    language = config.get("language", "es")
    lang_code = {"es": "es-ES", "en": "en-US", "pt": "pt-BR"}.get(language, "es-ES")

    abuse_detected = False
    max_duration = config.get("max_duration", 300)

    try:
        # Connect to Riva ASR NIM
        asr_url = f"wss://{riva_endpoint}/v1/realtime?intent=transcription"
        asr_headers = {"Authorization": f"Bearer {ngc_key}"}

        # Connect to Riva TTS NIM
        tts_url = f"wss://{riva_endpoint}/v1/realtime?intent=synthesize"
        tts_headers = {"Authorization": f"Bearer {ngc_key}"}

        async with websockets.connect(asr_url, additional_headers=asr_headers) as asr_ws, \
                   websockets.connect(tts_url, additional_headers=tts_headers) as tts_ws:

            # Configure ASR
            await asr_ws.send(json.dumps({
                "type": "transcription_session.update",
                "config": {
                    "language_code": lang_code,
                    "encoding": "LINEAR_PCM",
                    "sample_rate_hertz": 16000,
                    "model": "canary-1b"
                }
            }))

            # Configure TTS
            await tts_ws.send(json.dumps({
                "type": "synthesis_session.update",
                "config": {
                    "voice_name": config.get("voice_model", "magpie-tts-es"),
                    "language_code": lang_code,
                    "encoding": "LINEAR_PCM",
                    "sample_rate_hertz": 22050
                }
            }))

            async def client_audio_to_asr():
                """Browser mic → Riva ASR NIM."""
                try:
                    while True:
                        audio_chunk = await websocket.receive_bytes()
                        audio_b64 = base64.b64encode(audio_chunk).decode()
                        await asr_ws.send(json.dumps({
                            "type": "input_audio_buffer.append",
                            "audio": audio_b64
                        }))
                except (WebSocketDisconnect, Exception):
                    pass

            async def asr_to_llm_to_tts():
                """Riva ASR → NexusEngine (LLM) → Riva TTS."""
                nonlocal abuse_detected
                try:
                    async for event_raw in asr_ws:
                        event = json.loads(event_raw)
                        etype = event.get("type", "")

                        if etype == "conversation.item.input_audio_transcription.completed":
                            user_text = event.get("transcript", "").strip()
                            if not user_text:
                                continue

                            logger.info("riva_asr_transcript", text=user_text[:100])

                            # Process through NexusEngine
                            agent_response = await process_with_nexus_engine(config, user_text)

                            if "[ABUSE_DETECTED]" in agent_response:
                                abuse_detected = True

                            # Send response to TTS
                            await tts_ws.send(json.dumps({
                                "type": "input_text.append",
                                "text": agent_response.replace("[ABUSE_DETECTED]", "").strip()
                            }))
                            await tts_ws.send(json.dumps({"type": "input_text.commit"}))

                            if abuse_detected:
                                await asyncio.sleep(3)
                                return
                except (WebSocketDisconnect, Exception):
                    pass

            async def tts_to_client():
                """Riva TTS → Browser speaker."""
                try:
                    async for event_raw in tts_ws:
                        event = json.loads(event_raw)
                        if event.get("type") == "conversation.item.speech.data":
                            audio_b64 = event.get("audio", "")
                            if audio_b64:
                                audio_bytes = base64.b64decode(audio_b64)
                                await websocket.send_bytes(audio_bytes)
                except (WebSocketDisconnect, Exception):
                    pass

            async def timeout_watchdog():
                await asyncio.sleep(max_duration)

            done, pending = await asyncio.wait(
                [
                    asyncio.create_task(client_audio_to_asr()),
                    asyncio.create_task(asr_to_llm_to_tts()),
                    asyncio.create_task(tts_to_client()),
                    asyncio.create_task(timeout_watchdog()),
                ],
                return_when=asyncio.FIRST_COMPLETED
            )
            for task in pending:
                task.cancel()

    except Exception as e:
        logger.error("nvidia_riva_error", error=str(e))

    return abuse_detected


# --- Helper Functions ---

async def process_with_nexus_engine(config: dict, user_text: str) -> str:
    """Process user text through NexusEngine (same engine as chat agents)."""
    try:
        from app.core.engine import NexusEngine

        engine = NexusEngine(
            tenant_id=config["tenant_id"],
            agent_id=config["agent_id"]
        )
        response = await engine.process(
            message=user_text,
            channel="voice_widget",
            system_prompt=config.get("system_prompt"),
        )
        return response.get("text", response) if isinstance(response, dict) else str(response)
    except Exception as e:
        logger.error("nexus_engine_error", error=str(e))
        return "Lo siento, hubo un error procesando tu solicitud."


async def execute_tool(config: dict, tool_name: str, arguments_json: str) -> dict:
    """Execute a tool via the existing tool infrastructure."""
    try:
        from app.core.engine import NexusEngine

        engine = NexusEngine(
            tenant_id=config["tenant_id"],
            agent_id=config["agent_id"]
        )
        args = json.loads(arguments_json) if arguments_json else {}
        result = await engine.execute_tool(tool_name, args)
        return result if isinstance(result, dict) else {"result": str(result)}
    except Exception as e:
        logger.error("tool_execution_error", tool=tool_name, error=str(e))
        return {"error": f"Tool execution failed: {str(e)}"}


def convert_tools_to_openai_format(tools: list) -> list:
    """Convert NexusEngine tool names to OpenAI Realtime function calling format."""
    # Map of known tools to their OpenAI function definitions
    TOOL_DEFINITIONS = {
        "search_specific_products": {
            "type": "function",
            "name": "search_specific_products",
            "description": "Search for products in the store catalog by query",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query for products"}
                },
                "required": ["query"]
            }
        },
        "check_stock": {
            "type": "function",
            "name": "check_stock",
            "description": "Check stock availability for a product",
            "parameters": {
                "type": "object",
                "properties": {
                    "product_id": {"type": "string", "description": "Product ID to check"}
                },
                "required": ["product_id"]
            }
        },
        "create_order": {
            "type": "function",
            "name": "create_order",
            "description": "Create a new order for a customer",
            "parameters": {
                "type": "object",
                "properties": {
                    "product_id": {"type": "string"},
                    "quantity": {"type": "integer", "default": 1}
                },
                "required": ["product_id"]
            }
        },
        "schedule_appointment": {
            "type": "function",
            "name": "schedule_appointment",
            "description": "Schedule an appointment/meeting",
            "parameters": {
                "type": "object",
                "properties": {
                    "date": {"type": "string", "description": "Date in YYYY-MM-DD format"},
                    "time": {"type": "string", "description": "Time in HH:MM format"},
                    "email": {"type": "string", "description": "Customer email"}
                },
                "required": ["date", "time"]
            }
        }
    }

    result = []
    for tool_name in tools:
        if isinstance(tool_name, str) and tool_name in TOOL_DEFINITIONS:
            result.append(TOOL_DEFINITIONS[tool_name])
        elif isinstance(tool_name, dict) and "name" in tool_name:
            # Already in dict format
            result.append(tool_name)
    return result


async def record_voice_usage(config: dict, session_id: str, duration: int, abuse: bool):
    """Record voice session usage in database."""
    try:
        await db.pool.execute("""
            INSERT INTO voice_usage_records (
                tenant_id, widget_id, session_id, duration_seconds,
                api_key_mode, provider, visitor_ip, abuse_detected
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        """,
            config.get("tenant_id"),
            config.get("widget_id"),
            session_id,
            duration,
            config.get("api_key_mode", "platform"),
            config.get("realtime_provider", "openai"),
            config.get("visitor_ip"),
            abuse
        )
    except Exception as e:
        logger.error("voice_usage_record_error", error=str(e))


async def _get_widget_token(widget_id: int) -> str:
    """Get widget_token from widget_id."""
    if not widget_id:
        return ""
    row = await db.pool.fetchrow(
        "SELECT widget_token FROM voice_widget_configs WHERE id = $1", widget_id
    )
    return row["widget_token"] if row else ""
