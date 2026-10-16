import { useEffect, useState } from "react";
import { HandCoins, Wallet } from "lucide-react";
import { useAuth } from "../login/features/AuthProvider";
import { purchasingApi } from "../../services/purchasingApi";
import { cedis, dateTime, ErrorText, Modal, PageTitle, Pagination, pesewas, Status } from "../purchasing/components/PurchasingUI";

export default function SupplierDebts() {
  const { session } = useAuth();
  const token = session?.token;
  const admin = session?.user?.role === "admin";

  const [branches, setBranches] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [branchId, setBranchId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ purchases: [], summary: {}, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [payments, setPayments] = useState([]);
  const [paymentError, setPaymentError] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const [saving, setSaving] = useState(false);
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

    purchasingApi.debts(token, {
      ...(admin ? { branchId } : {}),
      supplierId,
      status,
      page,
      limit: 20,
    }, controller.signal)
      .then(setData)
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [token, admin, branchId, supplierId, status, page, refresh]);

  function openPayment(purchase) {
    setSelected(purchase);
    setPayments([]);
    setPaymentError("");
    setAmount("");
    setMethod("cash");
    setReference("");
    setNotes("");
    setRequestKey(crypto.randomUUID());

    purchasingApi.payments(token, purchase._id)
      .then((response) => setPayments(response.payments || []))
      .catch((err) => setPaymentError(err.message));
  }

  async function savePayment(event) {
    event.preventDefault();
    setPaymentError("");

    try {
      const value = pesewas(amount);

      if (value <= 0 || value > selected.balanceDue) {
        throw new Error("Payment must be positive and cannot exceed the outstanding balance.");
      }

      setSaving(true);

      await purchasingApi.repay(token, selected._id, {
        requestKey,
        amount: value,
        method,
        reference,
        notes,
      });

      setSelected(null);
      setRefresh((n) => n + 1);
    } catch (err) {
      setPaymentError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const summary = data.summary || {};

  return (
    <main className="jbp-page">
      <PageTitle title="Supplier Debts" subtitle="Outstanding purchase balances and repayment history for each branch." />

      <div className="jbp-stats">
        <div className="jbp-card"><span className="jbp-card-label">Outstanding balance</span><strong>{cedis(summary.totalOutstanding ?? 0)}</strong><small>All matching purchase records</small></div>
        <div className="jbp-card"><span className="jbp-card-label">Purchase value</span><strong>{cedis(summary.totalPurchaseValue ?? 0)}</strong><small>All matching records</small></div>
        <div className="jbp-card"><span className="jbp-card-label">Paid to suppliers</span><strong>{cedis(summary.totalPaid ?? 0)}</strong><small>All matching records</small></div>
        <div className="jbp-card"><span className="jbp-card-label">Matching invoices</span><strong>{data.total || 0}</strong><small>Across all pages</small></div>
      </div>

      <section className="jbp-panel">
        <div className="jbp-toolbar">
          {admin && <select aria-label="Branch" className="jbp-input" value={branchId} onChange={(event) => { setBranchId(event.target.value); setPage(1); }}>
            <option value="">All branches</option>
            {branches.map((branch) => <option key={branch._id} value={branch._id}>{branch.name}</option>)}
          </select>}

          <select aria-label="Supplier" className="jbp-input" value={supplierId} onChange={(event) => { setSupplierId(event.target.value); setPage(1); }}>
            <option value="">All suppliers</option>
            {suppliers.map((supplier) => <option key={supplier._id} value={supplier._id}>{supplier.name}</option>)}
          </select>

          <select aria-label="Payment status" className="jbp-input" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
            <option value="">Outstanding only</option>
            <option value="unpaid">Unpaid</option>
            <option value="partial">Partially paid</option>
            <option value="paid">Fully paid</option>
          </select>
        </div>

        <ErrorText>{error}</ErrorText>

        {loading ? <p className="jbp-empty">Loading supplier debts...</p> : !(data.purchases || []).length ? <p className="jbp-empty">No matching purchase balances.</p> : <div className="jbp-table-scroll">
          <table className="jbp-table">
            <thead><tr><th>Supplier</th><th>Branch</th><th>Date</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th><th>History / Payment</th></tr></thead>
            <tbody>{(data.purchases || []).map((purchase) => <tr key={purchase._id}>
              <td><strong>{purchase.supplier?.name || "—"}</strong></td>
              <td>{purchase.branch?.name || "—"}</td>
              <td>{dateTime(purchase.purchasedAt)}</td>
              <td>{cedis(purchase.totalCost)}</td>
              <td>{cedis(purchase.amountPaid)}</td>
              <td>{cedis(purchase.balanceDue)}</td>
              <td><Status value={purchase.paymentStatus} /></td>
              <td><button type="button" className="jbp-link" onClick={() => openPayment(purchase)}>{purchase.balanceDue > 0 ? "Repay / history" : "History"}</button></td>
            </tr>)}</tbody>
          </table>
        </div>}

        <Pagination page={page} totalPages={data.totalPages || 0} onPage={setPage} />
      </section>

      {selected && <Modal title="Supplier Repayments" onClose={() => setSelected(null)}>
        <p><strong>{selected.supplier?.name || "Supplier"}</strong></p>
        <p>Outstanding balance: <strong>{cedis(selected.balanceDue)}</strong></p>

        <h3>Recorded payments</h3>
        {payments.length === 0 ? <p className="jbp-hint">No payments returned for this purchase.</p> : <div className="jbp-table-scroll"><table className="jbp-table">
          <thead><tr><th>Paid at</th><th>Amount</th><th>Method</th></tr></thead>
          <tbody>{payments.map((payment) => <tr key={payment._id}><td>{dateTime(payment.paidAt)}</td><td>{cedis(payment.amount)}</td><td>{payment.method}</td></tr>)}</tbody>
        </table></div>}

        <ErrorText>{paymentError}</ErrorText>

        {selected.balanceDue > 0 && <form className="jbp-form" onSubmit={savePayment}>
          <h3>Record a repayment</h3>
          <div className="jbp-field"><label>Amount (GH₵)</label><input className="jbp-input" required inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} /></div>
          <div className="jbp-field"><label>Payment method</label><select className="jbp-input" value={method} onChange={(event) => setMethod(event.target.value)}><option value="cash">Cash</option><option value="momo">Mobile Money</option><option value="bank">Bank</option></select></div>
          <div className="jbp-field"><label>Reference (optional)</label><input className="jbp-input" value={reference} onChange={(event) => setReference(event.target.value)} /></div>
          <div className="jbp-field"><label>Notes (optional)</label><textarea className="jbp-input" rows="2" value={notes} onChange={(event) => setNotes(event.target.value)} /></div>
          <p className="jbp-hint">A network retry uses the same request key. Do not create a second payment if the first response is uncertain.</p>
          <div className="jbp-form-actions"><button className="jbp-btn" disabled={saving}>{saving ? "Recording..." : "Record Repayment"}</button></div>
        </form>}
      </Modal>}
    </main>
  );
}
