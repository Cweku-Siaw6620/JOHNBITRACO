import { useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { useAuth } from "../login/features/AuthProvider";
import { administrationApi } from "../../services/administrationApi";
import { AdminMessage, AdminModal, AdminPageHeader, AdminStat } from "../../components/administration/AdminUI";
import StaffForm from "./features/StaffForm";

export default function Staff() {
  const { session } = useAuth();
  const token = session?.token;
  const isAdmin = session?.user?.role === "admin";

  const [staff, setStaff] = useState([]);
  const [branches, setBranches] = useState([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [dialog, setDialog] = useState(null);
  const [selected, setSelected] = useState(null);
  const [pin, setPin] = useState("");
  const [transferBranch, setTransferBranch] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (!token || !isAdmin) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError("");

    Promise.all([
      administrationApi.staff(token, controller.signal),
      administrationApi.branches(token, controller.signal),
    ])
      .then(([usersResponse, branchesResponse]) => {
        setStaff(usersResponse.users || []);
        setBranches(branchesResponse.branches || []);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [token, isAdmin, refresh]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return staff.filter((user) => {
      if (roleFilter !== "all" && user.role !== roleFilter) return false;

      return [
        user.fullName,
        user.role,
        user.loginId,
        user.branch?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [staff, search, roleFilter]);

  function branchName(user) {
    if (!user.branch) return user.role === "admin" ? "All branches" : "Unassigned";

    if (typeof user.branch === "object") return user.branch.name || user.branch.code || "Branch";

    return branches.find((branch) => branch._id === user.branch)?.name || "Assigned branch";
  }

  async function toggleActive(user) {
    if (user.role === "admin") return;

    const action = user.isActive === false ? "activate" : "deactivate";

    if (!window.confirm(`Are you sure you want to ${action} ${user.fullName}?`)) return;

    setError("");
    setSuccess("");

    try {
      await administrationApi.editStaff(token, user._id || user.id, {
        isActive: user.isActive === false,
      });

      setSuccess(`Account ${action === "activate" ? "activated" : "deactivated"} successfully.`);
      setRefresh((value) => value + 1);
    } catch (err) {
      setError(err.message);
    }
  }

  async function resetPin(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      if (!/^\d{5}$/.test(pin)) throw new Error("Enter exactly five digits.");

      await administrationApi.resetPin(token, selected._id || selected.id, pin);
      setDialog(null);
      setPin("");
      setSuccess("PIN reset. Previous staff sessions have been revoked.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const activeBranches = branches.filter((branch) => branch.isActive !== false);

  function startTransfer(user) {
    setSelected(user);
    setTransferBranch(
      typeof user.branch === "object" ? user.branch?._id || "" : user.branch || ""
    );
    setError("");
    setSuccess("");
    setDialog("transfer");
  }

  async function transferStaff(event) {
    event.preventDefault();
    setError("");
    setSaving(true);

    try {
      const target = activeBranches.find((branch) => branch._id === transferBranch);

      if (!target) {
        throw new Error("Select an active branch.");
      }

      await administrationApi.editStaff(token, selected._id || selected.id, {
        branch: transferBranch,
      });

      setDialog(null);
      setSelected(null);
      setSuccess(`Staff member assigned to ${target.name}. Existing sessions have been revoked.`);
      setRefresh((value) => value + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!isAdmin) {
    return <div className="jba-page"><AdminMessage message="Only an Admin can manage staff accounts." /></div>;
  }

  return (
    <div className="jba-page">
      <AdminPageHeader
        title="Staff Management"
        description="Manage employee and assistant accounts across JOHNBTRACO branches."
        action={<button className="jba-primary" onClick={() => {
          setError("");
          setDialog("create");
        }}><Plus size={17} /> Register Staff</button>}
      />

      <div className="jba-stats">
        <AdminStat label="Accounts loaded" value={staff.length} hint="Backend directory returns up to 200 accounts" />
        <AdminStat label="Active accounts" value={staff.filter((user) => user.isActive !== false).length} />
        <AdminStat label="Assistants and employees" value={staff.filter((user) => user.role !== "admin").length} />
      </div>

      <AdminMessage message={!dialog ? error : ""} />
      <AdminMessage message={success} variant="success" />

      <section className="jba-panel">
        <div className="jba-toolbar">
          <h2>Account Directory</h2>

          <div className="jba-actions">
            <input
              className="jba-input jba-search"
              aria-label="Search staff"
              placeholder="Search by name, ID or branch..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />

            <select className="jba-select" style={{ width: 155 }} value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
              <option value="all">All roles</option>
              <option value="admin">Admins</option>
              <option value="assistant">Assistants</option>
              <option value="employee">Employees</option>
            </select>

            <button className="jba-secondary" onClick={() => setRefresh((value) => value + 1)}>
              <RefreshCw size={16} /> Refresh
            </button>
          </div>
        </div>

        {staff.length >= 200 && (
          <p className="jba-note" style={{ padding: "0 22px" }}>
            The staff API currently returns at most 200 accounts, so this directory may be incomplete.
          </p>
        )}

        {loading ? (
          <p className="jba-empty">Loading staff accounts...</p>
        ) : filtered.length === 0 ? (
          <p className="jba-empty">No matching accounts found.</p>
        ) : (
          <div className="jba-table-scroll">
            <table className="jba-table">
              <thead>
                <tr>
                  <th>Staff member</th>
                  <th>Login ID</th>
                  <th>Role</th>
                  <th>Assigned branch</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => (
                  <tr key={user._id || user.id}>
                    <td><strong>{user.fullName}</strong></td>
                    <td>{user.loginId || "PIN login"}</td>
                    <td><span className="jba-pill">{user.role}</span></td>
                    <td>{branchName(user)}</td>
                    <td>
                      <span className={`jba-pill ${user.isActive === false ? "inactive" : "active"}`}>
                        {user.isActive === false ? "Inactive" : "Active"}
                      </span>
                    </td>
                    <td>
                      {user.role !== "admin" ? (
                        <div className="jba-actions">
                          <button className="jba-link" onClick={() => {
                            setSelected(user);
                            setPin("");
                            setError("");
                            setDialog("reset");
                          }}>Reset PIN</button>

                          <button className="jba-link" onClick={() => startTransfer(user)}>Change Branch</button>

                          <button className="jba-link" onClick={() => toggleActive(user)}>
                            {user.isActive === false ? "Activate" : "Deactivate"}
                          </button>
                        </div>
                      ) : (
                        <span className="jba-note">Protected</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="jba-note" style={{ marginTop: 18 }}>
        Additional Admin registration requires a dedicated backend endpoint. The current staff creation API only accepts Employee and Assistant accounts.
      </p>

      {dialog === "create" && (
        <StaffForm
          token={token}
          branches={branches}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            setSuccess("Staff account created successfully.");
            setRefresh((value) => value + 1);
          }}
        />
      )}

      {dialog === "transfer" && (
        <AdminModal title={`Assign Branch — ${selected?.fullName}`} onClose={() => setDialog(null)}>
          <form className="jba-form" onSubmit={transferStaff}>
            <AdminMessage message={error} />

            <label className="jba-field">
              Assigned branch
              <select
                className="jba-select"
                value={transferBranch}
                onChange={(event) => setTransferBranch(event.target.value)}
                required
              >
                <option value="">Select branch</option>
                {activeBranches.map((branch) => (
                  <option key={branch._id} value={branch._id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>

            <p className="jba-note">
              Changing an assignment ends the staff member's existing sessions.
              They must sign in again to access their new branch.
            </p>

            <div className="jba-form-actions">
              <button type="button" className="jba-secondary" onClick={() => setDialog(null)}>
                Cancel
              </button>
              <button type="submit" className="jba-primary" disabled={saving}>
                {saving ? "Saving..." : "Save Branch"}
              </button>
            </div>
          </form>
        </AdminModal>
      )}

      {dialog === "reset" && (
        <AdminModal title={`Reset PIN — ${selected?.fullName}`} onClose={() => setDialog(null)}>
          <form className="jba-form" onSubmit={resetPin}>
            <AdminMessage message={error} />

            <label className="jba-field">
              New unique five-digit PIN
              <input
                className="jba-input"
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                pattern="[0-9]{5}"
                maxLength={5}
                required
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 5))}
              />
            </label>

            <p className="jba-note">Changing this PIN will invalidate the staff member's existing sessions.</p>

            <div className="jba-form-actions">
              <button type="button" className="jba-secondary" onClick={() => setDialog(null)}>Cancel</button>
              <button type="submit" className="jba-primary" disabled={saving}>{saving ? "Saving..." : "Reset PIN"}</button>
            </div>
          </form>
        </AdminModal>
      )}
    </div>
  );
}
