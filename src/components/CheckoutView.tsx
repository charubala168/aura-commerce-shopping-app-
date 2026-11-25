import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { useStore } from '../context/StoreContext.tsx';
import { formatINR } from '../utils/currency.ts';
import type { OrderRecord } from '../types/ecommerce.ts';

interface CartValidationState {
  valid: boolean;
  issues: string[];
  priceChanges: Array<{
    itemId: string;
    productName: string;
    previousPrice: number;
    currentPrice: number;
    delta: number;
  }>;
}

export function CheckoutView() {
  const {
    user,
    cartItems,
    cartSubtotal,
    hasStockIssues,
    apiFetch,
    refreshAll,
    navigate,
    showToast,
  } = useStore();

  const [fullName, setFullName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [line1, setLine1] = useState(user?.defaultAddress?.line1 || '');
  const [city, setCity] = useState(user?.defaultAddress?.city || '');
  const [stateCode, setStateCode] = useState(user?.defaultAddress?.state || '');
  const [postalCode, setPostalCode] = useState(user?.defaultAddress?.postalCode || '');
  const [country, setCountry] = useState(user?.defaultAddress?.country || 'India');
  const [paymentMethod, setPaymentMethod] = useState<'Card' | 'UPI' | 'COD'>('Card');
  const [submitting, setSubmitting] = useState(false);
  const [validation, setValidation] = useState<CartValidationState | null>(null);

  // Automatic pre-checkout stock & price validation
  useEffect(() => {
    if (!user) return;
    let active = true;
    void apiFetch<CartValidationState>('/api/cart/validate').then((res) => {
      if (!active) return;
      if (res.ok && res.data) {
        setValidation(res.data);
        if (res.data.priceChanges.length > 0 || res.data.issues.length > 0) {
          void refreshAll();
        }
      }
    });
    return () => {
      active = false;
    };
  }, [apiFetch, refreshAll, user]);

  // Idempotency key generated once per checkout attempt to prevent duplicate payment processing
  const idempotencyKey = useMemo(
    () => `idem_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    []
  );

  if (!user) {
    return (
      <div className="mx-auto max-w-[540px] px-6 py-20 text-center space-y-4">
        <h1 className="font-display text-3xl text-[var(--aura-text)]">Sign in to complete checkout</h1>
        <button
          type="button"
          onClick={() => navigate({ view: 'auth', mode: 'login' })}
          className="px-6 py-2.5 text-sm font-semibold rounded-md bg-[var(--aura-accent)] text-[var(--aura-accent-contrast)] cursor-pointer"
        >
          Sign In
        </button>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="mx-auto max-w-[540px] px-6 py-20 text-center space-y-4">
        <h1 className="font-display text-3xl text-[var(--aura-text)]">Your shopping bag is empty</h1>
        <button
          type="button"
          onClick={() => navigate({ view: 'catalog' })}
          className="px-6 py-2.5 text-sm font-semibold rounded-md bg-[var(--aura-accent)] text-[var(--aura-accent-contrast)] cursor-pointer"
        >
          Return to Catalog
        </button>
      </div>
    );
  }

  const shippingFee = cartSubtotal >= 999 ? 0 : 79;
  const tax = Number((cartSubtotal * 0.08).toFixed(2));
  const total = Number((cartSubtotal + shippingFee + tax).toFixed(2));

  const handleCheckout = async (e: FormEvent) => {
    e.preventDefault();
    if (hasStockIssues) {
      showToast('Resolve stock issues in your bag before checkout', 'error');
      return;
    }
    setSubmitting(true);
    const res = await apiFetch<{ order: OrderRecord; deduplicated: boolean }>('/api/orders/checkout', {
      method: 'POST',
      headers: {
        'x-idempotency-key': idempotencyKey,
      },
      body: JSON.stringify({
        idempotencyKey,
        paymentMethod,
        shippingAddress: {
          fullName,
          phone,
          line1,
          city,
          state: stateCode,
          postalCode,
          country,
        },
      }),
    });
    setSubmitting(false);

    if (!res.ok || !res.data) {
      showToast(res.error || 'Checkout failed', 'error');
      return;
    }

    await refreshAll();
    showToast(`Order ${res.data.order.orderNumber} confirmed`, 'success');
    navigate({ view: 'order-detail', orderId: res.data.order.id });
  };

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-12 space-y-8">
      <div className="border-b border-[var(--aura-border)] pb-6">
        <p className="text-xs text-[var(--aura-text-muted)]">Atomic Stock Verification &amp; Idempotent Payment</p>
        <h1 className="mt-1 font-display text-4xl font-semibold text-[var(--aura-text)]">
          Checkout
        </h1>
      </div>

      {validation && (validation.issues.length > 0 || validation.priceChanges.length > 0) && (
        <div className="rounded-lg border border-[var(--aura-border)] bg-[var(--aura-surface)] p-5 space-y-2.5">
          {validation.issues.length > 0 && (
            <div className="space-y-1">
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Stock &amp; Availability Notice</span>
              </p>
              <ul className="list-disc pl-5 text-xs text-[var(--aura-text)] space-y-0.5">
                {validation.issues.map((issue, idx) => (
                  <li key={idx}>{issue}</li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => navigate({ view: 'cart' })}
                className="mt-1 text-xs font-semibold text-[var(--aura-accent)] hover:underline cursor-pointer"
              >
                Adjust items in shopping bag
              </button>
            </div>
          )}
          {validation.priceChanges.length > 0 && (
            <div className="space-y-1">
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--aura-accent)]">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Price Change Detected (Totals Updated)</span>
              </p>
              <ul className="list-disc pl-5 text-xs text-[var(--aura-text-muted)] space-y-0.5">
                {validation.priceChanges.map((pc) => (
                  <li key={pc.itemId}>
                    {pc.productName}: {formatINR(pc.previousPrice)} → {formatINR(pc.currentPrice)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleCheckout} className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        <div className="lg:col-span-7 space-y-6 rounded-lg border border-[var(--aura-border)] bg-[var(--aura-surface)] p-6 sm:p-8">
          <h2 className="font-display text-2xl font-semibold text-[var(--aura-text)]">
            Delivery Details
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--aura-text)] mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-md border border-[var(--aura-border)] bg-[var(--aura-bg)] text-[var(--aura-text)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--aura-text)] mb-1.5">
                Phone Number
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 415 555 0192"
                className="w-full px-3 py-2 text-sm rounded-md border border-[var(--aura-border)] bg-[var(--aura-bg)] text-[var(--aura-text)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--aura-text)] mb-1.5">
              Street Address
            </label>
            <input
              type="text"
              required
              value={line1}
              onChange={(e) => setLine1(e.target.value)}
              placeholder="742 Evergreen Terrace, Apt 4B"
              className="w-full px-3 py-2 text-sm rounded-md border border-[var(--aura-border)] bg-[var(--aura-bg)] text-[var(--aura-text)]"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium text-[var(--aura-text)] mb-1.5">
                City
              </label>
              <input
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-md border border-[var(--aura-border)] bg-[var(--aura-bg)] text-[var(--aura-text)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--aura-text)] mb-1.5">
                State
              </label>
              <input
                type="text"
                value={stateCode}
                onChange={(e) => setStateCode(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-md border border-[var(--aura-border)] bg-[var(--aura-bg)] text-[var(--aura-text)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--aura-text)] mb-1.5">
                Postal Code
              </label>
              <input
                type="text"
                required
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-md border border-[var(--aura-border)] bg-[var(--aura-bg)] text-[var(--aura-text)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--aura-text)] mb-1.5">
                Country
              </label>
              <input
                type="text"
                required
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-md border border-[var(--aura-border)] bg-[var(--aura-bg)] text-[var(--aura-text)]"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-[var(--aura-border)] space-y-3">
            <h2 className="font-display text-2xl font-semibold text-[var(--aura-text)]">
              Payment Method
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(['Card', 'UPI', 'COD'] as const).map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={`p-3 rounded-md border text-left transition-colors cursor-pointer ${
                    paymentMethod === method
                      ? 'border-[var(--aura-accent)] bg-[var(--aura-surface-muted)]'
                      : 'border-[var(--aura-border)] bg-[var(--aura-bg)]'
                  }`}
                >
                  <p className="text-sm font-semibold text-[var(--aura-text)]">
                    {method === 'Card'
                      ? 'Credit / Debit Card'
                      : method === 'UPI'
                        ? 'Instant UPI'
                        : 'Cash on Delivery'}
                  </p>
                  <p className="text-xs text-[var(--aura-text-muted)] mt-0.5">
                    {method === 'COD' ? 'Pay upon courier arrival' : 'Instant verified settlement'}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 rounded-lg border border-[var(--aura-border)] bg-[var(--aura-surface)] p-6 space-y-5">
          <h2 className="font-display text-2xl font-semibold text-[var(--aura-text)]">
            Review Bag ({cartItems.length})
          </h2>

          <div className="divide-y divide-[var(--aura-border)] max-h-72 overflow-y-auto">
            {cartItems.map((item) => (
              <div key={item.id} className="py-3 flex justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-[var(--aura-text)] truncate">
                    {item.product?.name} × {item.quantity}
                  </p>
                  <p className="text-xs text-[var(--aura-text-muted)]">
                    {[item.variant.size, item.variant.color, item.variant.finish]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <span className="tabular-nums font-medium text-[var(--aura-text)] shrink-0">
                  {formatINR(item.lineTotal)}
                </span>
              </div>
            ))}
          </div>

          <div className="space-y-2 border-t border-[var(--aura-border)] pt-4 text-sm tabular-nums">
            <div className="flex justify-between">
              <span className="text-[var(--aura-text-muted)]">Subtotal</span>
              <span>{formatINR(cartSubtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--aura-text-muted)]">Shipping</span>
              <span>{shippingFee === 0 ? 'Complimentary' : formatINR(shippingFee)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--aura-text-muted)]">Tax (8%)</span>
              <span>{formatINR(tax)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-[var(--aura-border)] text-base font-semibold">
              <span>Total Due</span>
              <span>{formatINR(total)}</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || hasStockIssues}
            className="w-full py-3 px-4 text-sm font-semibold rounded-md bg-[var(--aura-accent)] text-[var(--aura-accent-contrast)] hover:bg-[var(--aura-accent-hover)] disabled:opacity-50 transition-colors cursor-pointer"
          >
            {submitting ? 'Confirming Order...' : `Place Order · ${formatINR(total)}`}
          </button>

          <p className="inline-flex items-center gap-1.5 text-xs text-[var(--aura-text-muted)]">
            <ShieldCheck className="w-4 h-4 shrink-0 text-[var(--aura-accent)]" />
            <span>Protected by duplicate-payment idempotency key and atomic stock reservation.</span>
          </p>
        </div>
      </form>
    </div>
  );
}
