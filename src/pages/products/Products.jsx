
import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  Boxes,
  Plus,
  Tag,
  Pencil,
  RefreshCw,
  Eye,
  Coins,
} from "lucide-react";

import { useAuth } from "../login/features/AuthProvider";

import { inventoryApi } from "../../services/inventoryApi";

import {
  Empty,
  ErrorNotice,
  Loading,
  Modal,
  PageHead,
  Pagination,
  SearchInput,
  StatCard,
  cedis,
  useDebounced,
} from "../../components/inventory/InventoryUI";

import "./products.css";


const categories = [
  "Executive",
  "Loafers",
  "Boots",
  "Other",
];


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


const emptyForm = {
  name: "",
  brand: "",
  category: "Executive",
  description: "",
  imageUrl: "",
  retailPrice: "",
  wholesalePrice: "",
  referenceCost: "",
  isActive: true,
};


function moneyToPesewas(value, label) {
  const text = String(value).trim();

  if (
    text === "" ||
    !/^\d+(\.\d{1,2})?$/.test(text)
  ) {
    throw new Error(
      `${label} must be a valid amount with no more than two decimal places.`
    );
  }

  const amount = Math.round(Number(text) * 100);

  if (!Number.isSafeInteger(amount)) {
    throw new Error(`${label} is too large.`);
  }

  return amount;
}


