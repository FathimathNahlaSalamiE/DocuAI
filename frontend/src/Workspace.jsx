import { useState, useEffect, useRef } from "react";
import { errorText } from "./AuthScreens";

// `email` is empty for guests. `api` already attaches the right identity (login token or guest id).
export default function Workspace({ api, email, onLogout, onSignIn }) {
  const isGuest = !email;

  const [msgs, setMsgs] = useState([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [docs, setDocs] = useState([]);
  const [selected, setSelected] = useState([]); // filenames in scope; [] = search all
  const [convs, setConvs] = useState([]); // chat history list
  const [activeId, setActiveId] = useState(null); // open conversation, null = a fresh chat
  const [loadingConv, setLoadingConv] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const threadEndRef = useRef(null);

  async function loadDocs() {
    try {
      const r = await api("/documents");
      if (!r.ok) return;
      const d = await r.json();
      setDocs(d.files || []);
    } catch {
      /* list just stays empty */
    }
  }

  async function loadConvs() {
    try {
      const r = await api("/conversations");
      if (!r.ok) return;
      const d = await r.json();
      setConvs(d.conversations || []);
    } catch {
      /* list just stays empty */
    }
  }

  useEffect(() => {
    loadDocs();
    loadConvs();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, busy]);

  /* ---------- chat history ---------- */

  function newChat() {
    if (busy) return;
    setActiveId(null);
    setMsgs([]);
  }

  async function openConv(id) {
    if (busy || id === activeId) return;
    setLoadingConv(true);
    try {
      const r = await api(`/conversations/${id}`);
      if (!r.ok) {
        // gone (deleted, or a guest chat that expired): refresh the list instead of failing silently
        setStatus(errorText(await r.json().catch(() => null), "Couldn't open that chat."));
        loadConvs();
        return;
      }
      const d = await r.json();
      setMsgs(d.messages || []);
      setActiveId(id);
    } catch {
      setStatus("Server unreachable. Check the backend is running.");
    } finally {
      setLoadingConv(false);
    }
  }

  async function removeConv(id) {
    try {
      await api(`/conversations/${id}`, { method: "DELETE" });
      if (id === activeId) {
        setActiveId(null);
        setMsgs([]);
      }
      loadConvs();
    } catch {
      setStatus("Couldn't delete that chat — check the backend is running.");
    }
  }

  /* ---------- documents ---------- */

  async function doUpload(file) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setStatus("Only PDF files are supported.");
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    setStatus(`Indexing ${file.name}…`);
    try {
      const r = await api("/upload", { method: "POST", body: fd });
      const d = await r.json().catch(() => null);
      if (r.ok) {
        setStatus(`Indexed ${d.file} — ${d.chunks} chunks`);
        setSelected(s => (s.includes(d.file) ? s : [...s, d.file]));
        loadDocs();
      } else {
        setStatus(errorText(d));
      }
    } catch {
      setStatus("Server unreachable. Check the backend is running.");
    }
  }

  async function removeDoc(filename) {
    try {
      await api(`/documents/${encodeURIComponent(filename)}`, { method: "DELETE" });
      setSelected(s => s.filter(f => f !== filename));
      loadDocs();
    } catch {
      setStatus("Couldn't remove — check the backend is running.");
    }
  }

  function toggleDoc(filename) {
    setSelected(s => (s.includes(filename) ? s.filter(f => f !== filename) : [...s, filename]));
  }

  /* ---------- asking ---------- */

  async function ask() {
    if (!q.trim() || busy) return;
    const question = q;
    setMsgs(m => [...m, { role: "user", text: question }]);
    setQ("");
    setBusy(true);
    try {
      const r = await api("/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          sources: selected.length ? selected : null,
          conversation_id: activeId,
        }),
      });
      const d = await r.json().catch(() => null);
      if (r.ok) {
        setMsgs(m => [...m, { role: "ai", text: d.answer, sources: d.sources }]);
        if (d.conversation_id !== activeId) setActiveId(d.conversation_id);
        loadConvs();
      } else {
        setMsgs(m => [...m, { role: "ai", text: errorText(d), error: true }]);
      }
    } catch {
      setMsgs(m => [...m, { role: "ai", text: "Server unreachable.", error: true }]);
    }
    setBusy(false);
  }

  return (
    <div className="shell">
      <aside className="rail">
        <div className="brand">
          <span className="brand-mark">Docu</span>
          <span className="brand-mark brand-mark-accent">AI</span>
        </div>

        <button className="new-chat" onClick={newChat} disabled={busy}>
          + New chat
        </button>

        <div
          className={`dropzone${dragOver ? " dropzone-active" : ""}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => {
            e.preventDefault();
            setDragOver(false);
            doUpload(e.dataTransfer.files[0]);
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M12 16V4M12 4l-4 4M12 4l4 4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>Drop a PDF, or click to choose</span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            hidden
            onChange={e => { doUpload(e.target.files[0]); e.target.value = ""; }}
          />
        </div>
        {status && <p className="status">{status}</p>}

        <div className="doc-section">
          <div className="doc-section-head">
            <h3>Documents</h3>
            {docs.length > 0 && (
              <button className="doc-clear" onClick={() => setSelected([])} disabled={selected.length === 0}>
                Clear
              </button>
            )}
          </div>
          {docs.length === 0 ? (
            <p className="empty">Nothing uploaded yet.</p>
          ) : (
            <ul className="doc-list">
              {docs.map(f => {
                const checked = selected.includes(f);
                return (
                  <li
                    key={f}
                    className={`doc-item${checked ? " doc-item-active" : ""}`}
                    onClick={() => toggleDoc(f)}
                  >
                    <span className="doc-check" aria-hidden="true">{checked ? "✓" : ""}</span>
                    <span className="doc-name" title={f}>{f}</span>
                    <button
                      className="doc-remove"
                      onClick={e => { e.stopPropagation(); removeDoc(f); }}
                      aria-label={`Remove ${f}`}
                    >
                      ×
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="doc-section">
          <div className="doc-section-head">
            <h3>History</h3>
          </div>
          {convs.length === 0 ? (
            <p className="empty">Your chats will show up here.</p>
          ) : (
            <ul className="doc-list">
              {convs.map(c => (
                <li
                  key={c.id}
                  className={`doc-item${c.id === activeId ? " doc-item-active" : ""}`}
                  onClick={() => openConv(c.id)}
                >
                  <span className="doc-name" title={c.title}>{c.title}</span>
                  <button
                    className="doc-remove"
                    onClick={e => { e.stopPropagation(); removeConv(c.id); }}
                    aria-label={`Delete chat: ${c.title}`}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="account">
          {isGuest ? (
            <>
              <span className="account-email">Guest</span>
              <button className="link-btn" onClick={onSignIn}>Sign in</button>
            </>
          ) : (
            <>
              <span className="account-email" title={email}>{email}</span>
              <button className="link-btn" onClick={onLogout}>Sign out</button>
            </>
          )}
        </div>
      </aside>

      <main className="chat">
        {isGuest && (
          <div className="guest-banner">
            You're using DocuAI as a guest. Documents and chats are deleted after 24 hours.{" "}
            <button className="link-btn" onClick={onSignIn}>Sign in</button> to keep them.
          </div>
        )}

        <div className="scope-bar">
          Asking about{" "}
          <strong>
            {selected.length === 0
              ? "all your documents"
              : selected.length === 1
              ? selected[0]
              : `${selected.length} selected documents`}
          </strong>
        </div>

        <div className="thread">
          {loadingConv && <p className="empty">Loading chat…</p>}
          {!loadingConv && msgs.length === 0 && (
            <div className="welcome">
              <p>Upload a document on the left, then ask a question here.</p>
              <p className="welcome-sub">
                Answers are drawn only from what you upload, with sources cited below each reply.
              </p>
            </div>
          )}
          {!loadingConv &&
            msgs.map((m, i) => (
              <div key={i} className={`bubble-row ${m.role === "user" ? "row-user" : "row-ai"}`}>
                <div className={`bubble ${m.role === "user" ? "bubble-user" : "bubble-ai"}${m.error ? " bubble-error" : ""}`}>
                  {m.text}
                  {m.sources && m.sources.length > 0 && (
                    <div className="sources">
                      {[...new Set(m.sources.map(s => `${s.file} · p.${s.page}`))].map((s, j) => (
                        <span key={j} className="source-chip">{s}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          {busy && (
            <div className="bubble-row row-ai">
              <div className="bubble bubble-ai bubble-thinking">
                <span className="dot" /><span className="dot" /><span className="dot" />
              </div>
            </div>
          )}
          <div ref={threadEndRef} />
        </div>

        <div className="composer">
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.key === "Enter" && ask()}
            placeholder="Ask about your documents…"
          />
          <button onClick={ask} disabled={busy || !q.trim()}>Ask</button>
        </div>
      </main>
    </div>
  );
}