import { useEffect, useState } from "react";
import { AdminMessage, AdminModal } from "../../../components/administration/AdminUI";
import { administrationApi } from "../../../services/administrationApi";

const emptyForm = {
  fullName: "",
  role: "employee",
  branch: "",
  loginId: "",
  pin: "",
};

export default function StaffForm({ token, branches, onClose, onSaved }) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const mainBranch = branches.find((branch) => branch.code === "MAIN");

    if (mainBranch) {
      setForm((previous) => ({ ...previous, branch: mainBranch._id }));
    }
  }, [branches]);

  function update(name, value) {
    setForm((previous) => {
      const next = { ...previous, [name]: value };

      if (name === "role" && value === "assistant") {
        next.branch = branches.find((branch) => branch.code === "MAIN")?._id || "";
      }

      return next;
    });
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      if (!/^\d{5}$/.test(form.pin)) {
        throw new Error("Enter a five-digit PIN.");
      }

      const body = {
        fullName: form.fullName.trim(),
        role: form.role,
        branch: form.branch,
        pin: form.pin,
      };

      if (form.role === "assistant") {
        body.loginId = form.loginId.trim().toUpperCase();
      }

      await administrationApi.addStaff(token, body);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const options = form.role === "assistant"
    ? branches.filter((branch) => branch.code === "MAIN")
    : branches.filter((branch) => branch.isActive !== false);

  return (
    <AdminModal title="Register Staff Account" onClose={onClose}>
      <form className="jba-form" onSubmit={submit}>
        <AdminMessage message={error} />

        <label className="jba-field">
          Full name
          <input
            className="jba-input"
            value={form.fullName}
            onChange={(event) => update("fullName", event.target.value)}
            minLength={2}
            required
            placeholder="Full staff name"
          />
        </label>

        <div className="jba-row">
          <label className="jba-field">
            Account role
            <select className="jba-select" value={form.role} onChange={(event) => update("role", event.target.value)}>
              <option value="employee">Employee</option>
              <option value="assistant">Assistant</option>
            </select>
          </label>

          <label className="jba-field">
            Assigned branch
            <select className="jba-select" value={form.branch} onChange={(event) => update("branch", event.target.value)} required>
              <option value="">Select branch</option>
              {options.map((branch) => <option value={branch._id} key={branch._id}>{branch.name}</option>)}
            </select>
          </label>
        </div>

        {form.role === "assistant" && (
          <label className="jba-field">
            Login ID
            <input
              className="jba-input"
              value={form.loginId}
              onChange={(event) => update("loginId", event.target.value)}
              minLength={3}
              maxLength={32}
              required
              placeholder="e.g. AST002"
            />
          </label>
        )}

        <label className="jba-field">
          Five-digit PIN
          <input
            className="jba-input"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            pattern="[0-9]{5}"
            maxLength={5}
            value={form.pin}
            onChange={(event) => update("pin", event.target.value.replace(/\D/g, "").slice(0, 5))}
            required
            placeholder="•••••"
          />
        </label>

        <p className="jba-note">
          Assistants sign in using Login ID and PIN, and must belong to Main Branch.
          Employees sign in with a unique five-digit PIN.
        </p>

        <div className="jba-form-actions">
          <button type="button" className="jba-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="jba-primary" disabled={saving}>{saving ? "Creating..." : "Create Account"}</button>
        </div>
      </form>
    </AdminModal>
  );
}
