import os
import shutil
import uuid
import structlog
from typing import List, Dict, Any
from bs4 import BeautifulSoup
import requests

from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import Chroma
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.schema import Document
from langchain_community.document_loaders import (
    PyPDFLoader, 
    TextLoader, 
    CSVLoader, 
    UnstructuredWordDocumentLoader,
    Docx2txtLoader
)
import tempfile

logger = structlog.get_logger()

from app.core.config import settings

# Configuration
CHROMA_PERSIST_DIRECTORY = "/app/data/chroma"
OPENAI_API_KEY = settings.OPENAI_API_KEY

import re

class RAGCore:
    """
    The 'Stellar Map' of the Nexus Business Engine.
    Handles Persistent Vector Storage using ChromaDB and OpenAI Embeddings.
    """
    
    def __init__(self, tenant_id: str, api_key: str = None, provider: str = "openai"):
        # Sanitize tenant_id for ChromaDB collection naming rules:
        sanitized_id = re.sub(r'[^a-zA-Z0-9]', '_', str(tenant_id))
        self.tenant_id = tenant_id
        self.collection_name = f"store_{sanitized_id}"
        
        # Provider selection (v5.1 Multi-Provider RAG)
        self.provider = provider
        
        if provider == "google":
            from langchain_google_genai import GoogleGenerativeAIEmbeddings
            self.embedding_fn = GoogleGenerativeAIEmbeddings(
                model="models/embedding-001",
                google_api_key=api_key
            )
        else:
            # Default to OpenAI
            from langchain_openai import OpenAIEmbeddings
            self.embedding_fn = OpenAIEmbeddings(
                model="text-embedding-3-small",
                openai_api_key=api_key or OPENAI_API_KEY
            )
            
        self._db = Chroma(
            collection_name=self.collection_name,
            embedding_function=self.embedding_fn,
            persist_directory=CHROMA_PERSIST_DIRECTORY
        )

    async def transform_product_with_llm(self, product: Dict, llm: Any) -> str:
        """
        Uses LLM to transform raw product JSON into a rich, semantic description.
        This is the "Smart Data Extraction" layer.
        """
        try:
            # Construct a raw representation for the model
            raw_text = (
                f"Name: {product.get('name', {}).get('es', '')}\n"
                f"Description: {product.get('description', {}).get('es', '')}\n"
                f"Categories: {product.get('categories', [])}\n"
                f"Attributes: {product.get('attributes', [])}\n"
                f"Tags: {product.get('tags', '')}"
            )
            
            # Simple prompt for high-speed transformation (using the passed LLM instance)
            from langchain.schema import SystemMessage, HumanMessage
            
            messages = [
                SystemMessage(content="You are an expert E-commerce SEO Copywriter. Your task is to transform raw product data into a concise, keyword-rich semantic description optimized for vector search. Focus on visual characteristics, usage, and key features. Output ONLY the description text."),
                HumanMessage(content=f"Raw Data:\n{raw_text}")
            ]
            
            response = await llm.ainvoke(messages)
            return response.content
        except Exception as e:
            logger.warning("rag_llm_transform_failed", error=str(e), product_id=product.get("id"))
            # Fallback to critical fields
            return f"{product.get('name', {}).get('es', '')} - {product.get('description', {}).get('es', '')}"

    async def ingest_store(self, product_data: List[Dict], public_url: str = None) -> bool:
        """
        Ingests strict Catalog Data + Public HTML Context into Vector Store.
        Now async to support LLM calls.
        """
        logger.info(f"rag_ingestion_start: tenant={self.tenant_id}, count={len(product_data)}")
        
        try:
            docs = []
            
            # Initialize LLM for transformation (Lightweight model)
            from langchain_openai import ChatOpenAI
            llm_transform = ChatOpenAI(
                model="gpt-4o-mini", # Cost-effective & Fast
                temperature=0.3,
                openai_api_key=self.openai_api_key
            )
            
            # 1. Product Ingestion with "Smart Transformation"
            for p in product_data:
                # Transform using Model
                text_content = await self.transform_product_with_llm(p, llm_transform)
                
                # Metadata for retrieval
                metadata = {
                    "source": "catalog", 
                    "product_id": str(p.get("id")),
                    "tenant_id": self.tenant_id,
                    "price": str(p.get("price", "0")), # Strings for Chroma metadata safety
                    "handle": p.get("handle", {}).get("es", "")
                }
                docs.append(Document(page_content=text_content, metadata=metadata))
                
                # Protocol Omega: Balanced Throttle (60 RPM) to prevent 429 on lower tiers 
                # Reduced from 4s to 1s for better UX while remaining safe.
                import asyncio
                await asyncio.sleep(1)
            
            # 2. HTML Scraper (Contextual DNA) - Kept robust
            if public_url:
                try:
                    logger.info(f"rag_scraping_url: {public_url}")
                    response = requests.get(public_url, timeout=10)
                    if response.status_code == 200:
                        soup = BeautifulSoup(response.text, "html.parser")
                        # Extract main text, omitting scripts/styles
                        for script in soup(["script", "style"]):
                            script.extract()
                        text = soup.get_text()
                        
                        # Chunking Strategy for HTML
                        splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
                        html_docs = splitter.create_documents([text], metadatas=[{"source": "website", "url": public_url, "tenant_id": self.tenant_id}])
                        docs.extend(html_docs)
                except Exception as e:
                    logger.error("rag_scraping_failed", error=str(e))
            
            # 3. Vectorization & Storage
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
        logger.info(f"rag_document_ingestion_start: tenant={self.tenant_id}, filename={filename}")
        
        try:
            # 1. Save to temp file for LangChain loaders
            suffix = os.path.splitext(filename)[1].lower()
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                tmp.write(content)
                tmp_path = tmp.name

            # 2. Select Loader
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
                logger.error("rag_unsupported_format", format=suffix)
                os.unlink(tmp_path)
                return False

            # 3. Load and Split
            raw_docs = loader.load()
            
            # Enrich metadata
            for d in raw_docs:
                d.metadata.update(metadata)
                d.metadata["tenant_id"] = self.tenant_id
                d.metadata["source_name"] = filename

            splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
            docs = splitter.split_documents(raw_docs)

            # 4. Vectorize
            if docs:
                # Force rebuild of _db to ensure correct API Key is used if it was updated
                self._db.add_documents(docs)
                logger.info(f"rag_document_ingestion_success: count={len(docs)}")
                os.unlink(tmp_path)
                return True
                
            os.unlink(tmp_path)
            return False

        except Exception as e:
            logger.error("rag_document_ingestion_failed", error=str(e))
            return False

    def search(self, query: str, k: int = 4, filter: dict = None) -> str:
        """
        Semantic Search for the Agent.
        Returns a single string block of context.
        Supports metadata filtering (e.g. by knowledge_sources).
        """
        try:
            # ChromaDB filter syntax: {"source_id": {"$in": ["id1", "id2"]}}
            results = self._db.similarity_search(query, k=k, filter=filter)
            context_block = "\n---\n".join([doc.page_content for doc in results])
            return context_block
        except Exception as e:
            logger.error("rag_search_failed", error=str(e))
            return ""

    def count_vectors(self) -> int:
        return self._db._collection.count()

    def delete_document_by_metadata(self, key: str, value: str) -> bool:
        """
        Deletes vectors matching specific metadata (e.g., {'source_id': '123'}).
        """
        try:
            logger.info(f"rag_deletion_start: {key}={value}")
            # ChromaDB specific delete
            self._db.delete(where={key: value})
            return True
        except Exception as e:
            logger.error("rag_deletion_failed", error=str(e))
            return False
