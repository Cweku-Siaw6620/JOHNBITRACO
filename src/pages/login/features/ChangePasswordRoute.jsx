import { Navigate, useNavigate } from "react-router-dom";
import ChangePasswordPage from "../ChangePasswordPage";
import { useAuth } from "./AuthProvider";

export default function ChangePasswordRoute() {
  const navigate = useNavigate();
  const { session, signOutLocally } = useAuth();

  if (!session?.token) return <Navigate to="/login" replace />;
  if (session.user?.role !== "admin" || !session.user?.mustChangePassword) {
    return <Navigate to="/dashboard" replace />;
  }

  function handleChanged() {
    signOutLocally();
    navigate("/login", { replace: true });
  }

  return (
    <ChangePasswordPage
      token={session.token}
      onChanged={handleChanged}
    />
  );
}
