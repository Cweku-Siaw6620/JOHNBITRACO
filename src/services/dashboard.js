const BASE_URL = (import.meta.env.VITE_API_HOSTED_URL || "http://localhost:5000" ).replace(/\/$/, "");

async function apiGet(path, token, signal) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` }, signal,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    if (response.status === 401) throw new Error("Your session has expired. Please sign in again.");
    throw new Error(data.message || `Request failed (${response.status})`);
  }
  return data;
}

export async function loadFinancialDashboard(token, filters = {}, signal) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  const query = params.toString();
  const data = await apiGet(`/api/dashboard/financial${query ? `?${query}` : ""}`, token, signal);
  return data.dashboard;
}

export async function loadDashboardSales(token, signal) {
  const data = await apiGet("/api/sales?limit=6", token, signal);
  return data.sales || [];
}

export async function loadDashboardBranches(token, signal) {
  const data = await apiGet("/api/branches", token, signal);
  return data.branches || data.data || [];
}

export async function loadDashboardStock(token, branchId, signal) {
  if (!branchId) return [];
  const data = await apiGet(`/api/inventory?branchId=${encodeURIComponent(branchId)}&lowStock=true&limit=30`, token, signal);
  return data.inventory || [];
}