function priceForInput(value) {
  if (!Number.isSafeInteger(value)) {
    return "";
  }

  return String(value / 100);
}


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

  const [productStockItem, setProductStockItem] = useState(null);

  const [modal, setModal] = useState(false);

  const [form, setForm] = useState(emptyForm);

  const [editingId, setEditingId] = useState(null);

  const [editingStockItemId, setEditingStockItemId] =
    useState(null);

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const [formError, setFormError] = useState("");

  const [refresh, setRefresh] = useState(0);

  const delayedSearch = useDebounced(search);


  // --------------------------------------------------
  // Load products
  // --------------------------------------------------

  const loadProducts = useCallback(
    async (signal) => {
      if (!token) {
        return;
      }

      setLoading(true);

      setError("");

      try {
        const response = await inventoryApi.products(
          token,
          {
            page,
            limit: 20,
            search: delayedSearch,
            category,
          },
          signal
        );

        setProducts(response.products || []);

        setTotal(response.total || 0);

      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message);
        }

      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [token, page, delayedSearch, category]
  );


  useEffect(() => {
    const controller = new AbortController();

    loadProducts(controller.signal);

    return () => controller.abort();

  }, [loadProducts, refresh]);


  // --------------------------------------------------
  // Maintain selected product
  // --------------------------------------------------

  useEffect(() => {
    if (products.length === 0) {
      setSelectedId(null);
      return;
    }

    const stillExists = products.some(
      (product) => product._id === selectedId
    );

    if (!stillExists) {
      setSelectedId(products[0]._id);
    }

  }, [products, selectedId]);


  // --------------------------------------------------
  // Load the internal stock item for the selected shoe
  // --------------------------------------------------

  useEffect(() => {
    if (!token || !selectedId) {
      setProductStockItem(null);
      return;
    }

    const controller = new AbortController();

    setProductStockItem(null);

    inventoryApi
      .variants(token, selectedId, controller.signal)
      .then((response) => {
        if (!controller.signal.aborted) {
          setProductStockItem(
            response.variants?.[0] || null
          );
        }
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError(err.message);
        }
      });

    return () => controller.abort();

  }, [token, selectedId, refresh]);


  const selectedProduct = products.find(
    (product) => product._id === selectedId
  );

  const categoriesCount = new Set(
    products.map((product) => product.category)
  ).size;


  // --------------------------------------------------
  // Product form helpers
  // --------------------------------------------------

  function updateForm(field, value) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }


  function openCreateProduct() {
    setEditingId(null);

    setEditingStockItemId(null);

    setForm({ ...emptyForm });

    setFormError("");

    setModal(true);
  }


  async function openEditProduct(product) {
    setError("");

    try {
      // Prices belong to the internal variant,
      // not the Product document.
      const response = await inventoryApi.variants(
        token,
        product._id
      );

      const stockItem = response.variants?.[0];

      if (!stockItem) {
        throw new Error(
          "This product has no internal stock item. " +
          "Its pricing cannot be edited yet."
        );
      }

      setEditingId(product._id);

      setEditingStockItemId(stockItem._id);

      setForm({
        name: product.name,
        brand: product.brand || "",
        category: product.category,
        description: product.description || "",
        imageUrl: product.imageUrl || "",
        retailPrice: priceForInput(
          stockItem.retailPrice
        ),
        wholesalePrice: priceForInput(
          stockItem.wholesalePrice
        ),
        referenceCost: priceForInput(
          stockItem.referenceCost
        ),
        isActive: product.isActive !== false,
      });

      setFormError("");

      setModal(true);

    } catch (err) {
      setError(err.message);
    }
  }


  // --------------------------------------------------
  // Save product and prices
  // --------------------------------------------------

  async function submitProduct(event) {
    event.preventDefault();

    if (!admin || saving) {
      return;
    }

    setSaving(true);

    setFormError("");

    try {
      const retailPrice = moneyToPesewas(
        form.retailPrice,
        "Retail price"
      );

      const wholesalePrice = moneyToPesewas(
        form.wholesalePrice,
        "Wholesale price"
      );

      const referenceCost =
        form.referenceCost.trim() === ""
          ? 0
          : moneyToPesewas(
              form.referenceCost,
              "Reference cost"
            );

      if (!form.name.trim()) {
        throw new Error("Enter the shoe name.");
      }

      if (!form.brand.trim()) {
        throw new Error("Select a shoe brand.");
      }

      const productDetails = {
        name: form.name.trim(),
        brand: form.brand.trim(),
        category: form.category,
        description: form.description.trim(),
        imageUrl: form.imageUrl.trim(),
      };

      if (editingId) {
        // Update product details and pricing separately,
        // using the endpoints that already exist.

        if (!editingStockItemId) {
          throw new Error(
            "The product's internal stock item is missing."
          );
        }

        await inventoryApi.updateProduct(
          token,
          editingId,
          {
            ...productDetails,
            isActive: form.isActive,
          }
        );

        await inventoryApi.updateVariant(
          token,
          editingStockItemId,
          {
            retailPrice,
            wholesalePrice,
            referenceCost,
          }
        );

      } else {
        // Updated backend creates the Product and
        // its single internal variant together.

        const response = await inventoryApi.createProduct(
          token,
          {
            ...productDetails,
            retailPrice,
            wholesalePrice,
            referenceCost,
          }
        );

        if (response.product?._id) {
          setSelectedId(response.product._id);
        }

        // Make the newly registered product visible
        // even if the previous filters excluded it.
        setSearch("");

        setCategory("");

        setPage(1);
      }

      setModal(false);

      setRefresh((previous) => previous + 1);

    } catch (err) {
      setFormError(err.message);

    } finally {
      setSaving(false);
    }
  }


  // --------------------------------------------------
  // Product interface
  // --------------------------------------------------

  return (
    <div className="jbi-page">

      <PageHead
        title="Products"
        description="Manage JOHNBTRACO shoes, brands and selling prices."
        actions={
          admin && (
            <button
              className="jbi-button gold"
              onClick={openCreateProduct}
            >
              <Plus size={17} />
              Add Product
            </button>
          )
        }
      />


      <div className="jbi-stats">

        <StatCard
          icon={Boxes}
          label="Products on This Page"
          value={products.length}
          detail={`${total} matching catalog records`}
        />

        <StatCard
          icon={Tag}
          label="Categories on This Page"
          value={categoriesCount}
        />

        <StatCard
          icon={Coins}
          label="Pricing"
          value="Retail / Wholesale"
          detail="Prices are managed per shoe"
        />

        <StatCard
          icon={RefreshCw}
          label="Catalog"
          value="Live"
          detail="Connected to the products API"
        />

      </div>


      <ErrorNotice
        error={error}
        retry={() => {
          setRefresh((previous) => previous + 1);
        }}
      />


      <div className="jbi-products-grid">

        {/* Product list */}

        <section className="jbi-panel">

          <div className="jbi-toolbar">

            <SearchInput
              value={search}
              onChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
              placeholder="Search shoe name or brand..."
            />

            <select
              className="jbi-select"
              value={category}
              onChange={(event) => {
                setCategory(event.target.value);
                setPage(1);
              }}
            >
              <option value="">
                All categories
              </option>

              {categories.map((item) => (
                <option
                  key={item}
                  value={item}
                >
                  {item}
                </option>
              ))}

            </select>

          </div>


          {loading ? (

            <Loading />

          ) : products.length === 0 ? (

            <Empty text="No shoes found. Add a product to get started." />

          ) : (

            <div className="jbi-table-scroll">

              <table className="jbi-table">

                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Brand</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>

                  {products.map((product) => (

                    <tr
                      key={product._id}
                      className={
                        selectedId === product._id
                          ? "is-selected"
                          : ""
                      }
                    >

                      <td>
                        <div className="jbi-product-cell">

                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                            />
                          ) : (
                            <span className="jbi-no-image">
                              <Boxes size={21} />
                            </span>
                          )}

                          <div>
                            <strong>{product.name}</strong>

                            <small>
                              {product.description ||
                                "Shoe collection"}
                            </small>
                          </div>

                        </div>
                      </td>

                      <td>{product.category}</td>

                      <td>{product.brand || "—"}</td>

                      <td>
                        <span className="jbi-pill green">
                          Active
                        </span>
                      </td>

                      <td>

                        <div className="jbi-inline">

                          <button
                            className="jbi-inline-action"
                            title="View product"
                            onClick={() => {
                              setSelectedId(product._id);
                            }}
                          >
                            <Eye size={16} />
                          </button>

                          {admin && (

                            <button
                              className="jbi-inline-action"
                              title="Edit product"
                              onClick={() => {
                                openEditProduct(product);
                              }}
                            >
                              <Pencil size={16} />
                            </button>

                          )}

                        </div>

                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

          )}


          <Pagination
            page={page}
            setPage={setPage}
            total={total}
            totalPages={Math.ceil(total / 20)}
            label="matching products"
          />

        </section>


        {/* Product details */}

        <aside className="jbi-detail jbi-product-detail">

          <h2>Product Details</h2>

          {!selectedProduct ? (

            <Empty text="Select a shoe to view its details." />

          ) : (

            <>

              {selectedProduct.imageUrl ? (

                <img
                  className="jbi-detail-image"
                  src={selectedProduct.imageUrl}
                  alt={selectedProduct.name}
                />

              ) : (

                <div className="jbi-detail-image jbi-image-placeholder">
                  <Boxes size={45} />
                </div>

              )}


              <h3>{selectedProduct.name}</h3>

              <p className="jbi-muted">
                {selectedProduct.category}
                {" · "}
                {selectedProduct.brand || "Unbranded"}
              </p>

              <p className="jbi-detail-description">
                {selectedProduct.description ||
                  "No product description provided."}
              </p>


              {productStockItem ? (

                <div className="jbi-detail-grid">

                  <div>
                    <span>Retail Price</span>
                    <strong>
                      {cedis(productStockItem.retailPrice)}
                    </strong>
                  </div>

                  <div>
                    <span>Wholesale Price</span>
                    <strong>
                      {cedis(productStockItem.wholesalePrice)}
                    </strong>
                  </div>

                  <div>
                    <span>Reference Cost</span>
                    <strong>
                      {cedis(productStockItem.referenceCost)}
                    </strong>
                  </div>

                </div>

              ) : (

                <p className="jbi-muted">
                  Pricing information is unavailable.
                </p>

              )}


              {admin && (

                <button
                  className="jbi-button gold jbi-detail-btn"
                  onClick={() => {
                    openEditProduct(selectedProduct);
                  }}
                >
                  <Pencil size={16} />
                  Edit Product
                </button>

              )}

            </>

          )}

        </aside>

      </div>


      {/* Add / Edit Product Modal */}

      {modal && (

        <Modal
          title={
            editingId
              ? "Edit Product"
              : "Add New Shoe"
          }
          onClose={() => {
            if (!saving) {
              setModal(false);
            }
          }}
        >

          <form
            className="jbi-form"
            onSubmit={submitProduct}
          >

            <div className="jbi-field">

              <label>Shoe name</label>

              <input
                required
                minLength={2}
                maxLength={150}
                value={form.name}
                onChange={(event) => {
                  updateForm("name", event.target.value);
                }}
                placeholder="e.g. Horsebit Loafer"
              />

            </div>


            <div className="jbi-form-grid">

              <div className="jbi-field">

                <label>Brand</label>

                <select
                  required
                  value={form.brand}
                  onChange={(event) => {
                    updateForm("brand", event.target.value);
                  }}
                >

                  <option value="">
                    Select a brand
                  </option>

                  {form.brand &&
                    !brands.includes(form.brand) && (

                      <option value={form.brand}>
                        {form.brand}
                      </option>

                    )}

                  {brands.map((brand) => (

                    <option
                      key={brand}
                      value={brand}
                    >
                      {brand}
                    </option>

                  ))}

                </select>

              </div>


              <div className="jbi-field">

                <label>Category</label>

                <select
                  value={form.category}
                  onChange={(event) => {
                    updateForm(
                      "category",
                      event.target.value
                    );
                  }}
                >

                  {categories.map((item) => (

                    <option
                      key={item}
                      value={item}
                    >
                      {item}
                    </option>

                  ))}

                </select>

              </div>

            </div>


            {/* Selling prices */}

            <div className="jbi-form-grid">

              <div className="jbi-field">

                <label>Retail Price (GH₵)</label>

                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.retailPrice}
                  onChange={(event) => {
                    updateForm(
                      "retailPrice",
                      event.target.value
                    );
                  }}
                  placeholder="1000.00"
                />

              </div>


              <div className="jbi-field">

                <label>Wholesale Price (GH₵)</label>

                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.wholesalePrice}
                  onChange={(event) => {
                    updateForm(
                      "wholesalePrice",
                      event.target.value
                    );
                  }}
                  placeholder="850.00"
                />

              </div>


              <div className="jbi-field">

                <label>Reference Cost (GH₵)</label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.referenceCost}
                  onChange={(event) => {
                    updateForm(
                      "referenceCost",
                      event.target.value
                    );
                  }}
                  placeholder="600.00"
                />

              </div>

            </div>


            <p className="jbi-hint">
              Reference cost is an estimate. Actual
              inventory cost is recorded when stock is added.
            </p>


            {/* Image URL */}

            <div className="jbi-field">

              <label>Image URL (HTTPS)</label>

              <input
                type="url"
                value={form.imageUrl}
                onChange={(event) => {
                  updateForm(
                    "imageUrl",
                    event.target.value
                  );
                }}
                placeholder="https://..."
              />

            </div>


            {/* Description */}

            <div className="jbi-field">

              <label>Description</label>

              <textarea
                rows={3}
                value={form.description}
                onChange={(event) => {
                  updateForm(
                    "description",
                    event.target.value
                  );
                }}
                placeholder="Optional product description"
              />

            </div>


            {/* Product status */}

            {editingId && (

              <div className="jbi-field">

                <label>Status</label>

                <select
                  value={String(form.isActive)}
                  onChange={(event) => {
                    updateForm(
                      "isActive",
                      event.target.value === "true"
                    );
                  }}
                >

                  <option value="true">
                    Active
                  </option>

                  <option value="false">
                    Inactive
                  </option>

                </select>

              </div>

            )}


            <ErrorNotice error={formError} />


            <div className="jbi-form-footer">

              <button
                className="jbi-button"
                type="button"
                disabled={saving}
                onClick={() => {
                  setModal(false);
                }}
              >
                Cancel
              </button>


              <button
                className="jbi-button burgundy"
                type="submit"
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Save Changes"
                    : "Save Product"}
              </button>

            </div>

          </form>

        </Modal>

      )}

    </div>
  );
}
