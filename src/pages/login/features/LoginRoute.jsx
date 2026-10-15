import { Navigate, useNavigate } from "react-router-dom";
import LoginPage from "../LoginPage";
import { useAuth } from "./AuthProvider";

export default function LoginRoute() {
  const navigate = useNavigate();
  const { session, setSession } = useAuth();

  if (session?.token) {
    return <Navigate to="/dashboard" replace />;
  }

  function handleLogin(nextSession) {
    setSession(nextSession);
    navigate(
      nextSession.user?.role === "admin" && nextSession.user?.mustChangePassword
        ? "/change-password"
        : "/dashboard",
      { replace: true }
    );
  }

  return <LoginPage onLogin={handleLogin} />;
}
