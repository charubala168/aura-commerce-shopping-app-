import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal } from 'lucide-react';
import { useStore } from '../context/StoreContext.tsx';
import { ProductCard } from './ProductCard.tsx';

const CATALOG_PAGE_SIZE = 16;

export function CatalogView({ initialCategory }: { initialCategory?: string }) {
  const { products, categories, productsLoading, productsError, refreshAll } = useStore();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(initialCategory || 'All');
  const [sortBy, setSortBy] = useState<
    'featured' | 'popular' | 'rating_desc' | 'price_asc' | 'price_desc'
  >('featured');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (initialCategory) setSelectedCategory(initialCategory);
  }, [initialCategory]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = products.filter((p) => {
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

    list = [...list];
    if (sortBy === 'price_asc') list.sort((a, b) => a.price - b.price);
    else if (sortBy === 'price_desc') list.sort((a, b) => b.price - a.price);
    else if (sortBy === 'rating_desc')
      list.sort((a, b) => b.rating - a.rating || b.popularityScore - a.popularityScore);
    else if (sortBy === 'popular') list.sort((a, b) => b.popularityScore - a.popularityScore);

    return list;
  }, [products, search, selectedCategory, sortBy, inStockOnly]);

  useEffect(() => {
    setPage(1);
  }, [search, selectedCategory, sortBy, inStockOnly]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / CATALOG_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * CATALOG_PAGE_SIZE, safePage * CATALOG_PAGE_SIZE);
  const startIdx = filtered.length === 0 ? 0 : (safePage - 1) * CATALOG_PAGE_SIZE + 1;
  const endIdx = Math.min(filtered.length, safePage * CATALOG_PAGE_SIZE);

  return (
    <div className="mx-auto max-w-[1280px] px-6 py-12 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[var(--aura-border)] pb-6">
        <div>
          <p className="text-xs text-[var(--aura-text-muted)]">Complete SmartCart Catalogue</p>
          <h1 className="mt-1 font-display text-4xl font-semibold text-[var(--aura-text)]">
            All Products
          </h1>
        </div>
        <p className="text-sm text-[var(--aura-text-muted)] tabular-nums">
          Showing {startIdx}–{endIdx} of {filtered.length}{' '}
          {filtered.length === 1 ? 'product' : 'products'}
        </p>
      </div>

      {/* Filter & Search Bar */}
      <div className="space-y-4">
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

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-4 h-4 text-[var(--aura-text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by product name, brand, category, or subcategory"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-[var(--aura-border)] bg-[var(--aura-surface)] text-[var(--aura-text)] placeholder:text-[var(--aura-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--aura-accent)]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
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
                <option value="featured">All (Catalog Order)</option>
                <option value="popular">Popularity</option>
                <option value="rating_desc">Top Rated</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
              </select>
            </div>
          </div>
        </div>
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
            className="mt-5 px-4 py-2 text-xs font-semibold rounded-md bg-[var(--aura-accent)] text-[var(--aura-accent-contrast)] cursor-pointer"
          >
            Retry Loading Products
          </button>
        </div>
      ) : paginated.length === 0 ? (
        <div className="rounded-lg border border-[var(--aura-border)] bg-[var(--aura-surface)] p-12 text-center">
          <p className="font-display text-2xl text-[var(--aura-text)]">No matching products</p>
          <p className="mt-2 text-sm text-[var(--aura-text-muted)]">
            Try clearing your search filter or viewing all categories.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setSelectedCategory('All');
              setInStockOnly(false);
            }}
            className="mt-5 px-4 py-2 text-xs font-semibold rounded-md bg-[var(--aura-accent)] text-[var(--aura-accent-contrast)] cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {paginated.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-4 pt-6 border-t border-[var(--aura-border)]">
              <p className="text-xs text-[var(--aura-text-muted)] tabular-nums">
                Page {safePage} of {totalPages} · {filtered.length} products
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
    </div>
  );
}
