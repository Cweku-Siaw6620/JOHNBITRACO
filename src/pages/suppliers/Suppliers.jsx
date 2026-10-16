import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Truck } from "lucide-react";
import { useAuth } from "../login/features/AuthProvider";
import { purchasingApi } from "../../services/purchasingApi";
import { ErrorText, Modal, PageTitle } from "../purchasing/components/PurchasingUI";

const blank = { name: "", phone: "", alternatePhone: "", email: "", address: "", notes: "" };

export default function Suppliers() {
  const { session } = useAuth();
  const token = session?.token;
  const admin = session?.user?.role === "admin";

  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();

    purchasingApi.suppliers(token, controller.signal)
      .then((data) => setSuppliers(data.suppliers || []))
      .catch((err) => { if (err.name !== "AbortError") setError(err.message); });

    return () => controller.abort();
  }, [token, refresh]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return suppliers.filter((supplier) => [supplier.name, supplier.phone, supplier.email, supplier.address]
      .filter(Boolean).join(" ").toLowerCase().includes(term));
  }, [suppliers, search]);

  async function save(event) {
    event.preventDefault();
    setError("");
    setSaving(true);

    try {
      await purchasingApi.createSupplier(token, form);
      setOpen(false);
      setForm(blank);
      setRefresh((n) => n + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="jbp-page">
      <PageTitle title="Suppliers" subtitle="Supplier contact directory for JOHNBITRACO purchasing."
        action={admin && <button className="jbp-btn" onClick={() => { setError(""); setOpen(true); }}><Plus size={17} /> Add Supplier</button>} />

      <div className="jbp-stats">
        <div className="jbp-card"><span className="jbp-card-label">Active suppliers loaded</span><strong>{suppliers.length}</strong><small>The backend currently limits the directory to 500</small></div>
        <div className="jbp-card"><span className="jbp-card-label">Search matches</span><strong>{filtered.length}</strong><small>Within loaded directory</small></div>
      </div>

      <section className="jbp-panel">
        <div className="jbp-toolbar">
          <Search size={18} />
          <input className="jbp-input" aria-label="Search suppliers" value={search} placeholder="Search name, phone, email..." onChange={(event) => setSearch(event.target.value)} />
        </div>

        <ErrorText>{!open ? error : ""}</ErrorText>
        {suppliers.length >= 500 && <p className="jbp-hint">The supplier API returns up to 500 records. This table and search may not include additional suppliers.</p>}

        {filtered.length === 0 ? <p className="jbp-empty">No suppliers found.</p> : <div className="jbp-table-scroll"><table className="jbp-table">
          <thead><tr><th>Supplier</th><th>Phone</th><th>Alternate phone</th><th>Email</th><th>Address</th><th>Notes</th></tr></thead>
          <tbody>{filtered.map((supplier) => <tr key={supplier._id}>
            <td><strong>{supplier.name}</strong></td><td>{supplier.phone || "—"}</td><td>{supplier.alternatePhone || "—"}</td>
            <td>{supplier.email || "—"}</td><td>{supplier.address || "—"}</td><td>{supplier.notes || "—"}</td>
          </tr>)}</tbody>
        </table></div>}
      </section>

      {open && <Modal title="Register Supplier" onClose={() => setOpen(false)}>
        <form className="jbp-form" onSubmit={save}>
          <ErrorText>{error}</ErrorText>
          {[
            ["name", "Supplier name", true],
            ["phone", "Phone number", false],
            ["alternatePhone", "Alternate phone", false],
            ["email", "Email address", false],
            ["address", "Address", false],
            ["notes", "Notes", false],
          ].map(([key, label, required]) => <div className="jbp-field" key={key}>
            <label>{label}</label>
            <input className="jbp-input" type={key === "email" ? "email" : "text"} required={required}
              value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} />
          </div>)}
          <div className="jbp-form-actions"><button className="jbp-btn jbp-btn-secondary" type="button" onClick={() => setOpen(false)}>Cancel</button>
            <button className="jbp-btn" disabled={saving}>{saving ? "Saving..." : "Save Supplier"}</button></div>
        </form>
      </Modal>}
    </main>
  );
}
