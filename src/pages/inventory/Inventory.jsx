import { useCallback, useEffect, useMemo, useState } from "react";
import { Boxes, AlertTriangle, CircleX, Coins, Plus, SlidersHorizontal, Eye } from "lucide-react";
import { useAuth } from "../login/features/AuthProvider";
import { inventoryApi } from "../../services/inventoryApi";
import {
  cedis, Empty, ErrorNotice, Loading, Modal, PageHead, Pagination,
  SearchInput, StatCard, useDebounced,
} from "../../components/inventory/InventoryUI";
import "./inventory.css";

const categories = ["Executive", "Loafers", "Boots", "Other"];

function branchIdOf(branch) {
  return typeof branch === "string" ? branch : branch?._id || "";
}

export default function Inventory() {
  const { session } = useAuth();
  const token = session?.token;
  const role = session?.user?.role;
  const admin = role === "admin";
  const writable = role === "admin" || role === "assistant";

  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState(branchIdOf(session?.user?.branch));
  const [inventory, setInventory] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [selected, setSelected] = useState(null);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ variantId: "", quantity: "", quantityChange: "", unitCost: "", lowStockThreshold: 5, reason: "" });
  const [productId, setProductId] = useState("");
  const [productChoices, setProductChoices] = useState([]);
  const [variantChoices, setVariantChoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const delayedSearch = useDebounced(search);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();

    inventoryApi.branches(token, controller.signal)
      .then((result) => {
        const list = Array.isArray(result) ? result : result.branches || result.data || [];
        setBranches(list);
        if (admin) setBranchId((previous) => previous || list[0]?._id || "");
      })
      .catch((err) => { if (err.name !== "AbortError") setError(err.message); });

    return () => controller.abort();
  }, [token, admin]);

  const reload = useCallback(async (signal) => {
    if (!branchId) return;
    setLoading(true);
    setError("");

    try {
      const result = await inventoryApi.stock(token, {
        branchId,
        page,
        limit: 20,
        search: delayedSearch,
        category,
        ...(lowOnly ? { lowStock: "true" } : {}),
      }, signal);

      setInventory(result.inventory || []);
      setTotal(result.total || 0);
    } catch (err) {
      if (err.name !== "AbortError") setError(err.message);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [token, branchId, page, delayedSearch, category, lowOnly]);

  useEffect(() => {
    const controller = new AbortController();
    reload(controller.signal);
    return () => controller.abort();
  }, [reload, refresh]);

  const lowCount = inventory.filter((item) => item.quantity > 0 && item.quantity <= item.lowStockThreshold).length;
  const outCount = inventory.filter((item) => item.quantity === 0).length;
  const totalUnits = inventory.reduce((sum, item) => sum + item.quantity, 0);
  const validValues = inventory.every((item) => Number.isSafeInteger(item.inventoryValue));
  const stockValue = validValues ? cedis(inventory.reduce((sum, item) => sum + item.inventoryValue, 0)) : "Unavailable";
  const displayedBranch = branches.find((item) => item._id === branchId);

  async function openModal(type, stock = null) {
    setModal(type);
    setFormError("");
    setSelected(stock);
    setProductId("");
    setVariantChoices([]);
    setForm({
      variantId: stock?.variant?._id || "",
      quantity: "",
      quantityChange: "",
      unitCost: "",
      lowStockThreshold: 5,
      reason: "",
    });

    if (!stock) {
      try {
        const result = await inventoryApi.products(token, { page: 1, limit: 100 });
        setProductChoices(result.products || []);
      } catch (err) {
        setFormError(err.message);
      }
    }
  }

  async function selectProduct(id) {
    setProductId(id);
    setForm((current) => ({ ...current, variantId: "" }));
    setVariantChoices([]);
    if (!id) return;

    try {
      const result = await inventoryApi.variants(token, id);
      setVariantChoices(result.variants || []);
    } catch (err) {
      setFormError(err.message);
    }
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setFormError("");

    try {
      const common = {
        branchId,
        variantId: form.variantId,
        reason: form.reason.trim(),
      };

      if (modal === "opening") {
        await inventoryApi.openingStock(token, {
          ...common,
          quantity: Number(form.quantity),
          unitCost: Math.round(Number(form.unitCost) * 100),
          lowStockThreshold: Number(form.lowStockThreshold),
        });
      } else {
        const quantityChange = Number(form.quantityChange);
        await inventoryApi.adjustStock(token, {
          ...common,
          quantityChange,
          ...(quantityChange > 0 ? { unitCost: Math.round(Number(form.unitCost) * 100) } : {}),
        });
      }

      setModal(null);
      setRefresh((value) => value + 1);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const positiveChange = Number(form.quantityChange) > 0;

  return <div className="jbi-page">
    <PageHead title="Inventory" description="View branch stock, low-stock items and adjustments." actions={<>
      {admin && <button className="jbi-button gold" disabled={!branchId} onClick={() => openModal("opening")}><Plus size={17} /> Opening Stock</button>}
      {writable && <button className="jbi-button burgundy" disabled={!branchId} onClick={() => openModal("adjustment")}><SlidersHorizontal size={17} /> Adjust Stock</button>}
    </>} />

    <div className="jbi-stats">
      <StatCard icon={Boxes} label="Units on This Page" value={totalUnits.toLocaleString()} detail={`${total} matching stock records`} />
      <StatCard icon={AlertTriangle} label="Low Stock on This Page" value={lowCount} tone="red" />
      <StatCard icon={CircleX} label="Out of Stock on This Page" value={outCount} tone="red" />
      <StatCard icon={Coins} label="Stock Value on This Page" value={stockValue} detail={validValues ? "Valuation for displayed records" : "Cost reconciliation may be required"} />
    </div>

    <ErrorNotice error={error} retry={() => setRefresh((value) => value + 1)} />

    <section className="jbi-panel">
      <div className="jbi-toolbar">
        {admin && <select className="jbi-select" value={branchId} onChange={(event) => { setBranchId(event.target.value); setPage(1); setSelected(null); }}>
          {branches.map((branch) => <option key={branch._id} value={branch._id}>{branch.name}</option>)}
        </select>}
        {!admin && <span className="jbi-branch-label">{displayedBranch?.name || "My assigned branch"}</span>}
        <SearchInput value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="Search product, SKU, size or color..." />
        <select className="jbi-select" value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }}>
          <option value="">All categories</option>
          {categories.map((item) => <option key={item}>{item}</option>)}
        </select>
        <label className="jbi-check"><input type="checkbox" checked={lowOnly} onChange={(event) => { setLowOnly(event.target.checked); setPage(1); }} /> Low stock only</label>
      </div>

      {!branchId ? <Empty text="No assigned branch found." /> : loading ? <Loading /> : inventory.length === 0 ? <Empty text="No inventory records match your filters." /> : <div className="jbi-table-scroll">
        <table className="jbi-table">
          <thead><tr><th>Product</th><th>Category</th><th>Size</th><th>Color</th><th>SKU</th><th>Quantity</th><th>Threshold</th><th>Stock Value</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>{inventory.map((stock) => {
            const variant = stock.variant || {};
            const product = variant.product || {};
            const status = stock.quantity === 0 ? "Out of stock" : stock.quantity <= stock.lowStockThreshold ? "Low stock" : "In stock";
            const tone = stock.quantity === 0 ? "red" : stock.quantity <= stock.lowStockThreshold ? "amber" : "green";

            return <tr key={stock._id} className={selected?._id === stock._id ? "is-selected" : ""}>
              <td><strong>{product.name || "Unknown shoe"}</strong><span className="jbi-subtext">{product.brand || ""}</span></td>
              <td>{product.category || "—"}</td>
              <td>{variant.size || "—"}</td>
              <td>{variant.color || "—"}</td>
              <td>{variant.sku || "—"}</td>
              <td><strong>{stock.quantity}</strong></td>
              <td>{stock.lowStockThreshold}</td>
              <td>{cedis(stock.inventoryValue)}</td>
              <td><span className={`jbi-pill ${tone}`}>{status}</span></td>
              <td><div className="jbi-inline"><button className="jbi-inline-action" title="View details" onClick={() => setSelected(stock)}><Eye size={16} /></button>
                {writable && <button className="jbi-inline-action" title="Adjust stock" onClick={() => openModal("adjustment", stock)}><SlidersHorizontal size={16} /></button>}</div></td>
            </tr>;
          })}</tbody>
        </table>
      </div>}

      <Pagination page={page} setPage={setPage} total={total} totalPages={Math.ceil(total / 20)} label="matching stock records" />
    </section>

    {selected && !modal && <section className="jbi-panel jbi-selected-stock">
      <strong>{selected.variant?.product?.name || "Selected stock"}</strong>
      <span>SKU: {selected.variant?.sku || "—"}</span>
      <span>Size: {selected.variant?.size} · {selected.variant?.color}</span>
      <span>Available: {selected.quantity} pairs</span>
      <span>Valuation: {cedis(selected.inventoryValue)}</span>
      <button className="jbi-button" onClick={() => setSelected(null)}>Close</button>
    </section>}

    {modal && <Modal title={modal === "opening" ? "Register Opening Stock" : "Adjust Branch Stock"} onClose={() => setModal(null)}>
      <form className="jbi-form" onSubmit={submit}>
        <p className="jbi-hint">Branch: <strong>{displayedBranch?.name || "Assigned branch"}</strong>. Quantity changes and audit movements are recorded by the backend.</p>
        {!selected && <>
          <div className="jbi-field"><label>Product</label><select required value={productId} onChange={(event) => selectProduct(event.target.value)}><option value="">Select product</option>{productChoices.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></div>
          <div className="jbi-field"><label>Size / Color / SKU</label><select required value={form.variantId} onChange={(event) => setForm({ ...form, variantId: event.target.value })}><option value="">Select variant</option>{variantChoices.map((item) => <option key={item._id} value={item._id}>{item.size} · {item.color} · {item.sku}</option>)}</select></div>
        </>}
        {selected && <p className="jbi-hint">{selected.variant?.sku} — currently {selected.quantity} pairs.</p>}
        {modal === "opening" ? <div className="jbi-form-grid">
          <div className="jbi-field"><label>Opening quantity</label><input required type="number" min="1" step="1" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></div>
          <div className="jbi-field"><label>Actual cost per pair (GH₵)</label><input required type="number" min="0" step="0.01" value={form.unitCost} onChange={(event) => setForm({ ...form, unitCost: event.target.value })} /></div>
          <div className="jbi-field"><label>Low-stock threshold</label><input type="number" min="0" step="1" value={form.lowStockThreshold} onChange={(event) => setForm({ ...form, lowStockThreshold: event.target.value })} /></div>
        </div> : <>
          <div className="jbi-field"><label>Quantity change (+ add / − deduct)</label><input required type="number" step="1" value={form.quantityChange} onChange={(event) => setForm({ ...form, quantityChange: event.target.value })} placeholder="e.g. 5 or -3" /></div>
          {positiveChange && <div className="jbi-field"><label>Cost per added pair (GH₵)</label><input required type="number" min="0" step="0.01" value={form.unitCost} onChange={(event) => setForm({ ...form, unitCost: event.target.value })} /></div>}
        </>}
        <div className="jbi-field"><label>Reason</label><textarea required minLength={5} maxLength={500} rows={3} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} placeholder="Explain the stock transaction" /></div>
        <ErrorNotice error={formError} />
        <div className="jbi-form-footer"><button type="button" className="jbi-button" onClick={() => setModal(null)}>Cancel</button><button disabled={saving} className="jbi-button burgundy">{saving ? "Saving..." : "Confirm"}</button></div>
      </form>
    </Modal>}
  </div>;
}
