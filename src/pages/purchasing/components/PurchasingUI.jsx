import { useEffect } from "react";
import { X } from "lucide-react";
import "./purchasing.css";

export function cedis(value) {
  return Number.isSafeInteger(value)
    ? `GH₵ ${(value / 100).toLocaleString("en-GH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    : "Unavailable";
}

export function dateTime(value) {
  if (!value) return "—";

  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? "—"
    : date.toLocaleString("en-GH", { dateStyle: "medium", timeStyle: "short" });
}

export function pesewas(value) {
  const text = String(value).trim();

  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    throw new Error("Enter a valid GH₵ amount with at most two decimal places.");
  }

  const [whole, fraction = ""] = text.split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));

  if (!Number.isSafeInteger(result)) {
    throw new Error("Amount exceeds the supported limit.");
  }

  return result;
}

export function Modal({ title, children, onClose, wide = false }) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="jbp-overlay" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div className={`jbp-modal ${wide ? "jbp-modal-wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="jbp-modal-head">
          <h2>{title}</h2>
          <button type="button" className="jbp-icon-btn" onClick={onClose} aria-label="Close dialog">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Pagination({ page, totalPages, onPage }) {
  if (totalPages <= 1) return null;

  return (
    <div className="jbp-pagination">
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
      <span>Page {page} of {totalPages}</span>
      <button type="button" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Next</button>
    </div>
  );
}

export function Status({ value }) {
  const status = value || "unpaid";
  return <span className={`jbp-status jbp-status-${status}`}>{status}</span>;
}

export function PageTitle({ title, subtitle, action }) {
  return (
    <div className="jbp-header">
      <div>
        <div className="jbp-eyebrow">JOHNBITRACO / PURCHASING</div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

export function ErrorText({ children }) {
  if (!children) return null;
  return <p role="alert" className="jbp-error">{children}</p>;
}
