import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Download, FileText, RotateCcw, Search, Truck } from 'lucide-react';
import { useStore } from '../context/StoreContext.tsx';
import { formatINR } from '../utils/currency.ts';
import { handleProductImageError, resolveProductImageSrc } from '../utils/imageFallback.ts';
import { downloadOrderInvoicePdf } from '../utils/pdfInvoice.ts';
import type { OrderRecord, PaymentAuditLog, PaymentRecord } from '../types/ecommerce.ts';

export function OrderHistoryView() {
  const { user, apiFetch, navigate, refreshAll, showToast, switchDemoAccount } = useStore();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('All');
  const [paymentMethod, setPaymentMethod] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sort, setSort] = useState('newest');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const loadOrders = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const params = new URLSearchParams({
      status,
      paymentMethod,
      dateFrom,
      dateTo,
      sort,
      search,
      page: String(page),
      limit: '5',
    });
    const res = await apiFetch<{
      orders: OrderRecord[];
      pagination: { page: number; totalPages: number; totalItems: number };
    }>(`/api/orders?${params.toString()}`);

    if (res.ok && res.data) {
      setOrders(res.data.orders);
      setTotalPages(res.data.pagination.totalPages);
      setTotalItems(res.data.pagination.totalItems);
    }
    setLoading(false);
  }, [apiFetch, dateFrom, dateTo, page, paymentMethod, search, sort, status, user]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const handleQuickReorder = async (orderId: string) => {
    const res = await apiFetch<{ addedCount: number; skipped: string[] }>(
      `/api/orders/${orderId}/reorder`,
      { method: 'POST' }
    );
    if (res.ok && res.data) {
      await refreshAll();
      showToast(`Added ${res.data.addedCount} item(s) to your bag`, 'success');
      navigate({ view: 'cart' });
    }
  };

  if (!user) {
    return (
      <div className="mx-auto max-w-[540px] px-6 py-20 text-center space-y-4">
        <h1 className="font-display text-3xl font-semibold text-[var(--aura-text)]">
          Sign in to view your orders
        </h1>
        <p className="text-sm text-[var(--aura-text-muted)]">
          Track deliveries, download PDF invoices, reorder past pieces, or manage returns.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => navigate({ view: 'auth', mode: 'login' })}
            className="px-6 py-2.5 text-sm font-semibold rounded-md bg-[var(--aura-accent)] text-[var(--aura-accent-contrast)] cursor-pointer"
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => void switchDemoAccount('aarav@auracommerce.in')}
            className="px-5 py-2.5 text-sm font-medium rounded-md border border-[var(--aura-border)] text-[var(--aura-text)] hover:bg-[var(--aura-surface-muted)] cursor-pointer"
          >
            Open Demo Account (Aarav)
          </button>
        </div>
      </div>
    );
  }

  const statuses = ['All', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Return Requested'];

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-12 space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--aura-border)] pb-6">
        <div>
          <p className="text-xs text-[var(--aura-text-muted)]">
            Server-side paginated &amp; filtered transaction archive
          </p>
          <h1 className="mt-1 font-display text-4xl font-semibold text-[var(--aura-text)]">
            Order History
          </h1>
        </div>
        <span className="text-xs text-[var(--aura-text-muted)] tabular-nums">
          {totalItems} total {totalItems === 1 ? 'order' : 'orders'}
        </span>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-[var(--aura-surface-muted)] overflow-x-auto">
          {statuses.map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => {
                setStatus(st);
                setPage(1);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 cursor-pointer ${
                status === st
                  ? 'bg-[var(--aura-surface)] text-[var(--aura-text)] shadow-xs'
                  : 'text-[var(--aura-text-muted)]'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-[var(--aura-text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Order # or item name"
              className="pl-9 pr-3 py-2 text-xs rounded-md border border-[var(--aura-border)] bg-[var(--aura-surface)] text-[var(--aura-text)]"
            />
          </div>

          <select
            aria-label="Filter by payment method"
            value={paymentMethod}
            onChange={(e) => {
              setPaymentMethod(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs rounded-md border border-[var(--aura-border)] bg-[var(--aura-surface)] text-[var(--aura-text)] cursor-pointer"
          >
            <option value="All">All Payments</option>
            <option value="Card">Card</option>
            <option value="UPI">UPI</option>
            <option value="COD">COD</option>
          </select>

          <input
            type="date"
            aria-label="Orders from date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-2 text-xs rounded-md border border-[var(--aura-border)] bg-[var(--aura-surface)] text-[var(--aura-text)]"
          />

          <input
            type="date"
            aria-label="Orders to date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-2 text-xs rounded-md border border-[var(--aura-border)] bg-[var(--aura-surface)] text-[var(--aura-text)]"
          />

          <select
            aria-label="Sort orders"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs rounded-md border border-[var(--aura-border)] bg-[var(--aura-surface)] text-[var(--aura-text)] cursor-pointer"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="total_desc">Highest Total</option>
            <option value="total_asc">Lowest Total</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-28 rounded-lg bg-[var(--aura-surface-muted)] animate-pulse" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-lg border border-[var(--aura-border)] bg-[var(--aura-surface)] p-12 text-center">
          <p className="font-display text-2xl text-[var(--aura-text)]">No orders found</p>
          <p className="mt-2 text-sm text-[var(--aura-text-muted)]">
            Complete a checkout or adjust your status filter to view orders here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div
              key={order.id}
              className="rounded-lg border border-[var(--aura-border)] bg-[var(--aura-surface)] p-6 flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--aura-text-muted)]">
                  <span className="font-mono-tabular font-semibold text-[var(--aura-text)]">
                    {order.orderNumber}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-tabular">{order.invoiceNumber}</span>
                  <span aria-hidden="true">·</span>
                  <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-medium text-[var(--aura-accent)]">{order.status}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {order.paymentMethod} ({order.paymentStatus})
                  </span>
                </div>
                <p className="text-sm font-medium text-[var(--aura-text)]">
                  {order.items.map((i) => `${i.name} × ${i.quantity}`).join(', ')}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <span className="text-base font-semibold tabular-nums text-[var(--aura-text)] mr-1">
                  {formatINR(order.total)}
                </span>
                <button
                  type="button"
                  onClick={() => downloadOrderInvoicePdf(order)}
                  className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium rounded-md border border-[var(--aura-border)] text-[var(--aura-text)] hover:bg-[var(--aura-surface-muted)] cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleQuickReorder(order.id)}
                  className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium rounded-md border border-[var(--aura-border)] text-[var(--aura-text)] hover:bg-[var(--aura-surface-muted)] cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reorder</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate({ view: 'order-detail', orderId: order.id })}
                  className="px-4 py-2 text-xs font-semibold rounded-md bg-[var(--aura-accent)] text-[var(--aura-accent-contrast)] hover:bg-[var(--aura-accent-hover)] cursor-pointer"
                >
                  Inspect Order
                </button>
              </div>
            </div>
          ))}

          {/* Pagination */}
          <div className="flex items-center justify-between pt-4 text-xs text-[var(--aura-text-muted)]">
            <span className="tabular-nums">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-md border border-[var(--aura-border)] disabled:opacity-40 cursor-pointer"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-md border border-[var(--aura-border)] disabled:opacity-40 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function OrderDetailView({ orderId }: { orderId: string }) {
  const { apiFetch, navigate, refreshAll, showToast } = useStore();
  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [payment, setPayment] = useState<PaymentRecord | null>(null);
  const [auditLogs, setAuditLogs] = useState<PaymentAuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch<{
      order: OrderRecord;
      payment: PaymentRecord | null;
      auditLogs: PaymentAuditLog[];
    }>(`/api/orders/${orderId}`);
    if (res.ok && res.data) {
      setOrder(res.data.order);
      setPayment(res.data.payment);
      setAuditLogs(res.data.auditLogs);
    }
    setLoading(false);
  }, [apiFetch, orderId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const handleReorder = async () => {
    const res = await apiFetch<{ addedCount: number; skipped: string[] }>(
      `/api/orders/${orderId}/reorder`,
      { method: 'POST' }
    );
    if (res.ok && res.data) {
      await refreshAll();
      showToast(`Added ${res.data.addedCount} item(s) to your bag`, 'success');
      navigate({ view: 'cart' });
    }
  };

  const handleCancel = async () => {
    const res = await apiFetch<{ order: OrderRecord }>(`/api/orders/${orderId}/cancel`, {
      method: 'POST',
    });
    if (res.ok && res.data) {
      setOrder(res.data.order);
      await loadDetail();
      await refreshAll();
      showToast('Order cancelled and stock restored', 'info');
    } else {
      showToast(res.error || 'Could not cancel order', 'error');
    }
  };

  const handleReturn = async () => {
    const res = await apiFetch<{ order: OrderRecord }>(`/api/orders/${orderId}/return`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'Customer requested studio return' }),
    });
    if (res.ok && res.data) {
      setOrder(res.data.order);
      await loadDetail();
      showToast('Return request submitted', 'success');
    } else {
      showToast(res.error || 'Could not request return', 'error');
    }
  };

  const handleAdvanceStatus = async () => {
    const res = await apiFetch<{ order: OrderRecord }>(`/api/orders/${orderId}/advance-status`, {
      method: 'POST',
    });
    if (res.ok && res.data) {
      setOrder(res.data.order);
      await loadDetail();
      await refreshAll();
      showToast(`Order progressed to ${res.data.order.status}`, 'success');
    }
  };

  const handleVerifyWebhook = async () => {
    const res = await apiFetch<{ deduplicated: boolean; payment: PaymentRecord }>(
      `/api/orders/${orderId}/verify-webhook`,
      { method: 'POST', body: JSON.stringify({ event: 'gateway_settled' }) }
    );
    if (res.ok && res.data) {
      await loadDetail();
      showToast(
        res.data.deduplicated
          ? 'Duplicate webhook safely deduplicated (idempotent)'
          : 'HMAC-SHA256 payment webhook verified and logged',
        'success'
      );
    } else {
      showToast(res.error || 'Webhook verification failed', 'error');
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-[1100px] px-6 py-16">
        <div className="h-64 rounded-lg bg-[var(--aura-surface-muted)] animate-pulse" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-[1100px] px-6 py-20 text-center">
        <p className="font-display text-3xl text-[var(--aura-text)]">Order not found</p>
        <button
          type="button"
          onClick={() => navigate({ view: 'orders' })}
          className="mt-5 px-5 py-2.5 text-xs font-semibold rounded-md bg-[var(--aura-accent)] text-[var(--aura-accent-contrast)] cursor-pointer"
        >
          Back to Order History
        </button>
      </div>
    );
  }

  const canCancel = order.status === 'Confirmed' || order.status === 'Processing';
  const canReturn = order.status === 'Delivered';
  const canAdvance = order.status === 'Processing' || order.status === 'Shipped';

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-12 space-y-8">
      <button
        type="button"
        onClick={() => navigate({ view: 'orders' })}
        className="inline-flex items-center gap-2 text-sm text-[var(--aura-text-muted)] hover:text-[var(--aura-text)] cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>All Orders</span>
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--aura-border)] pb-6">
        <div>
          <p className="font-mono-tabular text-xs text-[var(--aura-text-muted)]">
            {order.orderNumber} · {order.invoiceNumber}
          </p>
          <h1 className="mt-1 font-display text-4xl font-semibold text-[var(--aura-text)]">
            {order.status}
          </h1>
          <p className="mt-1 text-xs text-[var(--aura-text-muted)]">
            Placed {new Date(order.createdAt).toLocaleString()} · Tracking {order.trackingNumber}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => downloadOrderInvoicePdf(order)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md border border-[var(--aura-border)] text-[var(--aura-text)] hover:bg-[var(--aura-surface-muted)] cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download PDF</span>
          </button>

          <button
            type="button"
            onClick={() => navigate({ view: 'invoice', orderId: order.id })}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md border border-[var(--aura-border)] text-[var(--aura-text)] hover:bg-[var(--aura-surface-muted)] cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>View Invoice</span>
          </button>

          <button
            type="button"
            onClick={() => void handleReorder()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md bg-[var(--aura-accent)] text-[var(--aura-accent-contrast)] hover:bg-[var(--aura-accent-hover)] cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reorder</span>
          </button>

          {canAdvance && (
            <button
              type="button"
              onClick={() => void handleAdvanceStatus()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-md border border-[var(--aura-border)] text-[var(--aura-text)] hover:bg-[var(--aura-surface-muted)] cursor-pointer"
            >
              <Truck className="w-3.5 h-3.5" />
              <span>{order.status === 'Processing' ? 'Mark Shipped' : 'Mark Delivered'}</span>
            </button>
          )}

          {canCancel && (
            <button
              type="button"
              onClick={() => void handleCancel()}
              className="px-4 py-2 text-xs font-medium rounded-md border border-red-300 dark:border-red-900 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
            >
              Cancel Order
            </button>
          )}

          {canReturn && (
            <button
              type="button"
              onClick={() => void handleReturn()}
              className="px-4 py-2 text-xs font-medium rounded-md border border-[var(--aura-border)] text-[var(--aura-text)] hover:bg-[var(--aura-surface-muted)] cursor-pointer"
            >
              Request Return
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-lg border border-[var(--aura-border)] bg-[var(--aura-surface)] p-6 space-y-4">
            <h2 className="font-display text-2xl font-semibold text-[var(--aura-text)]">Items</h2>
            <div className="divide-y divide-[var(--aura-border)]">
              {order.items.map((item, idx) => (
                <div key={`${item.productId}-${idx}`} className="py-4 flex items-center gap-4">
                  <img
                    src={resolveProductImageSrc(item.image)}
                    alt={item.name}
                    referrerPolicy="no-referrer"
                    onError={handleProductImageError}
                    className="w-16 h-14 rounded-md object-cover bg-[var(--aura-surface-muted)]"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--aura-text)] truncate">
                      {item.name}
                    </p>
                    <p className="text-xs text-[var(--aura-text-muted)]">
                      {[item.variant.size, item.variant.color, item.variant.finish]
                        .filter(Boolean)
                        .join(' · ')}{' '}
                      · Qty {item.quantity}
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-[var(--aura-text)]">
                    {formatINR(item.lineTotal)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Payment Audit Logs */}
          <div className="rounded-lg border border-[var(--aura-border)] bg-[var(--aura-surface)] p-6 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-2xl font-semibold text-[var(--aura-text)]">
                Payment &amp; Audit Log
              </h2>
              <button
                type="button"
                onClick={() => void handleVerifyWebhook()}
                className="px-3 py-1.5 text-xs font-medium rounded-md border border-[var(--aura-border)] text-[var(--aura-text)] hover:bg-[var(--aura-surface-muted)] cursor-pointer"
              >
                Verify Webhook (HMAC)
              </button>
            </div>
            {payment && (
              <p className="text-xs text-[var(--aura-text-muted)] font-mono-tabular">
                Ref: {payment.transactionRef} · Method: {payment.method} · Status: {payment.status} ·{' '}
                {payment.webhookVerified ? 'Webhook HMAC Verified' : 'Awaiting Webhook'}
              </p>
            )}
            <div className="space-y-2 pt-2">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="text-xs border-t border-[var(--aura-border)] pt-2 flex flex-col sm:flex-row sm:justify-between gap-1"
                >
                  <span className="font-mono-tabular font-medium text-[var(--aura-text)]">
                    {log.event}
                  </span>
                  <span className="text-[var(--aura-text-muted)]">{log.details}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-lg border border-[var(--aura-border)] bg-[var(--aura-surface)] p-6 space-y-4">
            <h2 className="font-display text-2xl font-semibold text-[var(--aura-text)]">
              Delivery &amp; Totals
            </h2>
            <div className="text-xs space-y-1 text-[var(--aura-text-muted)]">
              <p className="text-sm font-medium text-[var(--aura-text)]">
                {order.shippingAddress.fullName}
              </p>
              <p>{order.shippingAddress.line1}</p>
              <p>
                {order.shippingAddress.city}, {order.shippingAddress.state}{' '}
                {order.shippingAddress.postalCode}
              </p>
              <p>{order.shippingAddress.country}</p>
              <p>{order.shippingAddress.phone}</p>
            </div>
            <div className="border-t border-[var(--aura-border)] pt-4 space-y-2 text-sm tabular-nums">
              <div className="flex justify-between">
                <span className="text-[var(--aura-text-muted)]">Subtotal</span>
                <span>{formatINR(order.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--aura-text-muted)]">Tax</span>
                <span>{formatINR(order.tax)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--aura-text-muted)]">Shipping</span>
                <span>
                  {order.shippingFee === 0 ? 'Complimentary' : formatINR(order.shippingFee)}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-[var(--aura-border)] font-semibold">
                <span>Total</span>
                <span>{formatINR(order.total)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-[var(--aura-border)] bg-[var(--aura-surface)] p-6 space-y-3">
            <h2 className="font-display text-2xl font-semibold text-[var(--aura-text)]">
              Fulfillment Timeline
            </h2>
            <div className="space-y-3">
              {order.timeline.map((step, idx) => (
                <div key={idx} className="border-t border-[var(--aura-border)] pt-2.5 first:border-t-0 first:pt-0">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[var(--aura-text)]">{step.status}</span>
                    <span className="font-mono-tabular text-[var(--aura-text-muted)]">
                      {new Date(step.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--aura-text-muted)]">{step.note}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function InvoiceView({ orderId }: { orderId: string }) {
  const { apiFetch, navigate } = useStore();
  const [order, setOrder] = useState<OrderRecord | null>(null);

  useEffect(() => {
    void apiFetch<{ order: OrderRecord }>(`/api/orders/${orderId}`).then((res) => {
      if (res.ok && res.data) setOrder(res.data.order);
    });
  }, [apiFetch, orderId]);

  if (!order) {
    return (
      <div className="mx-auto max-w-[820px] px-6 py-16 text-center text-sm text-[var(--aura-text-muted)]">
        Loading invoice...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[820px] px-6 py-12 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => navigate({ view: 'order-detail', orderId: order.id })}
          className="inline-flex items-center gap-2 text-sm text-[var(--aura-text-muted)] hover:text-[var(--aura-text)] cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Order</span>
        </button>

        <button
          type="button"
          onClick={() => downloadOrderInvoicePdf(order)}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-md bg-[var(--aura-accent)] text-[var(--aura-accent-contrast)] hover:bg-[var(--aura-accent-hover)] cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>Download PDF Invoice</span>
        </button>
      </div>

      <div className="rounded-lg border border-[var(--aura-border)] bg-[var(--aura-surface)] p-8 sm:p-10 space-y-8">
        <div className="flex flex-wrap justify-between gap-6 border-b border-[var(--aura-border)] pb-6">
          <div>
            <p className="font-display text-3xl font-semibold text-[var(--aura-text)]">Aura Commerce</p>
            <p className="text-xs text-[var(--aura-text-muted)] mt-1">
              Commercial Tax Invoice · Architectural Objects &amp; Living
            </p>
          </div>
          <div className="text-right font-mono-tabular text-xs space-y-1">
            <p className="text-sm font-semibold text-[var(--aura-text)]">{order.invoiceNumber}</p>
            <p className="text-[var(--aura-text-muted)]">Order: {order.orderNumber}</p>
            <p className="text-[var(--aura-text-muted)]">
              Issued: {new Date(order.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
          <div className="space-y-1">
            <p className="font-semibold text-[var(--aura-text)]">Billed &amp; Shipped To</p>
            <p className="text-[var(--aura-text-muted)]">{order.shippingAddress.fullName}</p>
            <p className="text-[var(--aura-text-muted)]">{order.shippingAddress.line1}</p>
            <p className="text-[var(--aura-text-muted)]">
              {order.shippingAddress.city}, {order.shippingAddress.state}{' '}
              {order.shippingAddress.postalCode}
            </p>
            <p className="text-[var(--aura-text-muted)]">{order.shippingAddress.country}</p>
          </div>
          <div className="space-y-1 sm:text-right">
            <p className="font-semibold text-[var(--aura-text)]">Settlement Details</p>
            <p className="text-[var(--aura-text-muted)]">Method: {order.paymentMethod}</p>
            <p className="text-[var(--aura-text-muted)]">Payment Status: {order.paymentStatus}</p>
            <p className="text-[var(--aura-text-muted)]">Tracking: {order.trackingNumber}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--aura-border)] text-[var(--aura-text-muted)]">
                <th className="py-2.5 font-medium">Object</th>
                <th className="py-2.5 font-medium">Variant</th>
                <th className="py-2.5 font-medium text-right">Qty</th>
                <th className="py-2.5 font-medium text-right">Unit</th>
                <th className="py-2.5 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--aura-border)] tabular-nums">
              {order.items.map((item, i) => (
                <tr key={i}>
                  <td className="py-3 font-medium text-[var(--aura-text)]">{item.name}</td>
                  <td className="py-3 text-[var(--aura-text-muted)]">
                    {[item.variant.size, item.variant.color, item.variant.finish]
                      .filter(Boolean)
                      .join(' / ')}
                  </td>
                  <td className="py-3 text-right">{item.quantity}</td>
                  <td className="py-3 text-right">{formatINR(item.unitPrice)}</td>
                  <td className="py-3 text-right font-medium text-[var(--aura-text)]">
                    {formatINR(item.lineTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end border-t border-[var(--aura-border)] pt-6">
          <div className="w-64 space-y-2 text-xs tabular-nums">
            <div className="flex justify-between">
              <span className="text-[var(--aura-text-muted)]">Subtotal</span>
              <span>{formatINR(order.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--aura-text-muted)]">Tax (8%)</span>
              <span>{formatINR(order.tax)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--aura-text-muted)]">Shipping</span>
              <span>{order.shippingFee === 0 ? 'Complimentary' : formatINR(order.shippingFee)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-[var(--aura-border)] text-sm font-semibold text-[var(--aura-text)]">
              <span>Total</span>
              <span>{formatINR(order.total)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
