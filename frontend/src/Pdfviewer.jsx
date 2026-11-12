import { useState, useEffect, useRef } from "react";
import * as pdfjsLib from "pdfjs-dist";
// If an older browser complains about missing features (e.g. "Promise.withResolvers"), switch both
// imports to the "pdfjs-dist/legacy/build/..." versions of these two files.
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { FileIcon, CloseIcon, ChevronLeftIcon, ChevronRightIcon, MinusIcon, PlusIcon } from "./ui";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

// ---- highlight start ----
const words = s => s.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];

// 2D matrix product, same convention as pdf.js (a, b, c, d, e, f)
const mul = (m1, m2) => [
  m1[0] * m2[0] + m1[2] * m2[1],
  m1[1] * m2[0] + m1[3] * m2[1],
  m1[0] * m2[2] + m1[2] * m2[3],
  m1[1] * m2[2] + m1[3] * m2[3],
  m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
  m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
];

// Finds where the cited passage sits on the page and returns boxes (in CSS pixels) to highlight.
// It matches a short run of words, so small differences in how text was extracted don't matter.
// If it can't find the passage it returns [] and the viewer simply shows the page.
function findRects(content, viewportTransform, scale, snippet) {
  const want = words(snippet);
  if (want.length < 3) return [];

  const pageWords = [];
  const runOf = []; // which text run each word came from
  content.items.forEach((it, idx) => {
    if (!it.str) return;
    for (const w of words(it.str)) {
      pageWords.push(w);
      runOf.push(idx);
    }
  });

  const K = Math.min(4, want.length);
  let start = -1;
  for (let offset = 0; offset <= Math.min(6, want.length - K) && start < 0; offset++) {
    const shingle = want.slice(offset, offset + K);
    for (let i = 0; i + K <= pageWords.length; i++) {
      if (shingle.every((w, j) => pageWords[i + j] === w)) {
        start = i - offset;
        break;
      }
    }
  }
  if (start < 0) return [];

  const from = Math.max(0, start);
  const to = Math.min(pageWords.length - 1, start + want.length - 1);
  const runs = [...new Set(runOf.slice(from, to + 1))];

  return runs.map(idx => {
    const it = content.items[idx];
    const t = mul(viewportTransform, it.transform);
    const h = Math.hypot(t[2], t[3]); // text height in pixels
    return {
      left: t[4],
      top: t[5] - h * 0.92,
      width: Math.max(it.width * scale, 6),
      height: h * 1.2,
    };
  });
}
// ---- highlight end ----

const MESSAGES = {
  nofile:
    "We don’t have the original file for this document. It was probably uploaded before viewing was added, or it has expired. Remove it and upload it again to read it here.",
  load: "We couldn’t open this document. Check that the backend is running and try again.",
  render: "We couldn’t draw this page. Try another page, or reopen the document.",
};

