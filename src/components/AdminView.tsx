import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  CheckCircle2,
  Edit3,
  PackagePlus,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useStore } from '../context/StoreContext.tsx';
import { formatINR } from '../utils/currency.ts';
import type {
  ContactMessage,
  OrderRecord,
  OrderStatus,
  PaymentAuditLog,
  PaymentRecord,
  Product,
  PublicUser,
  UserPreferences,
} from '../types/ecommerce.ts';

interface AdminOverviewData {
  metrics: {
    totalRevenue: number;
    totalOrders: number;
    totalProducts: number;
    totalCustomers: number;
    pendingReturns: number;
    outOfStockCount: number;
    lowStockCount: number;
    openMessages: number;
  };
  products: Product[];
  orders: OrderRecord[];
  customers: Array<PublicUser & { orderCount: number; totalSpent: number }>;
  payments: PaymentRecord[];
  paymentAuditLogs: PaymentAuditLog[];
  contactMessages: ContactMessage[];
}

export function AdminView() {
  const { user, authToken, apiFetch, applyAuthSession, refreshAll, showToast, navigate } =
    useStore();

  const [setupStatus, setSetupStatus] = useState<{
    hasAdmin: boolean;
    envPasscodeConfigured: boolean;
  } | null>(null);
  const [claimName, setClaimName] = useState(user?.name || '');
  const [claimEmail, setClaimEmail] = useState(user?.email || '');
  const [claimPassword, setClaimPassword] = useState('');
  const [claimPasscode, setClaimPasscode] = useState('');
  const [claiming, setClaiming] = useState(false);

  const [tab, setTab] = useState<'overview' | 'products' | 'orders' | 'customers' | 'transactions'>(
    'overview'
  );
  const [overview, setOverview] = useState<AdminOverviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'All' | OrderStatus>('All');
  const [promoTitle, setPromoTitle] = useState('');
  const [promoBody, setPromoBody] = useState('');
  const [sendingPromo, setSendingPromo] = useState(false);

  // Product Form State (Create or Edit)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [pName, setPName] = useState('');
  const [pBrand, setPBrand] = useState('');
  const [pCategory, setPCategory] = useState('Fashion & Clothing');
  const [pSubcategory, setPSubcategory] = useState('');
  const [pPrice, setPPrice] = useState('');
  const [pCompareAt, setPCompareAt] = useState('');
  const [pStock, setPStock] = useState('20');
  const [pImage, setPImage] = useState('/src/assets/images/hero_aura_atelier_1795613731604.jpg');
  const [pDesc, setPDesc] = useState('');
  const [pFeatured, setPFeatured] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);

  const isAdmin = Boolean(authToken && user?.role === 'admin');

  const fetchSetupStatus = useCallback(async () => {
    const res = await apiFetch<{ hasAdmin: boolean; envPasscodeConfigured: boolean }>(
      '/api/admin/setup-status'
    );
    if (res.ok && res.data) {
      setSetupStatus(res.data);
    }
  }, [apiFetch]);

  const fetchOverview = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    const res = await apiFetch<AdminOverviewData>('/api/admin/overview');
    if (res.ok && res.data) {
      setOverview(res.data);
    }
    setLoading(false);
  }, [apiFetch, isAdmin]);

  useEffect(() => {
    void fetchSetupStatus();
  }, [fetchSetupStatus]);

  useEffect(() => {
    if (isAdmin) {
      void fetchOverview();
    }
  }, [isAdmin, fetchOverview]);

  const handleClaimAdmin = async (e: FormEvent) => {
    e.preventDefault();
    setClaiming(true);
    const res = await apiFetch<{
      token: string;
      user: PublicUser;
      preferences: UserPreferences;
    }>('/api/admin/claim-setup', {
      method: 'POST',
      body: JSON.stringify({
        name: claimName,
        email: claimEmail,
        password: claimPassword,
        passcode: claimPasscode,
      }),
    });
    setClaiming(false);

    if (!res.ok || !res.data) {
      showToast(res.error || 'Admin access setup failed', 'error');
      return;
    }

    applyAuthSession(res.data.token, res.data.user, res.data.preferences);
    showToast('Administrator access active', 'success');
    void fetchSetupStatus();
  };

  const openCreateForm = () => {
    setEditingProduct(null);
    setPName('');
    setPBrand('');
    setPCategory('Fashion & Clothing');
    setPSubcategory('');
    setPPrice('');
    setPCompareAt('');
    setPStock('20');
    setPImage('/src/assets/images/hero_aura_atelier_1795613731604.jpg');
    setPDesc('');
    setPFeatured(false);
    setShowProductForm(true);
  };

  const openEditForm = (product: Product) => {
    setEditingProduct(product);
    setPName(product.name);
    setPBrand(product.brand);
    setPCategory(product.category);
    setPSubcategory(product.subcategory || '');
    setPPrice(String(product.price));
    setPCompareAt(product.compareAtPrice ? String(product.compareAtPrice) : '');
    setPStock(String(product.stock));
    setPImage(product.image);
    setPDesc(product.description);
    setPFeatured(product.featured);
    setShowProductForm(true);
  };

  const handleSaveProduct = async (e: FormEvent) => {
    e.preventDefault();
    setSavingProduct(true);
    const payload = {
      name: pName,
      brand: pBrand,
      category: pCategory,
      subcategory: pSubcategory,
      price: Number(pPrice),
      compareAtPrice: pCompareAt ? Number(pCompareAt) : undefined,
      stock: Number(pStock),
      image: pImage,
      description: pDesc,
      featured: pFeatured,
    };

    const res = editingProduct
      ? await apiFetch(`/api/admin/products/${editingProduct.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        })
      : await apiFetch('/api/admin/products', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

    setSavingProduct(false);
    if (!res.ok) {
      showToast(res.error || 'Could not save product', 'error');
      return;
    }

    setShowProductForm(false);
    showToast(editingProduct ? 'Product updated' : 'New product added', 'success');
    await Promise.all([fetchOverview(), refreshAll()]);
  };

  const handleQuickStock = async (product: Product, delta: number) => {
    const nextStock = Math.max(0, product.stock + delta);
    const res = await apiFetch(`/api/admin/products/${product.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ stock: nextStock }),
    });
    if (res.ok) {
      showToast(`${product.name} stock set to ${nextStock}`, 'success');
      await Promise.all([fetchOverview(), refreshAll()]);
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    const res = await apiFetch(`/api/admin/products/${product.id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast(`${product.name} removed from catalog`, 'info');
      await Promise.all([fetchOverview(), refreshAll()]);
    } else {
      showToast(res.error || 'Delete failed', 'error');
    }
  };

  const handleOrderStatusChange = async (orderId: string, status: OrderStatus) => {
    const res = await apiFetch(`/api/admin/orders/${orderId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      showToast(`Order updated to ${status}`, 'success');
      await fetchOverview();
    } else {
      showToast(res.error || 'Could not update order', 'error');
    }
  };

  const handleApproveReturn = async (orderId: string) => {
    const res = await apiFetch(`/api/admin/orders/${orderId}`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'approve_return' }),
    });
    if (res.ok) {
      showToast('Return approved, inventory restocked, and refund issued', 'success');
      await Promise.all([fetchOverview(), refreshAll()]);
    } else {
      showToast(res.error || 'Could not process return', 'error');
    }
  };

  const handleMarkMessageReviewed = async (id: string) => {
    const res = await apiFetch(`/api/admin/contact/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'Reviewed' }),
    });
    if (res.ok) {
      await fetchOverview();
    }
  };

  const handleBroadcastPromo = async (e: FormEvent) => {
    e.preventDefault();
    setSendingPromo(true);
    const res = await apiFetch<{ sentCount: number; totalUsers: number }>(
      '/api/admin/promotions/send',
      {
        method: 'POST',
        body: JSON.stringify({ title: promoTitle, body: promoBody }),
      }
    );
    setSendingPromo(false);
    if (res.ok && res.data) {
      setPromoTitle('');
      setPromoBody('');
      showToast(
        `Campaign sent to ${res.data.sentCount} of ${res.data.totalUsers} account(s)`,
        'success'
      );
    } else {
      showToast(res.error || 'Could not broadcast campaign', 'error');
    }
  };

  const filteredProducts = useMemo(() => {
    if (!overview) return [];
    const q = productSearch.trim().toLowerCase();
    if (!q) return overview.products;
    return overview.products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }, [overview, productSearch]);

  const filteredOrders = useMemo(() => {
    if (!overview) return [];
    if (orderStatusFilter === 'All') return overview.orders;
    return overview.orders.filter((o) => o.status === orderStatusFilter);
  }, [overview, orderStatusFilter]);

  if (!isAdmin) {
    const canClaimFirstAdmin =
      setupStatus && !setupStatus.hasAdmin && !setupStatus.envPasscodeConfigured;
    const needsPasscode = setupStatus?.envPasscodeConfigured;

    return (
      <div className="mx-auto max-w-[520px] px-6 py-16">
        <div className="rounded-lg border border-[var(--aura-border)] bg-[var(--aura-surface)] p-8 space-y-6">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-6 h-6 text-[var(--aura-accent)] shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-[var(--aura-text-muted)]">Operations Console</p>
              <h1 className="mt-1 font-display text-3xl font-semibold text-[var(--aura-text)]">
                Admin Dashboard
              </h1>
            </div>
          </div>

          {canClaimFirstAdmin || needsPasscode ? (
            <form onSubmit={handleClaimAdmin} className="space-y-4">
              <p className="text-xs leading-relaxed text-[var(--aura-text-muted)]">
                {needsPasscode
                  ? 'Enter the server ADMIN_PASSCODE to elevate your session or create an admin session.'
                  : user
                    ? `Signed in as ${user.email}. Claim first-run administrator ownership for this workspace below.`
                    : 'No administrator has been claimed yet. Complete first-run admin setup below to manage products, inventory, orders, and transactions.'}
              </p>

              {needsPasscode && (
                <div>
                  <label className="block text-xs font-medium text-[var(--aura-text)] mb-1.5">
                    Admin Passcode
                  </label>
                  <input
                    type="password"
                    required
                    value={claimPasscode}
                    onChange={(e) => setClaimPasscode(e.target.value)}
                    placeholder="Configured ADMIN_PASSCODE"
                    className="w-full px-3 py-2 text-sm rounded-md border border-[var(--aura-border)] bg-[var(--aura-bg)] text-[var(--aura-text)]"
                  />
                </div>
              )}

              {!user && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-[var(--aura-text)] mb-1.5">
                      Admin Name
                    </label>
                    <input
                      type="text"
                      required
                      minLength={2}
                      value={claimName}
                      onChange={(e) => setClaimName(e.target.value)}
                      placeholder="Store Administrator"
                      className="w-full px-3 py-2 text-sm rounded-md border border-[var(--aura-border)] bg-[var(--aura-bg)] text-[var(--aura-text)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--aura-text)] mb-1.5">
                      Admin Email
                    </label>
                    <input
                      type="email"
                      required
                      value={claimEmail}
                      onChange={(e) => setClaimEmail(e.target.value)}
                      placeholder="admin@auracommerce.in"
                      className="w-full px-3 py-2 text-sm rounded-md border border-[var(--aura-border)] bg-[var(--aura-bg)] text-[var(--aura-text)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--aura-text)] mb-1.5">
                      Password (minimum 8 characters)
                    </label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={claimPassword}
                      onChange={(e) => setClaimPassword(e.target.value)}
                      placeholder="Choose a strong admin password"
                      className="w-full px-3 py-2 text-sm rounded-md border border-[var(--aura-border)] bg-[var(--aura-bg)] text-[var(--aura-text)]"
                    />
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={claiming}
                className="w-full py-2.5 px-4 text-sm font-semibold rounded-md bg-[var(--aura-accent)] text-[var(--aura-accent-contrast)] hover:bg-[var(--aura-accent-hover)] cursor-pointer disabled:opacity-60"
              >
                {claiming
                  ? 'Activating Admin...'
                  : user
                    ? 'Activate Administrator Access'
                    : 'Claim Admin Account'}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-[var(--aura-text-muted)]">
                An administrator account is already registered. Sign in with your administrator
                credentials to access inventory, order processing, and transaction controls.
              </p>
              <button
                type="button"
                onClick={() => navigate({ view: 'auth', mode: 'login' })}
                className="w-full py-2.5 px-4 text-sm font-semibold rounded-md bg-[var(--aura-accent)] text-[var(--aura-accent-contrast)] hover:bg-[var(--aura-accent-hover)] cursor-pointer"
              >
                Sign In with Admin Account
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1280px] px-6 py-12 space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--aura-border)] pb-6">
        <div>
          <p className="text-xs text-[var(--aura-text-muted)]">
            Store Operations · Signed in as {user?.email}
          </p>
          <h1 className="mt-1 font-display text-4xl font-semibold text-[var(--aura-text)]">
            Admin Dashboard
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void fetchOverview()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border border-[var(--aura-border)] text-[var(--aura-text)] hover:bg-[var(--aura-surface-muted)] cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={openCreateForm}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md bg-[var(--aura-accent)] text-[var(--aura-accent-contrast)] hover:bg-[var(--aura-accent-hover)] cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 p-1 rounded-lg bg-[var(--aura-surface-muted)] overflow-x-auto">
        {(
          [
            ['overview', 'Overview'],
            ['products', `Products & Inventory (${overview?.products.length || 0})`],
            ['orders', `Orders & Returns (${overview?.orders.length || 0})`],
            ['customers', `Customers (${overview?.customers.length || 0})`],
            ['transactions', `Transactions (${overview?.payments.length || 0})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-3.5 py-2 text-xs font-medium rounded-md whitespace-nowrap shrink-0 cursor-pointer ${
              tab === key
                ? 'bg-[var(--aura-surface)] text-[var(--aura-text)] shadow-xs'
                : 'text-[var(--aura-text-muted)] hover:text-[var(--aura-text)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Add / Edit Product Modal Panel */}
      {showProductForm && (
        <form
          onSubmit={handleSaveProduct}
          className="rounded-lg border border-[var(--aura-border)] bg-[var(--aura-surface)] p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-semibold text-[var(--aura-text)]">
              {editingProduct ? `Edit: ${editingProduct.name}` : 'Add New Product'}
            </h2>
            <button
              type="button"
              onClick={() => setShowProductForm(false)}
              className="text-xs text-[var(--aura-text-muted)] hover:text-[var(--aura-text)] cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--aura-text)] mb-1">
                Product Name
              </label>
              <input
                type="text"
                required
                value={pName}
                onChange={(e) => setPName(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-md border border-[var(--aura-border)] bg-[var(--aura-bg)] text-[var(--aura-text)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--aura-text)] mb-1">Brand</label>
              <input
                type="text"
                required
                value={pBrand}
                onChange={(e) => setPBrand(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-md border border-[var(--aura-border)] bg-[var(--aura-bg)] text-[var(--aura-text)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--aura-text)] mb-1">
                Category
              </label>
              <select
                value={pCategory}
                onChange={(e) => setPCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-md border border-[var(--aura-border)] bg-[var(--aura-bg)] text-[var(--aura-text)]"
              >
                <option value="Fashion & Clothing">Fashion &amp; Clothing</option>
                <option value="Electronics & Gadgets">Electronics &amp; Gadgets</option>
                <option value="Beauty & Skincare">Beauty &amp; Skincare</option>
                <option value="Bags & Accessories">Bags &amp; Accessories</option>
                <option value="Home & Kitchen">Home &amp; Kitchen</option>
                <option value="Stationery & Lifestyle">Stationery &amp; Lifestyle</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--aura-text)] mb-1">
                Subcategory
              </label>
              <input
                type="text"
                value={pSubcategory}
                onChange={(e) => setPSubcategory(e.target.value)}
                placeholder="e.g. Audio, Ethnic Wear"
                className="w-full px-3 py-2 text-sm rounded-md border border-[var(--aura-border)] bg-[var(--aura-bg)] text-[var(--aura-text)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--aura-text)] mb-1">
                Price (₹ INR)
              </label>
              <input
                type="number"
                required
                min={1}
                value={pPrice}
                onChange={(e) => setPPrice(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-md border border-[var(--aura-border)] bg-[var(--aura-bg)] text-[var(--aura-text)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--aura-text)] mb-1">
                Original Price (₹, optional)
              </label>
              <input
                type="number"
                min={0}
                value={pCompareAt}
                onChange={(e) => setPCompareAt(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-md border border-[var(--aura-border)] bg-[var(--aura-bg)] text-[var(--aura-text)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--aura-text)] mb-1">
                Stock Quantity
              </label>
              <input
                type="number"
                required
                min={0}
                value={pStock}
                onChange={(e) => setPStock(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-md border border-[var(--aura-border)] bg-[var(--aura-bg)] text-[var(--aura-text)]"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[var(--aura-text)] mb-1">
                Image Path or HTTPS URL
              </label>
              <input
                type="text"
                required
                value={pImage}
                onChange={(e) => setPImage(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-md border border-[var(--aura-border)] bg-[var(--aura-bg)] text-[var(--aura-text)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--aura-text)] mb-1">
              Description
            </label>
            <textarea
              rows={2}
              required
              minLength={5}
              value={pDesc}
              onChange={(e) => setPDesc(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-md border border-[var(--aura-border)] bg-[var(--aura-bg)] text-[var(--aura-text)]"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <label className="inline-flex items-center gap-2 text-xs text-[var(--aura-text)] cursor-pointer">
              <input
                type="checkbox"
                checked={pFeatured}
                onChange={(e) => setPFeatured(e.target.checked)}
                className="accent-[var(--aura-accent)]"
              />
              <span>Mark as Featured Product</span>
            </label>
            <button
              type="submit"
              disabled={savingProduct}
              className="px-5 py-2 text-xs font-semibold rounded-md bg-[var(--aura-accent)] text-[var(--aura-accent-contrast)] hover:bg-[var(--aura-accent-hover)] cursor-pointer disabled:opacity-60"
            >
              {savingProduct ? 'Saving...' : editingProduct ? 'Update Product' : 'Create Product'}
            </button>
          </div>
        </form>
      )}

      {/* TAB 1: OVERVIEW */}
      {tab === 'overview' && overview && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              ['Total Revenue', formatINR(overview.metrics.totalRevenue)],
              ['Total Orders', String(overview.metrics.totalOrders)],
              ['Catalog Products', String(overview.metrics.totalProducts)],
              ['Registered Customers', String(overview.metrics.totalCustomers)],
              ['Pending Returns', String(overview.metrics.pendingReturns)],
              ['Out of Stock', String(overview.metrics.outOfStockCount)],
              ['Low Stock (<=5)', String(overview.metrics.lowStockCount)],
              ['Open Inquiries', String(overview.metrics.openMessages)],
            ].map(([label, val]) => (
              <div
                key={label}
                className="rounded-lg border border-[var(--aura-border)] bg-[var(--aura-surface)] p-5"
              >
                <p className="text-xs text-[var(--aura-text-muted)]">{label}</p>
                <p className="mt-2 font-display text-3xl font-semibold text-[var(--aura-text)] tabular-nums">
                  {val}
                </p>
              </div>
            ))}
          </div>

          {/* Support Inquiries */}
          <div className="rounded-lg border border-[var(--aura-border)] bg-[var(--aura-surface)] p-6 space-y-4">
            <h2 className="font-display text-2xl font-semibold text-[var(--aura-text)]">
              Customer Inquiries ({overview.contactMessages.length})
            </h2>
            {overview.contactMessages.length === 0 ? (
              <p className="text-xs text-[var(--aura-text-muted)]">No contact submissions yet.</p>
            ) : (
              <div className="divide-y divide-[var(--aura-border)]">
                {overview.contactMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className="py-3 flex flex-wrap items-start justify-between gap-4"
                  >
                    <div className="space-y-1 max-w-2xl">
                      <p className="text-sm font-medium text-[var(--aura-text)]">
                        {msg.subject}{' '}
                        <span className="text-xs font-normal text-[var(--aura-text-muted)]">
                          · {msg.name} ({msg.email})
                        </span>
                      </p>
                      <p className="text-xs text-[var(--aura-text-muted)]">{msg.message}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[var(--aura-text-muted)]">{msg.status}</span>
                      {msg.status === 'New' && (
                        <button
                          type="button"
                          onClick={() => void handleMarkMessageReviewed(msg.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md border border-[var(--aura-border)] text-[var(--aura-text)] hover:bg-[var(--aura-surface-muted)] cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Mark Reviewed</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Promotional Push Campaign Broadcast */}
          <form
            onSubmit={handleBroadcastPromo}
            className="rounded-lg border border-[var(--aura-border)] bg-[var(--aura-surface)] p-6 space-y-4"
          >
            <div>
              <h2 className="font-display text-2xl font-semibold text-[var(--aura-text)]">
                Promotional Campaign Push Broadcast
              </h2>
              <p className="text-xs text-[var(--aura-text-muted)] mt-1">
                Send real-time Expo and Socket.IO promotional alerts to all customer accounts opted into Promotional Campaigns.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[var(--aura-text)] mb-1">
                  Campaign Title
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={120}
                  value={promoTitle}
                  onChange={(e) => setPromoTitle(e.target.value)}
                  placeholder="e.g. Weekend Atelier Sale — Extra 15% Off"
                  className="w-full px-3 py-2 text-sm rounded-md border border-[var(--aura-border)] bg-[var(--aura-bg)] text-[var(--aura-text)]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--aura-text)] mb-1">
                  Campaign Message
                </label>
                <input
                  type="text"
                  required
                  minLength={4}
                  maxLength={320}
                  value={promoBody}
                  onChange={(e) => setPromoBody(e.target.value)}
                  placeholder="Use code AURA15 at checkout for limited-time savings."
                  className="w-full px-3 py-2 text-sm rounded-md border border-[var(--aura-border)] bg-[var(--aura-bg)] text-[var(--aura-text)]"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={sendingPromo}
                className="px-4 py-2 text-xs font-semibold rounded-md bg-[var(--aura-accent)] text-[var(--aura-accent-contrast)] hover:bg-[var(--aura-accent-hover)] cursor-pointer disabled:opacity-60"
              >
                {sendingPromo ? 'Sending Campaign...' : 'Send Promotional Push'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: PRODUCTS & INVENTORY */}
      {tab === 'products' && overview && (
        <div className="space-y-4">
          <input
            type="search"
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            placeholder="Filter catalog products by name, brand, or category..."
            className="w-full max-w-md px-3 py-2 text-sm rounded-md border border-[var(--aura-border)] bg-[var(--aura-surface)] text-[var(--aura-text)]"
          />

          <div className="overflow-x-auto rounded-lg border border-[var(--aura-border)] bg-[var(--aura-surface)]">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--aura-border)] bg-[var(--aura-surface-muted)] text-[var(--aura-text-muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Price</th>
                  <th className="px-4 py-3 font-medium">Stock</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--aura-border)]">
                {filteredProducts.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[var(--aura-text)]">{p.name}</p>
                      <p className="text-[var(--aura-text-muted)]">
                        {p.brand} · {p.featured ? 'Featured' : 'Standard'}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-[var(--aura-text-muted)]">{p.category}</td>
                    <td className="px-4 py-3 tabular-nums font-medium text-[var(--aura-text)]">
                      {formatINR(p.price)}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      <div className="inline-flex items-center gap-2">
                        <span
                          className={
                            p.stock <= 0
                              ? 'text-red-500 font-semibold'
                              : 'text-[var(--aura-text)] font-medium'
                          }
                        >
                          {p.stock}
                        </span>
                        <button
                          type="button"
                          onClick={() => void handleQuickStock(p, 5)}
                          title="Add 5 units"
                          className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded border border-[var(--aura-border)] text-[var(--aura-text)] hover:bg-[var(--aura-surface-muted)] cursor-pointer"
                        >
                          <PackagePlus className="w-3 h-3" />
                          <span>+5</span>
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditForm(p)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-[var(--aura-border)] text-[var(--aura-text)] hover:bg-[var(--aura-surface-muted)] cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteProduct(p)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-red-300 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: ORDERS & RETURNS */}
      {tab === 'orders' && overview && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                'All',
                'Return Requested',
                'Confirmed',
                'Processing',
                'Shipped',
                'Delivered',
                'Cancelled',
              ] as const
            ).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setOrderStatusFilter(status)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md border cursor-pointer ${
                  orderStatusFilter === status
                    ? 'border-[var(--aura-accent)] bg-[var(--aura-accent)] text-[var(--aura-accent-contrast)]'
                    : 'border-[var(--aura-border)] text-[var(--aura-text)] hover:bg-[var(--aura-surface-muted)]'
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          {filteredOrders.length === 0 ? (
            <div className="rounded-lg border border-[var(--aura-border)] bg-[var(--aura-surface)] p-10 text-center text-sm text-[var(--aura-text-muted)]">
              No orders match this status filter.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-lg border border-[var(--aura-border)] bg-[var(--aura-surface)] p-5 flex flex-wrap items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-[var(--aura-text-muted)] tabular-nums">
                      <span className="font-semibold text-[var(--aura-text)]">
                        {order.orderNumber}
                      </span>
                      <span>·</span>
                      <span>{order.shippingAddress.fullName}</span>
                      <span>·</span>
                      <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-xs text-[var(--aura-text-muted)]">
                      {order.items.length} item(s) · {order.paymentMethod} ({order.paymentStatus}) ·{' '}
                      <strong className="text-[var(--aura-text)] tabular-nums">
                        {formatINR(order.total)}
                      </strong>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {order.status === 'Return Requested' && (
                      <button
                        type="button"
                        onClick={() => void handleApproveReturn(order.id)}
                        className="px-3 py-1.5 text-xs font-semibold rounded-md bg-[var(--aura-accent)] text-[var(--aura-accent-contrast)] cursor-pointer"
                      >
                        Approve Return &amp; Refund
                      </button>
                    )}

                    <select
                      aria-label={`Update status for ${order.orderNumber}`}
                      value={order.status}
                      onChange={(e) =>
                        void handleOrderStatusChange(order.id, e.target.value as OrderStatus)
                      }
                      className="px-3 py-1.5 text-xs rounded-md border border-[var(--aura-border)] bg-[var(--aura-bg)] text-[var(--aura-text)] cursor-pointer"
                    >
                      <option value="Confirmed">Confirmed</option>
                      <option value="Processing">Processing</option>
                      <option value="Shipped">Shipped</option>
                      <option value="Delivered">Delivered</option>
                      <option value="Return Requested">Return Requested</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: CUSTOMERS */}
      {tab === 'customers' && overview && (
        <div className="overflow-x-auto rounded-lg border border-[var(--aura-border)] bg-[var(--aura-surface)]">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[var(--aura-border)] bg-[var(--aura-surface-muted)] text-[var(--aura-text-muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Orders</th>
                <th className="px-4 py-3 font-medium">Total Spent</th>
                <th className="px-4 py-3 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--aura-border)]">
              {overview.customers.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-[var(--aura-text)]">{c.name}</p>
                    <p className="text-[var(--aura-text-muted)]">{c.email}</p>
                  </td>
                  <td className="px-4 py-3 text-[var(--aura-text-muted)] capitalize">
                    {c.role || 'customer'}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-[var(--aura-text)]">{c.orderCount}</td>
                  <td className="px-4 py-3 tabular-nums font-medium text-[var(--aura-text)]">
                    {formatINR(c.totalSpent)}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-[var(--aura-text-muted)]">
                    {new Date(c.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 5: TRANSACTIONS */}
      {tab === 'transactions' && overview && (
        <div className="space-y-6">
          <div className="overflow-x-auto rounded-lg border border-[var(--aura-border)] bg-[var(--aura-surface)]">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--aura-border)] bg-[var(--aura-surface-muted)] text-[var(--aura-text-muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Transaction Ref</th>
                  <th className="px-4 py-3 font-medium">Method</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Webhook</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--aura-border)]">
                {overview.payments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-[var(--aura-text-muted)]">
                      No payment transactions recorded yet.
                    </td>
                  </tr>
                ) : (
                  overview.payments.map((pay) => (
                    <tr key={pay.id}>
                      <td className="px-4 py-3 font-mono text-[var(--aura-text)]">
                        {pay.transactionRef}
                      </td>
                      <td className="px-4 py-3 text-[var(--aura-text-muted)]">{pay.method}</td>
                      <td className="px-4 py-3 tabular-nums font-medium text-[var(--aura-text)]">
                        {formatINR(pay.amount)}
                      </td>
                      <td className="px-4 py-3 text-[var(--aura-text)]">{pay.status}</td>
                      <td className="px-4 py-3 text-[var(--aura-text-muted)]">
                        {pay.webhookVerified ? 'HMAC Verified' : 'Unverified'}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-[var(--aura-text-muted)]">
                        {new Date(pay.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border border-[var(--aura-border)] bg-[var(--aura-surface)] p-5 space-y-3">
            <h3 className="text-sm font-semibold text-[var(--aura-text)]">
              Payment Audit Log ({overview.paymentAuditLogs.length})
            </h3>
            {overview.paymentAuditLogs.length === 0 ? (
              <p className="text-xs text-[var(--aura-text-muted)]">No audit events recorded yet.</p>
            ) : (
              <div className="divide-y divide-[var(--aura-border)] text-xs">
                {overview.paymentAuditLogs.slice(0, 15).map((log) => (
                  <div key={log.id} className="py-2 flex items-center justify-between gap-4">
                    <span className="font-mono text-[var(--aura-text)]">{log.event}</span>
                    <span className="text-[var(--aura-text-muted)] flex-1">{log.details}</span>
                    <span className="tabular-nums text-[var(--aura-text-muted)]">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
