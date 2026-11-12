// All styling for DocuAI. Injected by App.jsx as a <style> tag.
export const css = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600&display=swap');

:root {
  --forest: #143028;
  --cream: #F7F3EC;
  --ink: #1E2A26;
  --muted: #5F6A63;
  --line: #E6DFD1;
  --amber: #E9B44C;
  --amber-bg: #FDF1D8;
  --amber-ink: #7A4E00;
  --err: #9A3B3B;
  --err-bg: #F7EAEA;
  --ok-bg: #E4EEE8;
  --serif: Fraunces, Georgia, serif;
}

* { box-sizing: border-box; }
html, body { height: 100%; }
body {
  margin: 0;
  background: var(--cream);
  color: var(--ink);
  font-family: Inter, system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}
#root { width: 100% !important; max-width: none !important; margin: 0 !important; padding: 0 !important; border: 0 !important; text-align: left !important; height: 100%; }
button, input { font: inherit; color: inherit; }
button { cursor: pointer; }
:focus-visible { outline: 2px solid var(--forest); outline-offset: 2px; }
.side :focus-visible { outline-color: var(--amber); }

/* ---------- shared bits ---------- */
.wordmark { display: flex; align-items: center; gap: 10px; font-family: var(--serif); font-size: 26px; font-weight: 600; letter-spacing: -0.01em; color: var(--cream); }
.wordmark.dark { color: var(--forest); }
.btn-primary { width: 100%; padding: 13px 16px; border: 0; border-radius: 12px; background: var(--forest); color: var(--cream); font-size: 15px; font-weight: 600; }
.btn-primary:hover:not(:disabled) { background: #1D4236; }
.btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }
.lnk { background: none; border: 0; padding: 0; color: var(--forest); font-weight: 600; text-decoration: underline; text-underline-offset: 3px; font-size: inherit; }
.splash { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; color: var(--muted); }

/* ---------- sign in / sign up / reset pages ---------- */
.auth-page { min-height: 100vh; display: grid; grid-template-columns: minmax(380px, 5fr) 6fr; }
.auth-brand { background: var(--forest); color: var(--cream); padding: 44px 56px; display: flex; flex-direction: column; justify-content: space-between; gap: 32px; }
.auth-brand h2 { font-family: var(--serif); font-size: 44px; line-height: 1.1; font-weight: 600; letter-spacing: -0.02em; margin: 0 0 16px; }
.auth-brand .lead { margin: 0 0 12px; font-size: 17px; line-height: 1.6; color: rgba(247, 243, 236, 0.84); max-width: 430px; }
.feat { display: flex; gap: 14px; align-items: flex-start; margin-top: 22px; }
.feat .ic { width: 40px; height: 40px; border-radius: 12px; background: rgba(247, 243, 236, 0.12); display: flex; align-items: center; justify-content: center; color: var(--amber); flex-shrink: 0; }
.feat b { display: block; font-size: 15px; margin-bottom: 2px; }
.feat span.d { font-size: 14px; color: rgba(247, 243, 236, 0.78); }
.brand-fine { margin: 0; font-size: 13px; color: rgba(247, 243, 236, 0.7); }
.auth-main { display: flex; align-items: center; justify-content: center; padding: 32px 24px; }
.auth-card { width: 100%; max-width: 400px; display: flex; flex-direction: column; gap: 16px; }
.auth-mobile-logo { display: none; margin-bottom: 8px; }
.a-title { font-family: var(--serif); font-size: 34px; font-weight: 600; letter-spacing: -0.02em; margin: 0; }
.a-sub { margin: -8px 0 0; font-size: 15px; line-height: 1.55; color: var(--muted); }
.a-sub strong { color: var(--ink); word-break: break-all; }
.a-note { margin: -6px 0 0; font-size: 13px; color: var(--muted); line-height: 1.45; }
.a-badge { width: 56px; height: 56px; border-radius: 18px; background: var(--amber-bg); color: var(--amber-ink); display: flex; align-items: center; justify-content: center; }
.field { display: flex; flex-direction: column; gap: 6px; font-size: 14px; font-weight: 500; }
.input { width: 100%; padding: 13px 14px; border: 1px solid #CFC5B0; border-radius: 12px; background: #fff; font-size: 16px; }
.input:focus { outline: 2px solid var(--forest); outline-offset: 1px; border-color: transparent; }
.pw { position: relative; }
.pw .input { padding-right: 64px; }
.show { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); border: 0; background: none; padding: 6px 8px; font-size: 13px; font-weight: 600; color: var(--muted); }
.hint { font-weight: 400; font-size: 12.5px; color: var(--muted); }
.row-right { display: flex; justify-content: flex-end; margin-top: -6px; font-size: 14px; }
.msg-err { margin: 0; padding: 11px 14px; border-radius: 12px; background: var(--err-bg); color: var(--err); font-size: 14px; line-height: 1.45; }
.msg-ok { margin: 0; padding: 11px 14px; border-radius: 12px; background: var(--ok-bg); color: var(--forest); font-size: 14px; line-height: 1.45; }
.a-switch { margin: 0; font-size: 14.5px; color: var(--muted); }
.a-left { align-self: flex-start; font-size: 14px; }

