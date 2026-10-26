import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle, ArrowUpRight, BarChart3, CalendarDays, Coins,
  Package, ShoppingCart, Users, RefreshCw, Wallet, TrendingUp,
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip,
  XAxis, YAxis, Pie, PieChart, Cell,
} from "recharts";
import { useAuth } from "../login/features/AuthProvider";
import {
  loadFinancialDashboard, loadDashboardBranches,
  loadDashboardSales, loadDashboardStock,
} from "../../services/dashboard";
import "./styles/Dashboard.css";

const cash = value => value === null || value === undefined
  ? "Unavailable" : `GH₵ ${(value / 100).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const count = value => Number(value || 0).toLocaleString("en-GH");
const today = () => new Date().toISOString().slice(0, 10);
const firstDay = () => `${today().slice(0, 7)}-01`;
const toDate = iso => iso ? new Date(iso).toLocaleDateString("en-GH", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const dateLabel = iso => iso ? iso.slice(5) : "";

function StatCard({ label, value, icon: Icon, tone = "gold", caption }) {
  return <div className="jbd-stat">
    <div className={`jbd-stat-icon ${tone}`}><Icon size={27} strokeWidth={1.9} /></div>
    <div className="jbd-stat-copy"><span>{label}</span><strong>{value}</strong><small>{caption}</small></div>
    <div className="jbd-mini-bars" aria-hidden="true">{[25, 45, 35, 60, 47, 74, 92].map((h, i) => <i key={i} style={{height:`${h}%`}} />)}</div>
  </div>;
}

function Empty({ children = "No records for this period." }) { return <div className="jbd-empty">{children}</div>; }

export default function Dashboard() {
  const { session } = useAuth();
  const role = session?.user?.role || "employee";
  const [startDate, setStartDate] = useState(firstDay);
  const [endDate, setEndDate] = useState(today);
  const [branchId, setBranchId] = useState("");
  const [branches, setBranches] = useState([]);
  const [financial, setFinancial] = useState(null);
  const [sales, setSales] = useState([]);
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (!session?.token) return;
    const controller = new AbortController();
    if (role === "admin") {
      loadDashboardBranches(session.token, controller.signal).then(items => {
        if (Array.isArray(items)) setBranches(items);
      }).catch(() => {});
    }
    return () => controller.abort();
  }, [session?.token, role]);

  useEffect(() => {
    if (!session?.token) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    // Employee role currently has no authorized financial dashboard endpoint.
    if (role === "employee") { setLoading(false); return () => controller.abort(); }
    const filters = { startDate, endDate, ...(role === "admin" && branchId ? { branchId } : {}) };
    Promise.allSettled([
      loadFinancialDashboard(session.token, filters, controller.signal),
      loadDashboardSales(session.token, controller.signal),
    ]).then(([summary, recent]) => {
      if (controller.signal.aborted) return;
      if (summary.status === "fulfilled") setFinancial(summary.value);
      else { setFinancial(null); setError(summary.reason?.message || "Unable to load the dashboard."); }
      setSales(recent.status === "fulfilled" ? recent.value : []);
      setLoading(false);
    });
    return () => controller.abort();
  }, [session?.token, role, startDate, endDate, branchId, refresh]);

  const stockBranch = role === "admin" ? branchId : (session?.user?.branch?._id || session?.user?.branch || "");
  useEffect(() => {
    if (!session?.token || !stockBranch) { setStock([]); return; }
    const controller = new AbortController();
    loadDashboardStock(session.token, stockBranch, controller.signal)
      .then(setStock).catch(() => setStock([]));
    return () => controller.abort();
  }, [session?.token, stockBranch, refresh]);

  const performance = financial?.performance || {};
  const balances = financial?.currentBalances || {};
  const chartData = useMemo(() => (financial?.charts?.dailySales || []).map(r => ({
    date: dateLabel(r.date), revenue: (r.revenue || 0) / 100, sales: r.salesCount || 0,
  })), [financial]);
  const expenseData = useMemo(() => (financial?.charts?.expensesByCategory || [])
    .map(r => ({ name: r.category, value: r.amount / 100 })).filter(r => r.value > 0), [financial]);
  const chartColors = ["#850d19", "#d49a23", "#202123", "#7c8999", "#e0c99d"];

  if (role === "employee") {
    return <section className="jbd-page"><div className="jbd-heading"><div><p>Home &nbsp;›&nbsp; Dashboard</p><h1>Dashboard</h1><span>Welcome to JOHNBTRACO.</span></div></div><div className="jbd-panel jbd-employee"><Package size={32} /><h2>Stock viewing access</h2><p>Your employee account is restricted to viewing inventory in your assigned branch.</p><Link to="/inventory" className="jbd-primary-link">View Inventory <ArrowUpRight size={16}/></Link></div></section>;
  }

  return <section className="jbd-page">
    <div className="jbd-heading">
      <div><p>Home &nbsp;›&nbsp; <b>Dashboard</b></p><h1>Dashboard</h1><span>Overview of sales, stock, profit indicators and alerts.</span></div>
      <div className="jbd-filters">
        {role === "admin" && <select aria-label="Filter branch" value={branchId} onChange={e => setBranchId(e.target.value)}><option value="">All Branches</option>{branches.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}</select>}
        <label><CalendarDays size={16} /><input aria-label="Start date" type="date" value={startDate} max={endDate} onChange={e => setStartDate(e.target.value)} /> <span>—</span><input aria-label="End date" type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} /></label>
        <button title="Refresh" aria-label="Refresh dashboard" onClick={() => setRefresh(x => x + 1)}><RefreshCw size={17} /></button>
      </div>
    </div>
    {error && <div className="jbd-error" role="alert">{error} <button onClick={() => setRefresh(x=>x+1)}>Retry</button></div>}
    <div className="jbd-stats">
      <StatCard label="Total Sales" value={loading ? "…" : count(performance.salesCount)} icon={ShoppingCart} caption="Transactions in period" />
      <StatCard label="Revenue" value={loading ? "…" : cash(performance.revenue)} icon={Coins} caption="Sales in selected period" />
      <StatCard label="Gross Profit" value={loading ? "…" : cash(performance.grossProfit)} icon={TrendingUp} caption={performance.profitAvailable ? "Before operating costs" : "Cost verification needed"} />
      <StatCard label="Inventory Value" value={loading ? "…" : cash(balances.inventoryValue)} icon={Package} caption="Current stock valuation" />
      <StatCard label="Customer Debts" value={loading ? "…" : cash(balances.customerDebt)} icon={Users} tone="red" caption="Current outstanding" />
      <StatCard label="Low Stock Alerts" value={loading ? "…" : count(balances.lowStockVariants)} icon={AlertTriangle} tone="red" caption="Variants below threshold" />
    </div>
    <div className="jbd-main-row">
      <div className="jbd-panel jbd-sales-chart"><div className="jbd-panel-heading"><h2><BarChart3 size={20}/> Sales & Revenue Overview</h2><span>Daily revenue (GH₵)</span></div>
        {chartData.length ? <div className="jbd-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 12, right: 12, bottom: 2, left: 0 }}><defs><linearGradient id="jbRevenue" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8b2420" stopOpacity={.25}/><stop offset="100%" stopColor="#8b2420" stopOpacity={.01}/></linearGradient></defs><CartesianGrid stroke="#eee" vertical={false}/><XAxis dataKey="date" tick={{fontSize:11}} axisLine={false} tickLine={false}/><YAxis width={46} tick={{fontSize:11}} axisLine={false} tickLine={false}/><Tooltip formatter={v=>`GH₵ ${Number(v).toLocaleString("en-GH",{minimumFractionDigits:2})}`} /><Area type="monotone" dataKey="revenue" name="Revenue" stroke="#8b2420" strokeWidth={3} fill="url(#jbRevenue)" /></AreaChart></ResponsiveContainer></div> : <Empty>No sales chart data for the selected dates.</Empty>}
      </div>
      <div className="jbd-panel jbd-summary"><div className="jbd-panel-heading"><h2><BarChart3 size={20}/> Financial Summary</h2><span>Selected period</span></div>
        {[ ["Total Revenue", cash(performance.revenue)], ["Total Expenses",cash(performance.operatingExpenses)], ["Customer Debts",cash(balances.customerDebt)], ["Supplier Debts",cash(balances.supplierDebt)] ].map(([label,value]) => <div className="jbd-summary-line" key={label}><span>{label}</span><strong>{value}</strong></div>)}
        <div className="jbd-summary-result"><span>Net Operating Result</span><strong>{cash(performance.netOperatingResult)}</strong></div>
      </div>
      <div className="jbd-panel jbd-stock-chart"><div className="jbd-panel-heading"><h2><Package size={20}/> Expense Breakdown</h2><span>By category</span></div>
        {expenseData.length ? <><div className="jbd-donut"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={expenseData} dataKey="value" nameKey="name" innerRadius="66%" outerRadius="87%" paddingAngle={2}>{expenseData.map((_,i) => <Cell key={i} fill={chartColors[i % chartColors.length]} />)}</Pie><Tooltip formatter={v=>`GH₵ ${Number(v).toLocaleString("en-GH")}`} /></PieChart></ResponsiveContainer></div><div className="jbd-legend">{expenseData.slice(0,5).map((r,i)=><div key={r.name}><i style={{background:chartColors[i % chartColors.length]}} />{r.name}<strong>{cash(r.value * 100)}</strong></div>)}</div></> : <Empty>No expenses recorded in the selected period.</Empty>}
        <div className="jbd-stock-foot">Stock units on hand <strong>{count(balances.inventoryPairs)}</strong></div>
      </div>
    </div>
    <div className="jbd-bottom-row">
      <div className="jbd-panel"><div className="jbd-panel-heading"><h2><ShoppingCart size={20}/> Recent Sales</h2><Link to="/sales">View All</Link></div><div className="jbd-table-wrap"><table><thead><tr><th>Customer</th><th>Branch</th><th>Amount</th><th>Payment</th><th>Date</th></tr></thead><tbody>{sales.map(s => <tr key={s._id}><td>{s.customer?.name || "Walk-in Customer"}</td><td>{s.branch?.name || "—"}</td><td>{cash(s.total)}</td><td><span className={`jbd-status ${s.paymentStatus}`}>{s.paymentStatus}</span></td><td>{toDate(s.soldAt)}</td></tr>)}</tbody></table>{!sales.length && <Empty>No recent sales to display.</Empty>}</div></div>
      <div className="jbd-panel"><div className="jbd-panel-heading"><h2><AlertTriangle size={20}/> Low Stock Alerts</h2><Link to="/inventory">View All</Link></div>{!stockBranch && <Empty>Select a branch above to view its low-stock products.</Empty>}{stockBranch && !stock.length && <Empty>No low-stock records returned for this branch.</Empty>}{stock.map(s => <div className="jbd-stock-alert" key={s._id}><div><b>{s.variant?.product?.name || "Product"}</b><small>{s.variant?.size || ""} · {s.variant?.color || ""}</small></div><strong>{s.quantity} left</strong></div>)}</div>
      <div className="jbd-panel"><div className="jbd-panel-heading"><h2><ClipboardIcon/> Financial Notes</h2></div><p className="jbd-notes-intro">Accounting safeguards reported by your backend:</p>{(financial?.warnings || []).map((w,i)=><div className="jbd-note" key={i}>{w}</div>)}{!financial?.warnings?.length && <Empty>No warnings returned.</Empty>}</div>
    </div>
  </section>;
}

function ClipboardIcon() { return <Wallet size={20}/>; }
