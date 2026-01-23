import re
from typing import List, Optional
from langchain.schema import Document
import structlog

logger = structlog.get_logger(__name__)

class WhatsAppParser:
    """
    Nexus v5.49 - Specialized Parser for WhatsApp .txt exports.
    Can operate in two modes:
    1. Chronological: Ingests every message as a separate vector (or grouped by time).
    2. Hero Mode: Groups "Context (Other) -> Response (Hero)" to train the AI on specific style style.
    """
    
    # Regex to capture "[Date Time] Name: Message"
    # Example: [21/01/2026 14:30:00] Cliente: Hola que tal
    # regex slightly flexible for different exported formats (iOS vs Android)
    # v5.59: New Strict Pattern for Spanish formats [dd/mm/yy, hh:mm:ss p. m.]
    # Captures: 1=Timestamp, 2=Sender, 3=Message
    MSG_PATTERN = re.compile(r"^\[(.*?)\] (.*?): (.*)$")

    @staticmethod
    def parse(file_content: str, hero_name: Optional[str] = None, source_name: str = "whatsapp_chat") -> List[Document]:
        # Clean invisible unicode characters (LTR marks, etc)
        # v5.59: Advanced Cleaning
        cleaned_content = file_content.replace('\u200e', '').replace('\u202f', ' ').replace('\u202d', '').replace('\u202c', '')
        lines = cleaned_content.split('\n')
        
        documents = []
        context_window = [] # Stores "Other" messages as input context
        
        for line in lines:
            line = line.strip()
            if not line: continue
            
            # v5.59: Noise Filtering
            if "<adjunto:" in line or "encryp" in line.lower() or "cifrados" in line.lower():
                continue
            
            # Check for direct links without text (low value style)
            if line.startswith("http") and " " not in line:
                continue

            match = WhatsAppParser.MSG_PATTERN.match(line)
            if match:
                timestamp_str, sender, message = match.groups()
                sender = sender.strip()
                message = message.strip()
                
                if hero_name and sender.lower() == hero_name.lower():
                    # --- HERO SPEAKS (OUTPUT) ---
                    # We form a pair: Input (Context) -> Output (Hero)
                    if context_window:
                        context_str = "\n".join(context_window)
                        
                        # Style Training Pair
                        full_content = f"User said:\n{context_str}\n\nHero replied:\n{message}"
                        
                        doc = Document(
                            page_content=full_content,
                            metadata={
                                "source": source_name,
                                "collection": "ADN Personal", # Enforced by logic
                                "type": "style_training",
                                "hero": sender,
                                "role": "hero_response",
                                "timestamp": timestamp_str
                            }
                        )
                        documents.append(doc)
                        
                        # Reset context after usage
                        context_window = []
                    else:
                        # Hero spoke first or monologue. We skip or log?
                        # For style, monologue is less useful without prompt.
                        pass
                else:
                    # --- OTHER SPEAKS (INPUT) ---
                    # Add to context accumulator
                    context_window.append(message)
                    
                    # If not in Hero Mode (Standard), we just save the line
                    if not hero_name:
                         doc = Document(
                            page_content=f"[{timestamp_str}] {sender}: {message}",
                            metadata={
                                "source": source_name,
                                "sender": sender,
                                "timestamp": timestamp_str
                            }
                        )
                         documents.append(doc)
            else:
                # Line didn't match pattern. Continuation?
                # If we have a context window, append to last message?
                if context_window and not hero_name:
                     # Simple continuation for standard mode
                     pass

        logger.info("whatsapp_parsed", docs_generated=len(documents), mode="hero" if hero_name else "standard")
        return documents
