import { useState, useEffect, useRef } from "react";
import { errorText } from "./AuthScreens";
import PdfViewer from "./PdfViewer";
import {
  Wordmark, LogoMark, FileIcon, PlusIcon, ClipIcon, SendIcon,
  SignOutIcon, MenuIcon, CopyIcon, UploadIcon,
} from "./ui";

const SUGGESTIONS = [
  "Summarise this document",
  "What are the key dates and deadlines?",
  "List the main points",
];

/* ---------- tiny, safe markdown: **bold**, `code`, lists, paragraphs ---------- */

function inline(text, key) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) => {
    if (p.length > 4 && p.startsWith("**") && p.endsWith("**")) return <strong key={`${key}-${i}`}>{p.slice(2, -2)}</strong>;
    if (p.length > 2 && p.startsWith("`") && p.endsWith("`")) return <code key={`${key}-${i}`}>{p.slice(1, -1)}</code>;
    return p;
  });
}

function Markdown({ text }) {
  const blocks = String(text || "").trim().split(/\n{2,}/);
  return blocks.map((block, i) => {
    const lines = block.split("\n");
    if (lines.every(l => /^\s*[-*•]\s+/.test(l))) {
      return <ul key={i}>{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*[-*•]\s+/, ""), `${i}-${j}`)}</li>)}</ul>;
    }
    if (lines.every(l => /^\s*\d+[.)]\s+/.test(l))) {
      return <ol key={i}>{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*\d+[.)]\s+/, ""), `${i}-${j}`)}</li>)}</ol>;
    }
    const heading = lines.length === 1 && /^#{1,6}\s+(.*)$/.exec(lines[0]);
    if (heading) return <p key={i}><strong>{heading[1]}</strong></p>;
    return (
      <p key={i}>
        {lines.map((l, j) => (
          <span key={j}>{j > 0 && <br />}{inline(l, `${i}-${j}`)}</span>
        ))}
      </p>
    );
  });
}

/* ---------- source cards: file, page and the exact passage ---------- */

