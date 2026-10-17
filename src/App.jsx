import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AuthProvider } from "./pages/login/features/AuthProvider";
import LoginRoute from "./pages/login/features/LoginRoute";
import ChangePasswordRoute from "./pages/login/features/ChangePasswordRoute";
import ProtectedRoute from "./pages/login/features/ProtectedRoute";

import AppLayout from "./components/layout/AppLayout";
import Dashboard from "./pages/dashboard/Dashboard";
import ComingSoon from "./pages/placeholder/ComingSoon";

import Products from "./pages/products/Products";
import Inventory from "./pages/inventory/Inventory";
import StockMovements from "./pages/stock-movements/StockMovements";
import Sales from "./pages/sales/Sales";
import Customers from "./pages/customers/Customers";
import CustomerDebts from "./pages/customer-debts/CustomerDebts";
import Branches from "./pages/branches/Branches";
import Staff from "./pages/staff/Staff";
import Expenses from "./pages/expenses/Expenses";
import FinancialReports from "./pages/financial-reports/FinancialReports";

const upcomingPages = [
  "expenses",
  "financial-reports",
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
              <Route path="/products" element={<Products />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route element={<ProtectedRoute roles={["admin", "assistant"]} />}>
                <Route path="/stock-movements" element={<StockMovements />} />
              </Route>
              <Route path="/sales" element={<Sales />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/customer-debts" element={<CustomerDebts />} />
              <Route element={<ProtectedRoute roles={["admin"]} />}>
                <Route path="/branches" element={<Branches />} />
              </Route>
              <Route path="/staff" element={<Staff />} />
              <Route path="/expenses" element={<Expenses />} />
              <Route path="/financial-reports" element={<FinancialReports />} />

              {upcomingPages.map((path) => (
                <Route key={path} path={`/${path}`} element={<ComingSoon />} />
              ))}
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