export default function PdfViewer({ api, file, page, snippet, navKey, onClose }) {
  const [pdf, setPdf] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [curPage, setCurPage] = useState(page);
  const [pageText, setPageText] = useState(String(page));
  const [zoom, setZoom] = useState(1);
  const [width, setWidth] = useState(0);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [rects, setRects] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef(null);
  const canvasRef = useRef(null);
  const renderRef = useRef(null);

  // the cited passage is only highlighted on the page it was cited from
  const activeSnippet = curPage === page ? snippet : "";

  // load the document whenever a different file is opened
  useEffect(() => {
    let cancelled = false;
    let task = null;
    setPdf(null);
    setNumPages(0);
    setError("");
    setLoading(true);
    setRects([]);
    setZoom(1);
    (async () => {
      const r = await api(`/documents/${encodeURIComponent(file)}/file`);
      if (!r.ok) {
        if (!cancelled) setError(r.status === 404 ? "nofile" : "load");
        return;
      }
      const data = new Uint8Array(await r.arrayBuffer());
      task = pdfjsLib.getDocument({ data });
      const doc = await task.promise;
      if (cancelled) return;
      setPdf(doc);
      setNumPages(doc.numPages);
    })()
      .catch(() => { if (!cancelled) setError("load"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => {
      cancelled = true;
      task?.destroy?.();
    };
  }, [file]); // eslint-disable-line react-hooks/exhaustive-deps

  // jump to the requested page whenever a source card (or document) is clicked
  useEffect(() => {
    setCurPage(page);
    setPageText(String(page));
  }, [file, page, navKey]);

  // keep the page the same width as the panel
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // draw the page, then work out the highlight
  useEffect(() => {
    if (!pdf || !width) return;
    let cancelled = false;
    setRects([]);
    (async () => {
      const num = Math.min(Math.max(1, curPage), pdf.numPages);
      const pg = await pdf.getPage(num);
      if (cancelled) return;

      const base = pg.getViewport({ scale: 1 });
      const scale = (Math.max(240, width) / base.width) * zoom;
      const viewport = pg.getViewport({ scale });
      const dpr = window.devicePixelRatio || 1;
      const canvas = canvasRef.current;
      if (!canvas) return;

      if (renderRef.current) {
        renderRef.current.cancel();
        try { await renderRef.current.promise; } catch { /* cancelled */ }
      }
      if (cancelled) return;

      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      setSize({ w: viewport.width, h: viewport.height });

      renderRef.current = pg.render({
        canvasContext: canvas.getContext("2d"),
        viewport,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null,
      });
      await renderRef.current.promise;
      if (cancelled) return;

      if (activeSnippet) {
        const content = await pg.getTextContent();
        if (!cancelled) setRects(findRects(content, viewport.transform, viewport.scale, activeSnippet));
      }
    })().catch(e => {
      if (!cancelled && e?.name !== "RenderingCancelledException") setError("render");
    });
    return () => { cancelled = true; };
  }, [pdf, curPage, zoom, width, activeSnippet, navKey]);

  // bring the highlighted passage into view; otherwise start each page at the top
  useEffect(() => {
    const box = scrollRef.current;
    if (!box) return;
    if (rects.length) {
      const top = Math.min(...rects.map(r => r.top));
      box.scrollTo({ top: Math.max(0, top - 90), behavior: "smooth" });
    }
  }, [rects]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }); }, [curPage, file]);

  function goTo(n) {
    const p = Math.min(Math.max(1, Math.round(n) || 1), numPages || 1);
    setCurPage(p);
    setPageText(String(p));
  }

  const ready = !!pdf && !error;

  return (
    <aside className="viewer" aria-label={`Reading ${file}`}>
      <div className="v-head">
        <span className="v-title">
          <FileIcon size={18} />
          <span title={file}>{file}</span>
        </span>
        <button className="v-btn" onClick={onClose} aria-label="Close the document">
          <CloseIcon size={18} />
        </button>
      </div>

      <div className="v-bar">
        <button className="v-btn" onClick={() => goTo(curPage - 1)} disabled={!ready || curPage <= 1} aria-label="Previous page">
          <ChevronLeftIcon size={18} />
        </button>
        <span className="v-page">
          Page
          <input
            value={pageText}
            onChange={e => setPageText(e.target.value.replace(/\D/g, ""))}
            onBlur={() => goTo(Number(pageText))}
            onKeyDown={e => e.key === "Enter" && e.currentTarget.blur()}
            disabled={!ready}
            inputMode="numeric"
            aria-label="Page number"
          />
          of {numPages || "–"}
        </span>
        <button className="v-btn" onClick={() => goTo(curPage + 1)} disabled={!ready || curPage >= numPages} aria-label="Next page">
          <ChevronRightIcon size={18} />
        </button>
        <span className="v-sep" />
        <button className="v-btn" onClick={() => setZoom(z => Math.max(0.6, +(z - 0.2).toFixed(2)))} disabled={!ready || zoom <= 0.6} aria-label="Zoom out">
          <MinusIcon size={16} />
        </button>
        <span className="v-zoom">{Math.round(zoom * 100)}%</span>
        <button className="v-btn" onClick={() => setZoom(z => Math.min(2.6, +(z + 0.2).toFixed(2)))} disabled={!ready || zoom >= 2.6} aria-label="Zoom in">
          <PlusIcon size={16} />
        </button>
      </div>

      <div className="v-scroll" ref={scrollRef}>
        {loading && <p className="v-msg">Opening document…</p>}
        {!loading && error && <p className="v-msg">{MESSAGES[error]}</p>}
        {pdf && !error && (
          <div className="v-sheet" style={{ width: size.w, height: size.h }}>
            <canvas ref={canvasRef} />
            {rects.map((r, i) => (
              <span key={i} className="hl" style={{ left: r.left, top: r.top, width: r.width, height: r.height }} />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}