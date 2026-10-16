import { useEffect, useMemo, useState } from "react";
import { Plus, Users, UserCheck, Search } from "lucide-react";
import { useAuth } from "../login/features/AuthProvider";
import { salesApi } from "../../services/salesApi";
import {
  Dialog, Empty, Header, Loading, Metric, money, Notice, Panel,
} from "../commerce/components/CommerceUI";

const emptyCustomer = {
  name: "",
  phone: "",
  alternatePhone: "",
  address: "",
  notes: "",
};

export default function Customers() {
  const { session } = useAuth();
  const token = session?.token;

  const [customers, setCustomers] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState(emptyCustomer);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => { setPage(1); }, [search]);

  useEffect(() => {
    if (!token) return;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      setError("");

      salesApi.customers(token, { search, page, limit: 20 }, controller.signal)
        .then((result) => {
          setCustomers(result.customers || []);
          setTotal(result.total || 0);
        })
        .catch((err) => {
          if (err.name !== "AbortError") setError(err.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 240);

    return () => { clearTimeout(timer); controller.abort(); };
  }, [token, search, page, refresh]);

  async function create(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const result = await salesApi.createCustomer(token, form);
      setShowNew(false);
      setForm(emptyCustomer);
      setSelected(result.customer || null);
      setRefresh((value) => value + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const maxPage = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="jbc-page">
      <Header
        title="Customers"
        description="Register customers and manage their contact information."
        actions={<button className="jbc-btn burgundy" onClick={() => setShowNew(true)}><Plus size={17} /> Add Customer</button>}
      />

      <div className="jbc-kpis" style={{ gridTemplateColumns: "repeat(2,minmax(0,1fr))" }}>
        <Metric icon={Users} label="Registered customers" value={total} hint="Total matching customers" />
        <Metric icon={UserCheck} label="Visible on this page" value={customers.length} hint="Customers currently loaded" />
      </div>

      <Panel title="Customer directory">
        <div className="jbc-toolbar">
          <label className="jbc-field grow">
            Search customers
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customer name or phone" />
          </label>
          <button className="jbc-btn" onClick={() => setRefresh((value) => value + 1)}>Refresh</button>
        </div>

        <Notice error={error} />
        {loading ? <Loading /> : customers.length === 0 ? <Empty>No registered customers found.</Empty> : (
          <div className="jbc-table-wrap">
            <table className="jbc-table">
              <thead><tr><th>Customer</th><th>Phone</th><th>Alternate phone</th><th>Address</th><th>Registered</th><th>Action</th></tr></thead>
              <tbody>{customers.map((customer) => (
                <tr key={customer._id}>
                  <td><strong>{customer.name}</strong></td>
                  <td>{customer.phone || "—"}</td>
                  <td>{customer.alternatePhone || "—"}</td>
                  <td>{customer.address || "—"}</td>
                  <td>{customer.createdAt ? new Date(customer.createdAt).toLocaleDateString("en-GH") : "—"}</td>
                  <td><button className="jbc-mini" onClick={() => setSelected(customer)}>View</button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}

        <div className="jbc-form-actions">
          <span className="jbc-footnote" style={{ marginRight: "auto" }}>Page {page} of {maxPage} · {total} matching customers</span>
          <button className="jbc-btn" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button>
          <button className="jbc-btn" disabled={page >= maxPage} onClick={() => setPage((value) => value + 1)}>Next</button>
        </div>
      </Panel>

      <p className="jbc-footnote">Purchase histories and total spending are not shown here because the current backend has no customer-specific sales-history endpoint. Use Sales and Customer Debts for transaction records.</p>

      {selected && (
        <Dialog title="Customer details" onClose={() => setSelected(null)}>
          <p><strong>Name:</strong> {selected.name}</p>
          <p><strong>Phone:</strong> {selected.phone || "Not supplied"}</p>
          <p><strong>Alternate:</strong> {selected.alternatePhone || "Not supplied"}</p>
          <p><strong>Address:</strong> {selected.address || "Not supplied"}</p>
          <p><strong>Notes:</strong> {selected.notes || "None"}</p>
          <div className="jbc-form-actions"><button className="jbc-btn" onClick={() => setSelected(null)}>Close</button></div>
        </Dialog>
      )}

      {showNew && (
        <Dialog title="Register customer" onClose={() => setShowNew(false)}>
          <form onSubmit={create}>
            <div className="jbc-form-grid">
              {[
                ["name", "Full name", true],
                ["phone", "Phone number", false],
                ["alternatePhone", "Alternate phone", false],
                ["address", "Address", false],
              ].map(([key, label, required]) => (
                <label className="jbc-field" key={key}>
                  {label}
                  <input required={required} maxLength={key === "name" ? 150 : key === "address" ? 300 : 25} value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} />
                </label>
              ))}
              <label className="jbc-field full">Notes<textarea maxLength={1000} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></label>
            </div>
            <div className="jbc-form-actions">
              <button className="jbc-btn" type="button" onClick={() => setShowNew(false)}>Cancel</button>
              <button className="jbc-btn burgundy" type="submit" disabled={saving}>{saving ? "Saving..." : "Save customer"}</button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
