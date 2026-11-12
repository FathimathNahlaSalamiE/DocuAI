# DocuAI – Document Q&A with Retrieval-Augmented Generation

DocuAI is a full-stack web app that answers plain-English questions about PDFs you upload. It uses retrieval-augmented generation (RAG): the app finds the most relevant passages in your documents and asks a Groq-hosted LLM to answer **only** from those passages. Every answer comes with citations showing the file, page, and quoted text, and an in-app PDF viewer opens the cited page and highlights the passage. If the documents do not contain the answer, the app says so instead of guessing.

**Tech stack:** Python, FastAPI, LangChain, ChromaDB, FastEmbed (`BAAI/bge-small-en-v1.5`), Groq LLM, React 19, Vite, pdf.js, JWT, SQLite



## Features

- **Grounded answers.** The prompt restricts the model to retrieved context, and it replies "I couldn't find that in the documents." when the answer is not there.
- **Source citations.** Each answer lists the file, page number, and a short excerpt of every passage used.
- **In-app PDF viewer.** Click a citation to jump to the cited page and highlight the passage (pdf.js).
- **Multi-document search.** Search all your documents, or select specific files to search.
- **Saved chat history.** Conversations are stored and can be reopened or deleted.
- **Accounts.** Email sign-up with email verification, login with JWT sessions, bcrypt password hashing, and password-reset links that expire and work once.
- **Per-user data isolation.** Every vector search is filtered by owner, so users can only retrieve their own documents.
- **Guest mode.** Try the app without an account, with per-guest and global rate limits, upload size limits, a cap on documents, and automatic data cleanup after 24 hours.
- **Local embeddings.** Embeddings run locally with FastEmbed, so there is no embedding API cost. Only the final answer step calls the Groq API.

## Screenshots

<img width="1916" height="920" alt="Screenshot 2026-11-12 091834" src="https://github.com/user-attachments/assets/19754706-4daf-4e22-a111-93061e465a95" />

<img width="1910" height="920" alt="Screenshot 2026-11-12 091927" src="https://github.com/user-attachments/assets/2f495e68-4e83-4241-9838-c2a3ab3b534d" />

## How it works

1. **Ingest.** The PDF is read page by page (`pypdf`) and split into overlapping chunks of 800 characters (150-character overlap).
2. **Embed and store.** Each chunk is embedded locally with `bge-small-en-v1.5` and stored in ChromaDB with metadata: source file, page, owner, and creation time.
3. **Retrieve.** A question is embedded and the top 4 most similar chunks are retrieved, filtered to the signed-in user's (or guest's) documents and, optionally, to the selected files.
4. **Generate.** The chunks are passed to the LLM with a prompt that restricts answers to that context.
5. **Cite.** The response includes the file, page, and excerpt for each chunk, which the frontend uses for the source cards and PDF highlighting.

Re-uploading a file with the same name replaces its old chunks, so there are no duplicates.

## Project structure

```
DocuAI/
├── backend/
│   ├── app/
│   │   ├── main.py      # FastAPI routes, auth dependency, guest cleanup
│   │   ├── rag.py       # ingestion, retrieval, prompt, citations
│   │   ├── auth.py      # password hashing, JWT helpers
│   │   ├── db.py        # SQLAlchemy models (users, conversations, messages)
│   │   ├── mailer.py    # verification and reset emails (SMTP or dev-mode console)
│   │   ├── limits.py    # in-memory sliding-window rate limiter
│   │   └── config.py    # environment-based settings
│   ├── tests/
│   ├── requirements.txt
│   └── .env.example
└── frontend/            # React + Vite app
    └── src/             # App, Workspace, Authscreens, Pdfviewer, Ui
```

## Getting started

### Prerequisites

