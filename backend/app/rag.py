import os
from langchain_community.document_loaders import PyPDFLoader
from langchain_community.embeddings import FastEmbedEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from langchain_groq import ChatGroq
from app import config

emb = FastEmbedEmbeddings(model_name="BAAI/bge-small-en-v1.5", cache_dir=config.EMBED_CACHE)
store = Chroma(collection_name="docs", embedding_function=emb, persist_directory=config.CHROMA_DIR)
llm = ChatGroq(model=config.MODEL, temperature=0.1, api_key=config.GROQ_API_KEY)
splitter = RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=150)


def ingest_pdf(path: str) -> int:
    pages = PyPDFLoader(path).load()
    filename = os.path.basename(path)
    for p in pages:
        p.metadata["source"] = filename
    chunks = [c for c in splitter.split_documents(pages) if c.page_content.strip()]
    if not chunks:
        raise ValueError("No text found. The PDF may be scanned (needs OCR).")
    # stable, deterministic ids: re-uploading the same filename replaces its old chunks
    # instead of duplicating them alongside the new ones.
    ids = [f"{filename}-{i}" for i in range(len(chunks))]
    store.add_documents(chunks, ids=ids)
    return len(chunks)


def list_sources() -> list[str]:
    """Distinct filenames currently stored, for a document picker in the UI."""
    got = store.get(include=["metadatas"])
    return sorted({m["source"] for m in got["metadatas"] if m.get("source")})


def delete_source(filename: str) -> int:
    """Remove every chunk belonging to one uploaded file."""
    got = store.get(where={"source": filename}, include=[])
    ids = got["ids"]
    if ids:
        store.delete(ids=ids)
    return len(ids)


def clear_all() -> None:
    """Wipe every chunk from every file. Use sparingly (e.g. before a demo)."""
    got = store.get(include=[])
    if got["ids"]:
        store.delete(ids=got["ids"])


PROMPT = """Answer using ONLY the context below. If the answer is not in the context,
say "I couldn't find that in the documents." Be concise.

Context:
{context}

Question: {question}"""


def answer(question: str, k: int = 4, sources: list[str] | None = None):
    """
    sources: optional list of filenames to restrict retrieval to.
    - None or [] -> search across every uploaded file
    - [one file]  -> restrict to that file
    - [file1, file2, ...] -> restrict to any of those files (OR, via Chroma's $in)
    """
    if sources:
        filt = {"source": {"$in": sources}} if len(sources) > 1 else {"source": sources[0]}
    else:
        filt = None

    docs = store.similarity_search(question, k=k, filter=filt)

    if not docs:
        msg = (
            f"No chunks found for {', '.join(sources)}. Check the filenames are correct."
            if sources else
            "No documents have been uploaded yet."
        )
        return {"answer": msg, "sources": []}

    context = "\n\n".join(
        f"[{d.metadata['source']} p.{d.metadata.get('page', 0) + 1}] {d.page_content}"
        for d in docs
    )
    out = llm.invoke(PROMPT.format(context=context, question=question))
    sources = [
        {"file": d.metadata["source"], "page": d.metadata.get("page", 0) + 1}
        for d in docs
    ]
    return {"answer": out.content, "sources": sources, "chunks": [d.page_content for d in docs]}