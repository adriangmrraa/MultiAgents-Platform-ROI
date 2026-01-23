import os
import uuid
import structlog
from typing import List, Dict, Any, Optional
from bs4 import BeautifulSoup
import requests
import tempfile
import re

from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import SupabaseVectorStore
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.schema import Document
from langchain_community.document_loaders import (
    PyPDFLoader, 
    TextLoader, 
    CSVLoader, 
    UnstructuredWordDocumentLoader,
    Docx2txtLoader
)
from supabase.client import create_client, Client

from app.core.config import settings
from app.core.parsers.whatsapp import WhatsAppParser # v5.49

logger = structlog.get_logger(__name__)

# Configuration from settings
SUPABASE_URL = settings.SUPABASE_URL
SUPABASE_SERVICE_KEY = settings.SUPABASE_SERVICE_KEY
GLOBAL_OPENAI_API_KEY = settings.OPENAI_API_KEY
GLOBAL_GOOGLE_API_KEY = settings.GOOGLE_API_KEY

class RAGCore:
    """
    The 'Stellar Map' of the Nexus Business Engine.
    Handles Persistent Vector Storage using Supabase (pgvector) and OpenAI Embeddings.
    """
    
    def __init__(self, tenant_id: str, user_id: str = None, api_key: str = None, provider: str = "openai"):
        self.tenant_id = str(tenant_id)
        self.user_id = str(user_id) if user_id else None
        self.provider = provider
        
        # Priority: 1. Passed api_key (Tenant specific), 2. Global Fallback
        if provider == "google":
            self.api_key = api_key or GLOBAL_GOOGLE_API_KEY
        else:
            self.api_key = api_key or GLOBAL_OPENAI_API_KEY
            
        self._db_instance = None
        
        # Initialize Supabase Client (Infrastructure must be present)
        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
             raise Exception("Supabase infrastructure credentials missing.")
        
        self.supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    def _ensure_credentials(self):
        """Lazy check for credentials before any AI operations."""
        if not self.api_key:
            provider_name = "Google" if self.provider == "google" else "OpenAI"
            raise Exception(f"Missing {provider_name} Credentials. Please configure them in Settings.")

    @property
    def _db(self) -> SupabaseVectorStore:
        """Lazy initialization of the vector store."""
        if self._db_instance is None:
            self._ensure_credentials()
            
            # Provider selection
            if self.provider == "google":
                from langchain_google_genai import GoogleGenerativeAIEmbeddings
                embedding_fn = GoogleGenerativeAIEmbeddings(
                    model="models/embedding-001",
                    google_api_key=self.api_key
                )
            else:
                # Default to OpenAI
                embedding_fn = OpenAIEmbeddings(
                    model="text-embedding-3-small",
                    openai_api_key=self.api_key
                )
            
            try:
                self._db_instance = SupabaseVectorStore(
                    client=self.supabase,
                    embedding=embedding_fn,
                    table_name="documents",
                    query_name="match_documents"
                )
            except Exception as e:
                logger.error("rag_supabase_init_failed", error=str(e))
                raise Exception(f"Failed to initialize Vector Store: {str(e)}")
        
        return self._db_instance

    async def transform_product_with_llm(self, product: Dict, llm: Any) -> str:
        """
        Uses LLM to transform raw product JSON into a rich, semantic description.
        """
        try:
            raw_text = (
                f"Name: {product.get('name', {}).get('es', '')}\n"
                f"Description: {product.get('description', {}).get('es', '')}\n"
                f"Categories: {product.get('categories', [])}\n"
                f"Attributes: {product.get('attributes', [])}\n"
                f"Tags: {product.get('tags', '')}"
            )
            
            from langchain.schema import SystemMessage, HumanMessage
            
            messages = [
                SystemMessage(content="You are an expert E-commerce SEO Copywriter. Your task is to transform raw product data into a concise, keyword-rich semantic description optimized for vector search. Focus on visual characteristics, usage, and key features. Output ONLY the description text."),
                HumanMessage(content=f"Raw Data:\n{raw_text}")
            ]
            
            response = await llm.ainvoke(messages)
            return response.content
        except Exception as e:
            logger.warning("rag_llm_transform_failed", error=str(e), product_id=product.get("id"))
            return f"{product.get('name', {}).get('es', '')} - {product.get('description', {}).get('es', '')}"

    async def ingest_store(self, product_data: List[Dict], public_url: str = None) -> bool:
        """
        Ingests strict Catalog Data + Public HTML Context into Vector Store.
        """
        self._ensure_credentials()
        logger.info(f"rag_ingestion_start: tenant={self.tenant_id}, count={len(product_data)}")
        
        try:
            docs = []
            
            from langchain_openai import ChatOpenAI
            llm_transform = ChatOpenAI(
                model="gpt-4o-mini",
                temperature=0.3,
                openai_api_key=self.api_key
            )
            
            for p in product_data:
                text_content = await self.transform_product_with_llm(p, llm_transform)
                
                metadata = {
                    "source": "catalog", 
                    "product_id": str(p.get("id")),
                    "tenant_id": self.tenant_id,
                    "user_id": self.user_id, # Strict Isolation (Nexus v5.10)
                    "price": str(p.get("price", "0")),
                    "handle": p.get("handle", {}).get("es", "")
                }
                docs.append(Document(page_content=text_content, metadata=metadata))
                
                import asyncio
                await asyncio.sleep(1)
            
            if public_url:
                try:
                    logger.info(f"rag_scraping_url: {public_url}")
                    response = requests.get(public_url, timeout=10)
                    if response.status_code == 200:
                        soup = BeautifulSoup(response.text, "html.parser")
                        for script in soup(["script", "style"]):
                            script.extract()
                        text = soup.get_text()
                        
                        splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
                        html_docs = splitter.create_documents(
                            [text], 
                            metadatas=[{"source": "website", "url": public_url, "tenant_id": self.tenant_id, "user_id": self.user_id}]
                        )
                        docs.extend(html_docs)
                except Exception as e:
                    logger.error("rag_scraping_failed", error=str(e))
            
            if docs:
                self._db.add_documents(docs)
                logger.info(f"rag_ingestion_success: count={len(docs)}")
                return True
                
            return False

        except Exception as e:
            logger.error("rag_ingestion_critical_error", error=str(e))
            return False

    async def ingest_document(self, content: bytes, filename: str, metadata: dict = {}, collection: str = "General", hero_name: str = None) -> bool:
        """
        Sovereign Document Ingestion (v5.1).
        Supports PDF, TXT, CSV, DOCX.
        """
        self._ensure_credentials()
        logger.info(f"rag_document_ingestion_start: tenant={self.tenant_id}, filename={filename}")
        
        tmp_path = None
        try:
            suffix = os.path.splitext(filename)[1].lower()
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                tmp.write(content)
                tmp_path = tmp.name

            loader = None
            if suffix == '.pdf':
                loader = PyPDFLoader(tmp_path)
                try:
                    raw_docs = loader.load()
                except Exception:
                     # Fallback for some PDFs
                     logger.warning("rag_pdf_fallback")
                     loader = UnstructuredWordDocumentLoader(tmp_path) # Sometimes works? No, distinct. 
                     # Just re-raise for now.
                     raise
            elif suffix == '.txt' or suffix == '.md':
                # v5.57: Robust Encoding Fallback (UTF-8 -> Latin-1)
                text_content = ""
                try:
                    # v5.59: Encoding Ladder (UTF-8-SIG > UTF-8 > Latin-1)
                    with open(tmp_path, 'r', encoding='utf-8-sig') as f:
                        text_content = f.read()
                except UnicodeDecodeError:
                    try:
                        with open(tmp_path, 'r', encoding='utf-8') as f:
                            text_content = f.read()
                    except UnicodeDecodeError:
                        logger.warning("rag_encoding_fallback_latin1", filename=filename)
                        with open(tmp_path, 'r', encoding='latin-1') as f:
                            text_content = f.read()

                if not text_content.strip():
                    raise Exception("El archivo está vacío o corrupto (No text content extracted).")

                # v5.57: Strict Routing & Parser Activation
                # Priority 1: Explicit Identity Collection (ADN Personal + Hero Name)
                if collection == "ADN Personal" and hero_name:
                     logger.info("rag_parser_identity_mode_forced", hero=hero_name)
                     from app.core.parsers.whatsapp import WhatsAppParser
                     raw_docs = WhatsAppParser.parse(text_content, hero_name=hero_name, source_name=filename)
                     
                     if not raw_docs:
                         logger.warning("rag_parser_identity_no_docs", reason="Parsing returned empty list")
                         # Fallback to TextLoader if Parser failing is not acceptable? 
                         # User said: "Nunca hagas fallback a 'General'".
                         # We should probably error out if it was meant to be parsed but failed?
                         # Or we allow it to be stored as a flat document in 'ADN Personal'.
                         # Let's fallback to flat text but KEEP collection 'ADN Personal'.
                         raw_docs = [Document(page_content=text_content, metadata={"source": filename})]

                # Priority 2: Auto-Detection (Legacy behavior)
                elif re.search(r"^\s*\[?\d{1,2}/\d{1,2}", text_content[:100]):
                     logger.info("rag_parser_whatsapp_detected_auto")
                     from app.core.parsers.whatsapp import WhatsAppParser
                     raw_docs = WhatsAppParser.parse(text_content, hero_name=hero_name, source_name=filename)
                
                # Priority 3: Plain Text
                else:
                     logger.info("rag_parser_standard_text")
                     # We already read the content, so we create Document directly to avoid re-reading
                     raw_docs = [Document(page_content=text_content, metadata={"source": filename})]

            elif suffix == '.csv':
                loader = CSVLoader(tmp_path)
            elif suffix == '.docx':
                loader = Docx2txtLoader(tmp_path)
            elif suffix == '.doc':
                loader = UnstructuredWordDocumentLoader(tmp_path)
            
            if not suffix == '.txt' and not suffix == '.md':
                # Loaders that were not handled in the if/else block above (e.g. PDF/DOCX)
                if not loader:
                     if suffix in ['.docx', '.doc', '.csv']:
                         pass # handled
                     else:
                        raise Exception(f"Unsupported file format: {suffix}")
                raw_docs = loader.load()
            
            # Post-processing (Nexus v5.71: Override Final)
            filename_only = os.path.basename(filename)
            critical_tensor_log = [] # Diagnostics
            
            for d in raw_docs:
                # 1. Base metadata
                d.metadata.update(metadata)
                
                # 2. Strict Type Safety & Routing Override
                # No importa lo que diga el parser, el usuario manda.
                d.metadata["collection"] = collection 
                d.metadata["tenant_id"] = str(self.tenant_id) # Type Safety (Str)
                d.metadata["user_id"] = str(self.user_id) if self.user_id else None
                d.metadata["source"] = filename_only # Canonical Source
                d.metadata["source_name"] = filename_only
                
                # Diagnostic snapshot
                if not critical_tensor_log:
                     critical_tensor_log.append(f"Ingesting chunk 1/N -> Metadata: {d.metadata.get('collection')}, Tenant: {d.metadata.get('tenant_id')}")

            if critical_tensor_log:
                logger.info("rag_data_integrity_check", details=critical_tensor_log[0])

            splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
            docs = splitter.split_documents(raw_docs)

            if docs:
                self._db.add_documents(docs)
                logger.info(f"rag_document_ingestion_success: count={len(docs)}")
                return True
                
            raise Exception("No text content extracted")

        except Exception as e:
            logger.error("rag_document_ingestion_failed", error=str(e))
            raise e
        finally:
            if tmp_path and os.path.exists(tmp_path):
                os.unlink(tmp_path)

    async def ingest_chat_message(self, message_content: str, metadata: dict) -> bool:
        """
        Shadow RAG: Ingests chat messages for long-term memory.
        Target Table: 'chats_vectors' (if specified) or 'documents' with specific metadata.
        User Requirement: "Nueva Colección chats_vectors".
        """
        self._ensure_credentials()
        try:
            # We strictly use the 'chats_vectors' table as requested in v5.32
            # NOTE: SupabaseVectorStore in LangChain usually takes table_name in __init__.
            # We need a transient instance or re-init for this specific table if we want a separate table.
            
            # Lazy re-init for this specific operation
            from langchain_openai import OpenAIEmbeddings
            from langchain_community.vectorstores import SupabaseVectorStore
            
            embedding_fn = None
            if self.provider == "google":
                from langchain_google_genai import GoogleGenerativeAIEmbeddings
                embedding_fn = GoogleGenerativeAIEmbeddings(model="models/embedding-001", google_api_key=self.api_key)
            else:
                embedding_fn = OpenAIEmbeddings(model="text-embedding-3-small", openai_api_key=self.api_key)

            # Metadata Enhancement
            final_metadata = {
                "source": "shadow_chat",
                "tenant_id": self.tenant_id,
                "user_id": self.user_id,
                **metadata
            }

            # Create transient vector store pointing to 'chats_vectors'
            vector_store = SupabaseVectorStore(
                client=self.supabase,
                embedding=embedding_fn,
                table_name="chats_vectors",
                query_name="match_chats" # Needs a matching function in Postgres/Supabase
            )

            doc = Document(page_content=message_content, metadata=final_metadata)
            vector_store.add_documents([doc])
            
            logger.info(f"rag_shadow_ingestion_success: tenant={self.tenant_id}")
            return True

        except Exception as e:
            logger.error("rag_shadow_ingestion_failed", error=str(e))
            return False

    def search(self, query: str, k: int = 4, filter: dict = None) -> str:
        """
        Semantic Search with Strict User Isolation.
        """
        if not self.user_id:
            logger.error("rag_search_blocked", reason="missing_user_id")
            return "Error: Strict isolation requires user_id context."

        try:
            # Combined filter with tenant_id AND user_id for strict isolation
            combined_filter = (filter or {}).copy()
            combined_filter["tenant_id"] = self.tenant_id
            combined_filter["user_id"] = self.user_id
            
            # Mandamiento de Búsqueda: "Nunca llamarás a similarity_search sin pasar filter={'user_id': ...}."
            results = self._db.similarity_search(query, k=k, filter=combined_filter)
            context_block = "\n---\n".join([doc.page_content for doc in results])
            return context_block
        except Exception as e:
            logger.error("rag_search_failed", error=str(e))
            return ""

    def search_shadow(self, query: str, k: int = 4, filter: dict = None) -> List[Document]:
        """
        Shadow RAG Search: Retrieves user-specific context from 'chats_vectors'.
        Returns list of Documents instead of string for granular control.
        """
        self._ensure_credentials()
        try:
            # Lazy re-init for chats_vectors (Shared logic with ingestion)
            from langchain_openai import OpenAIEmbeddings
            from langchain_community.vectorstores import SupabaseVectorStore
            
            embedding_fn = None
            if self.provider == "google":
                from langchain_google_genai import GoogleGenerativeAIEmbeddings
                embedding_fn = GoogleGenerativeAIEmbeddings(model="models/embedding-001", google_api_key=self.api_key)
            else:
                embedding_fn = OpenAIEmbeddings(model="text-embedding-3-small", openai_api_key=self.api_key)

            # Create transient vector store pointing to 'chats_vectors'
            vector_store = SupabaseVectorStore(
                client=self.supabase,
                embedding=embedding_fn,
                table_name="chats_vectors",
                query_name="match_chats"
            )
            
            # Strict Isolation Filters
            combined_filter = (filter or {}).copy()
            combined_filter["tenant_id"] = self.tenant_id
            # Optional: Allow searching across all circles if needed, but strict user_id if present
            # Shadow RAG is usually scoped to the CONTACT (User), so user_id is crucial.
            if self.user_id:
                combined_filter["user_id"] = self.user_id
            
            results = vector_store.similarity_search(query, k=k, filter=combined_filter)
            return results
            
        except Exception as e:
            logger.error("rag_shadow_search_failed", error=str(e))
            return []

    def count_vectors(self) -> int:
        """
        Counts vectors for this tenant/user.
        """
        try:
            query = self.supabase.table("documents").select("id", count="exact").eq("metadata->>tenant_id", self.tenant_id)
            if self.user_id:
                query = query.eq("metadata->>user_id", self.user_id)
            resp = query.execute()
            return resp.count if resp.count is not None else 0
        except Exception as e:
            logger.error("rag_count_failed", error=str(e))
            return 0

    def delete_document_by_metadata(self, key: str, value: str) -> bool:
        """
        Deletes vectors matching specific metadata, scoped to tenant and user.
        """
        try:
            logger.info(f"rag_deletion_start: {key}={value}")
            query = self.supabase.table("documents").delete().eq(f"metadata->>{key}", value).eq("metadata->>tenant_id", self.tenant_id)
            if self.user_id:
                query = query.eq("metadata->>user_id", self.user_id)
            query.execute()
            return True
        except Exception as e:
            logger.error("rag_deletion_failed", error=str(e))
            return False

    def delete_vectors(self, file_name: str) -> bool:
        """
        Nexus v5.71 - Critical Fix: Deletes vectors with Type Safety.
        Deletes by 'source_name' OR 'source' to catch all variants.
        """
        self._ensure_credentials()
        try:
            logger.info(f"rag_delete_vectors_start: file={file_name}, tenant={self.tenant_id}")
            
            # Type Safety: Ensure we are using String for Tenant ID
            str_tenant_id = str(self.tenant_id)
            
            # We perform 2 deletions to cover both legacy ("source") and new ("source_name") metadata standards.
            # 1. Delete by source_name
            self.supabase.table("documents").delete().eq("metadata->>tenant_id", str_tenant_id).eq("metadata->>source_name", file_name).execute()
            
            # 2. Delete by source (Legacy/Flat) - Ensure we don't delete by full path if file_name is just basename
            # current 'file_name' coming from admin_routes is already basename.
            self.supabase.table("documents").delete().eq("metadata->>tenant_id", str_tenant_id).eq("metadata->>source", file_name).execute()
            
            logger.info("rag_delete_vectors_success")
            return True
        except Exception as e:
            logger.warning(f"rag_delete_vectors_warning: {e}") 
            # We return True to allow the SQL deletion to proceed (Idempotent)
            return True
