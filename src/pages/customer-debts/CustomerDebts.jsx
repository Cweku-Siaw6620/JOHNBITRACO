import { useEffect, useMemo, useState } from "react";
import { CircleDollarSign, CreditCard, HandCoins, Wallet } from "lucide-react";
import { useAuth } from "../login/features/AuthProvider";
import { salesApi } from "../../services/salesApi";
import {
  Dialog, Empty, formatDate, Header, Loading, Metric,
  money, Notice, Panel, toPesewas,
} from "../commerce/components/CommerceUI";

export default function CustomerDebts() {
  const { session } = useAuth();
  const token = session?.token;
  const admin = session?.user?.role === "admin";

  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState("");
  const [debts, setDebts] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({ totalDebt: 0, numberOfSales: 0 });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [selected, setSelected] = useState(null);
  const [payments, setPayments] = useState([]);
  const [paymentsError, setPaymentsError] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!admin || !token) return;

    const controller = new AbortController();
    salesApi.branches(token, controller.signal)
      .then((response) => setBranches(response.branches || response.data || []))
      .catch((err) => { if (err.name !== "AbortError") setError(err.message); });

    return () => controller.abort();
  }, [admin, token]);

  useEffect(() => {
    setPage(1);
  }, [branchId]);

  useEffect(() => {
    if (!token) return;

    const controller = new AbortController();
    setLoading(true);
    setError("");

    salesApi.debts(token, { ...(admin && branchId ? { branchId } : {}), page, limit: 20 }, controller.signal)
      .then((response) => {
        setDebts(response.debts || []);
        setTotalPages(response.totalPages || 0);
        setTotal(response.total || 0);
        setSummary(response.summary || { totalDebt: 0, numberOfSales: 0 });
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [token, admin, branchId, page, reload]);

  function selectSale(sale) {
    setSelected(sale);
    setAmount("");
    setReference("");
    setMethod("cash");
    setRequestKey(crypto.randomUUID());
    setPayments([]);
    setPaymentsError("");

    salesApi.payments(token, sale._id)
      .then((response) => setPayments(response.payments || []))
      .catch((err) => setPaymentsError(err.message));
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return debts;

    return debts.filter((sale) => [
      sale.customer?.name,
      sale.customer?.phone,
      sale._id,
      sale.branch?.name,
    ].filter(Boolean).join(" ").toLowerCase().includes(term));
  }, [debts, search]);

  async function recordPayment(event) {
    event.preventDefault();
    setPaymentsError("");

    try {
      const amountInPesewas = toPesewas(amount);
      if (amountInPesewas <= 0) throw new Error("Payment must be greater than zero.");
      if (amountInPesewas > selected.balanceDue) throw new Error("Payment exceeds the outstanding balance.");

      setSaving(true);
      await salesApi.recordPayment(token, selected._id, {
        requestKey,
        amount: amountInPesewas,
        method,
        reference,
      });

      setSelected(null);
      setReload((value) => value + 1);
    } catch (err) {
      setPaymentsError(err.message);
      // Keep requestKey unchanged if the network result was uncertain: prevents duplicate payment on retry.
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="jbc-page">
      <Header title="Customer Debts" description="Outstanding credit sales and customer repayments by branch." />

      <div className="jbc-toolbar">
        {admin && (
          <label className="jbc-field">
            Branch
            <select value={branchId} onChange={(event) => setBranchId(event.target.value)}>
              <option value="">All branches</option>
              {branches.map((branch) => <option key={branch._id} value={branch._id}>{branch.name}</option>)}
            </select>
          </label>
        )}
        <label className="jbc-field grow">
          Search displayed page
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search current page" />
        </label>
        <button className="jbc-btn" onClick={() => setReload((value) => value + 1)}>Refresh</button>
      </div>

      <Notice error={error} />

      <div className="jbc-kpis" style={{ gridTemplateColumns: "repeat(2,minmax(0,1fr))" }}>
        <Metric icon={Wallet} label="Total outstanding" value={money(summary.totalDebt)} hint="Calculated across all outstanding sales" />
        <Metric icon={CircleDollarSign} label="Credit sales outstanding" value={summary.numberOfSales} hint="All matching unpaid or partial sales" />
      </div>

      <Panel title="Outstanding customer balances">
        {loading ? <Loading /> : filtered.length === 0 ? <Empty>No outstanding credit sales match your filters.</Empty> : (
          <div className="jbc-table-wrap">
            <table className="jbc-table">
              <thead><tr><th>Date</th><th>Customer</th><th>Phone</th><th>Branch</th><th>Sale ID</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>{filtered.map((sale) => (
                <tr key={sale._id}>
                  <td>{formatDate(sale.soldAt || sale.createdAt)}</td>
                  <td><strong>{sale.customer?.name || "Unassigned"}</strong></td>
                  <td>{sale.customer?.phone || "—"}</td>
                  <td>{sale.branch?.name || "Assigned branch"}</td>
                  <td>{sale._id.slice(-8).toUpperCase()}</td>
                  <td>{money(sale.total)}</td>
                  <td>{money(sale.amountPaid)}</td>
                  <td><strong>{money(sale.balanceDue)}</strong></td>
                  <td><span className={`jbc-status ${sale.paymentStatus}`}>{sale.paymentStatus}</span></td>
                  <td><button className="jbc-mini" onClick={() => selectSale(sale)}>Repay / History</button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        <div className="jbc-form-actions" style={{ justifyContent: "space-between" }}>
          <span>Page {page} of {Math.max(1, totalPages)} · {total} outstanding sales</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="jbc-btn ghost" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>Previous</button>
            <button className="jbc-btn ghost" disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)}>Next</button>
          </div>
        </div>
      </Panel>

      {selected && (
        <Dialog title="Customer repayment" onClose={() => setSelected(null)} wide>
          <div className="jbc-form-grid">
            <p><strong>Customer:</strong> {selected.customer?.name || "Unassigned"}</p>
            <p><strong>Outstanding:</strong> {money(selected.balanceDue)}</p>
          </div>

          <Notice error={paymentsError} />

          <form onSubmit={recordPayment}>
            <div className="jbc-form-grid">
              <label className="jbc-field">Payment amount (GH₵)<input required inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" /></label>
              <label className="jbc-field">Payment method<select value={method} onChange={(event) => setMethod(event.target.value)}><option value="cash">Cash</option><option value="momo">Mobile Money</option><option value="bank">Bank</option></select></label>
              <label className="jbc-field full">Transaction reference<input maxLength={150} value={reference} onChange={(event) => setReference(event.target.value)} /></label>
            </div>
            <div className="jbc-form-actions">
              <button className="jbc-btn" type="button" onClick={() => setSelected(null)}>Cancel</button>
              <button className="jbc-btn burgundy" type="submit" disabled={saving}>{saving ? "Recording..." : "Record repayment"}</button>
            </div>
          </form>

          <h3 style={{ fontFamily: "Georgia, serif", marginTop: 24 }}>Payment history</h3>
          <div className="jbc-table-wrap">
            <table className="jbc-table"><thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Reference</th></tr></thead>
              <tbody>{payments.map((payment) => (
                <tr key={payment._id}><td>{formatDate(payment.paidAt)}</td><td>{money(payment.amount)}</td><td>{payment.method}</td><td>{payment.reference || "—"}</td></tr>
              ))}</tbody>
            </table>
          </div>
          {payments.length === 0 && <Empty>No payments found, or payment history has not loaded.</Empty>}
        </Dialog>
      )}
    </div>
  );
}
