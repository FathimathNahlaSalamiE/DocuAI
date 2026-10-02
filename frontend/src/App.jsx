import { useState, useEffect, useRef } from "react";

const API = import.meta.env.VITE_API_URL;

export default function App() {
  const [msgs, setMsgs] = useState([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [docs, setDocs] = useState([]);
  const [selected, setSelected] = useState([]); // filenames in scope; [] = search all
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const threadEndRef = useRef(null);

  async function loadDocs() {
    try {
      const r = await fetch(`${API}/documents`);
      const d = await r.json();
      setDocs(d.files || []);
    } catch {
      /* list just stays empty */
    }
  }

  useEffect(() => { loadDocs(); }, []);
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, busy]);

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
      const r = await fetch(`${API}/upload`, { method: "POST", body: fd });
      const d = await r.json();
      if (r.ok) {
        setStatus(`Indexed ${d.file} — ${d.chunks} chunks`);
        setSelected(s => [...s, d.file]); // newly uploaded file joins the active scope
        loadDocs();
      } else {
        setStatus(d.detail);
      }
    } catch {
      setStatus("Server unreachable. Check the backend is running.");
    }
  }

  async function removeDoc(filename) {
    try {
      await fetch(`${API}/documents/${encodeURIComponent(filename)}`, { method: "DELETE" });
      setSelected(s => s.filter(f => f !== filename));
      loadDocs();
    } catch {
      setStatus("Couldn't remove — check the backend is running.");
    }
  }

  function toggleDoc(filename) {
    setSelected(s =>
      s.includes(filename) ? s.filter(f => f !== filename) : [...s, filename]
    );
  }

  async function ask() {
    if (!q.trim() || busy) return;
    const question = q;
    setMsgs(m => [...m, { role: "user", text: question }]);
    setQ("");
    setBusy(true);
    try {
      const r = await fetch(`${API}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, sources: selected.length ? selected : null }),
      });
      const d = await r.json();
      setMsgs(m => [
        ...m,
        r.ok
          ? { role: "ai", text: d.answer, sources: d.sources }
          : { role: "ai", text: d.detail || "Something went wrong.", error: true },
      ]);
    } catch {
      setMsgs(m => [...m, { role: "ai", text: "Server unreachable.", error: true }]);
    }
    setBusy(false);
  }

  return (
    <div className="shell">
      <style>{css}</style>

      <aside className="rail">
        <div className="brand">
          <span className="brand-mark">Docu</span>
          <span className="brand-mark brand-mark-accent">AI</span>
        </div>

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
            onChange={e => doUpload(e.target.files[0])}
          />
        </div>
        {status && <p className="status">{status}</p>}

        <div className="doc-section">
          <div className="doc-section-head">
            <h3>Documents</h3>
            {docs.length > 0 && (
              <button
                className="doc-clear"
                onClick={() => setSelected([])}
                disabled={selected.length === 0}
              >
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
      </aside>

      <main className="chat">
        <div className="scope-bar">
          Asking about{" "}
          <strong>
            {selected.length === 0
              ? "all uploaded documents"
              : selected.length === 1
              ? selected[0]
              : `${selected.length} selected documents`}
          </strong>
        </div>

        <div className="thread">
          {msgs.length === 0 && (
            <div className="welcome">
              <p>Upload a document on the left, then ask a question here.</p>
              <p className="welcome-sub">Answers are drawn only from what you upload, with sources cited below each reply.</p>
            </div>
          )}
          {msgs.map((m, i) => (
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

const css = `
@import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@500;600&family=Inter:wght@400;500;600&display=swap');

:root {
  --paper: #FAFAF8;
  --ink: #1C1B1A;
  --ink-soft: #5B5752;
  --pine: #2F5D50;
  --pine-dark: #234840;
  --tint: #E4E0D8;
  --amber: #8A6D3B;
  --amber-bg: #F3ECDD;
  --error: #9A3B3B;
}

* { box-sizing: border-box; }

body { margin: 0; }

.shell {
  display: flex;
  height: 100vh;
  background: var(--paper);
  color: var(--ink);
  font-family: 'Inter', sans-serif;
}

.rail {
  width: 280px;
  flex-shrink: 0;
  background: #F2F0EA;
  border-right: 1px solid var(--tint);
  padding: 28px 20px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  overflow-y: auto;
}

.brand {
  font-family: 'Source Serif 4', serif;
  font-size: 22px;
  font-weight: 600;
}
.brand-mark-accent { color: var(--pine); }

.dropzone {
  border: 1.5px dashed #B9B3A6;
  border-radius: 10px;
  padding: 18px 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
  font-size: 13px;
  color: var(--ink-soft);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.dropzone:hover, .dropzone-active {
  border-color: var(--pine);
  background: #EEF2F0;
  color: var(--pine-dark);
}

.status {
  font-size: 12.5px;
  color: var(--ink-soft);
  margin: -8px 0 0;
  line-height: 1.4;
}

.doc-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 0 10px;
}
.doc-section-head h3 {
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--ink-soft);
  margin: 0;
}
.doc-clear {
  background: none;
  border: none;
  font-size: 11.5px;
  color: var(--pine);
  cursor: pointer;
  padding: 0;
}
.doc-clear:disabled { color: var(--ink-soft); opacity: 0.5; cursor: default; }

.doc-check {
  width: 14px;
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 700;
}

.empty { font-size: 13px; color: var(--ink-soft); margin: 0; }

.doc-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }

.doc-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 7px;
  font-size: 13.5px;
  cursor: pointer;
  color: var(--ink);
}
.doc-item:hover { background: var(--tint); }
.doc-item-active { background: var(--pine); color: #fff; }
.doc-item-active:hover { background: var(--pine-dark); }

.doc-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.doc-remove {
  background: none;
  border: none;
  color: inherit;
  opacity: 0.6;
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
  padding: 0 2px;
}
.doc-remove:hover { opacity: 1; }

.chat {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.scope-bar {
  padding: 14px 28px;
  font-size: 13px;
  color: var(--ink-soft);
  border-bottom: 1px solid var(--tint);
}
.scope-bar strong { color: var(--ink); font-weight: 600; }

.thread {
  flex: 1;
  overflow-y: auto;
  padding: 24px 28px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.welcome {
  margin: auto;
  text-align: center;
  max-width: 360px;
  color: var(--ink-soft);
}
.welcome p { margin: 0 0 8px; font-size: 15px; }
.welcome-sub { font-size: 13px; }

.bubble-row { display: flex; }
.row-user { justify-content: flex-end; }
.row-ai { justify-content: flex-start; }

.bubble {
  max-width: 72%;
  padding: 11px 15px;
  border-radius: 12px;
  font-size: 14.5px;
  line-height: 1.55;
}
.bubble-user { background: var(--pine); color: #fff; border-bottom-right-radius: 3px; }
.bubble-ai { background: #F2F0EA; color: var(--ink); border-bottom-left-radius: 3px; }
.bubble-error { background: #F7EAEA; color: var(--error); }

.bubble-thinking { display: flex; gap: 4px; align-items: center; padding: 14px 16px; }
.dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--ink-soft);
  animation: pulse 1.1s infinite ease-in-out;
}
.dot:nth-child(2) { animation-delay: 0.15s; }
.dot:nth-child(3) { animation-delay: 0.3s; }
@keyframes pulse { 0%, 80%, 100% { opacity: 0.25; } 40% { opacity: 1; } }

.sources {
  margin-top: 9px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.source-chip {
  background: var(--amber-bg);
  color: var(--amber);
  font-size: 11.5px;
  font-weight: 500;
  padding: 3px 8px;
  border-radius: 999px;
  white-space: nowrap;
}

.composer {
  display: flex;
  gap: 10px;
  padding: 16px 28px 22px;
  border-top: 1px solid var(--tint);
}
.composer input {
  flex: 1;
  padding: 11px 14px;
  border: 1px solid var(--tint);
  border-radius: 9px;
  font-size: 14px;
  font-family: inherit;
  background: #fff;
  color: var(--ink);
}
.composer input:focus {
  outline: 2px solid var(--pine);
  outline-offset: 1px;
  border-color: transparent;
}
.composer button {
  padding: 0 20px;
  border: none;
  border-radius: 9px;
  background: var(--pine);
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}
.composer button:hover:not(:disabled) { background: var(--pine-dark); }
.composer button:disabled { opacity: 0.4; cursor: not-allowed; }

@media (max-width: 720px) {
  .shell { flex-direction: column; }
  .rail { width: 100%; height: auto; border-right: none; border-bottom: 1px solid var(--tint); }
}
`;