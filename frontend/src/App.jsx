import { useState, useEffect, useCallback } from "react";
import { API, AuthScreen, VerifyScreen, ResetScreen } from "./AuthScreens";
import Workspace from "./Workspace";

const TOKEN_KEY = "docuai_token";
const GUEST_KEY = "docuai_guest";

// A random, unguessable id that identifies this browser as a guest. It acts like a password for the
// guest's own documents and chats, so it must come from crypto.getRandomValues (never Math.random).
function newGuestId() {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; // UUID v4 layout; the backend checks this exact format
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map(x => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function loadGuestId() {
  let id = localStorage.getItem(GUEST_KEY);
  if (!id) {
    id = newGuestId();
    localStorage.setItem(GUEST_KEY, id);
  }
  return id;
}

/* ------------------------------ App (auth gate) ------------------------------ */

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [email, setEmail] = useState("");
  const [guestId] = useState(loadGuestId);
  const [showAuth, setShowAuth] = useState(false); // the sign-in page, opened from guest mode
  const [bootError, setBootError] = useState("");
  const [retry, setRetry] = useState(0);
  const [notice, setNotice] = useState(""); // e.g. "Password updated" shown on the sign-in screen

  // Links in emails open this page as /?verify=TOKEN or /?reset=TOKEN
  const [urlAction, setUrlAction] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("verify")) return { type: "verify", token: p.get("verify") };
    if (p.get("reset")) return { type: "reset", token: p.get("reset") };
    return null;
  });

  function finishUrlAction() {
    window.history.replaceState({}, "", window.location.pathname); // remove the token from the address bar
    setUrlAction(null);
  }

  // Signing out drops back to guest mode rather than a locked screen.
  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setEmail("");
    setBootError("");
  }, []);

  function handleAuth(newToken, newEmail) {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    setEmail(newEmail);
    setBootError("");
    setShowAuth(false);
    setNotice("");
  }

  // fetch wrapper: sends the login token if there is one, otherwise the guest id.
  // A rejected login token signs the user out; guests never get a 401.
  const api = useCallback(
    async (path, opts = {}) => {
      const headers = { ...(opts.headers || {}) };
      if (token) headers.Authorization = `Bearer ${token}`;
      else headers["X-Guest-Id"] = guestId;
      const r = await fetch(`${API}${path}`, { ...opts, headers });
      if (r.status === 401 && token) logout();
      return r;
    },
    [token, guestId, logout]
  );

  // On load (or after a retry), confirm a saved login token is still valid.
  useEffect(() => {
    if (!token || email) return;
    let cancelled = false;
    fetch(`${API}/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async r => {
        if (cancelled) return;
        if (r.status === 401) return logout();
        const d = await r.json();
        setEmail(d.email);
      })
      .catch(() => {
        if (!cancelled) setBootError("Can't reach the server. Check that the backend is running.");
      });
    return () => { cancelled = true; };
  }, [token, email, retry, logout]);

  let screen;
  if (urlAction?.type === "verify") {
    screen = (
      <VerifyScreen
        token={urlAction.token}
        onSuccess={(t, e) => { handleAuth(t, e); finishUrlAction(); }}
        onBack={() => { setShowAuth(true); finishUrlAction(); }}
      />
    );
  } else if (urlAction?.type === "reset") {
    screen = (
      <ResetScreen
        token={urlAction.token}
        onDone={msg => { setNotice(msg); setShowAuth(true); finishUrlAction(); }}
      />
    );
  } else if (showAuth && !token) {
    screen = <AuthScreen onAuth={handleAuth} notice={notice} onGuest={() => setShowAuth(false)} />;
  } else if (token && bootError) {
    screen = (
      <div className="auth-wrap">
        <div className="auth-card">
          <p className="auth-error">{bootError}</p>
          <button className="auth-submit" onClick={() => { setBootError(""); setRetry(n => n + 1); }}>
            Try again
          </button>
          <p className="auth-switch">
            <button type="button" className="link-btn" onClick={logout}>Continue as guest</button>
          </p>
        </div>
      </div>
    );
  } else if (token && !email) {
    screen = <div className="auth-wrap"><p className="auth-sub">Loading…</p></div>;
  } else {
    // key = identity, so signing in or out starts a clean workspace (no leftover chat or documents)
    screen = (
      <Workspace
        key={email || "guest"}
        api={api}
        email={email}
        onLogout={logout}
        onSignIn={() => setShowAuth(true)}
      />
    );
  }

  return (
    <>
      <style>{css}</style>
      {screen}
    </>
  );
}

/* ------------------------------ Styles ------------------------------ */

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
body { margin: 0; background: var(--paper); }

.shell {
  display: flex;
  height: 100vh;
  background: var(--paper);
  color: var(--ink);
  font-family: 'Inter', sans-serif;
}

/* ---- auth ---- */
.auth-wrap {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--paper);
  color: var(--ink);
  font-family: 'Inter', sans-serif;
}
.auth-card {
  width: 100%;
  max-width: 380px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.auth-title {
  font-family: 'Source Serif 4', serif;
  font-size: 28px;
  font-weight: 600;
  margin: 12px 0 0;
}
.auth-sub { margin: -8px 0 4px; font-size: 14px; color: var(--ink-soft); }
.field { display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 500; }
.field input {
  padding: 11px 13px;
  border: 1px solid #CFC9BC;
  border-radius: 9px;
  font-size: 14.5px;
  font-family: inherit;
  background: #fff;
  color: var(--ink);
}
.field input:focus {
  outline: 2px solid var(--pine);
  outline-offset: 1px;
  border-color: transparent;
}
.auth-error {
  margin: 0;
  padding: 9px 12px;
  border-radius: 8px;
  background: #F7EAEA;
  color: var(--error);
  font-size: 13.5px;
  line-height: 1.4;
}
.auth-submit {
  padding: 12px;
  border: none;
  border-radius: 9px;
  background: var(--pine);
  color: #fff;
  font-size: 14.5px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
}
.auth-submit:hover:not(:disabled) { background: var(--pine-dark); }
.auth-submit:disabled { opacity: 0.55; cursor: wait; }
.auth-switch { margin: 0; font-size: 13.5px; color: var(--ink-soft); }
.link-btn {
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  font-size: 13px;
  color: var(--pine);
  font-weight: 500;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.link-btn:hover { color: var(--pine-dark); }
.auth-row { display: flex; justify-content: flex-end; margin-top: -6px; }
.auth-left { align-self: flex-start; }
.auth-info {
  margin: 0;
  padding: 9px 12px;
  border-radius: 8px;
  background: #E8F0EC;
  color: var(--pine-dark);
  font-size: 13.5px;
  line-height: 1.4;
}
.auth-sub strong { color: var(--ink); font-weight: 600; word-break: break-all; }
.auth-note { margin: -6px 0 0; font-size: 12.5px; color: var(--ink-soft); line-height: 1.4; }

.new-chat {
  width: 100%;
  padding: 10px 12px;
  border: 1.5px solid var(--pine);
  border-radius: 9px;
  background: transparent;
  color: var(--pine);
  font-size: 13.5px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  margin-top: -8px;
}
.new-chat:hover:not(:disabled) { background: var(--pine); color: #fff; }
.new-chat:disabled { opacity: 0.45; cursor: not-allowed; }

.guest-banner {
  padding: 10px 28px;
  background: var(--amber-bg);
  color: #5E4A25;
  font-size: 13px;
  line-height: 1.45;
  border-bottom: 1px solid var(--tint);
}
.guest-banner .link-btn { color: #5E4A25; }

/* ---- workspace ---- */
.rail {
  width: 280px;
  flex-shrink: 0;
  background: #F2F0EA;
  border-right: 1px solid var(--tint);
  padding: 28px 20px 20px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  overflow-y: auto;
}
.brand { font-family: 'Source Serif 4', serif; font-size: 22px; font-weight: 600; }
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

.status { font-size: 12.5px; color: var(--ink-soft); margin: -8px 0 0; line-height: 1.4; }

.doc-section-head { display: flex; align-items: center; justify-content: space-between; margin: 0 0 10px; }
.doc-section-head h3 { font-size: 11.5px; font-weight: 600; letter-spacing: 0.02em; color: var(--ink-soft); margin: 0; }
.doc-clear { background: none; border: none; font-size: 11.5px; color: var(--pine); cursor: pointer; padding: 0; }
.doc-clear:disabled { color: var(--ink-soft); opacity: 0.5; cursor: default; }

.empty { font-size: 13px; color: var(--ink-soft); margin: 0; }

.doc-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.doc-item {
  display: flex;
  align-items: center;
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
.doc-check { width: 14px; flex-shrink: 0; font-size: 11px; font-weight: 700; }
.doc-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
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

.account {
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid var(--tint);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 12.5px;
  color: var(--ink-soft);
}
.account-email { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.chat { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.scope-bar { padding: 14px 28px; font-size: 13px; color: var(--ink-soft); border-bottom: 1px solid var(--tint); }
.scope-bar strong { color: var(--ink); font-weight: 600; }

.thread { flex: 1; overflow-y: auto; padding: 24px 28px; display: flex; flex-direction: column; gap: 14px; }
.welcome { margin: auto; text-align: center; max-width: 360px; color: var(--ink-soft); }
.welcome p { margin: 0 0 8px; font-size: 15px; }
.welcome-sub { font-size: 13px; }

.bubble-row { display: flex; }
.row-user { justify-content: flex-end; }
.row-ai { justify-content: flex-start; }
.bubble { max-width: 72%; padding: 11px 15px; border-radius: 12px; font-size: 14.5px; line-height: 1.55; }
.bubble-user { background: var(--pine); color: #fff; border-bottom-right-radius: 3px; }
.bubble-ai { background: #F2F0EA; color: var(--ink); border-bottom-left-radius: 3px; }
.bubble-error { background: #F7EAEA; color: var(--error); }

.bubble-thinking { display: flex; gap: 4px; align-items: center; padding: 14px 16px; }
.dot { width: 6px; height: 6px; border-radius: 50%; background: var(--ink-soft); animation: pulse 1.1s infinite ease-in-out; }
.dot:nth-child(2) { animation-delay: 0.15s; }
.dot:nth-child(3) { animation-delay: 0.3s; }
@keyframes pulse { 0%, 80%, 100% { opacity: 0.25; } 40% { opacity: 1; } }

.sources { margin-top: 9px; display: flex; flex-wrap: wrap; gap: 6px; }
.source-chip {
  background: var(--amber-bg);
  color: var(--amber);
  font-size: 11.5px;
  font-weight: 500;
  padding: 3px 8px;
  border-radius: 999px;
  white-space: nowrap;
}

.composer { display: flex; gap: 10px; padding: 16px 28px 22px; border-top: 1px solid var(--tint); }
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
.composer input:focus { outline: 2px solid var(--pine); outline-offset: 1px; border-color: transparent; }
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
  .shell { flex-direction: column; height: auto; min-height: 100vh; }
  .rail { width: 100%; border-right: none; border-bottom: 1px solid var(--tint); }
  .account { margin-top: 0; }
  .chat { min-height: 70vh; }
}
`;