import { NavLink } from "react-router-dom";
import {
  BarChart3, Boxes, Building2, ChevronLeft, ClipboardList,
  FileBarChart2, History, LayoutDashboard, Menu, Package,
  ReceiptText, Settings, ShoppingBag, ShoppingCart,
  Truck, Users, Wallet, X, UserRoundCog,
} from "lucide-react";
import logo from "../../pages/login/assets/johnbitraco-logo.webp";
import "./layout.css";

const groups = [
  { title: "", links: [{ label: "Dashboard", to: "/dashboard", icon: LayoutDashboard }] },
  { title: "INVENTORY", links: [
    { label: "Products", to: "/products", icon: Package },
    { label: "Inventory", to: "/inventory", icon: Boxes },
    { label: "Stock Movements", to: "/stock-movements", icon: History, roles: ["admin", "assistant"] },
  ] },
  { title: "SALES & CUSTOMERS", roles: ["admin", "assistant"], links: [
    { label: "Sales", to: "/sales", icon: ShoppingCart },
    { label: "Customers", to: "/customers", icon: Users },
    { label: "Customer Debts", to: "/customer-debts", icon: Wallet },
  ] },
  { title: "FINANCE", roles: ["admin", "assistant"], links: [
    { label: "Expenses", to: "/expenses", icon: ReceiptText },
    { label: "Financial Reports", to: "/financial-reports", icon: FileBarChart2 },
  ] },
  { title: "ADMINISTRATION", links: [
    { label: "Branches", to: "/branches", icon: Building2, roles: ["admin"] },
    { label: "Staff Management", to: "/staff", icon: UserRoundCog, roles: ["admin"] },
  ] },
];

export default function Sidebar({ role = "employee", open, onClose, collapsed, onToggleCollapse }) {
  return (
    <>
      {open && <button type="button" className="jb-sidebar-shade" onClick={onClose} aria-label="Close navigation" />}
      <aside className={`jb-sidebar ${open ? "is-open" : ""} ${collapsed ? "is-collapsed" : ""}`}>
        <div className="jb-sidebar-brand">
          <img src={logo} alt="JOHNBTRACO" />
          <span>INVENTORY & FINANCIAL SYSTEM</span>
          <button className="jb-sidebar-mobile-close" onClick={onClose} aria-label="Close menu"><X size={19} /></button>
        </div>
        <nav className="jb-sidebar-nav" aria-label="Main navigation">
          {groups.filter(g => !g.roles || g.roles.includes(role)).map(group => (
            <div className="jb-sidebar-group" key={group.title || "home"}>
              {group.title && <div className="jb-sidebar-caption">{group.title}</div>}
              {group.links.filter(l => !l.roles || l.roles.includes(role)).map(({ label, to, icon: Icon }) => (
                <NavLink key={to} end to={to} onClick={onClose} title={label} className={({ isActive }) => `jb-sidebar-link ${isActive ? "active" : ""}`}>
                  <Icon size={19} strokeWidth={1.8} /> <span>{label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <button type="button" onClick={onToggleCollapse} className="jb-sidebar-collapse"><ChevronLeft size={17} /><span>Collapse menu</span></button>
      </aside>
    </>
  );
}
