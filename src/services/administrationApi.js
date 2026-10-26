const BASE_URL = (import.meta.env.VITE_API_HOSTED_URL || "http://localhost:5000" ).replace(/\/$/, "");

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

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.success === false) {
    const error = new Error(payload.message || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }

  return payload;
}

export const administrationApi = {
  branches: (token, signal) => request("/api/branches", token, { signal }),

  addBranch: (token, body) => request("/api/branches", token, { method: "POST", body }),

  deleteBranch: (token, id) => request(`/api/branches/${encodeURIComponent(id)}`, token, { method: "DELETE" }),

  staff: (token, signal) => request("/api/users", token, { signal }),

  addStaff: (token, body) => request("/api/users", token, { method: "POST", body }),

  editStaff: (token, id, body) => request(`/api/users/${encodeURIComponent(id)}`, token, {
    method: "PATCH",
    body,
  }),

  resetPin: (token, id, pin) => request(`/api/users/${encodeURIComponent(id)}/pin`, token, {
    method: "PATCH",
    body: { pin },
  }),
};
