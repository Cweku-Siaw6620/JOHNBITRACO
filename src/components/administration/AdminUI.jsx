import { X } from "lucide-react";
import "./administration.css";

export function AdminPageHeader({ eyebrow, title, description, action }) {
  return (
    <div className="jba-heading">
      <div>
        <span className="jba-eyebrow">{eyebrow || "ADMINISTRATION"}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>

      {action}
    </div>
  );
}

export function AdminStat({ label, value, hint }) {
  return (
    <div className="jba-stat">
      <span>{label}</span>
      <strong>{value}</strong>
      {hint && <small>{hint}</small>}
    </div>
  );
}

export function AdminModal({ title, onClose, children }) {
  return (
    <div className="jba-overlay" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="jba-dialog" role="dialog" aria-modal="true" aria-label={title}>
        <div className="jba-dialog-head">
          <h2>{title}</h2>
          <button type="button" className="jba-icon" onClick={onClose} aria-label="Close dialog">
            <X size={20} />
          </button>
        </div>

        {children}
      </section>
    </div>
  );
}

export function AdminMessage({ message, variant = "error" }) {
  if (!message) return null;

  return <div className={`jba-message jba-${variant}`} role="status">{message}</div>;
}
