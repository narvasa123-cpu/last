import { History, Pencil, Plus, Search, SlidersHorizontal, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Sidebar } from '../../components/layout/Sidebar';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input, Textarea } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { useNotifications } from '../../hooks/useNotifications';
import {
  createAdminProduct,
  deleteAdminProduct,
  bulkAdjustProductStock,
  getAdminProductsPage,
  getStockChangeLogs,
  subscribeToAdminTable,
  updateAdminProduct,
  updateProductFeatured,
  uploadAdminProductImage,
} from '../../lib/admin';
import type { Product, ProductCategory, StockChangeLog } from '../../lib/types';
import { createEmptyFlowerSvg, formatPrice } from '../../lib/utils';

type ProductFormState = {
  name: string;
  description: string;
  category: ProductCategory;
  price: string;
  imageUrl: string;
  stock: string;
  isFeatured: boolean;
};

type ProductFormErrors = Partial<Record<'name' | 'price' | 'stock' | 'imageUrl' | 'general', string>>;

const emptyProductForm: ProductFormState = {
  name: '',
  description: '',
  category: 'mixed',
  price: '0',
  imageUrl: '',
  stock: '0',
  isFeatured: false,
};

function validateProductForm(form: ProductFormState, imageFile: File | null): ProductFormErrors {
  const errors: ProductFormErrors = {};

  if (!form.name.trim()) {
    errors.name = 'Product name is required.';
  }

  if (!form.price.trim()) {
    errors.price = 'Enter a product price.';
  } else {
    const price = Number(form.price);
    if (!Number.isFinite(price) || price <= 0) {
      errors.price = 'Price must be greater than zero.';
    }
  }

  if (!form.stock.trim()) {
    errors.stock = 'Enter the available stock.';
  } else {
    const stock = Number(form.stock);
    if (!Number.isInteger(stock) || stock < 0) {
      errors.stock = 'Stock must be a whole number of 0 or more.';
    }
  }

  if (form.imageUrl.trim()) {
    try {
      new URL(form.imageUrl.trim());
    } catch {
      errors.imageUrl = 'Use a valid hosted image URL.';
    }
  }

  if (imageFile) {
    if (!imageFile.type.startsWith('image/')) {
      errors.imageUrl = 'Select a valid image file.';
    } else if (imageFile.size > 5 * 1024 * 1024) {
      errors.imageUrl = 'Image files must be 5 MB or smaller.';
    }
  }

  return errors;
}

