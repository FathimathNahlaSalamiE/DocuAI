import { useState, useEffect } from "react";

export const API = import.meta.env.VITE_API_URL;

// FastAPI returns `detail` as a string for our errors, and as a list for validation errors.
export function errorText(d, fallback = "Something went wrong.") {
  if (!d || !d.detail) return fallback;
  if (typeof d.detail === "string") return d.detail;
  if (Array.isArray(d.detail)) {
    const msg = d.detail.map(e => (e.msg || "").replace(/^Value error, /, "")).join(" ").trim();
    return msg || fallback;
  }
  return fallback;
}

const OFFLINE = "Can't reach the server. Check that the backend is running.";
const COOLDOWN = 60; // seconds before the resend button works again

async function post(path, body) {
  const r = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const d = await r.json().catch(() => null);
  return { r, d };
}

function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">Docu</span>
      <span className="brand-mark brand-mark-accent">AI</span>
    </div>
  );
}

/* ---------------- Sign in / Sign up / Forgot password / Check inbox ---------------- */

export function AuthScreen({ onAuth, notice, onGuest }) {
  const [mode, setMode] = useState("signin"); // "signin" | "signup" | "forgot" | "check"
  const [checkKind, setCheckKind] = useState("verify"); // what the "check" screen is about
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsVerify, setNeedsVerify] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  function go(next) {
    setMode(next);
    setError("");
    setInfo("");
    setNeedsVerify(false);
    setPassword("");
    setConfirm("");
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    setNeedsVerify(false);

    const cleanEmail = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    if (mode === "signup") {
      if (password.length < 8) return setError("Password must be at least 8 characters.");
      if (password !== confirm) return setError("Passwords don't match.");
    }
    if (mode === "signin" && !password) return setError("Enter your password.");

    setLoading(true);
    try {
      if (mode === "signin") {
        const { r, d } = await post("/login", { email: cleanEmail, password });
        if (r.ok) onAuth(d.token, d.email);
        else {
          setError(errorText(d));
          if (r.status === 403) setNeedsVerify(true); // correct password, email not verified yet
        }
      } else if (mode === "signup") {
        const { r, d } = await post("/register", { email: cleanEmail, password });
        if (r.ok) {
          setCheckKind("verify");
          setCooldown(COOLDOWN);
          go("check");
        } else setError(errorText(d));
      } else if (mode === "forgot") {
        const { r, d } = await post("/forgot-password", { email: cleanEmail });
        if (r.ok) {
          setCheckKind("reset");
          setCooldown(COOLDOWN);
          go("check");
        } else setError(errorText(d));
      }
    } catch {
      setError(OFFLINE);
    }
    setLoading(false);
  }

  async function resend(kind = checkKind) {
    setError("");
    setInfo("");
    try {
      const path = kind === "verify" ? "/resend-verification" : "/forgot-password";
      const { r, d } = await post(path, { email: email.trim() });
      if (r.ok) {
        setInfo("Sent. Check your inbox, and your spam folder too.");
        setCooldown(COOLDOWN);
      } else setError(errorText(d));
    } catch {
      setError(OFFLINE);
    }
  }

  async function verifyFromSignin() {
    setCheckKind("verify");
    go("check");
    await resend("verify");
  }

  /* ---- "check your inbox" screen ---- */
  if (mode === "check") {
    const verifying = checkKind === "verify";
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <Brand />
          <h1 className="auth-title">Check your inbox</h1>
          <p className="auth-sub">
            {verifying
              ? <>We sent a verification link to <strong>{email.trim()}</strong>. Click it to activate your account.</>
              : <>If an account exists for <strong>{email.trim()}</strong>, we sent a link to reset your password. It expires in 30 minutes.</>}
          </p>
          {info && <p className="auth-info" role="status">{info}</p>}
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="auth-submit" onClick={() => resend()} disabled={cooldown > 0}>
            {cooldown > 0 ? `Resend in ${cooldown}s` : verifying ? "Resend verification email" : "Resend reset link"}
          </button>
          <p className="auth-switch">
            <button type="button" className="link-btn" onClick={() => go("signin")}>Back to sign in</button>
          </p>
        </div>
      </div>
    );
  }

  /* ---- sign in / sign up / forgot ---- */
  const titles = {
    signin: ["Sign in", "Pick up where you left off with your documents."],
    signup: ["Create your account", "Your documents stay private to your account."],
    forgot: ["Reset your password", "Enter your email and we'll send you a link to choose a new one."],
  };
  const [title, sub] = titles[mode];

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={submit} noValidate>
        <Brand />
        <h1 className="auth-title">{title}</h1>
        <p className="auth-sub">{sub}</p>
        {onGuest && mode !== "forgot" && (
          <p className="auth-note">
            Documents and chats from your guest session stay separate from your account.
          </p>
        )}

        {notice && mode === "signin" && <p className="auth-info" role="status">{notice}</p>}

        <label className="field">
          <span>Email</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoFocus
          />
        </label>

        {mode !== "forgot" && (
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
            />
          </label>
        )}

        {mode === "signup" && (
          <label className="field">
            <span>Confirm password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Repeat your password"
            />
          </label>
        )}

        {mode === "signin" && (
          <div className="auth-row">
            <button type="button" className="link-btn" onClick={() => go("forgot")}>
              Forgot password?
            </button>
          </div>
        )}

        {error && <p className="auth-error" role="alert">{error}</p>}
        {needsVerify && (
          <button type="button" className="link-btn auth-left" onClick={verifyFromSignin}>
            Send me a new verification email
          </button>
        )}

        <button className="auth-submit" type="submit" disabled={loading}>
          {loading
            ? "Please wait…"
            : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
        </button>

        <p className="auth-switch">
          {mode === "signin" && (
            <>New to DocuAI?{" "}
              <button type="button" className="link-btn" onClick={() => go("signup")}>Create an account</button></>
          )}
          {mode === "signup" && (
            <>Already have an account?{" "}
              <button type="button" className="link-btn" onClick={() => go("signin")}>Sign in</button></>
          )}
          {mode === "forgot" && (
            <button type="button" className="link-btn" onClick={() => go("signin")}>Back to sign in</button>
          )}
        </p>
        {onGuest && (
          <p className="auth-switch">
            <button type="button" className="link-btn" onClick={onGuest}>Continue as guest</button>
          </p>
        )}
      </form>
    </div>
  );
}

