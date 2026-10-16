import { useEffect } from "react";
import { X } from "lucide-react";
import "./commerce.css";

export function money(pesewas) {
  return Number.isSafeInteger(pesewas)
    ? `GH₵ ${(pesewas / 100).toLocaleString("en-GH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    : "Unavailable";
}

export function dateInput(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function saleDate(sale) {
  const date = new Date(sale.soldAt || sale.createdAt);
  return Number.isNaN(date.getTime()) ? "" : dateInput(date);
}

export function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("en-GH", { dateStyle: "medium", timeStyle: "short" });
}

export function toPesewas(input) {
  const value = String(input).trim();

  if (!/^\d+(\.\d{1,2})?$/.test(value)) {
    throw new Error("Enter a valid amount in GH₵ (up to two decimal places).");
  }

  const [whole, cents = ""] = value.split(".");
  const amount = Number(whole) * 100 + Number(cents.padEnd(2, "0"));

  if (!Number.isSafeInteger(amount)) {
    throw new Error("The amount is too large.");
  }

  return amount;
}

export function Header({ title, description, actions }) {
  return (
    <header className="jbc-heading">
      <div>
        <span className="jbc-breadcrumb">Home › {title}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="jbc-heading-actions">{actions}</div>
    </header>
  );
}

export function Metric({ label, value, icon: Icon, hint }) {
  return (
    <article className="jbc-metric">
      <div className="jbc-metric-icon"><Icon size={25} /></div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </article>
  );
}

export function Panel({ title, actions, children }) {
  return (
    <section className="jbc-panel">
      {(title || actions) && (
        <div className="jbc-panel-top">
          {title && <h2>{title}</h2>}
          <div>{actions}</div>
        </div>
      )}
      {children}
    </section>
  );
}

export function Dialog({ title, onClose, children, wide = false }) {
  useEffect(() => {
    function keydown(event) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [onClose]);

  return (
    <div className="jbc-overlay" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className={`jbc-dialog ${wide ? "jbc-dialog-wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="jbc-dialog-title">
          <h2>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close"><X size={21} /></button>
        </div>
        {children}
      </section>
    </div>
  );
}

export function Notice({ error, warning, success }) {
  if (!error && !warning && !success) return null;

  return (
    <p role={error ? "alert" : "status"} className={`jbc-notice ${error ? "error" : warning ? "warning" : "success"}`}>
      {error || warning || success}
    </p>
  );
}

export function Loading() {
  return <p className="jbc-empty">Loading records...</p>;
}

export function Empty({ children = "No records found." }) {
  return <p className="jbc-empty">{children}</p>;
}
