import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { salesApi } from "../../../services/salesApi";
import { Dialog, money, Notice, toPesewas } from "../../commerce/components/CommerceUI";

export default function NewSale({ token, admin, branches, preferredBranchId, assignedBranchId, onClose, onSaved }) {
  const [branchId, setBranchId] = useState(preferredBranchId || assignedBranchId || branches[0]?._id || "");
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState("");
  const [variants, setVariants] = useState([]);
  const [variantId, setVariantId] = useState("");
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

  useEffect(() => {
    const controller = new AbortController();
    const delay = setTimeout(() => {
      salesApi.products(token, { search: productSearch, limit: 100 }, controller.signal)
        .then((response) => setProducts(response.products || []))
        .catch((err) => { if (err.name !== "AbortError") setError(err.message); });
    }, 250);

    return () => { clearTimeout(delay); controller.abort(); };
  }, [token, productSearch]);

  useEffect(() => {
    setVariantId("");
    setVariants([]);
    if (!productId) return;

    const controller = new AbortController();
    salesApi.variants(token, productId, controller.signal)
      .then((response) => setVariants(response.variants || []))
      .catch((err) => { if (err.name !== "AbortError") setError(err.message); });

    return () => controller.abort();
  }, [token, productId]);

  const subtotal = useMemo(() => lines.reduce((sum, line) => {
    return sum + line.unitPrice * line.quantity;
  }, 0), [lines]);

  function addItem() {
    setError("");
    const variant = variants.find((item) => item._id === variantId);

    if (!variant || !Number.isSafeInteger(Number(quantity)) || Number(quantity) <= 0) {
      setError("Select a valid shoe variant and quantity.");
      return;
    }

    if (lines.some((line) => line.variantId === variantId)) {
      setError("That shoe variant is already in the sale.");
      return;
    }

    const price = priceType === "wholesale" ? variant.wholesalePrice : variant.retailPrice;

    setLines((items) => [...items, {
      variantId,
      sku: variant.sku,
      size: variant.size,
      color: variant.color,
      productName: products.find((item) => item._id === productId)?.name || "Shoe",
      quantity: Number(quantity),
      priceType,
      unitPrice: price,
    }]);

    setVariantId("");
    setQuantity(1);
  }

  async function submit(event) {
    event.preventDefault();
    setError("");

    try {
      if (admin && !branchId) throw new Error("Select the receiving branch.");
      if (!lines.length) throw new Error("Add at least one shoe to the sale.");

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
              <select required value={branchId} onChange={(event) => setBranchId(event.target.value)}>
                <option value="">Select branch</option>
                {branches.map((branch) => <option key={branch._id} value={branch._id}>{branch.name}</option>)}
              </select>
            </label>
          )}
          <label className="jbc-field">
            Find customer (optional for fully paid sales)
            <input value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Search name or phone" />
          </label>
          <label className="jbc-field">
            Customer
            <select value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
              <option value="">Walk-in customer</option>
              {customers.map((customer) => <option key={customer._id} value={customer._id}>{customer.name} — {customer.phone}</option>)}
            </select>
          </label>
        </div>

        <PanelHeading text="Add shoes" />
        <div className="jbc-form-grid">
          <label className="jbc-field">
            Search product catalog
            <input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Shoe name" />
          </label>
          <label className="jbc-field">
            Product
            <select value={productId} onChange={(event) => setProductId(event.target.value)}>
              <option value="">Select shoe</option>
              {products.map((product) => <option key={product._id} value={product._id}>{product.name}</option>)}
            </select>
          </label>
          <label className="jbc-field">
            Size / color / SKU
            <select value={variantId} onChange={(event) => setVariantId(event.target.value)}>
              <option value="">Select variant</option>
              {variants.map((variant) => <option key={variant._id} value={variant._id}>{variant.size} · {variant.color} · {variant.sku}</option>)}
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
            <button type="button" className="jbc-btn gold" onClick={addItem}><Plus size={16} /> Add to sale</button>
          </div>
        </div>

        <div className="jbc-table-wrap" style={{ marginTop: 18 }}>
          <table className="jbc-table">
            <thead><tr><th>Product</th><th>Variant</th><th>Type</th><th>Qty</th><th>Unit price</th><th>Line total</th><th></th></tr></thead>
            <tbody>{lines.map((line) => (
              <tr key={line.variantId}>
                <td>{line.productName}</td><td>{line.size} / {line.color} · {line.sku}</td>
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
