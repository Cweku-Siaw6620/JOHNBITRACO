const API_BASE = (import.meta.env.VITE_API_HOSTED_URL || "http://localhost:5000").replace(/\/$/, "");

export async function loginUser({ role, loginId, secret }) {
  const payload = role === "employee"
    ? { role, pin: secret }
    : role === "assistant"
      ? { role, loginId: loginId.trim(), pin: secret }
      : { role, loginId: loginId.trim(), password: secret };

  let response;

  try {
    response = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error("Unable to reach the server. Check that the backend is running.");
  }

  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.success === false) {
    throw new Error(result.message || "Sign in failed. Check your credentials.");
  }

  // Accommodates either {token,user} or {data:{token,user}}.
  // Verify the exact fields against your current authController response.
  const token = result.token ?? result.accessToken ?? result.data?.token ?? result.data?.accessToken;
  const user = result.user ?? result.data?.user ?? null;
  if (!token) {
    throw new Error("Login succeeded, but no session token was returned. Check the API response mapping.");
  }
  return { token, user, raw: result };
}

export function saveSession(session, persist) {
  // Clearing both avoids keeping a stale token from a prior login mode.
  localStorage.removeItem("johnbitraco.auth");
  sessionStorage.removeItem("johnbitraco.auth");
  const destination = persist ? localStorage : sessionStorage;
  destination.setItem("johnbitraco.auth", JSON.stringify({
    token: session.token,
    user: session.user,
  }));
}
