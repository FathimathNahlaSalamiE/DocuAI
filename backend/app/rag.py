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
    pages = PyPDFLoader(path).load()          # metadata has source + page
    for p in pages:
        p.metadata["source"] = os.path.basename(path)
    chunks = [c for c in splitter.split_documents(pages) if c.page_content.strip()]
    if not chunks:
        raise ValueError("No text found. The PDF may be scanned (needs OCR).")
    store.add_documents(chunks)
    return len(chunks)

PROMPT = """Answer using ONLY the context below. If the answer is not in the context,
say "I couldn't find that in the documents." Be concise.

Context:
{context}

Question: {question}"""

def answer(question: str, k: int = 4):
    docs = store.similarity_search(question, k=k)
    if not docs:
        return {"answer": "No documents have been uploaded yet.", "sources": []}
    context = "\n\n".join(f"[{d.metadata['source']} p.{d.metadata.get('page', 0) + 1}] {d.page_content}" for d in docs)
    out = llm.invoke(PROMPT.format(context=context, question=question))
    sources = [{"file": d.metadata["source"], "page": d.metadata.get("page", 0) + 1} for d in docs]
    return {"answer": out.content, "sources": sources, "chunks": [d.page_content for d in docs]}