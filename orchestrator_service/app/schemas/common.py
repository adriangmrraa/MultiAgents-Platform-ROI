from enum import Enum

class ChatStatus(str, Enum):
    OPEN = "open"
    CLOSED = "closed"
    HUMAN_OVERRIDE = "human_override"
    HUMAN_HANDLING = "human_handling"

class MessageType(str, Enum):
    TEXT = "text"
    IMAGE = "image"
    AUDIO = "audio"
    VIDEO = "video"
    DOCUMENT = "document"

class MessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"
    TOOL = "tool"
    HUMAN_SUPERVISOR = "human_supervisor"
