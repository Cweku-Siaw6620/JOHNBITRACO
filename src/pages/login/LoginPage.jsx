import { useState } from "react";
import {
  Check, Eye, EyeOff, KeyRound, LockKeyhole,
  LogIn, ShieldCheck, UserRound, UsersRound,
} from "lucide-react";
import { loginUser, saveSession } from "../../services/auth";
import logo from "./assets/johnbitraco-logo.webp";
import showroom from "./assets/login-showroom.webp";
import "./styles/LoginPage.css";

const ROLES = [
  { key: "admin", label: "Admin", Icon: UserRound },
  { key: "assistant", label: "Assistant", Icon: UsersRound },
  { key: "employee", label: "Employee", Icon: UserRound },
];

export default function LoginPage({ onLogin }) {
  const [role, setRole] = useState("assistant");
  const [loginId, setLoginId] = useState("");
  const [secret, setSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(false);
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const pinMode = role !== "admin";
  const secretLabel = pinMode ? "PIN" : "Password";

  function changeRole(nextRole) {
    setRole(nextRole);
    setLoginId("");
    setSecret("");
    setShowSecret(false);
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (role !== "employee" && !loginId.trim()) {
      setError("Please enter your login ID.");
      return;
    }
    if (pinMode && !/^\d{5}$/.test(secret)) {
      setError("Enter your 5-digit PIN.");
      return;
    }
    if (!pinMode && !secret) {
      setError("Please enter your password.");
      return;
    }

    setSubmitting(true);
    try {
      const session = await loginUser({ role, loginId, secret });
      saveSession(session, rememberDevice);
      onLogin?.(session);
    } catch (err) {
      setError(err.message || "Unable to sign in.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="jb-login-root">
      <header className="jb-login-topbar">
        <div className="jb-login-topbar-brand">
          <span className="jb-header-monogram" aria-hidden="true">JB</span>
          <span className="jb-header-name">JOHNBITRACO</span>
          <span className="jb-header-divider" />
          <span className="jb-header-system">Inventory &amp; Financial Management System</span>
        </div>
        <span className="jb-secure"><LockKeyhole size={16} strokeWidth={1.9} /> Secure Access</span>
      </header>

      <div className="jb-login-layout">
        <section className="jb-showroom-panel" aria-label="JOHNBITRACO premium footwear">
          <img src={showroom} alt="Luxury footwear showroom with JOHNBITRACO welcome message" />
        </section>

        <section className="jb-form-side">
          <div className="jb-login-card">
            <img className="jb-main-logo" src={logo} alt="JOHNBITRACO ENT. – Deals in quality executive products" />

            <h1 className="jb-signin-heading">Sign in</h1>
            <p className="jb-signin-subtitle">Access your business dashboard securely</p>

            <div className="jb-role-selector" role="group" aria-label="Select account type">
              {ROLES.map(({ key, label, Icon }) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={role === key}
                  className={`jb-role-option ${role === key ? "jb-role-active" : ""}`}
                  onClick={() => changeRole(key)}
                >
                  <Icon size={18} fill="currentColor" strokeWidth={1.5} />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} noValidate>
              {role !== "employee" && (
                <label className="jb-field">
                  <span>Login ID</span>
                  <div className="jb-input-wrap">
                    <UserRound className="jb-field-icon" size={18} />
                    <input
                      value={loginId}
                      onChange={(e) => setLoginId(e.target.value)}
                      placeholder="Enter your login ID"
                      autoComplete="username"
                      maxLength={80}
                      disabled={isSubmitting}
                    />
                  </div>
                </label>
              )}

              <label className="jb-field">
                <span>{secretLabel}</span>
                <div className="jb-input-wrap">
                  <LockKeyhole className="jb-field-icon" size={18} />
                  <input
                    value={secret}
                    onChange={(e) => setSecret(pinMode ? e.target.value.replace(/\D/g, "").slice(0, 5) : e.target.value)}
                    type={showSecret ? "text" : "password"}
                    placeholder={pinMode ? "Enter your PIN" : "Enter your password"}
                    autoComplete={pinMode ? "off" : "current-password"}
                    inputMode={pinMode ? "numeric" : "text"}
                    maxLength={pinMode ? 5 : undefined}
                    disabled={isSubmitting}
                  />
                  <button
                    className="jb-password-toggle"
                    type="button"
                    title={showSecret ? "Hide" : "Show"}
                    aria-label={showSecret ? `Hide ${secretLabel}` : `Show ${secretLabel}`}
                    onClick={() => setShowSecret(!showSecret)}
                  >
                    {showSecret ? <EyeOff size={19} /> : <Eye size={19} />}
                  </button>
                </div>
              </label>

              <label className="jb-remember">
                <input
                  type="checkbox"
                  checked={rememberDevice}
                  onChange={(e) => setRememberDevice(e.target.checked)}
                  disabled={isSubmitting}
                />
                <span className="jb-checkbox-box"><Check size={13} strokeWidth={3} /></span>
                <span>Remember this device</span>
              </label>

              {error && <p className="jb-login-error" role="alert">{error}</p>}

              <button type="submit" className="jb-submit" disabled={isSubmitting}>
                <LogIn size={24} strokeWidth={2} />
                {isSubmitting ? "Signing in…" : "Sign In"}
              </button>
            </form>

            <p className="jb-help-line"><span />Need help signing in?<span /></p>
            <footer className="jb-login-footer"><ShieldCheck size={16} fill="currentColor" /> Protected access · 30-minute inactivity timeout</footer>
          </div>
          <p className="jb-mobile-tagline"><KeyRound size={14} /> Quality Footwear. Stronger Business.</p>
        </section>
      </div>
    </main>
  );
}
