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
    MSG_PATTERN = re.compile(r"^\[?(\d{1,2}/\d{1,2}/\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?)\]?\s+([^:]+):\s+(.*)$")

    @staticmethod
    def parse(file_content: str, hero_name: Optional[str] = None, source_name: str = "whatsapp_chat") -> List[Document]:
        lines = file_content.split('\n')
        documents = []
        
        current_buffer = [] # For simple grouping if needed, or keeping context
        
        # We will parse line by line.
        # If Hero Mode is active:
        # We accumulate "Other" messages. When "Hero" speaks, we form a training pair:
        # Input: [Other messages]
        # Output: [Hero message]
        # And we vectorise that pair for "Style Retrieval".
        
        # If Hero Mode is OFF (Knowledge Base Mode):
        # We just vectorize blocks of conversation to provide factual context.
        
        context_window = []
        
        for line in lines:
            line = line.strip()
            if not line: continue
            
            match = WhatsAppParser.MSG_PATTERN.match(line)
            if match:
                timestamp_str, sender, message = match.groups()
                # Clean characters
                sender = sender.replace("\u202a", "").replace("\u202c", "").strip() 
                
                if hero_name and sender.lower() == hero_name.lower():
                    # It's the HERO.
                    # Create a document that captures the CONTEXT leading up to this answer.
                    if context_window:
                        # Join context
                        context_str = "\n".join(context_window)
                        full_content = f"CONTEXT:\n{context_str}\n\nRESPONSE ({sender}):\n{message}"
                        
                        doc = Document(
                            page_content=full_content,
                            metadata={
                                "source": source_name,
                                "type": "style_training",
                                "hero": sender,
                                "timestamp": timestamp_str,
                                "role": "assistant"
                            }
                        )
                        documents.append(doc)
                        # Reset context? Or keep sliding? 
                        # Usually for Q&A pairs we reset, but sliding might be better. 
                        # Let's simple reset for clear Q&A pairs.
                        context_window = []
                    else:
                        # Hero spoke without context? Maybe start of chat or monologue.
                        # Just digest it as knowledge.
                        pass
                else:
                    # It's SOMEONE ELSE.
                    # Add to context window.
                    context_window.append(f"[{timestamp_str}] {sender}: {message}")
                    
                    # Also, if functionality is just "Ingest Facts", we might want to store this raw message too.
                    # But for now, let's assume the user wants either Context Pairs (Hero) or just full chat.
                    
                    if not hero_name:
                         # Standard Mode: Just document the line
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
                # Continuation of previous message?
                if context_window and not hero_name:
                     # Append to last doc if needed? 
                     # Simplifying: Ignore non-matching lines (system messages like "Messages are encrypted")
                     pass

        logger.info("whatsapp_parsed", docs_generated=len(documents), mode="hero" if hero_name else "standard")
        return documents
