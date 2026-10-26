import { useEffect, useMemo, useState } from "react";
import { Building2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useAuth } from "../login/features/AuthProvider";
import { administrationApi } from "../../services/administrationApi";
import { AdminMessage, AdminModal, AdminPageHeader, AdminStat } from "../../components/administration/AdminUI";

const initialForm = { name: "", code: "" };

export default function Branches() {
  const { session } = useAuth();
  const token = session?.token;
  const isAdmin = session?.user?.role === "admin";

  const [branches, setBranches] = useState([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(initialForm);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [branchToDelete, setBranchToDelete] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!token || !isAdmin) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError("");

    administrationApi.branches(token, controller.signal)
      .then((response) => setBranches(response.branches || []))
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

    return branches.filter((branch) => [branch.name, branch.code]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(needle));
  }, [branches, search]);

  async function saveBranch(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await administrationApi.addBranch(token, {
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
      });

      setDialogOpen(false);
      setForm(initialForm);
      setSuccess("Branch registered successfully.");
      setRefresh((value) => value + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteBranch() {
    if (!branchToDelete || deleting || deleteConfirmation !== branchToDelete.code) return;

    setDeleting(true);
    setError("");
    setSuccess("");

    try {
      await administrationApi.deleteBranch(token, branchToDelete._id);
      setBranchToDelete(null);
      setDeleteConfirmation("");
      setSuccess("Branch and its associated records permanently deleted.");
      setRefresh((value) => value + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  if (!isAdmin) {
    return <div className="jba-page"><AdminMessage message="Only an Admin can manage branches." /></div>;
  }

  return (
    <div className="jba-page">
      <AdminPageHeader
        title="Branches"
        description="Manage JOHNBTRACO business locations and branch records."
        action={(
          <button className="jba-primary" onClick={() => {
            setError("");
            setDialogOpen(true);
          }}>
            <Plus size={17} /> Add Branch
          </button>
        )}
      />

      <div className="jba-stats">
        <AdminStat label="Total branches" value={branches.length} hint="Registered business locations" />
        <AdminStat label="Active branches" value={branches.filter((branch) => branch.isActive !== false).length} />
        <AdminStat label="Inactive branches" value={branches.filter((branch) => branch.isActive === false).length} />
      </div>

      <AdminMessage message={!dialogOpen ? error : ""} />
      <AdminMessage message={success} variant="success" />

      <section className="jba-panel">
        <div className="jba-toolbar">
          <h2>Branch Directory</h2>

          <div className="jba-actions">
            <input
              className="jba-input jba-search"
              placeholder="Search branches..."
              aria-label="Search branches"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />

            <button className="jba-secondary" onClick={() => setRefresh((value) => value + 1)}>
              <RefreshCw size={16} /> Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <p className="jba-empty">Loading branches...</p>
        ) : filtered.length === 0 ? (
          <p className="jba-empty">No matching branches found.</p>
        ) : (
          <div className="jba-table-scroll">
            <table className="jba-table">
              <thead>
                <tr>
                  <th>Branch</th>
                  <th>Branch code</th>
                  <th>Status</th>
                  <th>Date registered</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((branch) => (
                  <tr key={branch._id}>
                    <td><strong><Building2 size={15} style={{ display: "inline", marginRight: 8 }} />{branch.name}</strong></td>
                    <td>{branch.code}</td>
                    <td>
                      <span className={`jba-pill ${branch.isActive === false ? "inactive" : "active"}`}>
                        {branch.isActive === false ? "Inactive" : "Active"}
                      </span>
                    </td>
                    <td>{branch.createdAt ? new Date(branch.createdAt).toLocaleDateString("en-GB") : "—"}</td>
                    <td>
                      {branch.code !== "MAIN" && (
                        <button
                          type="button"
                          className="jba-secondary"
                          disabled={deleting}
                          onClick={() => {
                            setError("");
                            setSuccess("");
                            setDeleteConfirmation("");
                            setBranchToDelete(branch);
                          }}
                        >
                          <Trash2 size={16} color="#B42318" /> Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {branchToDelete && (
        <AdminModal
          title="Permanently Delete Branch"
          onClose={() => { if (!deleting) setBranchToDelete(null); }}
        >
          <div className="jba-form">
            <p>
              Delete <strong>{branchToDelete.name}</strong> and its assigned staff,
              sessions, inventory, movements, sales, payments, purchases and expenses?
            </p>
            <p className="jba-note">
              This is a permanent deletion. Products, customers and suppliers shared
              with other branches will remain.
            </p>
            <label className="jba-field">
              Type the branch code <strong>{branchToDelete.code}</strong> to confirm
              <input
                className="jba-input"
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value.toUpperCase())}
                autoComplete="off"
                disabled={deleting}
              />
            </label>
            <AdminMessage message={error} />
            <div className="jba-form-actions">
              <button type="button" className="jba-secondary" disabled={deleting} onClick={() => setBranchToDelete(null)}>Cancel</button>
              <button
                type="button"
                className="jba-primary"
                disabled={deleting || deleteConfirmation !== branchToDelete.code}
                onClick={deleteBranch}
              >
                {deleting ? "Deleting..." : "Permanently Delete"}
              </button>
            </div>
          </div>
        </AdminModal>
      )}

      {dialogOpen && (
        <AdminModal title="Register New Branch" onClose={() => setDialogOpen(false)}>
          <form className="jba-form" onSubmit={saveBranch}>
            <AdminMessage message={error} />

            <label className="jba-field">
              Branch name
              <input
                className="jba-input"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="e.g. Sub Branch 3"
                required
                minLength={2}
              />
            </label>

            <label className="jba-field">
              Unique branch code
              <input
                className="jba-input"
                value={form.code}
                onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
                placeholder="e.g. SUB003"
                pattern="[A-Za-z0-9_-]{2,15}"
                title="2–15 letters, digits, underscores or hyphens"
                required
              />
            </label>

            <p className="jba-note">The branch code cannot be changed from this page. Use a unique code for each location.</p>

            <div className="jba-form-actions">
              <button type="button" className="jba-secondary" onClick={() => setDialogOpen(false)}>Cancel</button>
              <button className="jba-primary" type="submit" disabled={saving}>{saving ? "Creating..." : "Create Branch"}</button>
            </div>
          </form>
        </AdminModal>
      )}
    </div>
  );
}
