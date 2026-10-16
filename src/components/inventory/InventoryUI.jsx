import { useEffect, useState } from "react";
import { AlertTriangle, LoaderCircle, Search, X } from "lucide-react";
import "./inventoryUI.css";

export const cedis = (pesewas) =>
  Number.isSafeInteger(pesewas)
    ? `GH₵ ${(pesewas / 100).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "Unavailable";

export function useDebounced(value, delay = 280) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timeout);
  }, [value, delay]);

  return debounced;
}

export function PageHead({ title, description, actions }) {
  return (
    <div className="jbi-page-head">
      <div>
        <div className="jbi-breadcrumb">Home <span>›</span> {title}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="jbi-page-actions">{actions}</div>
    </div>
  );
}

export function StatCard({ label, value, icon: Icon, tone = "gold", detail }) {
  return (
    <div className="jbi-stat">
      <div className={`jbi-stat-icon ${tone}`}><Icon size={25} /></div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail || "Current records"}</small>
    </div>
  );
}

export function ErrorNotice({ error, retry }) {
  if (!error) return null;

  return (
    <div className="jbi-error" role="alert">
      <AlertTriangle size={18} />
      <span>{error}</span>
      {retry && <button type="button" onClick={retry}>Retry</button>}
    </div>
  );
}

export function Loading({ label = "Loading records..." }) {
  return <div className="jbi-loading"><LoaderCircle className="jbi-spin" size={22} /> {label}</div>;
}

export function SearchInput({ value, onChange, placeholder }) {
  return (
    <label className="jbi-search">
      <Search size={17} />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}

export function Modal({ title, onClose, children, wide = false }) {
  useEffect(() => {
    const onKeyDown = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="jbi-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`jbi-modal ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="jbi-modal-head"><h2>{title}</h2><button type="button" onClick={onClose} aria-label="Close"><X size={21} /></button></div>
        {children}
      </section>
    </div>
  );
}

export function Pagination({ page, totalPages, setPage, total, label = "records" }) {
  return (
    <div className="jbi-pagination">
      <span>{total} {label}</span>
      <div>
        <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
        <span>{page} / {Math.max(1, totalPages || 1)}</span>
        <button type="button" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
      </div>
    </div>
  );
}

export function Empty({ text = "No records found." }) {
  return <div className="jbi-empty">{text}</div>;
}
