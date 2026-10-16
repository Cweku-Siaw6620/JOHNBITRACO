import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, History, SlidersHorizontal, Eye } from "lucide-react";
import { useAuth } from "../login/features/AuthProvider";
import { inventoryApi } from "../../services/inventoryApi";
import {
  Empty, ErrorNotice, Loading, Modal, PageHead,
  Pagination, SearchInput, StatCard, useDebounced,
} from "../../components/inventory/InventoryUI";
import "./movements.css";

const typeNames = {
  OPENING_STOCK: "Opening stock",
  PURCHASE: "Purchase",
  SALE: "Sale",
  SALE_RETURN: "Sale return",
  PURCHASE_RETURN: "Purchase return",
  ADJUSTMENT: "Adjustment",
  TRANSFER_IN: "Transfer in",
  TRANSFER_OUT: "Transfer out",
};

const formatDate = (value) => value
  ? new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })
  : "—";

export default function StockMovements() {
  const { session } = useAuth();
  const token = session?.token;
  const role = session?.user?.role;
  const admin = role === "admin";

  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState(
    typeof session?.user?.branch === "string"
      ? session.user.branch
      : session?.user?.branch?._id || ""
  );

  const [movements, setMovements] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const debouncedSearch = useDebounced(search);

  useEffect(() => {
    if (!token || role === "employee") return;
    const controller = new AbortController();

    inventoryApi.branches(token, controller.signal)
      .then((result) => {
        const list = Array.isArray(result) ? result : result.branches || result.data || [];
        setBranches(list);
        if (admin) setBranchId((current) => current || list[0]?._id || "");
      })
      .catch((err) => { if (err.name !== "AbortError") setError(err.message); });

    return () => controller.abort();
  }, [token, role, admin]);

  const load = useCallback(async (signal) => {
    if (!branchId || role === "employee") return;
    setLoading(true);
    setError("");

    try {
      const result = await inventoryApi.movements(token, {
        branchId,
        page,
        limit: 20,
      }, signal);

      setMovements(result.movements || []);
      setTotal(result.total || 0);
    } catch (err) {
      if (err.name !== "AbortError") setError(err.message);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [token, branchId, page, role]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load, refresh]);

  const visible = useMemo(() => movements.filter((movement) => {
    if (type && movement.type !== type) return false;
    if (!debouncedSearch.trim()) return true;

    const term = debouncedSearch.toLowerCase();
    const content = [
      movement.variant?.sku,
      movement.variant?.color,
      movement.variant?.size,
      movement.reason,
      movement.referenceId,
      movement.performedBy?.fullName,
      movement.type,
    ].filter(Boolean).join(" ").toLowerCase();

    return content.includes(term);
  }), [movements, type, debouncedSearch]);

  const inbound = visible.filter((item) => item.quantityChange > 0);
  const outbound = visible.filter((item) => item.quantityChange < 0);
  const adjustments = visible.filter((item) => item.type === "ADJUSTMENT");

  if (role === "employee") {
    return <div className="jbi-page"><PageHead title="Stock Movements" description="Stock movement history is restricted to Admin and Assistant accounts." /><div className="jbi-panel"><Empty text="Your role does not have access to stock movement history." /></div></div>;
  }

  return <div className="jbi-page">
    <PageHead title="Stock Movements" description="Audit stock increases, decreases and corrections." />

    <div className="jbi-stats">
      <StatCard icon={History} label="Movements on This Page" value={visible.length} detail={`${total} movements in this branch`} />
      <StatCard icon={ArrowUpRight} label="Stock In on This Page" value={inbound.reduce((sum, item) => sum + item.quantityChange, 0)} tone="green" detail={`${inbound.length} movements`} />
      <StatCard icon={ArrowDownRight} label="Stock Out on This Page" value={outbound.reduce((sum, item) => sum + Math.abs(item.quantityChange), 0)} tone="red" detail={`${outbound.length} movements`} />
      <StatCard icon={SlidersHorizontal} label="Adjustments on This Page" value={adjustments.length} />
    </div>

    <ErrorNotice error={error} retry={() => setRefresh((value) => value + 1)} />

    <section className="jbi-panel">
      <div className="jbi-toolbar">
        {admin && <select className="jbi-select" value={branchId} onChange={(event) => { setBranchId(event.target.value); setPage(1); }}>
          {branches.map((branch) => <option key={branch._id} value={branch._id}>{branch.name}</option>)}
        </select>}
        <SearchInput value={search} onChange={setSearch} placeholder="Filter displayed movements by SKU, reason or staff..." />
        <select className="jbi-select" value={type} onChange={(event) => setType(event.target.value)}>
          <option value="">All movement types</option>
          {Object.entries(typeNames).map(([value, name]) => <option value={value} key={value}>{name}</option>)}
        </select>
      </div>

      <p className="jbi-hint jbi-movements-hint">Search and movement-type filtering apply to the currently loaded page; the existing backend has no server-side search or type filters for this endpoint.</p>

      {!branchId ? <Empty text="No assigned branch found." /> : loading ? <Loading /> : visible.length === 0 ? <Empty text="No movements match these filters." /> : <div className="jbi-table-scroll">
        <table className="jbi-table">
          <thead><tr><th>Date / Time</th><th>SKU</th><th>Size / Color</th><th>Type</th><th>Qty Change</th><th>Before</th><th>After</th><th>Reason</th><th>Performed By</th><th>Details</th></tr></thead>
          <tbody>{visible.map((movement) => <tr key={movement._id}>
            <td>{formatDate(movement.createdAt)}</td>
            <td><strong>{movement.variant?.sku || "—"}</strong></td>
            <td>{movement.variant?.size || "—"} / {movement.variant?.color || "—"}</td>
            <td><span className={`jbi-pill ${movement.quantityChange > 0 ? "green" : "red"}`}>{typeNames[movement.type] || movement.type}</span></td>
            <td className={movement.quantityChange > 0 ? "jbi-positive" : "jbi-negative"}>{movement.quantityChange > 0 ? "+" : ""}{movement.quantityChange}</td>
            <td>{movement.quantityBefore}</td>
            <td>{movement.quantityAfter}</td>
            <td className="jbi-reason">{movement.reason || "—"}</td>
            <td>{movement.performedBy?.fullName || "Unknown"}</td>
            <td><button type="button" className="jbi-inline-action" aria-label="View movement details" onClick={() => setSelected(movement)}><Eye size={16} /></button></td>
          </tr>)}</tbody>
        </table>
      </div>}

      <Pagination page={page} setPage={setPage} total={total} totalPages={Math.ceil(total / 20)} label="branch movements" />
    </section>

    {selected && <Modal title="Stock Movement Details" onClose={() => setSelected(null)}>
      <div className="jbi-detail-grid jbi-movement-grid">
        <div><span>Movement type</span><strong>{typeNames[selected.type] || selected.type}</strong></div>
        <div><span>SKU</span><strong>{selected.variant?.sku || "—"}</strong></div>
        <div><span>Quantity changed</span><strong>{selected.quantityChange}</strong></div>
        <div><span>Stock before</span><strong>{selected.quantityBefore}</strong></div>
        <div><span>Stock after</span><strong>{selected.quantityAfter}</strong></div>
        <div><span>Performed by</span><strong>{selected.performedBy?.fullName || "Unknown"}</strong></div>
        <div><span>Reference type</span><strong>{selected.referenceType || "—"}</strong></div>
        <div><span>Reference ID</span><strong className="jbi-break">{selected.referenceId || "—"}</strong></div>
        <div><span>Date / time</span><strong>{formatDate(selected.createdAt)}</strong></div>
        <div><span>Reason</span><strong>{selected.reason || "—"}</strong></div>
      </div>
      <div className="jbi-form-footer"><button className="jbi-button" onClick={() => setSelected(null)}>Close</button></div>
    </Modal>}
  </div>;
}
