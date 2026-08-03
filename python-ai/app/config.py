import os
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
CHROMA_DIR = os.getenv("CHROMA_DIR", "./chroma_store")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
CHAT_MODEL = os.getenv("CHAT_MODEL", "llama-3.1-8b-instant")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")