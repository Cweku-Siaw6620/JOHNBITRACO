import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { purchasingApi } from "../../../services/purchasingApi";
import { cedis, ErrorText, Modal, pesewas } from "../../purchasing/components/PurchasingUI";

const emptyLine = () => ({ productId: "", variantId: "", quantity: "1", unitCost: "" });

export default function NewPurchase({ token, admin, userBranch, branches, suppliers, onClose, onSaved }) {
  const [branchId, setBranchId] = useState(admin ? "" : userBranch || "");
  const [supplierId, setSupplierId] = useState("");
  const [products, setProducts] = useState([]);
  const [variantsByProduct, setVariantsByProduct] = useState({});
  const [lines, setLines] = useState([emptyLine()]);
  const [method, setMethod] = useState("none");
  const [initialAmount, setInitialAmount] = useState("0");
  const [reference, setReference] = useState("");
  const [invoice, setInvoice] = useState("");
  const [notes, setNotes] = useState("");
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadCatalog() {
      try {
        const first = await purchasingApi.products(token, { page: 1, limit: 100 });
        const all = [...(first.products || [])];
        const totalPages = Number(first.totalPages || 1);

        for (let page = 2; page <= totalPages; page += 1) {
          const data = await purchasingApi.products(token, { page, limit: 100 });
          all.push(...(data.products || []));
        }

        if (active) setProducts(all);
      } catch (err) {
        if (active) setError(err.message);
      }
    }

    loadCatalog();
    return () => { active = false; };
  }, [token]);

  function changeLine(index, changes) {
    setLines((previous) => previous.map((line, position) =>
      position === index ? { ...line, ...changes } : line
    ));
  }

  async function selectProduct(index, productId) {
    changeLine(index, { productId, variantId: "" });

    if (!productId || variantsByProduct[productId]) return;

    try {
      const data = await purchasingApi.variants(token, productId);
      setVariantsByProduct((previous) => ({ ...previous, [productId]: data.variants || [] }));
    } catch (err) {
      setError(err.message);
    }
  }

  const preview = useMemo(() => {
    try {
      return lines.reduce((total, line) => {
        if (!line.unitCost || !line.quantity) return total;
        return total + pesewas(line.unitCost) * Number(line.quantity);
      }, 0);
    } catch {
      return null;
    }
  }, [lines]);

  async function save(event) {
    event.preventDefault();
    setError("");

    try {
      if (!branchId || !supplierId) throw new Error("Select a branch and supplier.");

      const items = lines.map((line) => {
        const quantity = Number(line.quantity);

        if (!line.variantId || !Number.isSafeInteger(quantity) || quantity <= 0) {
          throw new Error("Select a variant and enter a valid quantity on each line.");
        }

        return { variantId: line.variantId, quantity, unitCost: pesewas(line.unitCost) };
      });

      if (new Set(items.map((item) => item.variantId)).size !== items.length) {
        throw new Error("Each shoe variant can only appear once in a purchase.");
      }

      const amount = pesewas(initialAmount);
      const total = items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);

      if (!Number.isSafeInteger(total) || amount > total) {
        throw new Error("Initial payment cannot exceed the purchase total.");
      }

      if (amount > 0 && method === "none") {
        throw new Error("Select a payment method for the initial payment.");
      }

      setLoading(true);

      await purchasingApi.createPurchase(token, {
        supplierId,
        branchId,
        requestKey,
        supplierInvoiceNumber: invoice,
        notes,
        items,
        initialPayment: {
          amount,
          ...(amount > 0 ? { method, reference } : {}),
        },
      });

      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Record Supplier Purchase" onClose={onClose} wide>
      <form className="jbp-form" onSubmit={save}>
        <ErrorText>{error}</ErrorText>

        <div className="jbp-two-columns">
          <div className="jbp-field">
            <label>Receiving branch</label>
            <select className="jbp-input" required value={branchId} disabled={!admin} onChange={(event) => setBranchId(event.target.value)}>
              <option value="">Choose branch</option>
              {branches.map((branch) => <option key={branch._id} value={branch._id}>{branch.name}</option>)}
              {!admin && userBranch && !branches.some((branch) => branch._id === userBranch) && <option value={userBranch}>My assigned branch</option>}
            </select>
          </div>

          <div className="jbp-field">
            <label>Supplier</label>
            <select className="jbp-input" required value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
              <option value="">Choose supplier</option>
              {suppliers.map((supplier) => <option key={supplier._id} value={supplier._id}>{supplier.name}</option>)}
            </select>
          </div>
        </div>

        <div className="jbp-field">
          <label>Supplier invoice / reference (optional)</label>
          <input className="jbp-input" value={invoice} onChange={(event) => setInvoice(event.target.value)} />
        </div>

        <h3 style={{ margin: "8px 0 0", fontSize: 19 }}>Shoes received</h3>

        <div className="jbp-items">
          {lines.map((line, index) => (
            <div className="jbp-item" key={index}>
              <div className="jbp-field">
                <label>Product / variant</label>
                <select className="jbp-input" value={line.productId} onChange={(event) => selectProduct(index, event.target.value)} required>
                  <option value="">Select shoe</option>
                  {products.map((product) => <option key={product._id} value={product._id}>{product.name}</option>)}
                </select>
                <select className="jbp-input" style={{ marginTop: 6 }} value={line.variantId} onChange={(event) => changeLine(index, { variantId: event.target.value })} required>
                  <option value="">Select size / color</option>
                  {(variantsByProduct[line.productId] || []).map((variant) => (
                    <option key={variant._id} value={variant._id}>{variant.size} / {variant.color} · {variant.sku}</option>
                  ))}
                </select>
              </div>

              <div className="jbp-field">
                <label>Quantity</label>
                <input className="jbp-input" type="number" min="1" step="1" required value={line.quantity} onChange={(event) => changeLine(index, { quantity: event.target.value })} />
              </div>

              <div className="jbp-field">
                <label>Unit cost (GH₵)</label>
                <input className="jbp-input" inputMode="decimal" required placeholder="0.00" value={line.unitCost} onChange={(event) => changeLine(index, { unitCost: event.target.value })} />
              </div>

              <button className="jbp-icon-btn" type="button" title="Remove line" disabled={lines.length === 1} onClick={() => setLines((previous) => previous.filter((_, position) => position !== index))}>
                <Trash2 size={17} />
              </button>
            </div>
          ))}
        </div>

        <button className="jbp-btn jbp-btn-secondary" type="button" onClick={() => setLines((previous) => [...previous, emptyLine()])}><Plus size={16} /> Add another shoe</button>

        <p><strong>Purchase total: {preview === null ? "Check amounts" : cedis(preview)}</strong></p>

        <div className="jbp-two-columns">
          <div className="jbp-field">
            <label>Amount paid now (GH₵)</label>
            <input className="jbp-input" inputMode="decimal" required value={initialAmount} onChange={(event) => setInitialAmount(event.target.value)} />
          </div>
          <div className="jbp-field">
            <label>Payment method</label>
            <select className="jbp-input" value={method} onChange={(event) => setMethod(event.target.value)}>
              <option value="none">None</option>
              <option value="cash">Cash</option>
              <option value="momo">Mobile Money</option>
              <option value="bank">Bank</option>
            </select>
          </div>
        </div>

        {method !== "none" && <div className="jbp-field"><label>Payment reference (optional)</label><input className="jbp-input" value={reference} onChange={(event) => setReference(event.target.value)} /></div>}
        <div className="jbp-field"><label>Notes (optional)</label><textarea className="jbp-input" rows="2" value={notes} onChange={(event) => setNotes(event.target.value)} /></div>

        <p className="jbp-hint">Submit once per purchase. If a request times out, keep this form open; it retains the same request key for a safe retry.</p>

        <div className="jbp-form-actions">
          <button type="button" className="jbp-btn jbp-btn-secondary" onClick={onClose}>Cancel</button>
          <button className="jbp-btn" type="submit" disabled={loading}>{loading ? "Recording..." : "Record Purchase"}</button>
        </div>
      </form>
    </Modal>
  );
}
