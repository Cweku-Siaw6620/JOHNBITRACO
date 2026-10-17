import { useCallback, useEffect, useMemo, useState } from "react";
import { Boxes, Eye, Layers, PackagePlus, Plus, Tag, Pencil, RefreshCw } from "lucide-react";
import { useAuth } from "../login/features/AuthProvider";
import { inventoryApi } from "../../services/inventoryApi";
import {
  Empty, ErrorNotice, Loading, Modal, PageHead,
  Pagination, SearchInput, StatCard, cedis, useDebounced,
} from "../../components/inventory/InventoryUI";
import "./products.css";

const categories = ["Executive", "Loafers", "Boots", "Other"];
const brands = [
  "Louis Vuitton",
  "Feragamo",
  "Tods",
  "Anax",
  "Luboutin",
  "Hermex",
  "Valentino",
  "Gucci",
  "Butteri",
  "Mr. Zenith",
  "D&G",
  "Rossi",
  "Maurizio",
  "Balanciaga",
  "Clarks",
  "Polo",
];
const cleanProduct = { name: "", brand: "", category: "Executive", description: "", imageUrl: "" };
const cleanVariant = { sku: "", size: "", color: "", retailPrice: "", wholesalePrice: "", referenceCost: "" };

const moneyToPesewas = (value) => Math.round(Number(value) * 100);
const priceForInput = (pesewas) => Number.isSafeInteger(pesewas) ? (pesewas / 100).toString() : "";

