import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { salesApi } from "../../../services/salesApi";
import { inventoryApi } from "../../../services/inventoryApi";
import { Dialog, money, Notice, toPesewas } from "../../commerce/components/CommerceUI";

export default function NewSale({ token, admin, branches, preferredBranchId, assignedBranchId, onClose, onSaved }) {
  const [branchId, setBranchId] = useState(preferredBranchId || assignedBranchId || branches[0]?._id || "");
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [products, setProducts] = useState([]);
  const [branchStock, setBranchStock] = useState([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [productId, setProductId] = useState("");
  const [variants, setVariants] = useState([]);
  const [variantLoading, setVariantLoading] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [priceType, setPriceType] = useState("retail");
  const [lines, setLines] = useState([]);
  const [discount, setDiscount] = useState("0");
  const [paid, setPaid] = useState("0");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());

  useEffect(() => {
    if (!admin && assignedBranchId) setBranchId(assignedBranchId);
    else if (preferredBranchId) setBranchId(preferredBranchId);
    else if (branches.length && !branchId) setBranchId(branches[0]._id);
  }, [branches, preferredBranchId, assignedBranchId, admin, branchId]);

  useEffect(() => {
    const controller = new AbortController();
    const delay = setTimeout(() => {
      salesApi.customers(token, { search: customerSearch, limit: 100 }, controller.signal)
        .then((response) => setCustomers(response.customers || []))
        .catch((err) => { if (err.name !== "AbortError") setError(err.message); });
    }, 250);

    return () => { clearTimeout(delay); controller.abort(); };
  }, [token, customerSearch]);

  // Sellable products come from the selected branch's stock, not the global catalog.
  useEffect(() => {
    const controller = new AbortController();

    setProducts([]);
    setBranchStock([]);
    setProductId("");
    setVariants([]);
    setStockLoading(Boolean(branchId));

    if (!branchId) return () => controller.abort();

    async function loadBranchStock() {
      try {
        const records = await fetchBranchStock(token, branchId, controller.signal);
        if (controller.signal.aborted) return;

        const available = records.filter((item) =>
          Number(item.quantity) > 0 && item.variant?.product?._id
        );
        setBranchStock(available);

        const unique = new Map();
        for (const item of available) {
          const product = item.variant.product;
          if (product.isActive !== false) unique.set(product._id, product);
        }
        setProducts([...unique.values()]);
      } catch (err) {
        if (err.name !== "AbortError") setError(err.message);
      } finally {
        if (!controller.signal.aborted) setStockLoading(false);
      }
    }

    loadBranchStock();
    return () => controller.abort();
  }, [token, branchId]);

  const availableProducts = useMemo(() => {
    const term = productSearch.trim().toLowerCase();
    return products.filter((item) =>
      `${item.brand || ""} ${item.name || ""}`.toLowerCase().includes(term)
    );
  }, [products, productSearch]);

  useEffect(() => {
    setVariants([]);
    setVariantLoading(Boolean(productId));
    if (!productId) return;

    const controller = new AbortController();
    salesApi.variants(token, productId, controller.signal)
      .then((response) => {
        if (!controller.signal.aborted) setVariants(response.variants || []);
      })
      .catch((err) => { if (err.name !== "AbortError") setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setVariantLoading(false); });

    return () => controller.abort();
  }, [token, productId]);

  const subtotal = useMemo(() => lines.reduce((sum, line) => {
    return sum + line.unitPrice * line.quantity;
  }, 0), [lines]);

  function addItem() {
    setError("");
    if (!productId || variantLoading) {
      setError("Select a shoe and allow its pricing to load.");
      return;
    }

    // The simplified catalog must have exactly one internal variant per shoe.
    if (variants.length !== 1) {
      setError("This shoe does not have exactly one stock item. Contact the administrator.");
      return;
    }

    const variant = variants[0];
    const variantId = variant._id;
    const count = Number(quantity);

    if (!Number.isSafeInteger(count) || count <= 0) {
      setError("Enter a valid quantity.");
      return;
    }

    const stock = branchStock.find((item) =>
      String(item.variant?._id) === String(variantId)
    );
    if (!stock || count > Number(stock.quantity)) {
      setError(`Insufficient stock in this branch. Available: ${stock?.quantity || 0} pairs.`);
      return;
    }

    if (lines.some((line) => line.variantId === variantId)) {
      setError("This shoe is already in the sale. Remove it first to change the quantity or price type.");
      return;
    }

    const price = priceType === "wholesale" ? variant.wholesalePrice : variant.retailPrice;

    setLines((items) => [...items, {
      variantId,
      productName: products.find((item) => item._id === productId)?.name || "Shoe",
      quantity: count,
      priceType,
      unitPrice: price,
    }]);

    setQuantity(1);
  }

  async function submit(event) {
    event.preventDefault();
    setError("");

    try {
      if (admin && !branchId) throw new Error("Select the selling branch.");
      if (!lines.length) throw new Error("Add at least one shoe to the sale.");

      // Recheck availability in case another sale changed stock while this dialog was open.
      const latestStock = await fetchBranchStock(token, branchId);
      for (const line of lines) {
        const stock = latestStock.find((item) =>
          String(item.variant?._id) === String(line.variantId)
        );
        if (!stock || line.quantity > Number(stock.quantity)) {
          throw new Error(`${line.productName}: only ${stock?.quantity || 0} pairs available in this branch.`);
        }
      }

      const discountAmount = admin ? toPesewas(discount) : 0;
      const amountPaid = toPesewas(paid);
      const total = subtotal - discountAmount;

      if (total < 0) throw new Error("Discount exceeds the sale subtotal.");
      if (amountPaid > total) throw new Error("Payment exceeds the sale total.");
      if (amountPaid < total && !customerId) {
        throw new Error("Choose a registered customer for credit sales.");
      }

      const body = {
        branchId: admin ? branchId : assignedBranchId,
        customerId: customerId || null,
        requestKey,
        items: lines.map(({ variantId: id, quantity: count, priceType: type }) => ({
          variantId: id,
          quantity: count,
          priceType: type,
        })),
        discount: discountAmount,
        initialPayment: {
          amount: amountPaid,
          ...(amountPaid > 0 ? { method, reference } : {}),
        },
        notes,
      };

      // Non-admin accounts require their server-provided branch ID.
      if (!body.branchId) {
        throw new Error("Assigned branch is unavailable. Sign in again or contact the administrator.");
      }

      setSaving(true);
      await salesApi.createSale(token, body);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog title="New sale" onClose={onClose} wide>
      <form onSubmit={submit}>
        <Notice error={error} />
        <div className="jbc-form-grid">
          {admin && (
            <label className="jbc-field">
              Selling branch
              <select required value={branchId} onChange={(event) => {
                  setBranchId(event.target.value);
                  setLines([]);
                  setProductId("");
                  setProductSearch("");
                }}>
                <option value="">Select branch</option>
                {branches.map((branch) => <option key={branch._id} value={branch._id}>{branch.name}</option>)}
              </select>
            </label>
          )}

          <label className="jbc-field">
            Customer
            <select value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
              <option value="">Walk-in customer</option>
              {customers.map((customer) => <option key={customer._id} value={customer._id}>{customer.name} — {customer.phone}</option>)}
            </select>
          </label>
        </div>

        <PanelHeading text="Add shoes" />
        {branchId && !stockLoading && products.length === 0 && (
          <p className="jbc-footnote">No shoes with available stock in the selected branch.</p>
        )}
        <div className="jbc-form-grid">

          <label className="jbc-field">
            Product
            <select value={productId} onChange={(event) => setProductId(event.target.value)}>
              <option value="">{stockLoading ? "Loading branch inventory..." : "Select shoe"}</option>
              {availableProducts.map((product) => <option key={product._id} value={product._id}>{product.brand ? `${product.brand} · ` : ""}{product.name}</option>)}
            </select>
          </label>
          <label className="jbc-field">
            Price type
            <select value={priceType} onChange={(event) => setPriceType(event.target.value)}>
              <option value="retail">Retail</option>
              <option value="wholesale">Wholesale</option>
            </select>
          </label>
          <label className="jbc-field">
            Quantity
            <input type="number" min="1" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
          </label>
          <div className="jbc-field" style={{ justifyContent: "end" }}>
            <button type="button" className="jbc-btn gold" disabled={!productId || variantLoading || stockLoading} onClick={addItem}><Plus size={16} /> {variantLoading ? "Loading shoe..." : "Add to sale"}</button>
          </div>
        </div>

        <div className="jbc-table-wrap" style={{ marginTop: 18 }}>
          <table className="jbc-table">
            <thead><tr><th>Product</th><th>Type</th><th>Qty</th><th>Unit price</th><th>Line total</th><th></th></tr></thead>
            <tbody>{lines.map((line) => (
              <tr key={line.variantId}>
                <td>{line.productName}</td>
                <td>{line.priceType}</td><td>{line.quantity}</td><td>{money(line.unitPrice)}</td>
                <td>{money(line.unitPrice * line.quantity)}</td>
                <td><button type="button" className="jbc-mini" aria-label="Remove shoe" onClick={() => setLines((current) => current.filter((item) => item.variantId !== line.variantId))}><Trash2 size={15} /></button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>

        <PanelHeading text="Payment" />
        <div className="jbc-form-grid">
          {admin && <label className="jbc-field">Discount (GH₵)<input type="text" inputMode="decimal" value={discount} onChange={(event) => setDiscount(event.target.value)} /></label>}
          <label className="jbc-field">Amount paid (GH₵)<input required type="text" inputMode="decimal" value={paid} onChange={(event) => setPaid(event.target.value)} /></label>
          <label className="jbc-field">Payment method<select value={method} onChange={(event) => setMethod(event.target.value)}><option value="cash">Cash</option><option value="momo">Mobile Money</option><option value="bank">Bank</option></select></label>
          <label className="jbc-field">Payment reference<input value={reference} onChange={(event) => setReference(event.target.value)} /></label>
          <label className="jbc-field full">Notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
        </div>
        <p><strong>Subtotal:</strong> {money(subtotal)}</p>
        <p className="jbc-footnote">Selling prices are verified by the backend when the sale is submitted.</p>
        <div className="jbc-form-actions"><button type="button" className="jbc-btn" onClick={onClose}>Cancel</button><button disabled={saving || !lines.length} type="submit" className="jbc-btn burgundy">{saving ? "Saving..." : "Complete sale"}</button></div>
      </form>
    </Dialog>
  );
}

function PanelHeading({ text }) {
  return <h3 style={{ fontFamily: "Georgia, serif", margin: "24px 0 12px" }}>{text}</h3>;
}

// GET /api/inventory is paginated. Read every page rather than dropping
// sellable shoes that happen not to be on the first page.
async function fetchBranchStock(token, branchId, signal) {
  if (!branchId) return [];

  const first = await inventoryApi.stock(token, {
    branchId, page: 1, limit: 100,
  }, signal);

  const records = [...(first.inventory || [])];
  const totalPages = Math.max(1, Number(first.totalPages) ||
    Math.ceil(Number(first.total || records.length) / 100));

  if (totalPages > 100) {
    throw new Error("Branch inventory is too large to load safely. Ask the administrator to enable server-side product filtering.");
  }

  for (let page = 2; page <= totalPages; page += 1) {
    const result = await inventoryApi.stock(token, {
      branchId, page, limit: 100,
    }, signal);
    records.push(...(result.inventory || []));
  }

  return records;
}
