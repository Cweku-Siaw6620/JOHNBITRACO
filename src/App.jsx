import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./pages/login/features/AuthProvider";
import LoginRoute from "./pages/login/features/LoginRoute";
import ChangePasswordRoute from "./pages/login/features/ChangePasswordRoute";
import ProtectedRoute from "./pages/login/features/ProtectedRoute";
import AppLayout from "./components/layout/AppLayout";
import Dashboard from "./pages/dashboard/Dashboard";
import ComingSoon from "./pages/placeholder/ComingSoon";

const upcomingPages = [
  "products", "inventory", "stock-movements", "sales", "customers",
  "customer-debts", "purchases", "suppliers", "supplier-debts",
  "expenses", "financial-reports", "branches", "staff", "settings", "profile",
];

export default function App() {
  return (
  <BrowserRouter>
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/change-password" element={<ChangePasswordRoute />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            {upcomingPages.map(path => <Route key={path} path={`/${path}`} element={<ComingSoon />} />)}
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  </BrowserRouter>
)}
