import { Trash2 } from 'lucide-react';
import { useStore } from '../context/StoreContext.tsx';
import { ProductCard } from './ProductCard.tsx';

export function RecentlyViewedView() {
  const {
    recentlyViewed,
    removeRecentlyViewed,
    clearRecentlyViewed,
    navigate,
    user,
  } = useStore();

  return (
    <div className="mx-auto max-w-[1280px] px-6 py-12 space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--aura-border)] pb-6">
        <div>
          <p className="text-xs text-[var(--aura-text-muted)]">
            {user
              ? 'Synced to your account across devices · Unpurchased items feed Continue Shopping'
              : 'Guest session history (merges automatically on sign in)'}
          </p>
          <h1 className="mt-1 font-display text-4xl font-semibold text-[var(--aura-text)]">
            Recently Viewed
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--aura-text-muted)] tabular-nums">
            {recentlyViewed.length} / 20 tracked
          </span>
          {recentlyViewed.length > 0 && (
            <button
              type="button"
              onClick={() => void clearRecentlyViewed()}
              className="px-3 py-1.5 text-xs font-medium rounded-md border border-[var(--aura-border)] text-[var(--aura-text)] hover:bg-[var(--aura-surface-muted)] cursor-pointer"
            >
              Clear History
            </button>
          )}
        </div>
      </div>

      {recentlyViewed.length === 0 ? (
        <div className="rounded-lg border border-[var(--aura-border)] bg-[var(--aura-surface)] p-12 text-center">
          <p className="font-display text-2xl text-[var(--aura-text)]">No objects viewed yet</p>
          <p className="mt-2 text-sm text-[var(--aura-text-muted)]">
            Browse the catalog and the latest 20 unique objects you inspect will appear here automatically.
          </p>
          <button
            type="button"
            onClick={() => navigate({ view: 'catalog' })}
            className="mt-6 px-5 py-2.5 text-xs font-semibold rounded-md bg-[var(--aura-accent)] text-[var(--aura-accent-contrast)] cursor-pointer"
          >
            Browse Catalog
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {recentlyViewed.map(({ product, viewedAt }) => (
            <div key={product.id} className="space-y-2">
              <ProductCard
                product={product}
                reasonLine={`Viewed ${new Date(viewedAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}`}
              />
              <button
                type="button"
                onClick={() => void removeRecentlyViewed(product.id)}
                className="inline-flex items-center gap-1 text-xs text-[var(--aura-text-muted)] hover:text-[var(--aura-text)] cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                <span>Remove from history</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function RecommendationsView() {
  const {
    recommendations,
    categories,
    preferences,
    updateFavoriteCategories,
    navigate,
    user,
  } = useStore();

  const favCats = preferences?.favoriteCategories || [];

  const toggleFavCategory = (cat: string) => {
    const next = favCats.includes(cat) ? favCats.filter((c) => c !== cat) : [...favCats, cat];
    void updateFavoriteCategories(next);
  };

  return (
    <div className="mx-auto max-w-[1280px] px-6 py-12 space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--aura-border)] pb-6">
        <div>
          <p className="text-xs text-[var(--aura-text-muted)]">
            Powered by up to 50 recent views, wishlist signals, and order history · Excludes purchased &amp; out-of-stock items
          </p>
          <h1 className="mt-1 font-display text-4xl font-semibold text-[var(--aura-text)]">
            You May Also Like
          </h1>
        </div>
        <button
          type="button"
          onClick={() => navigate({ view: 'recently-viewed' })}
          className="text-sm font-medium text-[var(--aura-text)] border-b border-[var(--aura-border)] hover:border-[var(--aura-accent)] pb-0.5 cursor-pointer"
        >
          View Recently Viewed
        </button>
      </div>

      {/* Favorite Category Selector */}
      <div className="rounded-lg border border-[var(--aura-border)] bg-[var(--aura-surface)] p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-[var(--aura-text)]">
            Favorite Categories
          </p>
          {!user && (
            <button
              type="button"
              onClick={() => navigate({ view: 'auth', mode: 'login' })}
              className="text-xs text-[var(--aura-accent)] hover:underline cursor-pointer"
            >
              Sign in to save category preferences
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => {
            const active = favCats.includes(cat);
            return (
              <button
                key={cat}
                type="button"
                onClick={() => toggleFavCategory(cat)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
                  active
                    ? 'border-[var(--aura-accent)] bg-[var(--aura-accent)] text-[var(--aura-accent-contrast)]'
                    : 'border-[var(--aura-border)] text-[var(--aura-text-muted)] hover:text-[var(--aura-text)]'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
        {recommendations.map((rec) => (
          <ProductCard
            key={rec.product.id}
            product={rec.product}
            reasonLine={rec.reason}
          />
        ))}
      </div>
    </div>
  );
}
