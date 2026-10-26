import { useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";

import showroom from "./assets/password-showroom.webp";
import { changeAdminPassword } from "../../services/changePassword";
import "./styles/ChangePasswordPage.css";

/**
 * First-login admin password change.
 * Props:
 *   token: authenticated admin bearer token
 *   onChanged: called AFTER backend revokes sessions (navigate to login)
 */

function PasswordField({ label, value, onChange, visibilityKey, placeholder, autoComplete, visible, disabled, onToggle }) {
  return (
    <label className="jb-change-field">
      <span>{label}</span>
      <span className="jb-change-input-shell">
        <LockKeyhole aria-hidden="true" size={19} strokeWidth={1.8} />
        <input
          type={visible[visibilityKey] ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          required
        />
        <button
          type="button"
          className="jb-change-visibility"
          aria-label={visible[visibilityKey] ? `Hide ${label}` : `Show ${label}`}
          onClick={() => onToggle(visibilityKey)}
        >
          {visible[visibilityKey] ? <Eye size={19} /> : <EyeOff size={19} />}
        </button>
      </span>
    </label>
  );
}

export default function ChangePasswordPage({ token, onChanged }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [visible, setVisible] = useState({ current: false, next: false, confirm: false });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const rules = useMemo(() => [
    { text: "At least 8 characters long", pass: newPassword.length >= 8 },
    { text: "Use letters, numbers and symbols", pass: /[A-Za-z]/.test(newPassword) && /\d/.test(newPassword) && /[^A-Za-z0-9]/.test(newPassword) },
    { text: "Different from your current password", pass: Boolean(newPassword) && newPassword !== currentPassword },
    { text: "Both new passwords must match", pass: Boolean(confirmPassword) && newPassword === confirmPassword },
  ], [currentPassword, newPassword, confirmPassword]);

  function toggle(key) {
    setVisible((previous) => ({ ...previous, [key]: !previous[key] }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("Complete all three password fields.");
      return;
    }

    if (!rules.every((rule) => rule.pass)) {
      setError("Please meet all password requirements before proceeding.");
      return;
    }

    setPending(true);

    try {
      await changeAdminPassword({ token, currentPassword, newPassword });
      setSuccess("Password changed successfully. Please sign in again.");
      // The backend revokes all sessions after a successful password change.
      window.setTimeout(() => onChanged?.(), 1100);
    } catch (err) {
      setError(err.message || "Unable to change your password.");
    } finally {
      setPending(false);
    }
  }


  return (
    <main className="jb-change-layout">
      <section className="jb-change-hero" aria-label="JOHNBTRACO luxury footwear showroom">
        <img src={showroom} alt="JOHNBTRACO premium product showroom" />
      </section>

      <section className="jb-change-main">
        <div className="jb-change-card">
          <div className="jb-change-lock" aria-hidden="true">
            <LockKeyhole size={37} fill="currentColor" strokeWidth={1.4} />
          </div>

          <h1>Change Your Password</h1>
          <p className="jb-change-intro">
            For your security, please create a new password<br className="jb-change-desktop-break" /> before you continue.
          </p>

          <form onSubmit={handleSubmit} noValidate>
            <PasswordField
              label="Current Password"
              value={currentPassword}
              onChange={setCurrentPassword}
              visibilityKey="current"
              visible={visible}
              disabled={pending || Boolean(success)}
              onToggle={toggle}
              placeholder="Enter your current password"
              autoComplete="current-password"
            />

            <PasswordField
              label="New Password"
              value={newPassword}
              onChange={setNewPassword}
              visibilityKey="next"
              visible={visible}
              disabled={pending || Boolean(success)}
              onToggle={toggle}
              placeholder="Enter your new password"
              autoComplete="new-password"
            />

            <PasswordField
              label="Confirm New Password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              visibilityKey="confirm"
              visible={visible}
              disabled={pending || Boolean(success)}
              onToggle={toggle}
              placeholder="Confirm your new password"
              autoComplete="new-password"
            />

            <div className="jb-change-requirements">
              <h2>Password Requirements</h2>
              <ul>
                {rules.map((rule) => (
                  <li key={rule.text} className={rule.pass ? "jb-rule-met" : ""}>
                    <CheckCircle2 size={19} strokeWidth={1.7} aria-hidden="true" />
                    <span>{rule.text}</span>
                  </li>
                ))}
              </ul>
            </div>

            {error && <div className="jb-change-error" role="alert">{error}</div>}
            {success && (
              <div className="jb-change-success" role="status">
                <ShieldCheck size={19} /> {success}
              </div>
            )}

            <button className="jb-change-submit" type="submit" disabled={pending || Boolean(success)}>
              {pending ? "Updating Password..." : "Update Password"}
              {!pending && <ArrowRight size={21} aria-hidden="true" />}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
