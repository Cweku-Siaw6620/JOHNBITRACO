import React from "react";
import "./finance.css";

export const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

export const monthStart = () => `${today().slice(0, 7)}-01`;

export function money(amount) {
  return Number.isSafeInteger(amount)
    ? `GH₵ ${(amount / 100).toLocaleString("en-GH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    : "Unavailable";
}

export const categories = [
  "rent", "electricity", "water", "salaries", "transport",
  "packaging", "repairs", "internet", "marketing", "utilities", "other",
];

export function FinanceHeader({ title, description, children }) {
  return (
    <header className="jbf-header">
      <div>
        <span className="jbf-eyebrow">JOHNBTRACO / FINANCE</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="jbf-actions">{children}</div>
    </header>
  );
}

export function FinanceCard({ label, value, help }) {
  return (
    <section className="jbf-stat">
      <span>{label}</span>
      <strong>{value}</strong>
      {help && <small>{help}</small>}
    </section>
  );
}

export function FinanceNotice({ children, type = "error" }) {
  return children ? <div className={`jbf-notice jbf-${type}`} role="alert">{children}</div> : null;
}

export function BranchSelect({ admin, branches, branchId, onChange, allowAll = true, required = false }) {
  if (!admin) return null;

  return (
    <label>
      Branch
      <select value={branchId} onChange={(event) => onChange(event.target.value)} required={required}>
        {allowAll && <option value="">All branches</option>}
        {!allowAll && <option value="">Select branch</option>}
        {branches.map((branch) => (
          <option value={branch._id} key={branch._id}>
            {branch.name}
          </option>
        ))}
      </select>
    </label>
  );
}
