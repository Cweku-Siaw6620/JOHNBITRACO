const BASE_URL = (import.meta.env.VITE_API_LOCAL_URL || "http://localhost:5000" ).replace(/\/$/, "");

async function request(path, token, options = {}) {
  const { signal, method = "GET", body } = options;

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    signal,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok || result.success === false) {
    const error = new Error(
      response.status === 401
        ? "Session expired. Please sign in again."
        : result.message || `Request failed (${response.status}).`
    );

    error.status = response.status;
    error.details = result.errors;
    throw error;
  }

  return result;
}

function queryString(values = {}) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}

export const inventoryApi = {
  branches: (token, signal) => request("/api/branches", token, { signal }),

  products: (token, filters, signal) =>
    request(`/api/products${queryString(filters)}`, token, { signal }),

  product: (token, id, signal) =>
    request(`/api/products/${encodeURIComponent(id)}`, token, { signal }),

  variants: (token, id, signal) =>
    request(`/api/products/${encodeURIComponent(id)}/variants`, token, { signal }),

  createProduct: (token, body) =>
    request("/api/products", token, { method: "POST", body }),

  updateProduct: (token, id, body) =>
    request(`/api/products/${encodeURIComponent(id)}`, token, { method: "PATCH", body }),

  createVariant: (token, id, body) =>
    request(`/api/products/${encodeURIComponent(id)}/variants`, token, { method: "POST", body }),

  updateVariant: (token, id, body) =>
    request(`/api/products/variants/${encodeURIComponent(id)}`, token, { method: "PATCH", body }),

  stock: (token, filters, signal) =>
    request(`/api/inventory${queryString(filters)}`, token, { signal }),

  openingStock: (token, body) =>
    request("/api/inventory/opening-stock", token, { method: "POST", body }),

  adjustStock: (token, body) =>
    request("/api/inventory/adjustments", token, { method: "POST", body }),

  movements: (token, filters, signal) =>
    request(`/api/inventory/movements${queryString(filters)}`, token, { signal }),

  deleteStock: (token, id) =>
    request(`/api/inventory/${encodeURIComponent(id)}`, token, { method: "DELETE" }),
};
