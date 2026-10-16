import { useEffect, useState } from "react";
import { PackagePlus, ShoppingBag, Wallet } from "lucide-react";
import { useAuth } from "../login/features/AuthProvider";
import { purchasingApi } from "../../services/purchasingApi";
import { cedis, dateTime, ErrorText, Modal, PageTitle, Pagination, Status } from "../purchasing/components/PurchasingUI";
import NewPurchase from "./features/NewPurchase";

export default function Purchases() {
  const { session } = useAuth();
  const token = session?.token;
  const admin = session?.user?.role === "admin";
  const assignedBranch = session?.user?.branch?._id || session?.user?.branch || "";

  const [branches, setBranches] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [branchId, setBranchId] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ purchases: [], total: 0, totalPages: 0 });
  const [selected, setSelected] = useState(null);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();

    Promise.all([
      purchasingApi.branches(token, controller.signal),
      purchasingApi.suppliers(token, controller.signal),
    ]).then(([branchResponse, supplierResponse]) => {
      setBranches(branchResponse.branches || branchResponse.data || []);
      setSuppliers(supplierResponse.suppliers || []);
    }).catch((err) => {
      if (err.name !== "AbortError") setError(err.message);
    });

    return () => controller.abort();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();

    setLoading(true);
    setError("");

    purchasingApi.purchases(token, { page, limit: 20, ...(admin ? { branchId } : {}) }, controller.signal)
      .then((response) => setData(response))
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      }).finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [token, admin, branchId, page, refresh]);

  const rows = data.purchases || [];
  const pageTotal = rows.reduce((sum, item) => sum + (item.totalCost || 0), 0);
  const pageOutstanding = rows.reduce((sum, item) => sum + (item.balanceDue || 0), 0);

  return (
    <main className="jbp-page">
      <PageTitle title="Purchases" subtitle="Record new stock receipts and review supplier purchasing history."
        action={<button className="jbp-btn" onClick={() => setCreating(true)}><PackagePlus size={17} /> New Purchase</button>} />

      <div className="jbp-stats">
        <div className="jbp-card"><span className="jbp-card-label">Purchase records</span><strong>{data.total || 0}</strong><small>Matching the selected branch</small></div>
        <div className="jbp-card"><span className="jbp-card-label">Value on this page</span><strong>{cedis(pageTotal)}</strong><small>Current page only</small></div>
        <div className="jbp-card"><span className="jbp-card-label">Outstanding on this page</span><strong>{cedis(pageOutstanding)}</strong><small>Current page only</small></div>
        <div className="jbp-card"><span className="jbp-card-label">Transactions displayed</span><strong>{rows.length}</strong><small>Page {page}</small></div>
      </div>

      <section className="jbp-panel">
        <div className="jbp-toolbar">
          {admin && <select aria-label="Filter branch" className="jbp-input" value={branchId} onChange={(event) => { setBranchId(event.target.value); setPage(1); }}>
            <option value="">All branches</option>
            {branches.map((branch) => <option key={branch._id} value={branch._id}>{branch.name}</option>)}
          </select>}
          <span className="jbp-hint">Financial cards above describe the visible page, not lifetime totals.</span>
        </div>

        <ErrorText>{error}</ErrorText>

        {loading ? <p className="jbp-empty">Loading purchases...</p> : rows.length === 0 ? <p className="jbp-empty">No purchases recorded yet.</p> : (
          <div className="jbp-table-scroll">
            <table className="jbp-table">
              <thead><tr><th>Date</th><th>Supplier</th><th>Branch</th><th>Items</th><th>Total cost</th><th>Paid</th><th>Balance</th><th>Status</th><th>Details</th></tr></thead>
              <tbody>{rows.map((purchase) => (
                <tr key={purchase._id}>
                  <td>{dateTime(purchase.purchasedAt)}</td>
                  <td><strong>{purchase.supplier?.name || "Unknown"}</strong></td>
                  <td>{purchase.branch?.name || "—"}</td>
                  <td>{purchase.items?.reduce((total, line) => total + line.quantity, 0) || 0} pairs</td>
                  <td>{cedis(purchase.totalCost)}</td>
                  <td>{cedis(purchase.amountPaid)}</td>
                  <td>{cedis(purchase.balanceDue)}</td>
                  <td><Status value={purchase.paymentStatus} /></td>
                  <td><button className="jbp-link" onClick={() => setSelected(purchase)}>View</button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}

        <Pagination page={page} totalPages={data.totalPages || 0} onPage={setPage} />
      </section>

      {creating && <NewPurchase token={token} admin={admin} userBranch={assignedBranch} suppliers={suppliers} branches={branches}
        onClose={() => setCreating(false)} onSaved={() => { setCreating(false); setPage(1); setRefresh((n) => n + 1); }} />}

      {selected && <Modal title="Purchase Details" onClose={() => setSelected(null)} wide>
        <p><strong>Supplier:</strong> {selected.supplier?.name || "—"}</p>
        <p><strong>Branch:</strong> {selected.branch?.name || "—"}</p>
        <p><strong>Invoice:</strong> {selected.supplierInvoiceNumber || "—"}</p>
        <div className="jbp-table-scroll"><table className="jbp-table"><thead><tr><th>Shoe</th><th>Variant</th><th>Quantity</th><th>Unit cost</th><th>Total</th></tr></thead>
          <tbody>{(selected.items || []).map((item, index) => <tr key={`${item.variant}-${index}`}><td>{item.productName}</td><td>{item.size} / {item.color}</td><td>{item.quantity}</td><td>{cedis(item.unitCost)}</td><td>{cedis(item.totalCost)}</td></tr>)}</tbody></table></div>
        <p><strong>Purchase total:</strong> {cedis(selected.totalCost)} · <strong>Outstanding:</strong> {cedis(selected.balanceDue)}</p>
      </Modal>}
    </main>
  );
}
