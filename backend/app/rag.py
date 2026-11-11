import os
import time

from langchain_chroma import Chroma
from langchain_community.document_loaders import PyPDFLoader
from langchain_community.embeddings import FastEmbedEmbeddings
from langchain_groq import ChatGroq
from langchain_text_splitters import RecursiveCharacterTextSplitter

from app import config

emb = FastEmbedEmbeddings(model_name="BAAI/bge-small-en-v1.5", cache_dir=config.EMBED_CACHE)
store = Chroma(collection_name="docs", embedding_function=emb, persist_directory=config.CHROMA_DIR)
llm = ChatGroq(model=config.MODEL, temperature=0.1, api_key=config.GROQ_API_KEY)
splitter = RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=150)


def _where(owner: str, sources: list[str] | None = None) -> dict:
    """Every query is restricted to this owner's chunks; optionally to specific files too."""
    if not sources:
        return {"owner": owner}
    file_filter = {"source": {"$in": sources}} if len(sources) > 1 else {"source": sources[0]}
    return {"$and": [{"owner": owner}, file_filter]}


def delete_source(filename: str, owner: str) -> int:
    """Remove every chunk of one file belonging to this owner."""
    got = store.get(where=_where(owner, [filename]), include=[])
    ids = got["ids"]
    if ids:
        store.delete(ids=ids)
    return len(ids)


def ingest_pdf(path: str, owner: str) -> int:
    pages = PyPDFLoader(path).load()
    filename = os.path.basename(path)
    now = int(time.time())
    for p in pages:
        p.metadata["source"] = filename
        p.metadata["owner"] = owner
        p.metadata["guest"] = 1 if owner.startswith("g:") else 0   # lets us purge guest data by age
        p.metadata["created"] = now
    chunks = [c for c in splitter.split_documents(pages) if c.page_content.strip()]
    if not chunks:
        raise ValueError("No text found. The PDF may be scanned (needs OCR).")
    # Re-uploading the same filename replaces its old chunks (no duplicates, no stale leftovers).
    delete_source(filename, owner)
    ids = [f"{owner}-{filename}-{i}" for i in range(len(chunks))]
    store.add_documents(chunks, ids=ids)
    return len(chunks)


def list_sources(owner: str) -> list[str]:
    """Distinct filenames this owner has indexed."""
    got = store.get(where={"owner": owner}, include=["metadatas"])
    return sorted({m["source"] for m in got["metadatas"] if m.get("source")})


def purge_guest_chunks(cutoff_epoch: int) -> int:
    """Delete guest chunks uploaded before `cutoff_epoch` (seconds since 1970)."""
    got = store.get(where={"$and": [{"guest": 1}, {"created": {"$lt": cutoff_epoch}}]}, include=[])
    ids = got["ids"]
    if ids:
        store.delete(ids=ids)
    return len(ids)


PROMPT = """Answer using ONLY the context below. If the answer is not in the context,
say "I couldn't find that in the documents." Be concise.

Context:
{context}

Question: {question}"""


def answer(question: str, owner: str, k: int = 4, sources: list[str] | None = None):
    """
    sources: None or [] -> search all of this owner's files; otherwise only the listed files.
    """
    docs = store.similarity_search(question, k=k, filter=_where(owner, sources))

    if not docs:
        msg = (
            f"No chunks found for {', '.join(sources)}. Check the filenames are correct."
            if sources
            else "You haven't uploaded any documents yet."
        )
        return {"answer": msg, "sources": []}

    context = "\n\n".join(
        f"[{d.metadata['source']} p.{d.metadata.get('page', 0) + 1}] {d.page_content}" for d in docs
    )
    out = llm.invoke(PROMPT.format(context=context, question=question))
    cited = [{"file": d.metadata["source"], "page": d.metadata.get("page", 0) + 1} for d in docs]
    return {"answer": out.content, "sources": cited, "chunks": [d.page_content for d in docs]}