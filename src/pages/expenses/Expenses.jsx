import { useEffect, useState } from "react";
import { useAuth } from "../login/features/AuthProvider";
import { financeApi } from "../../services/financeApi";
import {
  BranchSelect, categories, FinanceCard, FinanceHeader,
  FinanceNotice, money, monthStart, today,
} from "../finance/components/FinanceUI";

const initialForm = () => ({
  branchId: "", category: "transport", description: "",
  amount: "", paymentMethod: "cash", paymentReference: "",
  expenseDate: today(),
});

export default function Expenses() {
  const { session } = useAuth();
  const token = session?.token;
  const admin = session?.user?.role === "admin";
  const userBranch = session?.user?.branch?._id || session?.user?.branch || "";

  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState("");
  const [startDate, setStartDate] = useState(monthStart());
  const [endDate, setEndDate] = useState(today());
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("posted");
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState({ expenses: [], summary: [], totalPages: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token || !admin) return;

    const controller = new AbortController();
    financeApi.branches(token, controller.signal)
      .then((result) => setBranches(result.branches || result.data || []))
      .catch((err) => { if (err.name !== "AbortError") setError(err.message); });

    return () => controller.abort();
  }, [token, admin]);

  useEffect(() => {
    if (!token) return;

    const controller = new AbortController();
    setLoading(true);
    setError("");

    financeApi.expenses(token, {
      branchId: admin ? branchId : undefined,
      startDate,
      endDate,
      category,
      status,
      page,
      limit: 20,
    }, controller.signal)
      .then(setData)
      .catch((err) => { if (err.name !== "AbortError") setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });

    return () => controller.abort();
  }, [token, admin, branchId, startDate, endDate, category, status, page, refresh]);

  const totals = Object.fromEntries((data.summary || []).map((item) => [item._id, item]));
  const updateForm = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const reset = () => { setPage(1); setRefresh((n) => n + 1); };

  async function submitExpense(event) {
    event.preventDefault();

    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isSafeInteger(Math.round(amount * 100))) {
      setError("Enter a valid expense amount.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await financeApi.createExpense(token, {
        ...form,
        branchId: admin ? form.branchId : userBranch,
        amount: Math.round(amount * 100),
        requestKey: crypto.randomUUID(),
      });

      setDialog(false);
      setForm(initialForm());
      reset();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function reverse(expense) {
    const reason = window.prompt("Why should this expense be reversed? (minimum 5 characters)");
    if (reason === null) return;
    if (reason.trim().length < 5) {
      setError("A reversal reason of at least 5 characters is required.");
      return;
    }

    try {
      await financeApi.reverseExpense(token, expense._id, reason.trim());
      reset();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="jbf-page">
      <FinanceHeader title="Expenses" description="Operating expenses and expense history, organized by branch.">
        <button className="jbf-button gold" onClick={() => {
          setForm({ ...initialForm(), branchId: admin ? (branchId || "") : userBranch });
          setDialog(true);
        }}>+ Record Expense</button>
      </FinanceHeader>

      <FinanceNotice>{error}</FinanceNotice>

      <section className="jbf-panel jbf-filters">
        <BranchSelect admin={admin} branches={branches} branchId={branchId} onChange={(value) => { setBranchId(value); setPage(1); }} />
        <label>From<input type="date" value={startDate} max={endDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} /></label>
        <label>To<input type="date" value={endDate} min={startDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} /></label>
        <label>Category<select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}><option value="">All categories</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label>Status<select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="posted">Posted</option><option value="reversed">Reversed</option><option value="all">All</option></select></label>
      </section>

      <div className="jbf-grid">
        <FinanceCard label="Posted expenses" value={money(totals.posted?.totalAmount ?? 0)} help="Matching branch, dates and category" />
        <FinanceCard label="Reversed expenses" value={money(totals.reversed?.totalAmount ?? 0)} help="Shown when status permits" />
        <FinanceCard label="Expense records" value={String(data.total || 0)} help="Matching your filters" />
        <FinanceCard label="Current page" value={`${page} / ${Math.max(1, data.totalPages || 1)}`} help="20 records per page" />
      </div>

      <section className="jbf-panel">
        <h2>Expense History</h2>
        <div className="jbf-table-wrap">
          <table className="jbf-table">
            <thead><tr><th>Date</th><th>Branch</th><th>Category</th><th>Description</th><th>Payment</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {!loading && (data.expenses || []).length === 0 && <tr><td colSpan={8}>No expenses found for this selection.</td></tr>}
              {loading && <tr><td colSpan={8}>Loading expenses…</td></tr>}
              {!loading && (data.expenses || []).map((expense) => (
                <tr key={expense._id}>
                  <td>{String(expense.expenseDate || "").slice(0, 10)}</td>
                  <td>{expense.branch?.name || "—"}</td>
                  <td>{expense.category}</td>
                  <td>{expense.description}</td>
                  <td>{expense.paymentMethod}</td>
                  <td>{money(expense.amount)}</td>
                  <td>{expense.status}</td>
                  <td>{admin && expense.status === "posted" ? <button className="jbf-button ghost" onClick={() => reverse(expense)}>Reverse</button> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="jbf-pager"><span>{data.total || 0} matching records</span><div className="jbf-actions"><button className="jbf-button ghost" disabled={page <= 1} onClick={() => setPage((n) => n - 1)}>Previous</button><button className="jbf-button ghost" disabled={page >= (data.totalPages || 1)} onClick={() => setPage((n) => n + 1)}>Next</button></div></div>
      </section>

      {dialog && (
        <div className="jbf-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDialog(false); }}>
          <section className="jbf-modal" role="dialog" aria-modal="true" aria-label="Record expense">
            <h2>Record an Expense</h2>
            <form onSubmit={submitExpense}>
              <div className="jbf-form">
                <BranchSelect admin={admin} allowAll={false} required branches={branches} branchId={form.branchId} onChange={(value) => updateForm("branchId", value)} />
                <label>Category<select required value={form.category} onChange={(e) => updateForm("category", e.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label className="full">Description<textarea required minLength={3} maxLength={500} value={form.description} onChange={(e) => updateForm("description", e.target.value)} /></label>
                <label>Amount (GH₵)<input required type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => updateForm("amount", e.target.value)} /></label>
                <label>Expense date<input required type="date" value={form.expenseDate} onChange={(e) => updateForm("expenseDate", e.target.value)} /></label>
                <label>Payment method<select value={form.paymentMethod} onChange={(e) => updateForm("paymentMethod", e.target.value)}><option value="cash">Cash</option><option value="momo">MoMo</option><option value="bank">Bank</option></select></label>
                <label>Payment reference<input maxLength={150} value={form.paymentReference} onChange={(e) => updateForm("paymentReference", e.target.value)} /></label>
              </div>
              <div className="jbf-modal-buttons"><button type="button" className="jbf-button ghost" onClick={() => setDialog(false)}>Cancel</button><button className="jbf-button gold" type="submit" disabled={saving}>{saving ? "Saving…" : "Save Expense"}</button></div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
