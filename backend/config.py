"""
Centralized configuration for the DocuMind AI platform.
Singleton pattern for model loading and environment management.
"""

import os
from functools import lru_cache
from typing import Optional
from dotenv import load_dotenv

load_dotenv()


class Settings:
    """Application settings loaded from environment variables."""

    # === API Keys ===
    GOOGLE_API_KEY: str = (os.getenv("GOOGLE_API_KEY", "") or os.getenv("GOOGLE", "") or os.getenv("google", "")).strip()
    GROQ_API_KEY: str = (os.getenv("GROQ_API_KEY", "")).strip()
    OPENROUTER_API_KEY: str = (os.getenv("OPENROUTER_API_KEY", "")).strip()
    GITHUB_TOKEN: str = (os.getenv("GITHUB_TOKEN", "") or os.getenv("GITHUB_API_KEY", "") or os.getenv("GITHUB", "") or os.getenv("github", "")).strip()

    # === LLM Configuration ===
    _has_github: bool = bool(os.getenv("GITHUB_TOKEN") or os.getenv("GITHUB") or os.getenv("github") or os.getenv("GITHUB_API_KEY"))
    _has_google: bool = bool(os.getenv("GOOGLE_API_KEY") or os.getenv("GOOGLE") or os.getenv("google"))
    LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "github" if (_has_github and not _has_google) else "google")
    LLM_TEMPERATURE: float = float(os.getenv("LLM_TEMPERATURE", "0.1"))
    LLM_MAX_TOKENS: int = int(os.getenv("LLM_MAX_TOKENS", "1500"))

    # === Embedding Configuration ===
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
    EMBEDDING_BATCH_SIZE: int = int(os.getenv("EMBEDDING_BATCH_SIZE", "64"))

    # === Retrieval Configuration ===
    RETRIEVAL_INITIAL_K: int = 20  # Candidates before re-ranking
    RETRIEVAL_FINAL_K: int = 5    # Final chunks after re-ranking
    BM25_WEIGHT: float = 0.3      # Weight for sparse retrieval in RRF
    DENSE_WEIGHT: float = 0.7     # Weight for dense retrieval in RRF
    RRF_K: int = 60               # RRF constant

    # === Re-ranker Configuration ===
    RERANKER_MODEL: str = os.getenv(
        "RERANKER_MODEL", "cross-encoder/ms-marco-MiniLM-L-6-v2"
    )
    RERANKER_ENABLED: bool = os.getenv("RERANKER_ENABLED", "true").lower() == "true"

    # === Chunking Configuration ===
    CHUNK_SIZE: int = int(os.getenv("CHUNK_SIZE", "500"))
    CHUNK_OVERLAP: int = int(os.getenv("CHUNK_OVERLAP", "50"))

    # === OCR Configuration ===
    OCR_ENABLED: bool = os.getenv("OCR_ENABLED", "true").lower() == "true"
    OCR_MIN_TEXT_LENGTH: int = 30  # Min chars per page before triggering OCR

    # === Application ===
    APP_NAME: str = "InsightPDF"
    APP_VERSION: str = "2.0.0"
    MAX_SESSIONS: int = int(os.getenv("MAX_SESSIONS", "200"))
    MAX_FILE_SIZE_MB: int = int(os.getenv("MAX_FILE_SIZE_MB", "50"))
    ALLOWED_EXTENSIONS: set = {".pdf", ".docx", ".txt"}

    # === Upload Storage ===
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "./uploads")

    # === CORS ===
    CORS_ORIGINS: list = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:3000,http://localhost:8000,http://127.0.0.1:3000,http://127.0.0.1:8000"
        ).split(",")
        if origin.strip()
    ]


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings singleton."""
    return Settings()


# === Singleton Model Registry ===

class ModelRegistry:
    """
    Singleton registry for ML models to prevent re-loading.
    Models are loaded lazily on first access.
    """

    _instance: Optional["ModelRegistry"] = None
    _embedding_model = None
    _reranker_model = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    @property
    def embedding_model(self):
        if self._embedding_model is None:
            from sentence_transformers import SentenceTransformer
            import logging
            logger = logging.getLogger(__name__)
            settings = get_settings()
            logger.info(f"Loading embedding model: {settings.EMBEDDING_MODEL}")
            self._embedding_model = SentenceTransformer(settings.EMBEDDING_MODEL)
            logger.info("Embedding model loaded successfully")
        return self._embedding_model

    @property
    def reranker_model(self):
        if self._reranker_model is None:
            settings = get_settings()
            if not settings.RERANKER_ENABLED:
                return None
            try:
                from sentence_transformers import CrossEncoder
                import logging
                logger = logging.getLogger(__name__)
                logger.info(f"Loading reranker model: {settings.RERANKER_MODEL}")
                self._reranker_model = CrossEncoder(settings.RERANKER_MODEL)
                logger.info("Reranker model loaded successfully")
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(f"Failed to load reranker model: {e}. Re-ranking disabled.")
                return None
        return self._reranker_model


def get_model_registry() -> ModelRegistry:
    """Get the singleton model registry."""
    return ModelRegistry()
