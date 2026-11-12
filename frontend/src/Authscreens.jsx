import { useState, useEffect, useId } from "react";
import { Wordmark, UploadIcon, ChatIcon, QuoteIcon, MailIcon } from "./ui";

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

const OFFLINE = "Can’t reach the server. Check that the backend is running.";
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

/* ---------------- shared layout: green story panel + the form ---------------- */

export function AuthLayout({ children }) {
  return (
    <div className="auth-page">
      <aside className="auth-brand">
        <Wordmark />
        <div>
          <h2>Ask your documents anything.</h2>
          <p className="lead">
            Upload a PDF and get clear answers in plain English, with the exact page each answer came from.
          </p>
          <div className="feat">
            <span className="ic"><UploadIcon size={20} /></span>
            <div><b>Upload your PDFs</b><span className="d">Contracts, handbooks, reports, study notes.</span></div>
          </div>
          <div className="feat">
            <span className="ic"><ChatIcon size={20} /></span>
            <div><b>Ask in your own words</b><span className="d">No special commands. Just type a question.</span></div>
          </div>
          <div className="feat">
            <span className="ic"><QuoteIcon size={20} /></span>
            <div><b>See where it came from</b><span className="d">Every answer shows its source and page.</span></div>
          </div>
        </div>
        <p className="brand-fine">Your documents stay private to you.</p>
      </aside>
      <main className="auth-main">
        <div className="auth-card">
          <div className="auth-mobile-logo"><Wordmark dark /></div>
          {children}
        </div>
      </main>
    </div>
  );
}

function PasswordField({ label, value, onChange, autoComplete, placeholder, autoFocus, hint }) {
  const id = useId();
  const [show, setShow] = useState(false);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="pw">
        <input
          id={id}
          className="input"
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoFocus={autoFocus}
        />
        <button type="button" className="show" onClick={() => setShow(s => !s)}>
          {show ? "Hide" : "Show"}
        </button>
      </div>
      {hint && <small className="hint">{hint}</small>}
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
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) return setError("Enter a valid email address.");
    if (mode === "signup") {
      if (password.length < 8) return setError("Password must be at least 8 characters.");
      if (password !== confirm) return setError("Passwords don’t match.");
    }
    if (mode === "signin" && !password) return setError("Enter your password.");

    setLoading(true);
    try {
      if (mode === "signin") {
        const { r, d } = await post("/login", { email: cleanEmail, password });
        if (r.ok) onAuth(d.token, d.email);
        else {
          setError(errorText(d));
          if (r.status === 403) setNeedsVerify(true); // right password, email not verified yet
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

  /* ---- "check your inbox" ---- */
  if (mode === "check") {
    const verifying = checkKind === "verify";
    return (
      <AuthLayout>
        <span className="a-badge"><MailIcon size={28} /></span>
        <h1 className="a-title">Check your inbox</h1>
        <p className="a-sub">
          {verifying ? (
            <>We sent a verification link to <strong>{email.trim()}</strong>. Click it to activate your account.</>
          ) : (
            <>If an account exists for <strong>{email.trim()}</strong>, we sent a link to reset your password. It expires in 30 minutes.</>
          )}
        </p>
        {info && <p className="msg-ok" role="status">{info}</p>}
        {error && <p className="msg-err" role="alert">{error}</p>}
        <button className="btn-primary" onClick={() => resend()} disabled={cooldown > 0}>
          {cooldown > 0 ? `Resend in ${cooldown}s` : verifying ? "Resend verification email" : "Resend reset link"}
        </button>
        <p className="a-switch">
          <button type="button" className="lnk" onClick={() => go("signin")}>Back to sign in</button>
        </p>
      </AuthLayout>
    );
  }

  /* ---- sign in / sign up / forgot ---- */
  const titles = {
    signin: ["Welcome back", "Sign in to pick up where you left off."],
    signup: ["Create your account", "Keep your documents and chats safe in one place."],
    forgot: ["Reset your password", "Enter your email and we’ll send you a link to choose a new one."],
  };
  const [title, sub] = titles[mode];

  return (
    <AuthLayout>
      <form className="auth-card" style={{ maxWidth: "none" }} onSubmit={submit} noValidate>
        <h1 className="a-title">{title}</h1>
        <p className="a-sub">{sub}</p>
        {onGuest && mode !== "forgot" && (
          <p className="a-note">Documents and chats from your guest session stay separate from your account.</p>
        )}

        {notice && mode === "signin" && <p className="msg-ok" role="status">{notice}</p>}

        <label className="field">
          <span>Email</span>
          <input
            className="input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoFocus
          />
        </label>

        {mode !== "forgot" && (
          <PasswordField
            label="Password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
          />
        )}

        {mode === "signup" && (
          <PasswordField
            label="Confirm password"
            autoComplete="new-password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder="Type it once more"
          />
        )}

        {mode === "signin" && (
          <div className="row-right">
            <button type="button" className="lnk" onClick={() => go("forgot")}>Forgot password?</button>
          </div>
        )}

        {error && <p className="msg-err" role="alert">{error}</p>}
        {needsVerify && (
          <button type="button" className="lnk a-left" onClick={verifyFromSignin}>
            Send me a new verification email
          </button>
        )}

        <button className="btn-primary" type="submit" disabled={loading}>
          {loading
            ? "Please wait…"
            : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
        </button>

        <p className="a-switch">
          {mode === "signin" && (
            <>New to DocuAI?{" "}
              <button type="button" className="lnk" onClick={() => go("signup")}>Create an account</button></>
          )}
          {mode === "signup" && (
            <>Already have an account?{" "}
              <button type="button" className="lnk" onClick={() => go("signin")}>Sign in</button></>
          )}
          {mode === "forgot" && (
            <button type="button" className="lnk" onClick={() => go("signin")}>Back to sign in</button>
          )}
        </p>
        {onGuest && (
          <p className="a-switch">
            <button type="button" className="lnk" onClick={onGuest}>Continue as guest</button>
          </p>
        )}
      </form>
    </AuthLayout>
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
    <AuthLayout>
      {error ? (
        <>
          <h1 className="a-title">We couldn’t verify that</h1>
          <p className="msg-err" role="alert">{error}</p>
          <p className="a-sub">Sign in with your email and password and we can send you a fresh link.</p>
          <button className="btn-primary" onClick={onBack}>Back to sign in</button>
        </>
      ) : (
        <>
          <h1 className="a-title">Verifying your email…</h1>
          <p className="a-sub">One moment, we’re getting you signed in.</p>
        </>
      )}
    </AuthLayout>
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
    if (password !== confirm) return setError("Passwords don’t match.");
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
    <AuthLayout>
      <form className="auth-card" style={{ maxWidth: "none" }} onSubmit={submit} noValidate>
        <h1 className="a-title">Choose a new password</h1>
        <p className="a-sub">Use at least 8 characters.</p>
        <PasswordField
          label="New password"
          autoComplete="new-password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoFocus
        />
        <PasswordField
          label="Confirm new password"
          autoComplete="new-password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
        />
        {error && <p className="msg-err" role="alert">{error}</p>}
        <button className="btn-primary" type="submit" disabled={loading}>
          {loading ? "Please wait…" : "Update password"}
        </button>
        <p className="a-switch">
          <button type="button" className="lnk" onClick={() => onDone("")}>Back to sign in</button>
        </p>
      </form>
    </AuthLayout>
  );
}