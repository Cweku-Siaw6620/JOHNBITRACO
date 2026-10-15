import { useState } from "react";
import { Outlet, Link } from "react-router-dom";
import { Bell, Menu, Search, ChevronDown, LogOut, UserCircle } from "lucide-react";
import Sidebar from "./Sidebar";
import { useAuth } from "../../pages/login/features/AuthProvider";
import "./layout.css";

export default function AppLayout() {
  const { session, signOutLocally } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const user = session?.user || {};
  const name = user.fullName || user.name || "Account";
  const initials = name.trim().split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase()).join("");
  return (
    <div className={`jb-app ${collapsed ? "nav-collapsed" : ""}`}>
      <Sidebar role={user.role} open={mobileOpen} onClose={() => setMobileOpen(false)} collapsed={collapsed} onToggleCollapse={() => setCollapsed(p => !p)} />
      <div className="jb-app-main">
        <header className="jb-topbar">
          <button className="jb-icon-btn" onClick={() => setMobileOpen(p => !p)} aria-label="Toggle navigation"><Menu size={22} /></button>
          <div className="jb-topbar-search"><Search size={19} /><span>Search anything...</span></div>
          <div className="jb-topbar-grow" />
          <span className="jb-notification" aria-label="Notifications"><Bell size={21} /></span>
          <div className="jb-account-area">
            <button className="jb-account-button" onClick={() => setAccountOpen(p => !p)} aria-expanded={accountOpen}>
              <span className="jb-avatar">{initials || "JB"}</span>
              <span className="jb-account-name">{name}<small>{user.role || "Staff"}</small></span>
              <ChevronDown size={15} />
            </button>
            {accountOpen && <div className="jb-account-menu">
              <Link to="/profile" onClick={() => setAccountOpen(false)}><UserCircle size={16} /> My Profile</Link>
              <button onClick={() => { signOutLocally(); setAccountOpen(false); }}><LogOut size={16} /> Sign out</button>
            </div>}
          </div>
        </header>
        <main className="jb-page-content"><Outlet /></main>
      </div>
    </div>
  );
}
