const BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/$/, "");

function withQuery(path, params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== "" && value !== null && value !== undefined) {
      query.set(key, String(value));
    }
  });

  return `${path}${query.size ? `?${query.toString()}` : ""}`;
}

async function request(path, token, options = {}) {
  const { method = "GET", body, signal } = options;

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    signal,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.success === false) {
    const error = new Error(data.message || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }

  return data;
}

export const purchasingApi = {
  branches: (token, signal) => request("/api/branches", token, { signal }),

  suppliers: (token, signal) => request("/api/suppliers", token, { signal }),

  createSupplier: (token, body) => request("/api/suppliers", token, {
    method: "POST",
    body,
  }),

  purchases: (token, params, signal) => request(
    withQuery("/api/purchases", params),
    token,
    { signal }
  ),

  createPurchase: (token, body) => request("/api/purchases", token, {
    method: "POST",
    body,
  }),

  debts: (token, params, signal) => request(
    withQuery("/api/purchases/debts", params),
    token,
    { signal }
  ),

  payments: (token, id, signal) => request(
    `/api/purchases/${encodeURIComponent(id)}/payments`,
    token,
    { signal }
  ),

  repay: (token, id, body) => request(
    `/api/purchases/${encodeURIComponent(id)}/payments`,
    token,
    { method: "POST", body }
  ),

  products: (token, params, signal) => request(
    withQuery("/api/products", params),
    token,
    { signal }
  ),

  variants: (token, id, signal) => request(
    `/api/products/${encodeURIComponent(id)}/variants`,
    token,
    { signal }
  ),
};