export default function Products() {
  const { session } = useAuth();
  const token = session?.token;
  const admin = session?.user?.role === "admin";

  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [variants, setVariants] = useState([]);
  const [selectedVariantId, setSelectedVariantId] = useState(null);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(cleanProduct);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const debouncedSearch = useDebounced(search);

  const loadProducts = useCallback(async (signal) => {
    setLoading(true);
    setError("");

    try {
      const data = await inventoryApi.products(token, {
        page,
        limit: 20,
        search: debouncedSearch,
        category,
      }, signal);

      setProducts(data.products || []);
      setTotal(data.total || 0);
    } catch (err) {
      if (err.name !== "AbortError") setError(err.message);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [token, page, debouncedSearch, category]);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    loadProducts(controller.signal);
    return () => controller.abort();
  }, [loadProducts, token, refresh]);

  useEffect(() => {
    if (!selectedId) {
      setVariants([]);
      setSelectedVariantId(null);
      return;
    }

    const controller = new AbortController();

    inventoryApi.variants(token, selectedId, controller.signal)
      .then((data) => {
        setVariants(data.variants || []);
        setSelectedVariantId((current) =>
          (data.variants || []).some((item) => item._id === current)
            ? current
            : data.variants?.[0]?._id || null
        );
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      });

    return () => controller.abort();
  }, [token, selectedId, refresh]);

  useEffect(() => {
    if (products.length > 0 && !products.some((p) => p._id === selectedId)) {
      setSelectedId(products[0]._id);
    }
  }, [products, selectedId]);

  const selected = products.find((item) => item._id === selectedId);
  const selectedVariant = variants.find((item) => item._id === selectedVariantId);
  const activeVariants = variants.length;
  const distinctCategories = new Set(products.map((p) => p.category)).size;

  function openProduct(product = null) {
    setEditingId(product?._id || null);
    setForm(product ? {
      name: product.name,
      brand: product.brand || "",
      category: product.category,
      description: product.description || "",
      imageUrl: product.imageUrl || "",
      isActive: product.isActive,
    } : cleanProduct);
    setFormError("");
    setModal("product");
  }

  function openVariant(variant = null) {
    if (!selectedId) return;
    setEditingId(variant?._id || null);
    setForm(variant ? {
      retailPrice: priceForInput(variant.retailPrice),
      wholesalePrice: priceForInput(variant.wholesalePrice),
      referenceCost: priceForInput(variant.referenceCost),
      isActive: variant.isActive,
    } : cleanVariant);
    setFormError("");
    setModal("variant");
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setFormError("");

    try {
      if (modal === "product") {
        if (editingId) {
          await inventoryApi.updateProduct(token, editingId, form);
        } else {
          const result = await inventoryApi.createProduct(token, form);
          setSelectedId(result.product?._id || null);
        }
      } else {
        const body = {
          ...form,
          retailPrice: moneyToPesewas(form.retailPrice),
          wholesalePrice: moneyToPesewas(form.wholesalePrice),
          ...(form.referenceCost === "" ? {} : { referenceCost: moneyToPesewas(form.referenceCost) }),
        };

        if (editingId) {
          await inventoryApi.updateVariant(token, editingId, body);
        } else {
          await inventoryApi.createVariant(token, selectedId, body);
        }
      }

      setModal(null);
      setRefresh((value) => value + 1);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const title = modal === "product"
    ? editingId ? "Edit Product" : "Add Product"
    : editingId ? "Update Variant Pricing" : "Add Product Variant";

  return (
    <div className="jbi-page">
      <PageHead
        title="Products"
        description="Manage shoe designs, sizes, colors, SKUs and prices."
        actions={admin && <>
          <button className="jbi-button gold" onClick={() => openProduct()}><Plus size={17} /> Add Product</button>
          <button className="jbi-button burgundy" disabled={!selectedId} onClick={() => openVariant()}><PackagePlus size={17} /> Add Variant</button>
        </>}
      />

      <div className="jbi-stats">
        <StatCard icon={Boxes} label="Products on This Page" value={products.length} detail={`Across ${total} matching catalog records`} />
        <StatCard icon={Layers} label="Selected Product Variants" value={activeVariants} detail="Active variants for selected product" />
        <StatCard icon={Tag} label="Categories on This Page" value={distinctCategories} />
        <StatCard icon={RefreshCw} label="Catalog" value="Live" detail="Loaded from the products API" />
      </div>

      <ErrorNotice error={error} retry={() => setRefresh((value) => value + 1)} />

      <div className="jbi-products-grid">
        <section className="jbi-panel">
          <div className="jbi-toolbar">
            <SearchInput value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="Search product name or brand..." />
            <select className="jbi-select" value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }}>
              <option value="">All categories</option>
              {categories.map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>

          {loading ? <Loading /> : products.length === 0 ? <Empty text="No products found. Add a shoe design to get started." /> : (
            <div className="jbi-table-scroll">
              <table className="jbi-table">
                <thead><tr><th>Product</th><th>Category</th><th>Brand</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product._id} className={selectedId === product._id ? "is-selected" : ""}>
                      <td><div className="jbi-product-cell">
                        {product.imageUrl ? <img src={product.imageUrl} alt="" /> : <span className="jbi-no-image"><Boxes size={21} /></span>}
                        <div><strong>{product.name}</strong><small>{product.description || "Shoe collection"}</small></div>
                      </div></td>
                      <td>{product.category}</td>
                      <td>{product.brand || "—"}</td>
                      <td><span className="jbi-pill green">Active</span></td>
                      <td><div className="jbi-inline">
                        <button className="jbi-inline-action" title="View variants" onClick={() => setSelectedId(product._id)}><Eye size={16} /></button>
                        {admin && <button className="jbi-inline-action" title="Edit product" onClick={() => openProduct(product)}><Pencil size={16} /></button>}
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Pagination page={page} setPage={setPage} total={total} totalPages={Math.ceil(total / 20)} label="matching products" />
        </section>

        <aside className="jbi-detail jbi-product-detail">
          <h2>Product Details</h2>
          {!selected ? <Empty text="Select a product to view its variants." /> : <>
            {selected.imageUrl ? <img className="jbi-detail-image" src={selected.imageUrl} alt={selected.name} /> : <div className="jbi-detail-image jbi-image-placeholder"><Boxes size={45} /></div>}
            <h3>{selected.name}</h3>
            <p className="jbi-muted">{selected.category} · {selected.brand || "Unbranded"}</p>
            <p className="jbi-detail-description">{selected.description || "No product description provided."}</p>

            <div className="jbi-variant-title"><strong>Available Variants ({variants.length})</strong></div>
            <div className="jbi-variant-list">
              {variants.map((variant) => (
                <button type="button" className={selectedVariantId === variant._id ? "selected" : ""} key={variant._id} onClick={() => setSelectedVariantId(variant._id)}>
                  {variant.size} · {variant.color}
                </button>
              ))}
            </div>

            {selectedVariant && <>
              <div className="jbi-detail-grid">
                <div><span>SKU</span><strong>{selectedVariant.sku}</strong></div>
                <div><span>Size / Color</span><strong>{selectedVariant.size} / {selectedVariant.color}</strong></div>
                <div><span>Retail Price</span><strong>{cedis(selectedVariant.retailPrice)}</strong></div>
                <div><span>Wholesale Price</span><strong>{cedis(selectedVariant.wholesalePrice)}</strong></div>
              </div>
              {admin && <button className="jbi-button gold jbi-detail-btn" onClick={() => openVariant(selectedVariant)}><Pencil size={16} /> Edit Variant Prices</button>}
            </>}
            {admin && <button className="jbi-button burgundy jbi-detail-btn" onClick={() => openVariant()}><Plus size={16} /> Manage Variants</button>}
          </>}
        </aside>
      </div>

      {modal && <Modal title={title} onClose={() => setModal(null)}>
        <form className="jbi-form" onSubmit={submit}>
          {modal === "product" ? <>
            <div className="jbi-field"><label>Product name</label><input required minLength={2} maxLength={150} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div>
            <div className="jbi-form-grid">
              <div className="jbi-field"><label>Brand</label><select value={form.brand} onChange={(event) => setForm({ ...form, brand: event.target.value })}>
                <option value="">Select a brand</option>
                {form.brand && !brands.includes(form.brand) && <option value={form.brand}>{form.brand}</option>}
                {brands.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
              </select></div>
              <div className="jbi-field"><label>Category</label><select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{categories.map((item) => <option key={item}>{item}</option>)}</select></div>
            </div>
            <div className="jbi-field"><label>Image URL (HTTPS)</label><input type="url" value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.target.value })} placeholder="https://..." /></div>
            <div className="jbi-field"><label>Description</label><textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></div>
            {editingId && <div className="jbi-field"><label>Status</label><select value={String(form.isActive)} onChange={(event) => setForm({ ...form, isActive: event.target.value === "true" })}><option value="true">Active</option><option value="false">Inactive</option></select></div>}
          </> : <>
            {!editingId && <div className="jbi-form-grid">
              <div className="jbi-field"><label>SKU</label><input required value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} placeholder="OXF-BLK-42" /></div>
              <div className="jbi-field"><label>Shoe size</label><input required value={form.size} onChange={(event) => setForm({ ...form, size: event.target.value })} /></div>
              <div className="jbi-field"><label>Color</label><input required value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} /></div>
            </div>}
            <div className="jbi-form-grid">
              {[["retailPrice", "Retail price (GH₵)"], ["wholesalePrice", "Wholesale price (GH₵)"], ["referenceCost", "Estimated Purchase Cost (GH₵)"]].map(([key, label]) => <div className="jbi-field" key={key}><label>{label}</label><input type="number" min="0" step="0.01" required={key !== "referenceCost"} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} /></div>)}
            </div>
            {editingId && <div className="jbi-field"><label>Variant status</label><select value={String(form.isActive)} onChange={(event) => setForm({ ...form, isActive: event.target.value === "true" })}><option value="true">Active</option><option value="false">Inactive</option></select></div>}
          </>}
          <ErrorNotice error={formError} />
          <div className="jbi-form-footer"><button className="jbi-button" type="button" onClick={() => setModal(null)}>Cancel</button><button className="jbi-button burgundy" disabled={saving}>{saving ? "Saving..." : "Save"}</button></div>
        </form>
      </Modal>}
    </div>
  );
}
