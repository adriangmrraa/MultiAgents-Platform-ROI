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

    async def ingest_document(self, content: bytes, filename: str, metadata: dict = {}) -> bool:
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
            elif suffix == '.txt' or suffix == '.md':
                loader = TextLoader(tmp_path, encoding='utf-8')
            elif suffix == '.csv':
                loader = CSVLoader(tmp_path)
            elif suffix == '.docx':
                loader = Docx2txtLoader(tmp_path)
            elif suffix == '.doc':
                loader = UnstructuredWordDocumentLoader(tmp_path)
            
            if not loader:
                raise Exception(f"Unsupported file format: {suffix}")

            raw_docs = loader.load()
            
            for d in raw_docs:
                d.metadata.update(metadata)
                d.metadata["tenant_id"] = self.tenant_id
                d.metadata["user_id"] = self.user_id # Strict Isolation (Nexus v5.10)
                d.metadata["source_name"] = filename

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
