const API_BASE = (import.meta.env.VITE_API_HOSTED_URL || "http://localhost:5000")
  .replace(/\/$/, "");

export async function changeAdminPassword({ token, currentPassword, newPassword }) {
  if (!token) {
    throw new Error("Your session has expired. Please sign in again.");
  }

  let response;

  try {
    response = await fetch(`${API_BASE}/api/auth/change-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  } catch {
    throw new Error("Unable to contact the server. Check your connection.");
  }

  const result = await response.json().catch(() => ({}));

  if (!response.ok || result.success === false) {
    throw new Error(result.message || "Could not change password.");
  }

  return result;
}