export function ManageProducts() {
  const { showToast } = useNotifications();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ProductCategory | 'all'>('all');
  const [featuredFilter, setFeaturedFilter] = useState<'all' | 'featured' | 'standard'>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');
  const [page, setPage] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [stockDelta, setStockDelta] = useState('10');
  const [stockHistory, setStockHistory] = useState<StockChangeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<ProductFormState>(emptyProductForm);
  const [formErrors, setFormErrors] = useState<ProductFormErrors>({});
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pageSize = 10;

  const syncProducts = useCallback(async (showLoading = false) => {
    if (showLoading) {
      setLoading(true);
    }

    const nextProducts = await getAdminProductsPage({
      page,
      pageSize,
      search,
      category: categoryFilter,
      featured: featuredFilter,
      stock: stockFilter,
    });

    setProducts(nextProducts.data);
    setTotalProducts(nextProducts.total);
    setSelectedProductIds((current) => current.filter((id) => nextProducts.data.some((product) => product.id === id)));
    setLoading(false);
  }, [categoryFilter, featuredFilter, page, search, stockFilter]);

  const loadStockHistory = useCallback(async () => {
    const logs = await getStockChangeLogs({ page: 1, pageSize: 6 });
    setStockHistory(logs.data);
  }, []);

  useEffect(() => {
    let active = true;

    async function syncProducts(showLoading = false) {
      if (showLoading) {
        setLoading(true);
      }

      const nextProducts = await getAdminProductsPage({
        page,
        pageSize,
        search,
        category: categoryFilter,
        featured: featuredFilter,
        stock: stockFilter,
      });

      if (!active) {
        return;
      }

      setProducts(nextProducts.data);
      setTotalProducts(nextProducts.total);

      if (showLoading) {
        setLoading(false);
      }
    }

    void syncProducts(true);
    void loadStockHistory();

    const unsubscribe = subscribeToAdminTable('products', () => {
      void syncProducts();
      void loadStockHistory();
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [categoryFilter, featuredFilter, loadStockHistory, page, search, stockFilter]);

  useEffect(() => {
    if (!selectedImageFile) {
      setPreviewImageUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(selectedImageFile);
    setPreviewImageUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedImageFile]);

  const totalPages = Math.max(1, Math.ceil(totalProducts / pageSize));

  function resetFormState(nextForm: ProductFormState = emptyProductForm) {
    setForm(nextForm);
    setFormErrors({});
    setSelectedImageFile(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  const handleOpenCreate = () => {
    setEditingProductId(null);
    resetFormState(emptyProductForm);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (product: Product) => {
    setEditingProductId(product.id);
    resetFormState({
      name: product.name,
      description: product.description,
      category: product.category,
      price: String(product.price),
      imageUrl: product.image_url,
      stock: String(product.stock),
      isFeatured: product.is_featured,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (submitting) return;
    setIsModalOpen(false);
    setEditingProductId(null);
    resetFormState(emptyProductForm);
  };

  const clearPendingImage = (removeStoredUrl = false) => {
    setSelectedImageFile(null);
    setFormErrors((current) => ({ ...current, imageUrl: undefined, general: undefined }));

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    if (removeStoredUrl) {
      setForm((current) => ({ ...current, imageUrl: '' }));
    }
  };

  const handleSubmit = async () => {
    const validationErrors = validateProductForm(form, selectedImageFile);

    if (Object.keys(validationErrors).length) {
      setFormErrors(validationErrors);
      return;
    }

    setSubmitting(true);
    setFormErrors({});

    let imageUrl = form.imageUrl.trim();

    if (selectedImageFile) {
      const upload = await uploadAdminProductImage(selectedImageFile, form.name);

      if (upload.error || !upload.data) {
        setSubmitting(false);
        setFormErrors({ imageUrl: upload.error ?? 'Unable to upload the selected image.' });
        return;
      }

      imageUrl = upload.data;
    }

    const payload = {
      name: form.name,
      description: form.description,
      category: form.category,
      price: Number(form.price),
      imageUrl,
      stock: Number(form.stock),
      isFeatured: form.isFeatured,
    };

    const result = editingProductId
      ? await updateAdminProduct(editingProductId, payload)
      : await createAdminProduct(payload);

    setSubmitting(false);

    if (result.error || !result.data) {
      setFormErrors({ general: result.error ?? 'Unable to save the product.' });
      return;
    }

    const savedProduct = result.data;
    setProducts((current) =>
      editingProductId
        ? current.map((entry) => (entry.id === savedProduct.id ? savedProduct : entry))
        : [savedProduct, ...current],
    );
    void syncProducts();
    void loadStockHistory();
    setIsModalOpen(false);
    setEditingProductId(null);
    resetFormState(emptyProductForm);
    showToast(
      editingProductId ? 'Product updated' : 'Product created',
      `${savedProduct.name} is now saved in the catalog.`,
    );
  };

  const toggleSelected = (productId: string) => {
    setSelectedProductIds((current) =>
      current.includes(productId) ? current.filter((id) => id !== productId) : [...current, productId],
    );
  };

  const handleFeaturedToggle = async (product: Product) => {
    const { data, error } = await updateProductFeatured(product.id, !product.is_featured);

    if (error || !data) {
      showToast('Featured update failed', error ?? 'Unable to update this product.');
      return;
    }

    setProducts((current) => current.map((entry) => (entry.id === data.id ? data : entry)));
    showToast('Product updated', `${data.name} is now ${data.is_featured ? 'featured' : 'standard'}.`);
  };

  const handleBulkStockAdjustment = async () => {
    const delta = Number(stockDelta);
    if (!Number.isInteger(delta) || delta === 0) {
      showToast('Check stock adjustment', 'Use a whole number such as 10 or -5.');
      return;
    }

    const { data, error } = await bulkAdjustProductStock(selectedProductIds, delta);

    if (error) {
      showToast('Bulk adjustment failed', error);
      return;
    }

    setProducts((current) => current.map((product) => data.find((entry) => entry.id === product.id) ?? product));
    setSelectedProductIds([]);
    void loadStockHistory();
    showToast('Stock adjusted', `${data.length} products were updated.`);
  };

  const handleDelete = async (product: Product) => {
    if (!window.confirm(`Delete ${product.name} from the catalog?`)) {
      return;
    }

    setDeletingProductId(product.id);
    const { error } = await deleteAdminProduct(product.id);
    setDeletingProductId(null);

    if (error) {
      showToast('Delete failed', error);
      return;
    }

    setProducts((current) => current.filter((entry) => entry.id !== product.id));
    showToast('Product deleted', `${product.name} has been removed from the catalog.`);
  };

  const previewImage = previewImageUrl || form.imageUrl.trim() || createEmptyFlowerSvg(form.name || 'Bloom');
  const imageStateLabel = selectedImageFile
    ? `${selectedImageFile.name} (${Math.max(1, Math.round(selectedImageFile.size / 1024))} KB)`
    : form.imageUrl.trim()
      ? 'Using the saved product image.'
      : 'Upload a product photo or paste a hosted image URL.';

  return (
    <PageWrapper>
      <div className="page-shell">
        <div className="dashboard-layout">
          <Sidebar role="admin" />
          <Card className="summary-card">
            <div className="section-heading">
              <div className="section">
                <span className="eyebrow">Manage Products</span>
                <h2>Catalog overview</h2>
                <p>Monitor featured items, category mix, and stock health.</p>
              </div>
              <Button onClick={handleOpenCreate}>
                <Plus size={18} />
                Add Product
              </Button>
            </div>
            <div className="search-row">
              <Input
                label="Search catalog"
                icon={<Search size={18} style={{ marginLeft: '1rem', color: 'var(--bloom-rose)' }} />}
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
              <div className="field-stack">
                <label htmlFor="product-category-filter">Category</label>
                <div className="select-shell">
                  <select
                    id="product-category-filter"
                    value={categoryFilter}
                    onChange={(event) => {
                      setCategoryFilter(event.target.value as ProductCategory | 'all');
                      setPage(1);
                    }}
                  >
                    <option value="all">All categories</option>
                    <option value="roses">roses</option>
                    <option value="tulips">tulips</option>
                    <option value="mixed">mixed</option>
                    <option value="sunflowers">sunflowers</option>
                    <option value="orchids">orchids</option>
                  </select>
                </div>
              </div>
              <div className="field-stack">
                <label htmlFor="product-featured-filter">Featured</label>
                <div className="select-shell">
                  <select
                    id="product-featured-filter"
                    value={featuredFilter}
                    onChange={(event) => {
                      setFeaturedFilter(event.target.value as typeof featuredFilter);
                      setPage(1);
                    }}
                  >
                    <option value="all">All</option>
                    <option value="featured">Featured</option>
                    <option value="standard">Standard</option>
                  </select>
                </div>
              </div>
              <div className="field-stack">
                <label htmlFor="product-stock-filter">Stock</label>
                <div className="select-shell">
                  <select
                    id="product-stock-filter"
                    value={stockFilter}
                    onChange={(event) => {
                      setStockFilter(event.target.value as typeof stockFilter);
                      setPage(1);
                    }}
                  >
                    <option value="all">All stock</option>
                    <option value="low">Low stock</option>
                    <option value="out">Out of stock</option>
                  </select>
                </div>
              </div>
            </div>
            <Card className="summary-card admin-compact-card">
              <div className="summary-row">
                <div className="section" style={{ gap: '0.2rem' }}>
                  <strong><SlidersHorizontal size={16} /> Bulk stock adjustment</strong>
                  <p>{selectedProductIds.length} selected products</p>
                </div>
                <div className="summary-row">
                  <Input
                    label="Delta"
                    type="number"
                    step="1"
                    value={stockDelta}
                    onChange={(event) => setStockDelta(event.target.value)}
                    style={{ maxWidth: '8rem' }}
                  />
                  <Button size="sm" disabled={!selectedProductIds.length} onClick={handleBulkStockAdjustment}>
                    Apply
                  </Button>
                </div>
              </div>
            </Card>
            <div className="table-shell">
              <table className="table">
                <thead>
                  <tr>
                    <th>Select</th>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Stock</th>
                    <th>Featured</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7}>Loading products...</td>
                    </tr>
                  ) : products.length ? (
                    products.map((product) => (
                      <tr key={product.id}>
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`Select ${product.name}`}
                            checked={selectedProductIds.includes(product.id)}
                            onChange={() => toggleSelected(product.id)}
                          />
                        </td>
                        <td>{product.name}</td>
                        <td>{product.category}</td>
                        <td>{formatPrice(product.price)}</td>
                        <td>{product.stock}</td>
                        <td>
                          <button
                            type="button"
                            className="chip-button"
                            onClick={() => handleFeaturedToggle(product)}
                          >
                            <Badge variant={product.is_featured ? 'success' : 'neutral'}>
                              {product.is_featured ? 'Featured' : 'Standard'}
                            </Badge>
                          </button>
                        </td>
                        <td>
                          <div className="summary-row" style={{ justifyContent: 'flex-start' }}>
                            <Button size="sm" variant="secondary" onClick={() => handleOpenEdit(product)}>
                              <Pencil size={16} />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={deletingProductId === product.id}
                              onClick={() => handleDelete(product)}
                            >
                              <Trash2 size={16} />
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7}>No products matched that search.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="pagination-row">
              <span>Page {page} of {totalPages} - {totalProducts} products</span>
              <div className="summary-row">
                <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
                  Previous
                </Button>
                <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>
                  Next
                </Button>
              </div>
            </div>
            <Card className="summary-card admin-compact-card">
              <div className="section" style={{ gap: '0.35rem' }}>
                <strong><History size={16} /> Stock change history</strong>
                {stockHistory.length ? (
                  stockHistory.map((log) => (
                    <div className="summary-row" key={log.id}>
                      <span>{log.product?.name ?? log.product_id}</span>
                      <strong className="tabular-nums">{log.previous_stock} to {log.next_stock}</strong>
                    </div>
                  ))
                ) : (
                  <p>No stock changes recorded yet.</p>
                )}
              </div>
            </Card>
          </Card>
        </div>
      </div>

      <Modal
        open={isModalOpen}
        onClose={closeModal}
        title={editingProductId ? 'Edit Product' : 'Add Product'}
        description="Update the product details that appear in the catalog and admin dashboards."
        className="summary-card"
      >
        <div className="section">
          <div className="product-detail product-editor-layout">
            <Card className="summary-card" style={{ padding: '0.75rem' }}>
              <img
                src={previewImage}
                alt={form.name || 'Product preview'}
                style={{ width: '100%', height: '180px', objectFit: 'cover', borderRadius: '1rem' }}
              />
            </Card>
            <div className="section">
              <Input
                label="Product Name"
                value={form.name}
                error={formErrors.name}
                onChange={(event) => {
                  setForm((current) => ({ ...current, name: event.target.value }));
                  setFormErrors((current) => ({ ...current, name: undefined, general: undefined }));
                }}
              />
              <Textarea
                label="Description"
                value={form.description}
                onChange={(event) => {
                  setForm((current) => ({ ...current, description: event.target.value }));
                  setFormErrors((current) => ({ ...current, general: undefined }));
                }}
              />
              <div className="field-stack">
                <label htmlFor="product-category">Category</label>
                <div className="select-shell">
                  <select
                    id="product-category"
                    value={form.category}
                    onChange={(event) => {
                      setForm((current) => ({ ...current, category: event.target.value as ProductCategory }));
                      setFormErrors((current) => ({ ...current, general: undefined }));
                    }}
                  >
                    <option value="roses">roses</option>
                    <option value="tulips">tulips</option>
                    <option value="mixed">mixed</option>
                    <option value="sunflowers">sunflowers</option>
                    <option value="orchids">orchids</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="coupon-grid">
            <Input
              label="Price"
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              error={formErrors.price}
              onChange={(event) => {
                setForm((current) => ({ ...current, price: event.target.value }));
                setFormErrors((current) => ({ ...current, price: undefined, general: undefined }));
              }}
            />
            <Input
              label="Stock"
              type="number"
              min="0"
              step="1"
              value={form.stock}
              error={formErrors.stock}
              onChange={(event) => {
                setForm((current) => ({ ...current, stock: event.target.value }));
                setFormErrors((current) => ({ ...current, stock: undefined, general: undefined }));
              }}
            />
          </div>

          <div className="field-stack">
            <label htmlFor="product-photo-upload">Product Photo</label>
            <Card className="summary-card" style={{ padding: '1rem' }}>
              <div className="section" style={{ gap: '0.85rem' }}>
                <input
                  ref={fileInputRef}
                  id="product-photo-upload"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={(event) => {
                    setSelectedImageFile(event.target.files?.[0] ?? null);
                    setFormErrors((current) => ({ ...current, imageUrl: undefined, general: undefined }));
                  }}
                />
                <div className="summary-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="muted">{imageStateLabel}</span>
                  {(selectedImageFile || form.imageUrl.trim()) && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => clearPendingImage(!selectedImageFile)}
                    >
                      {selectedImageFile ? 'Clear Upload' : 'Remove Image'}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
            {formErrors.imageUrl ? (
              <span className="field-error">{formErrors.imageUrl}</span>
            ) : (
              <span className="muted">JPG, PNG, WEBP, or SVG up to 5 MB.</span>
            )}
          </div>

          <Input
            label="Hosted Image URL"
            value={form.imageUrl}
            hint={selectedImageFile ? 'The uploaded file will replace this URL when you save.' : 'Optional for externally hosted assets.'}
            onChange={(event) => {
              setForm((current) => ({ ...current, imageUrl: event.target.value }));
              setFormErrors((current) => ({ ...current, imageUrl: undefined, general: undefined }));
            }}
          />

          <label className="checkbox-option">
            <input
              type="checkbox"
              checked={form.isFeatured}
              onChange={(event) => {
                setForm((current) => ({ ...current, isFeatured: event.target.checked }));
                setFormErrors((current) => ({ ...current, general: undefined }));
              }}
            />
            Feature this product on storefront highlights
          </label>

          {formErrors.general ? <span className="field-error">{formErrors.general}</span> : null}

          <div className="summary-row">
            <Button type="button" variant="secondary" onClick={closeModal} disabled={submitting}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Saving...' : editingProductId ? 'Save Changes' : 'Create Product'}
            </Button>
          </div>
        </div>
      </Modal>
    </PageWrapper>
  );
}
