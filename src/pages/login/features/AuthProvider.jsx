import { createContext, useContext, useMemo, useState } from "react";

const SESSION_KEY = "johnbitraco.auth";
const AuthContext = createContext(null);

function restoreSession() {
  for (const store of [sessionStorage, localStorage]) {
    try {
      const saved = JSON.parse(store.getItem(SESSION_KEY) || "null");
      if (saved?.token && saved?.user) return saved;
    } catch {
      // Ignore invalid previously saved data.
    }
  }
  return null;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(restoreSession);

  function signOutLocally() {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
  }

  const value = useMemo(
    () => ({ session, setSession, signOutLocally }),
    [session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("useAuth must be used inside AuthProvider");
  return auth;
}