- Python 3.11 or newer (use the version you developed with)
- Node.js 20 or newer
- A free [Groq API key](https://console.groq.com/)

### 1. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # Windows: copy .env.example .env
```

Edit `.env` and set `GROQ_API_KEY` and `JWT_SECRET`. Generate a secret with:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

Start the API:

```bash
uvicorn app.main:app --reload
```

The API runs at `http://localhost:8000` (interactive docs at `/docs`). The first run downloads the embedding model into `./models`, so it takes a little longer.

### 2. Frontend

```bash
cd frontend
npm install
echo "VITE_API_URL=http://localhost:8000" > .env
npm run dev
```

Open `http://localhost:5173`.

### Email in development

If `SMTP_HOST` is empty, verification and password-reset emails are printed in the backend terminal instead of being sent, so you can copy the link from the console. To send real emails, set the `SMTP_*` variables to any SMTP provider.

## Configuration

Set these in `backend/.env`.

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `GROQ_API_KEY` | Yes | – | Groq API key for the LLM |
| `JWT_SECRET` | Yes | – | Secret used to sign session tokens |
| `CORS_ORIGINS` | No | `http://localhost:5173` | Comma-separated allowed frontend origins |
| `FRONTEND_URL` | No | `http://localhost:5173` | Base URL used in email links |
| `DATABASE_URL` | No | `sqlite:///./users.db` | User and chat database |
| `CHROMA_DIR` | No | `./chroma_db` | Vector store location |
| `UPLOAD_DIR` | No | `./uploads` | Uploaded PDFs location |
| `EMBED_CACHE` | No | `./models` | Embedding model cache |
| `TOKEN_HOURS` | No | `168` | Session length (7 days) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` | No | empty / `587` | Email delivery (dev mode when `SMTP_HOST` is empty) |
| `VERIFY_MINUTES` / `RESET_MINUTES` | No | `1440` / `30` | Verification and reset link lifetimes |
| `EMAIL_COOLDOWN_SECONDS` | No | `60` | Delay between emails per account |
| `USER_MAX_UPLOAD_MB` / `GUEST_MAX_UPLOAD_MB` | No | `25` / `10` | Upload size limits |
| `GUEST_MAX_DOCS` | No | `2` | Documents a guest can keep |
| `GUEST_TTL_HOURS` | No | `24` | Guest data is deleted after this long |
| `GUEST_ASKS_PER_HOUR` / `GUEST_ASKS_GLOBAL_PER_HOUR` | No | `20` / `200` | Question limits per guest and for all guests |
| `GUEST_UPLOADS_GLOBAL_PER_HOUR` | No | `60` | Upload limit for all guests combined |

## API endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/`, `/health` | Service status |
| POST | `/register` | Create an account and send a verification email |
| POST | `/verify-email` | Confirm an email address |
| POST | `/resend-verification` | Resend the verification email |
| POST | `/login` | Log in and receive a JWT |
| POST | `/forgot-password` | Request a password-reset email |
| POST | `/reset-password` | Set a new password with a reset token |
| GET | `/me` | Current user |
| POST | `/upload` | Upload and index a PDF |
| POST | `/ask` | Ask a question, optionally limited to selected files |
| GET | `/conversations` | List saved conversations |
| GET / DELETE | `/conversations/{id}` | Open or delete a conversation |
| GET | `/documents` | List your indexed documents |
| GET | `/documents/{filename}/file` | Download an uploaded PDF |
| DELETE | `/documents/{filename}` | Delete a document and its indexed chunks |

Guests send an `X-Guest-Id` header instead of a token.

## Security notes

- Passwords are hashed with bcrypt; sessions use signed JWTs.
- Verification and reset links expire, and reset links work only once.
- Vector searches are filtered by owner on every query.
- API keys and secrets are read from environment variables and never sent to the browser.
- The rate limiter is in memory and per process, which suits a single-instance deployment. A multi-instance setup would need a shared store such as Redis.

## Known limitations

- Scanned PDFs without a text layer are not supported (they need OCR).
- Only PDF files are supported.
- Answer quality has not yet been measured on a formal evaluation set.
- The LLM runs on Groq's free tier, so heavy use may hit its rate limits.

## Author

**Fathimath Nahla Salami E**
[GitHub](https://github.com/FathimathNahlaSalamiE) · [LinkedIn](https://linkedin.com/in/fathimathnahlasalamie) · [Portfolio](https://portfolio-fathimath-nahla-salami-e.vercel.app)
