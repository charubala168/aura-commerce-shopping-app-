import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Bell,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  Palette,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import { useStore } from '../context/StoreContext.tsx';
import { ProductCard } from './ProductCard.tsx';

const HOME_PAGE_SIZE = 12;

export function HomeView() {
  const {
    products,
    categories,
    productsLoading,
    productsError,
    refreshAll,
    continueShopping,
    recommendations,
    navigate,
  } = useStore();
  const [heroImgError, setHeroImgError] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sortBy, setSortBy] = useState<
    'featured' | 'popular' | 'rating_desc' | 'price_asc' | 'price_desc'
  >('featured');
  const [page, setPage] = useState(1);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = products.filter((p) => {
      if (selectedCategory !== 'All' && p.category !== selectedCategory) return false;
      if (inStockOnly && p.stock <= 0) return false;
      if (
        q &&
        !p.name.toLowerCase().includes(q) &&
        !p.brand.toLowerCase().includes(q) &&
        !p.category.toLowerCase().includes(q) &&
        !(p.subcategory || '').toLowerCase().includes(q) &&
        !p.description.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });

    const sorted = [...list];
    if (sortBy === 'price_asc') sorted.sort((a, b) => a.price - b.price);
    else if (sortBy === 'price_desc') sorted.sort((a, b) => b.price - a.price);
    else if (sortBy === 'rating_desc')
      sorted.sort((a, b) => b.rating - a.rating || b.popularityScore - a.popularityScore);
    else if (sortBy === 'popular') sorted.sort((a, b) => b.popularityScore - a.popularityScore);
    return sorted;
  }, [products, search, selectedCategory, inStockOnly, sortBy]);

  useEffect(() => {
    setPage(1);
  }, [search, selectedCategory, inStockOnly, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / HOME_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedProducts = filteredProducts.slice(
    (safePage - 1) * HOME_PAGE_SIZE,
    safePage * HOME_PAGE_SIZE
  );
  const startIdx = filteredProducts.length === 0 ? 0 : (safePage - 1) * HOME_PAGE_SIZE + 1;
  const endIdx = Math.min(filteredProducts.length, safePage * HOME_PAGE_SIZE);

  const continueItems = continueShopping.slice(0, 3).map((r) => r.product);
  const recommendedPicks = recommendations.slice(0, 3);
  const trendingProducts = useMemo(
    () =>
      [...products]
        .filter((p) => p.isAvailable && p.stock > 0)
        .sort((a, b) => b.popularityScore - a.popularityScore)
        .slice(0, 4),
    [products]
  );
  const featuredProducts = useMemo(
    () =>
      products
        .filter((p) => p.isAvailable && p.stock > 0 && p.featured)
        .slice(0, 4),
    [products]
  );
  const categoryStats = useMemo(
    () =>
      categories.map((cat) => ({
        name: cat,
        count: products.filter((p) => p.category === cat).length,
      })),
    [categories, products]
  );

  return (
    <div className="space-y-16 pb-20">
      {/* 1. Storefront Hero — About the Website */}
      <section className="border-b border-[var(--aura-border)]">
        <div className="mx-auto grid max-w-[1280px] grid-cols-1 lg:grid-cols-12 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-center px-6 py-12 lg:py-16 lg:pr-12">
            <p className="text-xs font-medium tracking-wider uppercase text-[var(--aura-accent)]">
              About Aura Commerce · SmartCart Platform
            </p>
            <h1 className="mt-3 font-display text-4xl sm:text-5xl lg:text-[3.1rem] leading-[1.08] font-semibold text-[var(--aura-text)] text-balance">
              A personalized shopping website built around how you browse, save, and order.
            </h1>
            <p className="mt-5 text-sm sm:text-base leading-relaxed text-[var(--aura-text-muted)] max-w-[54ch]">
              Aura Commerce brings together {products.length || 65} everyday products across
              Fashion &amp; Clothing, Electronics &amp; Gadgets, Beauty &amp; Skincare, Bags &amp;
              Accessories, Home &amp; Kitchen, and Stationery—paired with cross-device cart and
              history sync, Save for Later with variant preservation, adaptive light &amp; dark
              themes, real-time order and price-drop alerts, and downloadable PDF invoices.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <a
                href="#catalog-smartcart"
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-md bg-[var(--aura-accent)] text-[var(--aura-accent-contrast)] hover:bg-[var(--aura-accent-hover)] transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <span>Explore All {products.length || 65} Products</span>
                <ArrowRight className="w-4 h-4" />
              </a>
              <button
                type="button"
                onClick={() => navigate({ view: 'recommendations' })}
                className="px-4 py-3 text-sm font-medium rounded-md border border-[var(--aura-border)] text-[var(--aura-text)] hover:bg-[var(--aura-surface-muted)] transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Personalized Picks
              </button>
              <button
                type="button"
                onClick={() => navigate({ view: 'account', tab: 'theme' })}
                className="px-3 py-3 text-sm font-medium text-[var(--aura-text-muted)] hover:text-[var(--aura-accent)] transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Customize Theme
              </button>
            </div>
          </div>

          <div className="lg:col-span-6 relative min-h-[280px] lg:min-h-[440px] bg-[var(--aura-surface-muted)]">
            {!heroImgError ? (
              <img
                src="/src/assets/images/hero_aura_atelier_1795613731604.jpg"
                alt="Aura Commerce sunlit showroom featuring electronics, lighting, and home essentials"
                referrerPolicy="no-referrer"
                onError={() => setHeroImgError(true)}
                className="h-full w-full lg:h-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center p-12 text-center">
                <span className="font-display text-3xl text-[var(--aura-text)]">
                  Aura Commerce Storefront
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* About This Website: What Aura Commerce Offers */}
      <section className="mx-auto max-w-[1280px] px-6 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--aura-border)] pb-4">
          <div>
            <p className="text-xs font-medium text-[var(--aura-text-muted)]">
              Welcome to SmartCart
            </p>
            <h2 className="mt-1 font-display text-3xl font-semibold text-[var(--aura-text)]">
              Inside Aura Commerce
            </h2>
          </div>
          <p className="text-xs text-[var(--aura-text-muted)] max-w-[46ch]">
            Every visit updates your discovery feed, shopping bag, order archive, and theme preferences in real time across devices.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              icon: Eye,
              title: 'Recently Viewed & Continue Shopping',
              desc: 'Tracks your latest 20 unique products across guest and signed-in sessions, merges history cleanly on login, and highlights unpurchased items.',
              actionLabel: 'View History',
              onClick: () => navigate({ view: 'recently-viewed' }),
            },
            {
              icon: Palette,
              title: 'Dynamic Theme & Personalization',
              desc: 'Detects your device light or dark preference automatically and lets you switch between Gallery Light, Obsidian Dark, Warm Sandstone, and Midnight Slate.',
              actionLabel: 'Theme Studio',
              onClick: () => navigate({ view: 'account', tab: 'theme' }),
            },
            {
              icon: Bell,
              title: 'Real-Time Push & Order Alerts',
              desc: 'Delivers instant notifications for order confirmations, verified payments, shipping milestones, wishlist price drops, restocks, and cart reminders.',
              actionLabel: 'Open Alerts',
              onClick: () => navigate({ view: 'notifications' }),
            },
            {
              icon: FileText,
              title: 'Orders, Returns & PDF Invoices',
              desc: 'Browse filterable order history, inspect payment audit logs, download commercial PDF invoices, request cancellations or returns, and reorder in one click.',
              actionLabel: 'Order Archive',
              onClick: () => navigate({ view: 'orders' }),
            },
            {
              icon: ShoppingBag,
              title: 'Smart Bag & Save for Later',
              desc: 'Preserves selected size, color, and finish variants across devices while validating live stock and price updates automatically before checkout.',
              actionLabel: 'Open Smart Bag',
              onClick: () => navigate({ view: 'cart' }),
            },
            {
              icon: Sparkles,
              title: 'Personalized Recommendations',
              desc: 'Curates in-stock "You May Also Like" picks tailored from up to 50 recent views, saved wishlist items, favorite categories, and past orders.',
              actionLabel: 'See Picks For You',
              onClick: () => navigate({ view: 'recommendations' }),
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="rounded-lg border border-[var(--aura-border)] bg-[var(--aura-surface)] p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-2">
                  <Icon className="w-4 h-4 text-[var(--aura-accent)]" />
                  <h3 className="text-sm font-semibold text-[var(--aura-text)]">{item.title}</h3>
                  <p className="text-xs leading-relaxed text-[var(--aura-text-muted)]">
                    {item.desc}
                  </p>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={item.onClick}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--aura-text)] border-b border-[var(--aura-border)] hover:border-[var(--aura-accent)] pb-0.5 cursor-pointer"
                  >
                    <span>{item.actionLabel}</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Promotional Banners & Shop by Category */}
      <section className="mx-auto max-w-[1280px] px-6 space-y-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-lg border border-[var(--aura-border)] bg-[var(--aura-surface)] p-6 sm:p-8 flex flex-col justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-[var(--aura-accent)]">
                Seasonal Offer · Up to 35% Off MRP
              </p>
              <h2 className="mt-2 font-display text-2xl sm:text-3xl font-semibold text-[var(--aura-text)]">
                Tech, Audio &amp; Workspace Upgrades
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-[var(--aura-text-muted)]">
                Complimentary shipping on orders above ₹999 with real-time price-drop alerts on saved items.
              </p>
            </div>
            <div>
              <button
                type="button"
                onClick={() => navigate({ view: 'catalog', category: 'Electronics & Gadgets' })}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--aura-text)] border-b border-[var(--aura-accent)] pb-0.5 cursor-pointer"
              >
                <span>Shop Electronics &amp; Gadgets</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-[var(--aura-border)] bg-[var(--aura-surface)] p-6 sm:p-8 flex flex-col justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-[var(--aura-accent)]">
                New Season Edit · Handloom &amp; Skincare
              </p>
              <h2 className="mt-2 font-display text-2xl sm:text-3xl font-semibold text-[var(--aura-text)]">
                Curated Wardrobes &amp; Clean Botanicals
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-[var(--aura-text-muted)]">
                Explore breathable cotton kurtis, street denim, and dermatologist-tested daily skincare.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-5">
              <button
                type="button"
                onClick={() => navigate({ view: 'catalog', category: 'Fashion & Clothing' })}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--aura-text)] border-b border-[var(--aura-accent)] pb-0.5 cursor-pointer"
              >
                <span>Shop Fashion</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => navigate({ view: 'catalog', category: 'Beauty & Skincare' })}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--aura-text)] border-b border-[var(--aura-border)] hover:border-[var(--aura-accent)] pb-0.5 cursor-pointer"
              >
                <span>Shop Beauty &amp; Skincare</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Category Directory */}
        {categoryStats.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {categoryStats.map((cat) => (
              <button
                key={cat.name}
                type="button"
                onClick={() => {
                  setSelectedCategory(cat.name);
                  document.getElementById('catalog-smartcart')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="rounded-lg border border-[var(--aura-border)] bg-[var(--aura-surface)] p-4 text-left hover:border-[var(--aura-accent)] transition-colors cursor-pointer"
              >
                <p className="text-xs font-semibold text-[var(--aura-text)] line-clamp-1">
                  {cat.name}
                </p>
                <p className="mt-1 text-xs text-[var(--aura-text-muted)] tabular-nums">
                  {cat.count} products
                </p>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Trending & Featured Highlights */}
      {trendingProducts.length > 0 && (
        <section className="mx-auto max-w-[1280px] px-6 space-y-6">
          <div className="flex items-end justify-between gap-4 border-b border-[var(--aura-border)] pb-4">
            <div>
              <p className="text-xs text-[var(--aura-text-muted)]">Most Popular This Week</p>
              <h2 className="mt-1 font-display text-3xl font-semibold text-[var(--aura-text)]">
                Trending Now
              </h2>
            </div>
            <button
              type="button"
              onClick={() => navigate({ view: 'catalog' })}
              className="text-xs font-medium text-[var(--aura-text)] border-b border-[var(--aura-border)] hover:border-[var(--aura-accent)] pb-0.5 cursor-pointer"
            >
              View All
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {trendingProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {featuredProducts.length > 0 && (
        <section className="mx-auto max-w-[1280px] px-6 space-y-6">
          <div className="flex items-end justify-between gap-4 border-b border-[var(--aura-border)] pb-4">
            <div>
              <p className="text-xs text-[var(--aura-text-muted)]">Editor&apos;s Selection</p>
              <h2 className="mt-1 font-display text-3xl font-semibold text-[var(--aura-text)]">
                Featured Products
              </h2>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* 2. Complete 65-Product Storefront Grid with Pagination */}
      <section id="catalog-smartcart" className="mx-auto max-w-[1280px] px-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[var(--aura-border)] pb-5">
          <div>
            <p className="text-xs font-medium text-[var(--aura-text-muted)]">
              01. Complete Catalogue · Showing {startIdx}–{endIdx} of {filteredProducts.length}
            </p>
            <h2 className="mt-1 font-display text-3xl font-semibold text-[var(--aura-text)]">
              All Products ({filteredProducts.length})
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[230px] flex-1 sm:flex-initial">
              <Search className="w-4 h-4 text-[var(--aura-text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${products.length || 65} products...`}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-[var(--aura-border)] bg-[var(--aura-surface)] text-[var(--aura-text)] placeholder:text-[var(--aura-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--aura-accent)]"
              />
            </div>

            <label className="inline-flex items-center gap-2 text-xs font-medium text-[var(--aura-text)] cursor-pointer select-none px-3 py-2 rounded-md border border-[var(--aura-border)] bg-[var(--aura-surface)]">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => setInStockOnly(e.target.checked)}
                className="accent-[var(--aura-accent)]"
              />
              <span>In Stock Only</span>
            </label>

            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-[var(--aura-border)] bg-[var(--aura-surface)]">
              <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--aura-text-muted)]" />
              <select
                aria-label="Sort products"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="text-xs font-medium bg-transparent text-[var(--aura-text)] focus:outline-none cursor-pointer"
              >
                <option value="featured">Default Order</option>
                <option value="popular">Popularity</option>
                <option value="rating_desc">Top Rated</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
              </select>
            </div>
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-[var(--aura-surface-muted)] overflow-x-auto">
          {['All', ...categories].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-[var(--aura-surface)] text-[var(--aura-text)] shadow-xs'
                  : 'text-[var(--aura-text-muted)] hover:text-[var(--aura-text)]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {productsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <div
                key={n}
                className="h-80 rounded-lg border border-[var(--aura-border)] bg-[var(--aura-surface-muted)] animate-pulse"
              />
            ))}
          </div>
        ) : productsError && products.length === 0 ? (
          <div className="rounded-lg border border-[var(--aura-border)] bg-[var(--aura-surface)] p-12 text-center">
            <p className="font-display text-2xl text-[var(--aura-text)]">
              Unable to load product catalogue
            </p>
            <p className="mt-2 text-sm text-[var(--aura-text-muted)]">{productsError}</p>
            <button
              type="button"
              onClick={() => void refreshAll()}
              className="mt-4 px-4 py-2 text-xs font-semibold rounded-md bg-[var(--aura-accent)] text-[var(--aura-accent-contrast)] cursor-pointer"
            >
              Retry Loading Products
            </button>
          </div>
        ) : paginatedProducts.length === 0 ? (
          <div className="rounded-lg border border-[var(--aura-border)] bg-[var(--aura-surface)] p-12 text-center">
            <p className="font-display text-2xl text-[var(--aura-text)]">No matching products</p>
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setSelectedCategory('All');
                setInStockOnly(false);
              }}
              className="mt-4 px-4 py-2 text-xs font-semibold rounded-md bg-[var(--aura-accent)] text-[var(--aura-accent-contrast)] cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {paginatedProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-[var(--aura-border)]">
                <p className="text-xs text-[var(--aura-text-muted)] tabular-nums">
                  Page {safePage} of {totalPages} · {filteredProducts.length} items
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={safePage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md border border-[var(--aura-border)] text-[var(--aura-text)] hover:bg-[var(--aura-surface-muted)] disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Prev</span>
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => setPage(pageNum)}
                      className={`h-8 min-w-8 px-2.5 text-xs font-medium rounded-md border tabular-nums transition-colors cursor-pointer ${
                        pageNum === safePage
                          ? 'border-[var(--aura-accent)] bg-[var(--aura-accent)] text-[var(--aura-accent-contrast)]'
                          : 'border-[var(--aura-border)] text-[var(--aura-text)] hover:bg-[var(--aura-surface-muted)]'
                      }`}
                    >
                      {pageNum}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md border border-[var(--aura-border)] text-[var(--aura-text)] hover:bg-[var(--aura-surface-muted)] disabled:opacity-40 cursor-pointer"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* 3. Continue Shopping (Viewed but Unpurchased Products) */}
      {continueItems.length > 0 && (
        <section className="mx-auto max-w-[1280px] px-6 pt-4 border-t border-[var(--aura-border)]">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-8 pt-10">
            <div>
              <p className="text-xs font-medium text-[var(--aura-text-muted)]">
                02. Viewed &amp; Unpurchased · Synced Across Sessions
              </p>
              <h2 className="mt-1 font-display text-3xl font-semibold text-[var(--aura-text)]">
                Continue Shopping
              </h2>
            </div>
            <button
              type="button"
              onClick={() => navigate({ view: 'recently-viewed' })}
              className="text-sm font-medium text-[var(--aura-text)] border-b border-[var(--aura-border)] hover:border-[var(--aura-accent)] pb-0.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              View History (20 max)
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {continueItems.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* 4. You May Also Like (Personalized Recommendations) */}
      {recommendedPicks.length > 0 && (
        <section className="mx-auto max-w-[1280px] px-6 pt-4 border-t border-[var(--aura-border)]">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-8 pt-10">
            <div>
              <p className="text-xs font-medium text-[var(--aura-text-muted)]">
                {continueItems.length > 0 ? '03.' : '02.'} Personalized From Up To 50 Recent Views · In Stock Only
              </p>
              <h2 className="mt-1 font-display text-3xl font-semibold text-[var(--aura-text)]">
                You May Also Like
              </h2>
            </div>
            <button
              type="button"
              onClick={() => navigate({ view: 'recommendations' })}
              className="text-sm font-medium text-[var(--aura-text)] border-b border-[var(--aura-border)] hover:border-[var(--aura-accent)] pb-0.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              See All Recommendations
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {recommendedPicks.map((rec) => (
              <ProductCard
                key={rec.product.id}
                product={rec.product}
                reasonLine={rec.reason}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