function Sources({ sources, onOpen }) {
  const seen = new Set();
  const cards = [];
  for (const s of sources || []) {
    const k = `${s.file}|${s.page}`;
    if (seen.has(k)) continue;
    seen.add(k);
    cards.push(s);
  }
  if (!cards.length) return null;
  return (
    <div>
      <p className="sources-label">Where this came from</p>
      <div className="cites">
        {cards.map(s => (
          <button
            className="cite"
            key={`${s.file}|${s.page}`}
            onClick={() => onOpen(s.file, s.page, s.snippet || "")}
            title="Open this page in the document"
          >
            <span className="cite-head">
              <span className="cite-file"><FileIcon size={16} /><span>{s.file}</span></span>
              <span className="badge">Page {s.page}</span>
            </span>
            {s.snippet && <span className="cite-snip">“{s.snippet}”</span>}
            <span className="cite-go">View page {s.page} →</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- first-time and empty states ---------- */

function Welcome({ hasDocs, uploading, onBrowse }) {
  if (hasDocs) {
    return (
      <div className="welcome">
        <LogoMark size={52} />
        <h2>What would you like to know?</h2>
        <p>Ask in your own words. You’ll see exactly where each answer came from.</p>
      </div>
    );
  }
  return (
    <div className="welcome">
      <div className="big-drop">
        <span className="big-ic"><UploadIcon size={28} /></span>
        <h2>Drop a PDF to get started</h2>
        <p>Your document stays private to you. Then ask anything about it in plain English.</p>
        <button className="btn-primary" onClick={onBrowse} disabled={uploading}>
          {uploading ? "Reading your document…" : "Choose a PDF"}
        </button>
      </div>
      <ol className="steps">
        <li><span className="n">1</span><b>Upload</b>Add one or more PDFs.</li>
        <li><span className="n">2</span><b>Ask</b>Type a question like you would to a person.</li>
        <li><span className="n">3</span><b>Check</b>See the exact page behind every answer.</li>
      </ol>
    </div>
  );
}

/* ---------- history grouped as Today / Yesterday / Earlier ---------- */

function groupConvs(convs) {
  const day = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = day(new Date());
  const groups = { Today: [], Yesterday: [], Earlier: [] };
  for (const c of convs) {
    const t = c.updated_at ? day(new Date(c.updated_at)) : today;
    const diff = Math.round((today - t) / 86400000);
    (diff <= 0 ? groups.Today : diff === 1 ? groups.Yesterday : groups.Earlier).push(c);
  }
  return Object.entries(groups).filter(([, list]) => list.length);
}

const hasFiles = e => [...(e.dataTransfer?.types || [])].includes("Files");

/* ---------- the workspace ---------- */

// `email` is empty for guests. `api` already attaches the right identity (login token or guest id).
export default function Workspace({ api, email, onLogout, onSignIn }) {
  const isGuest = !email;

  const [msgs, setMsgs] = useState([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [uploading, setUploading] = useState(false);
  const [docs, setDocs] = useState([]);
  const [selected, setSelected] = useState([]); // filenames in scope; [] = search all
  const [convs, setConvs] = useState([]);
  const [activeId, setActiveId] = useState(null); // open conversation, null = a fresh chat
  const [loadingConv, setLoadingConv] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [navOpen, setNavOpen] = useState(false); // sidebar drawer on phones
  const [copied, setCopied] = useState(-1);
  const [viewer, setViewer] = useState(null); // { file, page, snippet, navKey } while a PDF is open
  const fileInputRef = useRef(null);
  const threadEndRef = useRef(null);
  const dragDepth = useRef(0);

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
    threadEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, busy]);

  /* ----- chat history ----- */

  function newChat() {
    if (busy) return;
    setActiveId(null);
    setMsgs([]);
    setNavOpen(false);
  }

  async function openConv(id) {
    if (busy || id === activeId) return setNavOpen(false);
    setLoadingConv(true);
    try {
      const r = await api(`/conversations/${id}`);
      if (!r.ok) {
        // gone (deleted, or a guest chat that expired): refresh the list instead of failing silently
        setStatus(errorText(await r.json().catch(() => null), "Couldn’t open that chat."));
        loadConvs();
        return;
      }
      const d = await r.json();
      setMsgs(d.messages || []);
      setActiveId(id);
      setNavOpen(false);
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
      setStatus("Couldn’t delete that chat. Check the backend is running.");
    }
  }

  /* ----- documents ----- */

  async function uploadMany(fileList) {
    const files = [...(fileList || [])]; // copy now: the input is cleared right after this call
    if (!files.length) return;
    setUploading(true);
    for (const file of files) {
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        setStatus(`${file.name}: only PDF files are supported.`);
        continue;
      }
      setStatus(`Reading ${file.name}…`);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const r = await api("/upload", { method: "POST", body: fd });
        const d = await r.json().catch(() => null);
        if (r.ok) {
          setStatus(`${d.file} is ready.`);
          setSelected(s => (s.includes(d.file) ? s : [...s, d.file]));
          await loadDocs();
        } else {
          setStatus(errorText(d));
        }
      } catch {
        setStatus("Server unreachable. Check the backend is running.");
      }
    }
    setUploading(false);
  }

  async function removeDoc(filename) {
    try {
      await api(`/documents/${encodeURIComponent(filename)}`, { method: "DELETE" });
      setSelected(s => s.filter(f => f !== filename));
      setViewer(v => (v && v.file === filename ? null : v));
      loadDocs();
    } catch {
      setStatus("Couldn’t remove that file. Check the backend is running.");
    }
  }

  function toggleDoc(filename) {
    setSelected(s => (s.includes(filename) ? s.filter(f => f !== filename) : [...s, filename]));
  }

  /* ----- reading a document ----- */

  // navKey changes on every call, so clicking the same citation twice still scrolls and highlights again
  function openViewer(file, page = 1, snippet = "") {
    setViewer({ file, page, snippet, navKey: Date.now() });
    setNavOpen(false);
  }

  /* ----- asking ----- */

  async function ask(text) {
    const question = (text ?? q).trim();
    if (!question || busy) return;
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
      setMsgs(m => [...m, { role: "ai", text: "Can’t reach the server.", error: true }]);
    }
    setBusy(false);
  }

  async function copyText(i, text) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(i);
      setTimeout(() => setCopied(c => (c === i ? -1 : c)), 1600);
    } catch {
      /* clipboard blocked by the browser: nothing to do */
    }
  }

  /* ----- drag a PDF anywhere on the page ----- */

  const dragHandlers = {
    onDragEnter: e => { if (hasFiles(e)) { dragDepth.current += 1; setDragOver(true); } },
    onDragLeave: () => {
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragOver(false);
    },
    onDragOver: e => e.preventDefault(),
    onDrop: e => {
      e.preventDefault();
      dragDepth.current = 0;
      setDragOver(false);
      uploadMany(e.dataTransfer.files);
    },
  };

  /* ----- what to show in the header ----- */

  const convTitle = convs.find(c => c.id === activeId)?.title || "New chat";
  const scopeText =
    selected.length === 0
      ? docs.length > 1 ? "Asking about all your documents" : "Asking about your documents"
      : selected.length === 1 ? `Asking about ${selected[0]}` : `Asking about ${selected.length} documents`;
  const pills = selected.slice(0, 2);
  const grouped = groupConvs(convs);

  return (
    <div className="shell" {...dragHandlers}>
      {dragOver && <div className="drop">Drop your PDF to add it</div>}
      {navOpen && <button className="scrim" aria-label="Close menu" onClick={() => setNavOpen(false)} />}

      <aside className={`side${navOpen ? " open" : ""}`}>
        <div className="side-top">
          <Wordmark />
          <button className="new-chat" onClick={newChat} disabled={busy}>
            <PlusIcon size={16} /> New chat
          </button>
        </div>

        <div className="side-mid">
          <div>
            <div className="lbl-row">
              <p className="lbl" style={{ margin: "0 0 6px 8px" }}>Your documents</p>
              {docs.length > 0 && (
                <button className="clear" onClick={() => setSelected([])} disabled={selected.length === 0}>
                  Clear
                </button>
              )}
            </div>
            {docs.length === 0 ? (
              <p className="empty-side">No documents yet.</p>
            ) : (
              <>
                <p className="side-hint">Tick a box to ask about a file (none ticked means all). Click a name to read it.</p>
                {docs.map(f => {
                  const on = selected.includes(f);
                  return (
                    <div className={`rw doc${viewer?.file === f ? " viewing" : ""}`} key={f}>
                      <button
                        className="ckb"
                        onClick={() => toggleDoc(f)}
                        aria-pressed={on}
                        aria-label={`Ask about ${f}`}
                        title="Include in my questions"
                      >
                        <i className={`ck${on ? " yes" : ""}`} aria-hidden="true" />
                      </button>
                      <button className="nm" onClick={() => openViewer(f)} title={`Open ${f}`}>{f}</button>
                      <button className="rx" onClick={() => removeDoc(f)} aria-label={`Remove ${f}`}>×</button>
                    </div>
                  );
                })}
              </>
            )}
            <button className="add-doc" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              Drop a PDF here or <u>browse</u>
            </button>
            {status && (
              <p className="status" role="status">
                {uploading && <span className="spin" />}
                <span>{status}</span>
              </p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              multiple
              hidden
              onChange={e => { uploadMany(e.target.files); e.target.value = ""; }}
            />
          </div>

          <div>
            {convs.length === 0 && (
              <>
                <p className="lbl">History</p>
                <p className="empty-side">Your chats will show up here.</p>
              </>
            )}
            {grouped.map(([label, list]) => (
              <div key={label} style={{ marginBottom: 14 }}>
                <p className="lbl">{label}</p>
                {list.map(c => (
                  <div className="rw" key={c.id}>
                    <button
                      className={`row${c.id === activeId ? " on" : ""}`}
                      onClick={() => openConv(c.id)}
                      aria-current={c.id === activeId ? "true" : undefined}
                    >
                      <span className="t" title={c.title}>{c.title}</span>
                    </button>
                    <button className="rx" onClick={() => removeConv(c.id)} aria-label={`Delete chat: ${c.title}`}>×</button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="account">
          {isGuest ? (
            <>
              <span className="avatar" aria-hidden="true">G</span>
              <span className="who-am-i">Guest<small>Chats are kept for 24 hours</small></span>
              <button className="sign-in-btn" onClick={onSignIn}>Sign in</button>
            </>
          ) : (
            <>
              <span className="avatar" aria-hidden="true">{email[0].toUpperCase()}</span>
              <span className="who-am-i" title={email}>{email}</span>
              <button className="out-btn" onClick={onLogout} aria-label="Sign out" title="Sign out">
                <SignOutIcon size={18} />
              </button>
            </>
          )}
        </div>
      </aside>

      <main className="chat">
        {isGuest && (
          <div className="guest">
            You’re using DocuAI as a guest. Documents and chats are deleted after 24 hours.{" "}
            <button className="lnk" onClick={onSignIn}>Sign in</button> to keep them.
          </div>
        )}

        <header className="top">
          <button className="menu-btn" onClick={() => setNavOpen(true)} aria-label="Open menu">
            <MenuIcon size={20} />
          </button>
          <div className="titles">
            <h1>{convTitle}</h1>
            <p>{scopeText}</p>
          </div>
          <div className="pills">
            {pills.map(f => <span className="pill" key={f} title={f}>{f}</span>)}
            {selected.length > 2 && <span className="pill">+{selected.length - 2} more</span>}
          </div>
        </header>

        <div className="thread">
          {loadingConv ? (
            <p className="muted-center">Opening chat…</p>
          ) : msgs.length === 0 ? (
            <Welcome
              hasDocs={docs.length > 0}
              uploading={uploading}
              onBrowse={() => fileInputRef.current?.click()}
            />
          ) : (
            <div className="col">
              {msgs.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="msg-user">{m.text}</div>
                ) : (
                  <div key={i} className="msg-ai">
                    <LogoMark size={34} />
                    <div className="body">
                      <p className="who">DocuAI</p>
                      {m.error ? (
                        <p className="err">{m.text}</p>
                      ) : (
                        <>
                          <div className="md"><Markdown text={m.text} /></div>
                          <Sources sources={m.sources} onOpen={openViewer} />
                          <button className="copy" onClick={() => copyText(i, m.text)}>
                            <CopyIcon size={14} /> {copied === i ? "Copied" : "Copy"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )
              )}
              {busy && (
                <div className="msg-ai">
                  <LogoMark size={34} />
                  <div className="body"><div className="dots" aria-label="DocuAI is thinking"><i /><i /><i /></div></div>
                </div>
              )}
              <div ref={threadEndRef} />
            </div>
          )}
        </div>

        <div className="dock">
          <div className="dock-in">
            {docs.length > 0 && (
              <div className="chips">
                {SUGGESTIONS.map(s => (
                  <button key={s} className="chip" onClick={() => ask(s)} disabled={busy}>{s}</button>
                ))}
              </div>
            )}
            <div className="box">
              <button className="icon-btn" onClick={() => fileInputRef.current?.click()} aria-label="Upload a PDF" title="Upload a PDF">
                <ClipIcon size={20} />
              </button>
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.nativeEvent.isComposing && ask()}
                placeholder="Ask anything about your documents…"
                aria-label="Ask a question"
              />
              <button className="send" onClick={() => ask()} disabled={busy || !q.trim()} aria-label="Send">
                <SendIcon size={20} />
              </button>
            </div>
            <p className="fine">Answers come only from your documents, and every answer shows its source.</p>
          </div>
        </div>
      </main>

      {viewer && (
        <PdfViewer
          api={api}
          file={viewer.file}
          page={viewer.page}
          snippet={viewer.snippet}
          navKey={viewer.navKey}
          onClose={() => setViewer(null)}
        />
      )}
    </div>
  );
}