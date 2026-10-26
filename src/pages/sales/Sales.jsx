import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, CreditCard, Plus, Receipt, ShoppingCart } from "lucide-react";
import { useAuth } from "../login/features/AuthProvider";
import { salesApi } from "../../services/salesApi";
import {
  Dialog, Empty, formatDate, Header, Loading, Metric,
  money, Notice, Panel, saleDate, dateInput,
} from "../commerce/components/CommerceUI";
import NewSale from "./features/NewSale";

export default function Sales() {
  const { session } = useAuth();
  const token = session?.token;
  const admin = session?.user?.role === "admin";

  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState("");
  const [day, setDay] = useState(dateInput());
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("day");
  const [data, setData] = useState({ sales: [], total: 0, totalPages: 0 });
  const [summary, setSummary] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newSaleOpen, setNewSaleOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!token || !admin) return;

    const controller = new AbortController();

    salesApi.branches(token, controller.signal)
      .then((response) => setBranches(response.branches || response.data || []))
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      });

    return () => controller.abort();
  }, [token, admin]);

  const refresh = useCallback(() => setReload((value) => value + 1), []);

  useEffect(() => {
    setPage(1);
  }, [branchId, day, period]);

  useEffect(() => {
    if (!token) return;

    const controller = new AbortController();
    const filters = {
      ...(admin && branchId ? { branchId } : {}),
      ...(period === "day" ? { startDate: day, endDate: day } : {}),
    };

    setLoading(true);
    setError("");

    Promise.all([
      salesApi.sales(token, { ...filters, page, limit: 20 }, controller.signal),
      salesApi.salesSummary(token, filters, controller.signal),
    ])
      .then(([history, totals]) => {
        setData(history);
        setSummary(totals.summary);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [token, admin, branchId, day, period, page, reload]);

  // Search is limited to the displayed page. Reporting totals are server-side.
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();

    return (data.sales || []).filter((sale) => {
      const customer = sale.customer?.name || "Walk-in customer";
      const branch = sale.branch?.name || "";
      const productNames = (sale.items || []).map((item) => item.productName || "").join(" ");
      const text = [sale._id, customer, branch, productNames].join(" ").toLowerCase();

      return !term || text.includes(term);
    });
  }, [data.sales, search]);

  return (
    <div className="jbc-page">
      <Header
        title="Sales"
        description="Review daily sales and transaction history across branches."
        actions={session?.user?.role !== "employee" ? (
          <button className="jbc-btn gold" onClick={() => setNewSaleOpen(true)}>
            <Plus size={17} /> New Sale
          </button>
        ) : null}
      />

      <div className="jbc-toolbar">
        {admin && (
          <label className="jbc-field">
            Branch
            <select value={branchId} onChange={(event) => setBranchId(event.target.value)}>
              <option value="">All branches</option>
              {branches.map((branch) => (
                <option key={branch._id} value={branch._id}>{branch.name}</option>
              ))}
            </select>
          </label>
        )}

        <label className="jbc-field">
          History
          <select value={period} onChange={(event) => setPeriod(event.target.value)}>
            <option value="day">Daily sales</option>
            <option value="all">All sales history</option>
          </select>
        </label>

        {period === "day" && (
          <label className="jbc-field">
            Sales date
            <input type="date" value={day} onChange={(event) => setDay(event.target.value)} />
          </label>
        )}

        <label className="jbc-field grow">
          Search displayed page
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search current page" />
        </label>

        <button className="jbc-btn ghost" onClick={refresh}>Refresh</button>
      </div>

      <Notice error={error} />

      <div className="jbc-kpis">
        <Metric icon={ShoppingCart} label="Sales transactions" value={summary?.transactions ?? "—"} hint={period === "day" ? day : "All dates"} />
        <Metric icon={Receipt} label="Sales revenue" value={summary ? money(summary.revenue) : "—"} hint="All matching transactions" />
        <Metric icon={CreditCard} label="Paid against these sales" value={summary ? money(summary.amountPaid) : "—"} hint="Includes repayments made later" />
        <Metric icon={CalendarDays} label="Units sold / balance due" value={summary ? `${summary.itemsSold} / ${money(summary.balanceDue)}` : "—"} hint="Full selected period" />
      </div>

      <Panel title={period === "day" ? `Sales for ${day}` : "Sales transaction history"}>
        {loading ? <Loading /> : rows.length === 0 ? <Empty>No sales found for these filters.</Empty> : (
          <div className="jbc-table-wrap">
            <table className="jbc-table">
              <thead><tr><th>Date / time</th><th>Sale reference</th><th>Customer</th><th>Branch</th><th>Items</th><th>Total</th><th>Paid</th><th>Balance due</th><th>Payment</th><th>Actions</th></tr></thead>
              <tbody>
                {rows.map((sale) => (
                  <tr key={sale._id}>
                    <td>{formatDate(sale.soldAt || sale.createdAt)}</td>
                    <td><strong>{sale._id.slice(-8).toUpperCase()}</strong></td>
                    <td>{sale.customer?.name || "Walk-in customer"}</td>
                    <td>{sale.branch?.name || "Assigned branch"}</td>
                    <td>{(sale.items || []).reduce((sum, item) => sum + (item.quantity || 0), 0)}</td>
                    <td>{money(sale.total)}</td>
                    <td>{money(sale.amountPaid)}</td>
                    <td>{money(sale.balanceDue)}</td>
                    <td><span className={`jbc-status ${sale.paymentStatus}`}>{sale.paymentStatus}</span></td>
                    <td><button className="jbc-mini" onClick={() => setSelected(sale)}>Details</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="jbc-form-actions" style={{ justifyContent: "space-between" }}>
          <span>Page {page} of {Math.max(1, data.totalPages || 1)} · {data.total || 0} sales</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="jbc-btn ghost" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>Previous</button>
            <button className="jbc-btn ghost" disabled={page >= (data.totalPages || 1) || loading} onClick={() => setPage((value) => value + 1)}>Next</button>
          </div>
        </div>
      </Panel>

      {newSaleOpen && (
        <NewSale
          token={token}
          admin={admin}
          branches={branches}
          preferredBranchId={branchId}
          assignedBranchId={session?.user?.branch?._id || session?.user?.branch || ""}
          onClose={() => setNewSaleOpen(false)}
          onSaved={() => { setNewSaleOpen(false); refresh(); }}
        />
      )}

      {selected && (
        <Dialog title="Sale details" onClose={() => setSelected(null)} wide>
          <p><strong>Sale:</strong> {selected._id}</p>
          <p><strong>Customer:</strong> {selected.customer?.name || "Walk-in customer"}</p>
          <p><strong>Branch:</strong> {selected.branch?.name || "Assigned branch"}</p>
          <div className="jbc-table-wrap">
            <table className="jbc-table">
              <thead><tr><th>Product</th><th>Qty</th><th>Price</th><th>Line total</th></tr></thead>
              <tbody>{(selected.items || []).map((item) => (
                <tr key={item._id || `${item.variant}-${item.productName}-${item.quantity}`}><td>{item.productName}</td><td>{item.quantity}</td><td>{money(item.unitPrice)}</td><td>{money(item.lineTotal)}</td></tr>
              ))}</tbody>
            </table>
          </div>
          <p><strong>Total:</strong> {money(selected.total)} · <strong>Paid:</strong> {money(selected.amountPaid)} · <strong>Balance:</strong> {money(selected.balanceDue)}</p>
          <div className="jbc-form-actions"><button className="jbc-btn" onClick={() => setSelected(null)}>Close</button></div>
        </Dialog>
      )}
    </div>
  );
}
