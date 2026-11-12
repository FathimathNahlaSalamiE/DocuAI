import { useState, useEffect, useCallback } from "react";
import { API, AuthLayout, AuthScreen, VerifyScreen, ResetScreen } from "./AuthScreens";
import Workspace from "./Workspace";
import { Wordmark } from "./ui";
import { css } from "./styles";

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

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [email, setEmail] = useState("");
  const [guestId] = useState(loadGuestId);
  const [showAuth, setShowAuth] = useState(false); // the sign-in page, opened from guest mode
  const [bootError, setBootError] = useState("");
  const [retry, setRetry] = useState(0);
  const [notice, setNotice] = useState(""); // e.g. "Password updated" shown on the sign-in page

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
        if (!cancelled) setBootError("Can’t reach the server. Check that the backend is running.");
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
      <AuthLayout>
        <h1 className="a-title">We can’t reach DocuAI</h1>
        <p className="msg-err">{bootError}</p>
        <button className="btn-primary" onClick={() => { setBootError(""); setRetry(n => n + 1); }}>
          Try again
        </button>
        <p className="a-switch">
          <button type="button" className="lnk" onClick={logout}>Continue as guest</button>
        </p>
      </AuthLayout>
    );
  } else if (token && !email) {
    screen = (
      <div className="splash">
        <Wordmark dark />
        <p>Loading your workspace…</p>
      </div>
    );
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