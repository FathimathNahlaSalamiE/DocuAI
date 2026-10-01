import os
from dotenv import load_dotenv
load_dotenv()
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
MODEL = "openai/gpt-oss-120b"
CHROMA_DIR = os.environ.get("CHROMA_DIR", "./chroma_db")
UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "./uploads")
EMBED_CACHE = os.environ.get("EMBED_CACHE", "./models")
CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",")