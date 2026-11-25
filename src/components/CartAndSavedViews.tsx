import { useState } from 'react';
import { AlertTriangle, Bookmark, Heart, Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { useStore } from '../context/StoreContext.tsx';
import { formatINR } from '../utils/currency.ts';
import { handleProductImageError, resolveProductImageSrc } from '../utils/imageFallback.ts';
import type { EnrichedCartItem } from '../types/ecommerce.ts';

function CartItemRow({ item }: { item: EnrichedCartItem }) {
  const { updateCartItem, removeCartItem, saveForLater, navigate } = useStore();
  const product = item.product;
  const variantText = [item.variant.size, item.variant.color, item.variant.finish]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="flex gap-4 py-5 border-b border-[var(--aura-border)]">
      <button
        type="button"
        onClick={() => product && navigate({ view: 'product', productId: product.id })}
        className="w-24 h-20 rounded-md overflow-hidden bg-[var(--aura-surface-muted)] shrink-0 cursor-pointer"
      >
        {product ? (
          <img
            src={resolveProductImageSrc(product.image)}
            alt={product.name}
            referrerPolicy="no-referrer"
            onError={handleProductImageError}
            className="w-full h-full object-cover"
          />
        ) : null}
      </button>

      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={() => product && navigate({ view: 'product', productId: product.id })}
            className="text-sm font-semibold text-[var(--aura-text)] hover:text-[var(--aura-accent)] text-left truncate cursor-pointer"
          >
            {product ? product.name : 'Unavailable Object'}
          </button>
          <span className="text-sm font-semibold tabular-nums text-[var(--aura-text)] shrink-0">
            {formatINR(item.lineTotal)}
          </span>
        </div>

        {variantText && (
          <p className="text-xs text-[var(--aura-text-muted)]">{variantText}</p>
        )}

        {/* Smart Cart Alerts: Price Change & Stock Availability */}
        {item.priceChanged && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--aura-accent)]">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>
              Price updated from {formatINR(item.unitPriceAtAdd)} to {formatINR(item.currentPrice)}
            </span>
            <button
              type="button"
              onClick={() => void updateCartItem(item.id, { acceptPriceChange: true })}
              className="underline font-medium cursor-pointer"
            >
              Acknowledge
            </button>
          </div>
        )}

        {(item.isUnavailable || item.isOutOfStock) && (
          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{item.isUnavailable ? 'Object no longer available' : 'Out of stock'}</span>
          </p>
        )}

        {!item.isUnavailable && !item.isOutOfStock && item.quantity > item.availableStock && (
          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Only {item.availableStock} left in stock</span>
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="inline-flex items-center rounded-md border border-[var(--aura-border)] bg-[var(--aura-bg)]">
            <button
              type="button"
              aria-label="Decrease quantity"
              onClick={() => void updateCartItem(item.id, { quantity: item.quantity - 1 })}
              className="p-1.5 text-[var(--aura-text)] cursor-pointer"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="px-2.5 text-xs font-medium tabular-nums text-[var(--aura-text)]">
              {item.quantity}
            </span>
            <button
              type="button"
              aria-label="Increase quantity"
              disabled={item.quantity >= item.availableStock}
              onClick={() => void updateCartItem(item.id, { quantity: item.quantity + 1 })}
              className="p-1.5 text-[var(--aura-text)] disabled:opacity-40 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          <div className="flex items-center gap-4 text-xs text-[var(--aura-text-muted)]">
            <button
              type="button"
              onClick={() => void saveForLater(item.id)}
              className="inline-flex items-center gap-1 hover:text-[var(--aura-text)] cursor-pointer"
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>Save for Later</span>
            </button>
            <button
              type="button"
              onClick={() => void removeCartItem(item.id)}
              className="inline-flex items-center gap-1 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Remove</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CartDrawer() {
  const {
    cartDrawerOpen,
    setCartDrawerOpen,
    cartItems,
    cartSubtotal,
    hasPriceChanges,
    hasStockIssues,
    navigate,
    user,
  } = useStore();

  if (!cartDrawerOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        onClick={() => setCartDrawerOpen(false)}
        className="fixed inset-0 bg-black/45 backdrop-blur-[1px]"
      />
      <aside className="relative z-10 flex h-full w-full max-w-md flex-col bg-[var(--aura-surface)] border-l border-[var(--aura-border)]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--aura-border)]">
          <h2 className="font-display text-2xl font-semibold text-[var(--aura-text)]">
            Shopping Bag
          </h2>
          <button
            type="button"
            aria-label="Close shopping bag"
            onClick={() => setCartDrawerOpen(false)}
            className="p-2 rounded-md text-[var(--aura-text-muted)] hover:text-[var(--aura-text)] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6">
          {cartItems.length === 0 ? (
            <div className="py-20 text-center">
              <ShoppingBag className="w-8 h-8 mx-auto text-[var(--aura-text-muted)]" />
              <p className="mt-4 font-display text-2xl text-[var(--aura-text)]">Your bag is empty</p>
              <p className="mt-2 text-xs text-[var(--aura-text-muted)]">
                Explore curated objects to start your collection.
              </p>
            </div>
          ) : (
            <div>
              {cartItems.map((item) => (
                <CartItemRow key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>

        {cartItems.length > 0 && (
          <div className="border-t border-[var(--aura-border)] bg-[var(--aura-bg)] p-6 space-y-4">
            {(hasPriceChanges || hasStockIssues) && (
              <p className="text-xs text-[var(--aura-accent)]">
                Review price or stock notices above before completing checkout.
              </p>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--aura-text-muted)]">Subtotal</span>
              <span className="text-lg font-semibold tabular-nums text-[var(--aura-text)]">
                {formatINR(cartSubtotal)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setCartDrawerOpen(false);
                  navigate({ view: 'cart' });
                }}
                className="py-2.5 px-4 text-xs font-semibold rounded-md border border-[var(--aura-border)] bg-[var(--aura-surface)] text-[var(--aura-text)] hover:bg-[var(--aura-surface-muted)] cursor-pointer"
              >
                View Full Bag
              </button>
              <button
                type="button"
                disabled={hasStockIssues}
                onClick={() => {
                  setCartDrawerOpen(false);
                  navigate(user ? { view: 'checkout' } : { view: 'auth', mode: 'login' });
                }}
                className="py-2.5 px-4 text-xs font-semibold rounded-md bg-[var(--aura-accent)] text-[var(--aura-accent-contrast)] hover:bg-[var(--aura-accent-hover)] disabled:opacity-50 cursor-pointer"
              >
                {user ? 'Checkout' : 'Sign In to Checkout'}
              </button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

export function CartView() {
  const {
    cartItems,
    cartSubtotal,
    hasPriceChanges,
    hasStockIssues,
    savedItems,
    navigate,
    user,
  } = useStore();

  const estimatedShipping = cartSubtotal >= 999 || cartSubtotal === 0 ? 0 : 79;
  const estimatedTax = Number((cartSubtotal * 0.08).toFixed(2));
  const total = Number((cartSubtotal + estimatedShipping + estimatedTax).toFixed(2));

  return (
    <div className="mx-auto max-w-[1280px] px-6 py-12 space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--aura-border)] pb-6">
        <div>
          <p className="text-xs text-[var(--aura-text-muted)]">
            Real-time stock validation · Variant preservation · Cross-device sync
          </p>
          <h1 className="mt-1 font-display text-4xl font-semibold text-[var(--aura-text)]">
            Smart Shopping Bag
          </h1>
        </div>
        {savedItems.length > 0 && (
          <button
            type="button"
            onClick={() => navigate({ view: 'saved', tab: 'later' })}
            className="text-sm font-medium text-[var(--aura-accent)] hover:underline cursor-pointer"
          >
            View Save for Later ({savedItems.length})
          </button>
        )}
      </div>

      {cartItems.length === 0 ? (
        <div className="rounded-lg border border-[var(--aura-border)] bg-[var(--aura-surface)] p-12 text-center">
          <p className="font-display text-2xl text-[var(--aura-text)]">Your shopping bag is empty</p>
          <p className="mt-2 text-sm text-[var(--aura-text-muted)]">
            Browse the catalog or move items back from your Save for Later list.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => navigate({ view: 'catalog' })}
              className="px-5 py-2.5 text-xs font-semibold rounded-md bg-[var(--aura-accent)] text-[var(--aura-accent-contrast)] cursor-pointer"
            >
              Browse Catalog
            </button>
            <button
              type="button"
              onClick={() => navigate({ view: 'saved', tab: 'later' })}
              className="px-5 py-2.5 text-xs font-medium rounded-md border border-[var(--aura-border)] text-[var(--aura-text)] cursor-pointer"
            >
              Save for Later
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-8 rounded-lg border border-[var(--aura-border)] bg-[var(--aura-surface)] px-6">
            {cartItems.map((item) => (
              <CartItemRow key={item.id} item={item} />
            ))}
          </div>

          <div className="lg:col-span-4 rounded-lg border border-[var(--aura-border)] bg-[var(--aura-surface)] p-6 space-y-5">
            <h2 className="font-display text-2xl font-semibold text-[var(--aura-text)]">
              Order Summary
            </h2>

            {hasPriceChanges && (
              <p className="text-xs text-[var(--aura-accent)] leading-relaxed">
                One or more item prices changed since you added them. Current prices are reflected below.
              </p>
            )}

            <div className="space-y-2.5 text-sm border-b border-[var(--aura-border)] pb-4 tabular-nums">
              <div className="flex justify-between">
                <span className="text-[var(--aura-text-muted)]">Subtotal</span>
                <span className="text-[var(--aura-text)]">{formatINR(cartSubtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--aura-text-muted)]">Shipping (Free ₹999+)</span>
                <span className="text-[var(--aura-text)]">
                  {estimatedShipping === 0 ? 'Complimentary' : formatINR(estimatedShipping)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--aura-text-muted)]">Estimated Tax (8%)</span>
                <span className="text-[var(--aura-text)]">{formatINR(estimatedTax)}</span>
              </div>
            </div>

            <div className="flex justify-between items-baseline tabular-nums">
              <span className="text-sm font-semibold text-[var(--aura-text)]">Total</span>
              <span className="text-xl font-semibold text-[var(--aura-text)]">
                {formatINR(total)}
              </span>
            </div>

            <button
              type="button"
              disabled={hasStockIssues}
              onClick={() =>
                navigate(user ? { view: 'checkout' } : { view: 'auth', mode: 'login' })
              }
              className="w-full py-3 px-4 text-sm font-semibold rounded-md bg-[var(--aura-accent)] text-[var(--aura-accent-contrast)] hover:bg-[var(--aura-accent-hover)] disabled:opacity-50 transition-colors cursor-pointer"
            >
              {user ? 'Proceed to Checkout' : 'Sign In to Checkout'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function SavedAndWishlistView({ initialTab }: { initialTab: 'wishlist' | 'later' }) {
  const {
    user,
    wishlistItems,
    savedItems,
    toggleWishlist,
    addToCart,
    moveSavedToCart,
    removeSavedItem,
    navigate,
  } = useStore();
  const [tab, setTab] = useState<'wishlist' | 'later'>(initialTab);

  if (!user) {
    return (
      <div className="mx-auto max-w-[600px] px-6 py-20 text-center space-y-4">
        <Heart className="w-8 h-8 mx-auto text-[var(--aura-text-muted)]" />
        <h1 className="font-display text-3xl font-semibold text-[var(--aura-text)]">
          Sign in to access saved items
        </h1>
        <p className="text-sm text-[var(--aura-text-muted)]">
          Save favorites to your wishlist for price-drop alerts or move bag items to Save for Later.
        </p>
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

  return (
    <div className="mx-auto max-w-[1280px] px-6 py-12 space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--aura-border)] pb-6">
        <div>
          <p className="text-xs text-[var(--aura-text-muted)]">Personal Curation</p>
          <h1 className="mt-1 font-display text-4xl font-semibold text-[var(--aura-text)]">
            {tab === 'wishlist' ? 'Wishlist' : 'Save for Later'}
          </h1>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-[var(--aura-surface-muted)]">
          <button
            type="button"
            onClick={() => setTab('wishlist')}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              tab === 'wishlist'
                ? 'bg-[var(--aura-surface)] text-[var(--aura-text)] shadow-xs'
                : 'text-[var(--aura-text-muted)]'
            }`}
          >
            Wishlist ({wishlistItems.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('later')}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              tab === 'later'
                ? 'bg-[var(--aura-surface)] text-[var(--aura-text)] shadow-xs'
                : 'text-[var(--aura-text-muted)]'
            }`}
          >
            Save for Later ({savedItems.length})
          </button>
        </div>
      </div>

      {tab === 'wishlist' ? (
        wishlistItems.length === 0 ? (
          <div className="rounded-lg border border-[var(--aura-border)] bg-[var(--aura-surface)] p-12 text-center">
            <p className="font-display text-2xl text-[var(--aura-text)]">Your wishlist is empty</p>
            <p className="mt-2 text-sm text-[var(--aura-text-muted)]">
              Tap the heart icon on any object to track price drops and availability.
            </p>
            <button
              type="button"
              onClick={() => navigate({ view: 'catalog' })}
              className="mt-6 px-5 py-2.5 text-xs font-semibold rounded-md bg-[var(--aura-accent)] text-[var(--aura-accent-contrast)] cursor-pointer"
            >
              Explore Objects
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {wishlistItems.map(({ product, priceDropAmount }) => (
              <div
                key={product.id}
                className="rounded-lg border border-[var(--aura-border)] bg-[var(--aura-surface)] overflow-hidden flex flex-col"
              >
                <button
                  type="button"
                  onClick={() => navigate({ view: 'product', productId: product.id })}
                  className="aspect-[4/3] w-full bg-[var(--aura-surface-muted)] overflow-hidden cursor-pointer"
                >
                  <img
                    src={resolveProductImageSrc(product.image)}
                    alt={product.name}
                    referrerPolicy="no-referrer"
                    onError={handleProductImageError}
                    className="w-full h-full object-cover"
                  />
                </button>
                <div className="p-4 flex-1 flex flex-col justify-between gap-4">
                  <div>
                    <p className="text-xs text-[var(--aura-text-muted)]">
                      {product.category} · {product.stock > 0 ? 'In Stock' : 'Out of Stock'}
                    </p>
                    <h3 className="mt-1 font-semibold text-base text-[var(--aura-text)]">
                      {product.name}
                    </h3>
                    <div className="mt-1 flex items-baseline gap-2 tabular-nums">
                      <span className="text-sm font-semibold text-[var(--aura-text)]">
                        {formatINR(product.price)}
                      </span>
                      {priceDropAmount > 0 && (
                        <span className="text-xs font-medium text-[var(--aura-accent)]">
                          Price dropped by {formatINR(priceDropAmount)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={product.stock <= 0}
                      onClick={() => void addToCart(product.id, 1)}
                      className="flex-1 py-2 px-3 text-xs font-semibold rounded-md bg-[var(--aura-accent)] text-[var(--aura-accent-contrast)] disabled:opacity-40 cursor-pointer"
                    >
                      {product.stock <= 0 ? 'Out of Stock' : 'Add to Bag'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void toggleWishlist(product.id)}
                      className="px-3 py-2 text-xs rounded-md border border-[var(--aura-border)] text-[var(--aura-text-muted)] hover:text-[var(--aura-text)] cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : savedItems.length === 0 ? (
        <div className="rounded-lg border border-[var(--aura-border)] bg-[var(--aura-surface)] p-12 text-center">
          <p className="font-display text-2xl text-[var(--aura-text)]">No items saved for later</p>
          <p className="mt-2 text-sm text-[var(--aura-text-muted)]">
            Move items from your shopping bag to keep their variants ready for a future order.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {savedItems.map((saved) => {
            const product = saved.product;
            if (!product) return null;
            const vText = [saved.variant.size, saved.variant.color, saved.variant.finish]
              .filter(Boolean)
              .join(' · ');
            return (
              <div
                key={saved.id}
                className="rounded-lg border border-[var(--aura-border)] bg-[var(--aura-surface)] overflow-hidden flex flex-col"
              >
                <div className="aspect-[4/3] w-full bg-[var(--aura-surface-muted)] overflow-hidden">
                  <img
                    src={resolveProductImageSrc(product.image)}
                    alt={product.name}
                    referrerPolicy="no-referrer"
                    onError={handleProductImageError}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-4 flex-1 flex flex-col justify-between gap-4">
                  <div>
                    <p className="text-xs text-[var(--aura-text-muted)]">{vText || 'Standard Edition'}</p>
                    <h3 className="mt-1 font-semibold text-base text-[var(--aura-text)]">
                      {product.name}
                    </h3>
                    <p className="mt-1 text-sm font-semibold tabular-nums text-[var(--aura-text)]">
                      {formatINR(product.price)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={product.stock <= 0}
                      onClick={() => void moveSavedToCart(saved.id)}
                      className="flex-1 py-2 px-3 text-xs font-semibold rounded-md bg-[var(--aura-accent)] text-[var(--aura-accent-contrast)] disabled:opacity-40 cursor-pointer"
                    >
                      {product.stock <= 0 ? 'Out of Stock' : 'Move to Bag'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeSavedItem(saved.id)}
                      className="px-3 py-2 text-xs rounded-md border border-[var(--aura-border)] text-[var(--aura-text-muted)] hover:text-[var(--aura-text)] cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
