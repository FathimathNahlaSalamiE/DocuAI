import os
import shutil
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from app import config, rag

os.makedirs(config.UPLOAD_DIR, exist_ok=True)
app = FastAPI(title="DocuAI")
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Query(BaseModel):
    question: str
    sources: list[str] | None = None  # restrict retrieval to these files; None/[] = search all


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/upload")
def upload(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are supported")
    path = os.path.join(config.UPLOAD_DIR, os.path.basename(file.filename))
    with open(path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    try:
        n = rag.ingest_pdf(path)
    except ValueError as e:
        raise HTTPException(422, str(e))
    return {"file": file.filename, "chunks": n}


@app.post("/ask")
def ask(q: Query):
    if not q.question.strip():
        raise HTTPException(400, "Empty question")
    try:
        return rag.answer(q.question, sources=q.sources)
    except Exception as e:
        raise HTTPException(503, f"LLM error (possibly rate limit): {e}")


@app.get("/documents")
def documents():
    """List every distinct filename currently indexed, for a document picker."""
    return {"files": rag.list_sources()}


@app.delete("/documents/{filename}")
def delete_document(filename: str):
    n = rag.delete_source(filename)
    if n == 0:
        raise HTTPException(404, f"No chunks found for '{filename}'")
    return {"file": filename, "chunks_deleted": n}


@app.post("/reset")
def reset():
    """Wipe every uploaded file. Useful before a clean demo, not a user-facing feature."""
    rag.clear_all()
    return {"status": "cleared"}