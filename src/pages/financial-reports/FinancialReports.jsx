import { useEffect, useState } from "react";
import { useAuth } from "../login/features/AuthProvider";
import { financeApi, downloadFinanceReport } from "../../services/financeApi";
import { BranchSelect, FinanceCard, FinanceHeader, FinanceNotice, money, monthStart, today } from "../finance/components/FinanceUI";

export default function FinancialReports() {
  const { session } = useAuth();
  const token = session?.token;
  const admin = session?.user?.role === "admin";
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState("");
  const [startDate, setStartDate] = useState(monthStart());
  const [endDate, setEndDate] = useState(today());
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState("");

  useEffect(() => {
    if (!token || !admin) return;

    const controller = new AbortController();
    financeApi.branches(token, controller.signal)
      .then((result) => setBranches(result.branches || result.data || []))
      .catch((err) => { if (err.name !== "AbortError") setError(err.message); });

    return () => controller.abort();
  }, [token, admin]);

  const filters = { branchId: admin ? branchId : undefined, startDate, endDate };

  useEffect(() => {
    if (!token || (startDate && endDate && startDate > endDate)) return;

    const controller = new AbortController();
    setLoading(true);
    setError("");

    financeApi.report(token, filters, controller.signal)
      .then((result) => setReport(result.dashboard))
      .catch((err) => { if (err.name !== "AbortError") setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });

    return () => controller.abort();
  }, [token, admin, branchId, startDate, endDate]);

  async function exportReport(kind) {
    setError("");
    setDownloading(kind);

    try {
      await downloadFinanceReport(token, filters, kind);
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloading("");
    }
  }

  const performance = report?.performance || {};
  const payments = report?.paymentsInPeriod || {};
  const balances = report?.currentBalances || {};
  const categoryData = report?.charts?.expensesByCategory || [];
  const maxExpense = Math.max(...categoryData.map((item) => item.amount || 0), 1);

  return (
    <main className="jbf-page">
      <FinanceHeader title="Financial Reports" description="Reliable branch financial performance, with downloadable PDF and Excel reports.">
        <button className="jbf-button ghost" disabled={loading || !report || !!downloading} onClick={() => exportReport("pdf")}>{downloading === "pdf" ? "Preparing…" : "Download PDF"}</button>
        <button className="jbf-button gold" disabled={loading || !report || !!downloading} onClick={() => exportReport("xlsx")}>{downloading === "xlsx" ? "Preparing…" : "Download Excel"}</button>
      </FinanceHeader>

      <FinanceNotice>{error}</FinanceNotice>
      <section className="jbf-panel jbf-filters">
        <BranchSelect admin={admin} branches={branches} branchId={branchId} onChange={setBranchId} />
        <label>From<input type="date" value={startDate} max={endDate} onChange={(e) => setStartDate(e.target.value)} /></label>
        <label>To<input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} /></label>
      </section>

      {loading ? <div className="jbf-panel">Loading report…</div> : report && (
        <>
          <div className="jbf-grid">
            <FinanceCard label="Sales revenue" value={money(performance.revenue)} help={`${performance.salesCount || 0} transactions in period`} />
            <FinanceCard label="Cost of goods sold" value={money(performance.costOfGoodsSold)} help="Historical stock cost" />
            <FinanceCard label="Gross profit" value={money(performance.grossProfit)} help="Revenue less cost of products sold" />
            <FinanceCard label="Operating expenses" value={money(performance.operatingExpenses)} help="Posted expenses in period" />
            <FinanceCard label="Operating result" value={money(performance.netOperatingResult)} help="Gross profit less operating expenses" />
            <FinanceCard label="Customer payments received" value={money(payments.customerPaymentsReceived)} help="Received during selected period" />
            <FinanceCard label="Customer debt (current)" value={money(balances.customerDebt)} help="Current outstanding balances, not historical" />
            <FinanceCard label="Inventory value (current)" value={money(balances.inventoryValue)} help={`${balances.inventoryPairs || 0} pairs in stock`} />
          </div>

          <section className="jbf-panel">
            <h2>Expenses by Category</h2>
            {categoryData.length === 0 ? <p className="jbf-muted">No posted expenses in this period.</p> : (
              <div className="jbf-chart">
                {categoryData.map((item) => (
                  <div className="jbf-bar-row" key={item.category}>
                    <span>{item.category}</span>
                    <div className="jbf-bar-track"><div className="jbf-bar-fill" style={{ width: `${((item.amount || 0) / maxExpense) * 100}%` }} /></div>
                    <strong>{money(item.amount)}</strong>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="jbf-panel">
            <h2>Daily Sales History</h2>
            <div className="jbf-table-wrap">
              <table className="jbf-table">
                <thead><tr><th>Date</th><th>Transactions</th><th>Revenue</th></tr></thead>
                <tbody>
                  {(report.charts?.dailySales || []).map((item) => <tr key={item.date}><td>{item.date}</td><td>{item.salesCount}</td><td>{money(item.revenue)}</td></tr>)}
                  {!report.charts?.dailySales?.length && <tr><td colSpan={3}>No sales in this period.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          {report.warnings?.length > 0 && <section className="jbf-panel"><h2>Financial Qualifications</h2>{report.warnings.map((warning, index) => <FinanceNotice type="info" key={index}>{warning}</FinanceNotice>)}</section>}
        </>
      )}
    </main>
  );
}
