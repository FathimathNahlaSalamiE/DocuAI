// Small shared pieces: the logo and the icon set. Icons use currentColor, so CSS colors them.

export function LogoMark({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" style={{ flexShrink: 0 }} aria-hidden="true">
      <rect width="32" height="32" rx="10" fill="#E9B44C" />
      <path
        d="M11 8.5h7l4 4V23a1.5 1.5 0 0 1-1.5 1.5h-9.5A1.5 1.5 0 0 1 9.5 23V10A1.5 1.5 0 0 1 11 8.5z"
        stroke="#143028" strokeWidth="1.8" strokeLinejoin="round"
      />
      <path d="M13 17.5h6M13 20.5h4" stroke="#143028" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

// dark = dark text for cream backgrounds; default = light text for the green sidebar
export function Wordmark({ dark = false }) {
  return (
    <div className={`wordmark${dark ? " dark" : ""}`}>
      <LogoMark />
      <span>DocuAI</span>
    </div>
  );
}

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

const make = paths =>
  function Icon({ size = 18 }) {
    return (
      <svg {...base} width={size} height={size}>
        {paths}
      </svg>
    );
  };

export const FileIcon = make(
  <>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
  </>
);
export const PlusIcon = make(<path d="M12 5v14M5 12h14" />);
export const ClipIcon = make(
  <path d="M21 11.5l-8.6 8.6a5.5 5.5 0 0 1-7.8-7.8l8.6-8.6a3.7 3.7 0 0 1 5.2 5.2l-8.6 8.6a1.8 1.8 0 0 1-2.6-2.6l7.9-7.9" />
);
export const SendIcon = make(<path d="M12 19V5M5 12l7-7 7 7" />);
export const SignOutIcon = make(<path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3M16 8l4 4-4 4M20 12H9" />);
export const MenuIcon = make(<path d="M4 7h16M4 12h16M4 17h16" />);
export const CopyIcon = make(
  <>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V6a2 2 0 0 1 2-2h9" />
  </>
);
export const UploadIcon = make(
  <>
    <path d="M12 16V4M12 4l-4 4M12 4l4 4" />
    <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
  </>
);
export const ChatIcon = make(<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />);
export const QuoteIcon = make(<path d="M10 8H7a2 2 0 0 0-2 2v4h5v-4H7M19 8h-3a2 2 0 0 0-2 2v4h5v-4h-3" />);
export const MailIcon = make(
  <>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 7l9 6 9-6" />
  </>
);
export const CloseIcon = make(<path d="M6 6l12 12M18 6L6 18" />);
export const ChevronLeftIcon = make(<path d="M15 5l-7 7 7 7" />);
export const ChevronRightIcon = make(<path d="M9 5l7 7-7 7" />);
export const MinusIcon = make(<path d="M5 12h14" />);