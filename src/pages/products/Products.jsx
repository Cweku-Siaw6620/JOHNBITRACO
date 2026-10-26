
import {
  useCallback,
  useEffect,
  useMemo,
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


// ==================================================
// Default suggestions
// ==================================================

const DEFAULT_CATEGORIES = [
  "Executive",
  "Loafers",
  "Boots",
  "Other",
];

const DEFAULT_BRANDS = [
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


// ==================================================
// Recent-entry storage
// ==================================================

const RECENT_BRAND_KEY =
  "johnbtraco_recent_brand";

const RECENT_CATEGORY_KEY =
  "johnbtraco_recent_category";


function getRecentValue(key) {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}


function saveRecentValue(key, value) {
  try {
    localStorage.setItem(key, value.trim());
  } catch {
    // Product saving should not fail if
    // browser storage is unavailable.
  }
}


// ==================================================
// Helpers
// ==================================================

const emptyForm = {
  name: "",
  brand: "",
  category: "",
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


function buildSuggestions(values) {
  const seen = new Set();

  return values
    .map((value) => String(value || "").trim())
    .filter((value) => {
      if (!value) {
        return false;
      }

      const key = value.toLowerCase();

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);

      return true;
    });
}


// ==================================================
// Products component
// ==================================================

export default function Products() {
  const { session } = useAuth();

  const token = session?.token;

  const admin = session?.user?.role === "admin";


  // ------------------------------------------------
  // Products state
  // ------------------------------------------------

  const [products, setProducts] = useState([]);

  const [total, setTotal] = useState(0);

  const [page, setPage] = useState(1);

  const [search, setSearch] = useState("");

  const [category, setCategory] = useState("");

  const [selectedId, setSelectedId] = useState(null);

  const [productStockItem, setProductStockItem] =
    useState(null);


  // ------------------------------------------------
  // Form state
  // ------------------------------------------------

  const [modal, setModal] = useState(false);

  const [form, setForm] = useState({
    ...emptyForm,
  });

  const [editingId, setEditingId] = useState(null);

  const [
    editingStockItemId,
    setEditingStockItemId,
  ] = useState(null);


  // ------------------------------------------------
  // Recent values
  // ------------------------------------------------

  const [recentBrand, setRecentBrand] = useState(
    () => getRecentValue(RECENT_BRAND_KEY)
  );

  const [recentCategory, setRecentCategory] =
    useState(
      () => getRecentValue(RECENT_CATEGORY_KEY)
    );


  // ------------------------------------------------
  // General state
  // ------------------------------------------------

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const [formError, setFormError] = useState("");

  const [refresh, setRefresh] = useState(0);

  const delayedSearch = useDebounced(search);

  const delayedCategory = useDebounced(category);


  // ------------------------------------------------
  // Dynamic suggestions
  // ------------------------------------------------

  const brandSuggestions = useMemo(() => {
    return buildSuggestions([
      recentBrand,
      ...products.map((product) => product.brand),
      ...DEFAULT_BRANDS,
    ]);
  }, [recentBrand, products]);


  const categorySuggestions = useMemo(() => {
    return buildSuggestions([
      recentCategory,
      ...products.map((product) => product.category),
      ...DEFAULT_CATEGORIES,
    ]);
  }, [recentCategory, products]);


  // ------------------------------------------------
  // Load products
  // ------------------------------------------------

  const loadProducts = useCallback(
    async (signal) => {
      if (!token) {
        setLoading(false);
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
            category: delayedCategory.trim(),
          },
          signal
        );

        if (signal?.aborted) {
          return;
        }

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
    [
      token,
      page,
      delayedSearch,
      delayedCategory,
    ]
  );


  useEffect(() => {
    const controller = new AbortController();

    loadProducts(controller.signal);

    return () => controller.abort();

  }, [loadProducts, refresh]);


  // ------------------------------------------------
  // Maintain selected product
  // ------------------------------------------------

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


  // ------------------------------------------------
  // Load internal product stock item
  // ------------------------------------------------

  useEffect(() => {
    if (!token || !selectedId) {
      setProductStockItem(null);
      return;
    }

    const controller = new AbortController();

    setProductStockItem(null);

    inventoryApi
      .variants(
        token,
        selectedId,
        controller.signal
      )
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


  // ------------------------------------------------
  // Derived values
  // ------------------------------------------------

  const selectedProduct = products.find(
    (product) => product._id === selectedId
  );

  const categoriesCount = new Set(
    products.map((product) => product.category)
  ).size;


  // ------------------------------------------------
  // Update form field
  // ------------------------------------------------

  function updateForm(field, value) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }


  // ------------------------------------------------
  // Open Add Product modal
  // ------------------------------------------------

  function openCreateProduct() {
    setEditingId(null);

    setEditingStockItemId(null);

    setForm({
      ...emptyForm,
    });

    setFormError("");

    setModal(true);
  }


  // ------------------------------------------------
  // Open Edit Product modal
  // ------------------------------------------------

  async function openEditProduct(product) {
    setError("");

    try {
      // Prices remain stored in the internal
      // ProductVariant document.

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
        name: product.name || "",
        brand: product.brand || "",
        category: product.category || "",
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


  // ------------------------------------------------
  // Save recent brand and category
  // ------------------------------------------------

  function rememberProductEntries(brand, category) {
    const savedBrand = brand.trim();

    const savedCategory = category.trim();

    saveRecentValue(
      RECENT_BRAND_KEY,
      savedBrand
    );

    saveRecentValue(
      RECENT_CATEGORY_KEY,
      savedCategory
    );

    setRecentBrand(savedBrand);

    setRecentCategory(savedCategory);
  }


  // ------------------------------------------------
  // Submit Add / Edit Product
  // ------------------------------------------------

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


      // Validate product details

      if (!form.name.trim()) {
        throw new Error(
          "Enter the product name."
        );
      }

      if (!form.brand.trim()) {
        throw new Error(
          "Enter the product brand."
        );
      }

      if (!form.category.trim()) {
        throw new Error(
          "Enter the product category."
        );
      }


      const productDetails = {
        name: form.name.trim(),
        brand: form.brand.trim(),
        category: form.category.trim(),
        description: form.description.trim(),
        imageUrl: form.imageUrl.trim(),
      };


      // ----------------------------------------------
      // Edit existing product
      // ----------------------------------------------

      if (editingId) {
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

        // --------------------------------------------
        // Create new product
        // --------------------------------------------

        // The backend creates the Product
        // and its one internal variant together.

        const response =
          await inventoryApi.createProduct(
            token,
            {
              ...productDetails,
              retailPrice,
              wholesalePrice,
              referenceCost,
            }
          );

        if (response.product?._id) {
          setSelectedId(
            response.product._id
          );
        }

        // Reset filters so the new product
        // is visible in the catalogue.

        setSearch("");

        setCategory("");

        setPage(1);
      }


      // ----------------------------------------------
      // Remember recent entries only after success
      // ----------------------------------------------

      rememberProductEntries(
        productDetails.brand,
        productDetails.category
      );

      setModal(false);

      setRefresh((previous) => previous + 1);

    } catch (err) {
      setFormError(err.message);

    } finally {
      setSaving(false);
    }
  }


  // ==================================================
  // RENDER
  // ==================================================

  return (
    <div className="jbi-page">

      {/* ============================================
          PAGE HEADING
      ============================================ */}

      <PageHead
        title="Products"
        description="Manage JOHNBTRACO products, brands, categories and selling prices."
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


      {/* ============================================
          STATISTICS
      ============================================ */}

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
          detail="Prices are managed per product"
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


      {/* ============================================
          PRODUCT TABLE AND DETAILS
      ============================================ */}

      <div className="jbi-products-grid">

        <section className="jbi-panel">

          {/* Search and category filter */}

          <div className="jbi-toolbar">

            <SearchInput
              value={search}
              onChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
              placeholder="Search product name or brand..."
            />

            <input
              className="jbi-select"
              type="text"
              list="jbt-filter-categories"
              value={category}
              onChange={(event) => {
                setCategory(event.target.value);
                setPage(1);
              }}
              placeholder="All categories"
              maxLength={100}
              autoComplete="off"
            />

            <datalist id="jbt-filter-categories">
              {categorySuggestions.map((item) => (
                <option
                  key={item}
                  value={item}
                />
              ))}
            </datalist>

          </div>


          {/* Product listing */}

          {loading ? (

            <Loading />

          ) : products.length === 0 ? (

            <Empty text="No products found. Add a product to get started." />

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
                            <strong>
                              {product.name}
                            </strong>

                            <small>
                              {product.description ||
                                "product collection"}
                            </small>
                          </div>

                        </div>

                      </td>

                      <td>
                        {product.category}
                      </td>

                      <td>
                        {product.brand || "—"}
                      </td>

                      <td>
                        <span className="jbi-pill green">
                          Active
                        </span>
                      </td>

                      <td>

                        <div className="jbi-inline">

                          <button
                            type="button"
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
                              type="button"
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


        {/* ==========================================
            PRODUCT DETAILS
        ========================================== */}

        <aside className="jbi-detail jbi-product-detail">

          <h2>Product Details</h2>

          {!selectedProduct ? (

            <Empty text="Select a product to view its details." />

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


              <h3>
                {selectedProduct.name}
              </h3>


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
                      {cedis(
                        productStockItem.retailPrice
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Wholesale Price</span>
                    <strong>
                      {cedis(
                        productStockItem.wholesalePrice
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Reference Cost</span>
                    <strong>
                      {cedis(
                        productStockItem.referenceCost
                      )}
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
                  type="button"
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


      {/* ============================================
          ADD / EDIT PRODUCT MODAL
      ============================================ */}

      {modal && (

        <Modal
          title={
            editingId
              ? "Edit Product"
              : "Add New Product"
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

            {/* --------------------------------------
                product name
            -------------------------------------- */}

            <div className="jbi-field">

              <label>product name</label>

              <input
                required
                minLength={2}
                maxLength={150}
                value={form.name}
                onChange={(event) => {
                  updateForm(
                    "name",
                    event.target.value
                  );
                }}
                placeholder="e.g. Horsebit Loafer"
              />

            </div>


            {/* --------------------------------------
                Typable Brand and Category
            -------------------------------------- */}

            <div className="jbi-form-grid">

              <div className="jbi-field">

                <label>Brand</label>

                <input
                  required
                  type="text"
                  list="jbt-brand-suggestions"
                  maxLength={100}
                  value={form.brand}
                  onChange={(event) => {
                    updateForm(
                      "brand",
                      event.target.value
                    );
                  }}
                  placeholder="Type or select a brand"
                  autoComplete="off"
                />

                <datalist id="jbt-brand-suggestions">

                  {brandSuggestions.map((brand) => (
                    <option
                      key={brand}
                      value={brand}
                    />
                  ))}

                </datalist>

                {recentBrand && (

                  <small className="jbi-muted">
                    Recently entered: {recentBrand}
                  </small>

                )}

              </div>


              <div className="jbi-field">

                <label>Category</label>

                <input
                  required
                  type="text"
                  list="jbt-category-suggestions"
                  maxLength={100}
                  value={form.category}
                  onChange={(event) => {
                    updateForm(
                      "category",
                      event.target.value
                    );
                  }}
                  placeholder="Type or select a category"
                  autoComplete="off"
                />

                <datalist id="jbt-category-suggestions">

                  {categorySuggestions.map((item) => (
                    <option
                      key={item}
                      value={item}
                    />
                  ))}

                </datalist>

                {recentCategory && (

                  <small className="jbi-muted">
                    Recently entered: {recentCategory}
                  </small>

                )}

              </div>

            </div>


            {/* --------------------------------------
                Selling prices
            -------------------------------------- */}

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
              Reference cost is an estimate.
              Actual inventory cost is recorded
              when stock is added.
            </p>


            {/* --------------------------------------
                Image URL
            -------------------------------------- */}

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


            {/* --------------------------------------
                Description
            -------------------------------------- */}

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


            {/* --------------------------------------
                Product status
            -------------------------------------- */}

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


            {/* --------------------------------------
                Form error
            -------------------------------------- */}

            <ErrorNotice error={formError} />


            {/* --------------------------------------
                Form actions
            -------------------------------------- */}

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