/* ---------------- Page opened from the verification email: /?verify=TOKEN ---------------- */

export function VerifyScreen({ token, onSuccess, onBack }) {
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    post("/verify-email", { token })
      .then(({ r, d }) => {
        if (cancelled) return;
        if (r.ok) onSuccess(d.token, d.email);
        else setError(errorText(d));
      })
      .catch(() => { if (!cancelled) setError(OFFLINE); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <Brand />
        {error ? (
          <>
            <h1 className="auth-title">Couldn't verify</h1>
            <p className="auth-error" role="alert">{error}</p>
            <p className="auth-sub">
              Sign in with your email and password and we can send you a fresh link.
            </p>
            <button className="auth-submit" onClick={onBack}>Back to sign in</button>
          </>
        ) : (
          <p className="auth-sub">Verifying your email…</p>
        )}
      </div>
    </div>
  );
}

/* ---------------- Page opened from the reset email: /?reset=TOKEN ---------------- */

export function ResetScreen({ token, onDone }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    setLoading(true);
    try {
      const { r, d } = await post("/reset-password", { token, password });
      if (r.ok) onDone("Password updated. Sign in with your new password.");
      else setError(errorText(d));
    } catch {
      setError(OFFLINE);
    }
    setLoading(false);
  }

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={submit} noValidate>
        <Brand />
        <h1 className="auth-title">Choose a new password</h1>
        <p className="auth-sub">Use at least 8 characters.</p>

        <label className="field">
          <span>New password</span>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoFocus
          />
        </label>
        <label className="field">
          <span>Confirm new password</span>
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
          />
        </label>

        {error && <p className="auth-error" role="alert">{error}</p>}

        <button className="auth-submit" type="submit" disabled={loading}>
          {loading ? "Please wait…" : "Update password"}
        </button>
        <p className="auth-switch">
          <button type="button" className="link-btn" onClick={() => onDone("")}>Back to sign in</button>
        </p>
      </form>
    </div>
  );
}