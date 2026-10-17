const BASE_URL = (import.meta.env.VITE_API_HOSTED_URL || "http://localhost:5000").replace(/\/$/, "");

function query(values = {}) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }

  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

async function request(path, token, { method = "GET", body, signal } = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    signal,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.success === false) {
    const error = new Error(
      response.status === 401
        ? "Your session has expired. Please sign in again."
        : payload.message || `Request failed (${response.status})`
    );

    error.status = response.status;
    throw error;
  }

  return payload;
}

export const salesApi = {
  branches: (token, signal) => request("/api/branches", token, { signal }),

  sales: (token, filters, signal) =>
    request(`/api/sales${query(filters)}`, token, { signal }),

  salesSummary: (token, filters, signal) =>
    request(`/api/sales/summary${query(filters)}`, token, { signal }),

  createSale: (token, body) =>
    request("/api/sales", token, { method: "POST", body }),

  customers: (token, filters, signal) =>
    request(`/api/customers${query(filters)}`, token, { signal }),

  createCustomer: (token, body) =>
    request("/api/customers", token, { method: "POST", body }),

  debts: (token, filters, signal) =>
    request(`/api/sales/debts${query(filters)}`, token, { signal }),

  payments: (token, saleId, signal) =>
    request(`/api/sales/${encodeURIComponent(saleId)}/payments`, token, { signal }),

  recordPayment: (token, saleId, body) =>
    request(`/api/sales/${encodeURIComponent(saleId)}/payments`, token, { method: "POST", body }),

  products: (token, filters, signal) =>
    request(`/api/products${query(filters)}`, token, { signal }),

  variants: (token, productId, signal) =>
    request(`/api/products/${encodeURIComponent(productId)}/variants`, token, { signal }),
};

