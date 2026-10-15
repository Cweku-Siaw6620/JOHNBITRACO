import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./AuthProvider";

export default function ProtectedRoute() {
  const { session } = useAuth();

  if (!session?.token) return <Navigate to="/login" replace />;

  if (session.user?.role === "admin" && session.user?.mustChangePassword === true) {
    return <Navigate to="/change-password" replace />;
  }

  return <Outlet />;
}