/* ---------- workspace shell ---------- */
.shell { position: relative; display: flex; height: 100vh; height: 100dvh; background: var(--cream); overflow: hidden; }
.side { width: 288px; flex-shrink: 0; background: var(--forest); color: var(--cream); padding: 22px 16px 16px; display: flex; flex-direction: column; gap: 18px; }
.side-top { display: flex; flex-direction: column; gap: 18px; padding: 0 4px; }
.new-chat { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 12px; border: 0; border-radius: 12px; background: var(--cream); color: var(--forest); font-size: 15px; font-weight: 600; }
.new-chat:hover:not(:disabled) { background: #fff; }
.new-chat:disabled { opacity: 0.5; cursor: not-allowed; }
.side-mid { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 20px; padding-right: 2px; scrollbar-width: thin; scrollbar-color: rgba(247, 243, 236, 0.25) transparent; }
.lbl { margin: 0 0 6px 8px; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 600; color: rgba(247, 243, 236, 0.68); }
.lbl-row { display: flex; align-items: center; justify-content: space-between; }
.lbl-row .clear { border: 0; background: none; font-size: 12px; color: var(--amber); padding: 0 8px; }
.lbl-row .clear:disabled { color: rgba(247, 243, 236, 0.4); cursor: default; }
.side-hint { margin: 0 8px 8px; font-size: 12.5px; line-height: 1.4; color: rgba(247, 243, 236, 0.66); }
.empty-side { margin: 0 8px; font-size: 13.5px; color: rgba(247, 243, 236, 0.66); }
.rw { position: relative; }
.row { display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 34px 9px 10px; border: 0; border-radius: 10px; background: none; color: rgba(247, 243, 236, 0.92); font-size: 14px; text-align: left; }
.row:hover { background: rgba(247, 243, 236, 0.07); }
.row.on { background: rgba(247, 243, 236, 0.14); color: #fff; }
.row .t { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rx { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); width: 26px; height: 26px; border: 0; border-radius: 8px; background: none; color: rgba(247, 243, 236, 0.75); font-size: 17px; line-height: 1; opacity: 0; display: flex; align-items: center; justify-content: center; }
.rw:hover .rx, .rx:focus-visible { opacity: 1; }
.rx:hover { background: rgba(247, 243, 236, 0.16); }
@media (hover: none) { .rx { opacity: 0.75; } }
.ck { width: 16px; height: 16px; flex-shrink: 0; border: 1.5px solid rgba(247, 243, 236, 0.5); border-radius: 5px; position: relative; }
.ck.yes { background: var(--amber); border-color: var(--amber); }
.ck.yes::after { content: ""; position: absolute; left: 4px; top: 0; width: 4px; height: 9px; border: solid var(--forest); border-width: 0 2px 2px 0; transform: rotate(45deg); }
.add-doc { display: block; width: 100%; margin-top: 8px; padding: 13px; border: 1.5px dashed rgba(247, 243, 236, 0.38); border-radius: 12px; background: none; color: rgba(247, 243, 236, 0.88); font-size: 13.5px; }
.add-doc:hover { background: rgba(247, 243, 236, 0.07); }
.status { margin: 8px 8px 0; font-size: 12.5px; line-height: 1.4; color: rgba(247, 243, 236, 0.8); display: flex; align-items: center; gap: 8px; }
.spin { width: 12px; height: 12px; border: 2px solid rgba(247, 243, 236, 0.3); border-top-color: var(--amber); border-radius: 50%; animation: spin 0.8s linear infinite; flex-shrink: 0; }
@keyframes spin { to { transform: rotate(360deg); } }
.account { display: flex; align-items: center; gap: 10px; padding: 14px 8px 0; border-top: 1px solid rgba(247, 243, 236, 0.16); }
.avatar { width: 34px; height: 34px; border-radius: 50%; background: rgba(247, 243, 236, 0.16); display: flex; align-items: center; justify-content: center; font-weight: 600; flex-shrink: 0; }
.account .who-am-i { flex: 1; min-width: 0; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.account .who-am-i small { display: block; font-size: 12px; color: rgba(247, 243, 236, 0.65); }
.out-btn { border: 0; background: none; color: rgba(247, 243, 236, 0.85); padding: 6px; border-radius: 8px; display: flex; }
.out-btn:hover { background: rgba(247, 243, 236, 0.12); }
.sign-in-btn { border: 1.5px solid rgba(247, 243, 236, 0.5); background: none; color: var(--cream); padding: 7px 14px; border-radius: 10px; font-size: 13.5px; font-weight: 600; }
.sign-in-btn:hover { background: rgba(247, 243, 236, 0.12); }

/* ---------- chat area ---------- */
.chat { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; }
.guest { padding: 10px 36px; background: var(--amber-bg); color: #5E4A25; font-size: 13.5px; line-height: 1.45; border-bottom: 1px solid #F0DFB8; }
.guest .lnk { color: #5E4A25; }
.top { display: flex; align-items: center; gap: 14px; padding: 18px 36px; border-bottom: 1px solid var(--line); }
.top .titles { min-width: 0; }
.top h1 { margin: 0; font-family: var(--serif); font-size: 22px; font-weight: 600; letter-spacing: -0.01em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.top p { margin: 3px 0 0; font-size: 13px; color: var(--muted); }
.pills { margin-left: auto; display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
.pill { padding: 6px 12px; border-radius: 999px; background: #fff; border: 1px solid var(--line); font-size: 13px; color: #33413B; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.menu-btn { display: none; width: 40px; height: 40px; border: 1px solid var(--line); border-radius: 12px; background: #fff; align-items: center; justify-content: center; flex-shrink: 0; }
.scrim { display: none; }

.thread { flex: 1; min-height: 0; overflow-y: auto; padding: 28px 36px; display: flex; flex-direction: column; }
.col { width: 100%; max-width: 780px; margin: 0 auto; display: flex; flex-direction: column; gap: 28px; }
.muted-center { margin: auto; color: var(--muted); }

.msg-user { align-self: flex-end; max-width: 76%; padding: 13px 18px; border-radius: 20px 20px 6px 20px; background: var(--forest); color: var(--cream); font-size: 16px; line-height: 1.55; white-space: pre-wrap; overflow-wrap: anywhere; }
.msg-ai { display: flex; gap: 14px; }
.msg-ai .body { min-width: 0; flex: 1; }
.who { margin: 0 0 6px; font-size: 13px; font-weight: 600; color: var(--muted); }
.md { overflow-wrap: anywhere; }
.md p { margin: 0 0 12px; font-size: 17px; line-height: 1.7; }
.md ul, .md ol { margin: 0 0 12px; padding-left: 24px; font-size: 17px; line-height: 1.7; }
.md li { margin-bottom: 4px; }
.md strong { font-weight: 600; background: #FBE7B5; border-radius: 4px; padding: 0 4px; }
.md code { background: #EFE8DA; border-radius: 5px; padding: 1px 5px; font-size: 0.92em; }
.err { margin: 0; padding: 12px 16px; border-radius: 14px; background: var(--err-bg); color: var(--err); font-size: 15px; line-height: 1.5; }
.copy { margin-top: 6px; display: inline-flex; align-items: center; gap: 6px; border: 0; background: none; color: var(--muted); font-size: 13px; padding: 6px 8px; margin-left: -8px; border-radius: 8px; }
.copy:hover { background: #EFE8DA; }
.sources-label { margin: 18px 0 10px; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 600; color: var(--muted); }
.cites { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 12px; }
.cite { background: #fff; border: 1px solid var(--line); border-radius: 16px; padding: 14px 16px; min-width: 0; }
.cite-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
.cite-file { display: flex; align-items: center; gap: 8px; min-width: 0; font-size: 13px; font-weight: 600; color: var(--forest); }
.cite-file span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.badge { padding: 3px 10px; border-radius: 999px; background: var(--amber-bg); color: var(--amber-ink); font-size: 12px; font-weight: 600; white-space: nowrap; }
.cite-snip { margin: 0; font-family: var(--serif); font-size: 15px; line-height: 1.55; color: #3A4540; }
.dots { display: flex; gap: 5px; align-items: center; padding: 14px 0; }
.dots i { width: 7px; height: 7px; border-radius: 50%; background: var(--muted); animation: pulse 1.1s infinite ease-in-out; }
.dots i:nth-child(2) { animation-delay: 0.15s; }
.dots i:nth-child(3) { animation-delay: 0.3s; }
@keyframes pulse { 0%, 80%, 100% { opacity: 0.25; } 40% { opacity: 1; } }

.welcome { margin: auto; text-align: center; max-width: 560px; padding: 24px 0; display: flex; flex-direction: column; align-items: center; gap: 12px; }
.welcome h2 { margin: 8px 0 0; font-family: var(--serif); font-size: 34px; font-weight: 600; letter-spacing: -0.02em; }
.welcome p { margin: 0; font-size: 16px; line-height: 1.6; color: var(--muted); }
.big-drop { width: 100%; padding: 40px 28px; border: 2px dashed #CFC5B0; border-radius: 26px; background: #fff; display: flex; flex-direction: column; align-items: center; gap: 12px; }
.big-drop .btn-primary { width: auto; margin-top: 8px; padding: 13px 28px; }
.big-ic { width: 60px; height: 60px; border-radius: 18px; background: var(--amber-bg); color: var(--amber-ink); display: flex; align-items: center; justify-content: center; }
.steps { list-style: none; margin: 18px 0 0; padding: 0; width: 100%; display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; text-align: left; }
.steps li { font-size: 14px; line-height: 1.5; color: var(--muted); }
.steps b { display: block; color: var(--ink); font-size: 15px; margin-bottom: 2px; }
.steps .n { display: inline-flex; width: 24px; height: 24px; border-radius: 50%; background: var(--forest); color: var(--cream); font-size: 13px; font-weight: 600; align-items: center; justify-content: center; margin-bottom: 8px; }

/* ---------- question box ---------- */
.dock { padding: 0 36px 22px; }
.dock-in { max-width: 780px; margin: 0 auto; }
.chips { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
.chip { padding: 8px 14px; border-radius: 999px; border: 1px solid #D9D0BD; background: transparent; font-size: 14px; color: #33413B; }
.chip:hover:not(:disabled) { background: #fff; }
.chip:disabled { opacity: 0.5; cursor: not-allowed; }
.box { display: flex; align-items: center; gap: 8px; padding: 8px 8px 8px 12px; background: #fff; border: 1px solid var(--line); border-radius: 26px; box-shadow: 0 10px 32px rgba(20, 48, 40, 0.09); }
.box:focus-within { border-color: var(--forest); }
.box input { flex: 1; min-width: 0; border: 0; outline: 0; background: none; font-size: 16px; padding: 8px 4px; }
.icon-btn { width: 40px; height: 40px; border: 0; border-radius: 50%; background: none; color: var(--muted); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.icon-btn:hover { background: #F1EBDD; }
.send { width: 44px; height: 44px; border: 0; border-radius: 50%; background: var(--forest); color: var(--cream); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.send:hover:not(:disabled) { background: #1D4236; }
.send:disabled { opacity: 0.35; cursor: not-allowed; }
.fine { margin: 12px 0 0; text-align: center; font-size: 12px; color: var(--muted); }

.drop { position: absolute; inset: 14px; z-index: 50; display: flex; align-items: center; justify-content: center; background: rgba(247, 243, 236, 0.94); border: 3px dashed var(--forest); border-radius: 26px; font-family: var(--serif); font-size: 28px; color: var(--forest); pointer-events: none; }

/* ---------- phones and small windows ---------- */
@media (max-width: 900px) {
  .auth-page { grid-template-columns: 1fr; }
  .auth-brand { display: none; }
  .auth-mobile-logo { display: block; }
}
@media (max-width: 820px) {
  .side { position: fixed; z-index: 40; left: 0; top: 0; bottom: 0; transform: translateX(-104%); transition: transform 0.22s ease; box-shadow: 0 0 40px rgba(0, 0, 0, 0.35); }
  .side.open { transform: none; }
  .scrim { display: block; position: fixed; inset: 0; z-index: 35; background: rgba(10, 20, 16, 0.5); border: 0; }
  .menu-btn { display: flex; }
  .top { padding: 14px 16px; }
  .pills { display: none; }
  .guest { padding: 10px 16px; }
  .thread { padding: 20px 16px; }
  .dock { padding: 0 14px 16px; }
  .msg-user { max-width: 90%; }
  .steps { grid-template-columns: 1fr; }
  .welcome h2 { font-size: 28px; }
}

/* ---------- documents: tick to ask, click the name to read ---------- */
.rw.doc { display: flex; align-items: center; border-radius: 10px; }
.rw.doc:hover { background: rgba(247, 243, 236, 0.07); }
.rw.doc.viewing { background: rgba(247, 243, 236, 0.15); }
.ckb { width: 36px; height: 38px; flex-shrink: 0; border: 0; background: none; display: flex; align-items: center; justify-content: center; }
.nm { flex: 1; min-width: 0; border: 0; background: none; padding: 9px 34px 9px 2px; text-align: left; font-size: 14px; color: rgba(247, 243, 236, 0.92); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rw.doc.viewing .nm { color: #fff; font-weight: 600; }

/* ---------- source cards open the document ---------- */
button.cite { display: block; width: 100%; text-align: left; cursor: pointer; transition: border-color 0.15s, box-shadow 0.15s; }
button.cite:hover { border-color: var(--forest); box-shadow: 0 4px 14px rgba(20, 48, 40, 0.08); }
button.cite .cite-snip { display: block; }
.cite-go { display: block; margin-top: 10px; font-size: 12.5px; font-weight: 600; color: var(--forest); }

/* ---------- PDF viewer (right-hand panel) ---------- */
.viewer { flex: 0 0 clamp(380px, 42%, 680px); min-width: 0; display: flex; flex-direction: column; background: #EFE9DC; border-left: 1px solid var(--line); }
.v-head { display: flex; align-items: center; gap: 10px; padding: 14px 16px; background: var(--cream); border-bottom: 1px solid var(--line); }
.v-title { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; font-family: var(--serif); font-size: 17px; font-weight: 600; color: var(--forest); }
.v-title span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.v-bar { display: flex; align-items: center; justify-content: center; gap: 6px; flex-wrap: wrap; padding: 8px 12px; background: var(--cream); border-bottom: 1px solid var(--line); }
.v-btn { width: 34px; height: 34px; border: 1px solid var(--line); border-radius: 9px; background: #fff; color: var(--ink); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.v-btn:hover:not(:disabled) { border-color: var(--forest); }
.v-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.v-page { display: flex; align-items: center; gap: 6px; font-size: 14px; color: var(--muted); }
.v-page input { width: 48px; padding: 6px; border: 1px solid var(--line); border-radius: 8px; background: #fff; text-align: center; }
.v-sep { width: 1px; height: 22px; background: var(--line); margin: 0 6px; }
.v-zoom { min-width: 44px; text-align: center; font-size: 13px; color: var(--muted); }
.v-scroll { flex: 1; min-height: 0; overflow: auto; padding: 20px; }
.v-sheet { position: relative; margin: 0 auto; background: #fff; box-shadow: 0 6px 24px rgba(20, 48, 40, 0.18); }
.v-sheet canvas { display: block; }
.hl { position: absolute; background: rgba(233, 180, 76, 0.55); mix-blend-mode: multiply; border-radius: 3px; pointer-events: none; }
.v-msg { margin: 40px auto; max-width: 320px; text-align: center; color: var(--muted); line-height: 1.55; }
@media (max-width: 1200px) {
  .viewer { position: fixed; inset: 0; z-index: 45; flex: none; width: auto; border-left: 0; }
}
`;