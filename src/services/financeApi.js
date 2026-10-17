const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/$/, "");

export function financeQuery(filters = {}) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== "" && value !== undefined && value !== null) {
      params.set(key, String(value));
    }
  });

  const output = params.toString();
  return output ? `?${output}` : "";
}

async function api(path, token, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.success === false) {
    throw new Error(payload.message || `Request failed (${response.status})`);
  }

  return payload;
}

export const financeApi = {
  branches: (token, signal) => api("/api/branches", token, { signal }),

  expenses: (token, filters, signal) =>
    api(`/api/expenses${financeQuery(filters)}`, token, { signal }),

  createExpense: (token, payload) =>
    api("/api/expenses", token, { method: "POST", body: JSON.stringify(payload) }),

  reverseExpense: (token, id, reason) =>
    api(`/api/expenses/${encodeURIComponent(id)}/reverse`, token, {
      method: "PATCH",
      body: JSON.stringify({ reason }),
    }),

  report: (token, filters, signal) =>
    api(`/api/reports/financial${financeQuery(filters)}`, token, { signal }),
};

export async function downloadFinanceReport(token, filters, kind) {
  if (!["pdf", "xlsx"].includes(kind)) {
    throw new Error("Unsupported export type");
  }

  const response = await fetch(
    `${API_BASE}/api/reports/financial.${kind}${financeQuery(filters)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || `Report export failed (${response.status})`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `JOHNBTRACO_financial_report.${kind}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
