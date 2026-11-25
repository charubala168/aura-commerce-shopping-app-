import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, BellRing, Heart, Minus, PackagePlus, Plus, ShoppingBag, Star } from 'lucide-react';
import { useStore } from '../context/StoreContext.tsx';
import { formatINR } from '../utils/currency.ts';
import { handleProductImageError, resolveProductImageSrc } from '../utils/imageFallback.ts';
import { ProductCard } from './ProductCard.tsx';
import type { ProductReview } from '../types/ecommerce.ts';

export function ProductDetailView({ productId }: { productId: string }) {
  const {
    products,
    recommendations,
    recordProductView,
    addToCart,
    toggleWishlist,
    wishlistIds,
    simulatePriceDrop,
    simulateRestock,
    navigate,
    authToken,
    apiFetch,
    refreshAll,
    showToast,
  } = useStore();

  const product = products.find((p) => p.id === productId);

  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [selectedFinish, setSelectedFinish] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [revRating, setRevRating] = useState(5);
  const [revTitle, setRevTitle] = useState('');
  const [revComment, setRevComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const loadReviews = useCallback(async () => {
    if (!product) return;
    const res = await apiFetch<{ reviews: ProductReview[] }>(`/api/products/${product.id}/reviews`);
    if (res.ok && res.data) {
      setReviews(res.data.reviews);
    }
  }, [apiFetch, product]);

  useEffect(() => {
    if (!product) return;
    setSelectedSize(product.variants.sizes[0] || '');
    setSelectedColor(product.variants.colors[0] || '');
    setSelectedFinish(product.variants.finishes[0] || '');
    setQuantity(1);
    void recordProductView(product.id);
    void loadReviews();
  }, [product?.id, recordProductView, loadReviews]);

  const handleReviewSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!product) return;
    setSubmittingReview(true);
    const res = await apiFetch<{ review: ProductReview }>(`/api/products/${product.id}/reviews`, {
      method: 'POST',
      body: JSON.stringify({
        rating: revRating,
        title: revTitle,
        comment: revComment,
      }),
    });
    setSubmittingReview(false);
    if (!res.ok || !res.data) {
      showToast(res.error || 'Could not submit review', 'error');
      return;
    }
    setRevTitle('');
    setRevComment('');
    setRevRating(5);
    showToast('Review published', 'success');
    await Promise.all([loadReviews(), refreshAll()]);
  };

  if (!product) {
    return (
      <div className="mx-auto max-w-[1280px] px-6 py-20 text-center">
        <p className="font-display text-3xl text-[var(--aura-text)]">Product not found</p>
        <button
          type="button"
          onClick={() => navigate({ view: 'catalog' })}
          className="mt-6 px-5 py-2.5 text-sm font-medium rounded-md bg-[var(--aura-accent)] text-[var(--aura-accent-contrast)] cursor-pointer"
        >
          Return to Catalog
        </button>
      </div>
    );
  }

  const isWishlisted = wishlistIds.has(product.id);
  const isOutOfStock = product.stock <= 0;
  const discountPct =
    product.discountPercentage > 0
      ? product.discountPercentage
      : product.compareAtPrice && product.compareAtPrice > product.price
        ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
        : 0;
  const specEntries = Object.entries(product.specifications || {});
  const related = recommendations.filter((r) => r.product.id !== product.id).slice(0, 3);

  return (
    <div className="mx-auto max-w-[1280px] px-6 py-10 space-y-16">
      <button
        type="button"
        onClick={() => navigate({ view: 'catalog' })}
        className="inline-flex items-center gap-2 text-sm text-[var(--aura-text-muted)] hover:text-[var(--aura-text)] cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Catalog</span>
      </button>

      {/* Contiguous Purchase Module */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        <div className="lg:col-span-7 lg:sticky lg:top-20 rounded-lg overflow-hidden border border-[var(--aura-border)] bg-[var(--aura-surface-muted)] aspect-[4/3]">
          <img
            key={product.image}
            src={resolveProductImageSrc(product.image)}
            alt={product.name}
            referrerPolicy="no-referrer"
            onError={handleProductImageError}
            style={{
              objectPosition: product.imageFocus || 'center center',
              transform: product.imageScale ? `scale(${product.imageScale})` : undefined,
            }}
            className="h-full w-full object-cover"
          />
        </div>

        <div className="lg:col-span-5 lg:sticky lg:top-20 space-y-6 rounded-lg border border-[var(--aura-border)] bg-[var(--aura-surface)] p-6 sm:p-8">
          <div className="space-y-2 border-b border-[var(--aura-border)] pb-5">
            <div className="flex items-center justify-between gap-2 text-xs text-[var(--aura-text-muted)]">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-medium text-[var(--aura-text)]">{product.brand}</span>
                <span aria-hidden="true">·</span>
                <span>{product.category}</span>
                {product.subcategory && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{product.subcategory}</span>
                  </>
                )}
              </div>
              <span className="inline-flex items-center gap-1 font-medium text-[var(--aura-text)] tabular-nums shrink-0">
                <Star className="w-3.5 h-3.5 fill-[var(--aura-accent)] text-[var(--aura-accent)]" />
                {product.rating.toFixed(1)} ({product.reviewCount || 120})
              </span>
            </div>

            <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[var(--aura-text)] text-balance">
              {product.name}
            </h1>

            <div className="flex items-baseline gap-3 pt-1 tabular-nums flex-wrap">
              <span className="text-2xl font-semibold text-[var(--aura-text)]">
                {formatINR(product.price)}
              </span>
              {product.compareAtPrice && product.compareAtPrice > product.price && (
                <span className="text-sm line-through text-[var(--aura-text-muted)]">
                  {formatINR(product.compareAtPrice)}
                </span>
              )}
              {discountPct > 0 && (
                <span className="text-xs font-semibold text-[var(--aura-accent)]">
                  {discountPct}% off
                </span>
              )}
              <span
                className={`text-xs ml-auto ${
                  isOutOfStock ? 'text-red-500 font-medium' : 'text-[var(--aura-text-muted)]'
                }`}
              >
                {isOutOfStock ? 'Currently out of stock' : `${product.stock} in stock`}
              </span>
            </div>
          </div>

          <p className="text-sm leading-relaxed text-[var(--aura-text-muted)]">
            {product.description}
          </p>

          {/* Variant Selectors */}
          <div className="space-y-4">
            {product.variants.sizes.length > 0 && (
              <div>
                <p className="text-xs font-medium text-[var(--aura-text)] mb-2">
                  Size / Option: <span className="text-[var(--aura-text-muted)]">{selectedSize}</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {product.variants.sizes.map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => setSelectedSize(sz)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
                        selectedSize === sz
                          ? 'border-[var(--aura-accent)] bg-[var(--aura-accent)] text-[var(--aura-accent-contrast)]'
                          : 'border-[var(--aura-border)] text-[var(--aura-text)] hover:bg-[var(--aura-surface-muted)]'
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {product.variants.colors.length > 0 && (
              <div>
                <p className="text-xs font-medium text-[var(--aura-text)] mb-2">
                  Color: <span className="text-[var(--aura-text-muted)]">{selectedColor}</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {product.variants.colors.map((clr) => (
                    <button
                      key={clr}
                      type="button"
                      onClick={() => setSelectedColor(clr)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
                        selectedColor === clr
                          ? 'border-[var(--aura-accent)] bg-[var(--aura-accent)] text-[var(--aura-accent-contrast)]'
                          : 'border-[var(--aura-border)] text-[var(--aura-text)] hover:bg-[var(--aura-surface-muted)]'
                      }`}
                    >
                      {clr}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {product.variants.finishes.length > 0 && (
              <div>
                <p className="text-xs font-medium text-[var(--aura-text)] mb-2">
                  Finish: <span className="text-[var(--aura-text-muted)]">{selectedFinish}</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {product.variants.finishes.map((fin) => (
                    <button
                      key={fin}
                      type="button"
                      onClick={() => setSelectedFinish(fin)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
                        selectedFinish === fin
                          ? 'border-[var(--aura-accent)] bg-[var(--aura-accent)] text-[var(--aura-accent-contrast)]'
                          : 'border-[var(--aura-border)] text-[var(--aura-text)] hover:bg-[var(--aura-surface-muted)]'
                      }`}
                    >
                      {fin}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Quantity & Actions */}
          <div className="flex items-center gap-3 pt-2">
            <div className="inline-flex items-center rounded-md border border-[var(--aura-border)] bg-[var(--aura-bg)]">
              <button
                type="button"
                aria-label="Decrease quantity"
                disabled={quantity <= 1 || isOutOfStock}
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="p-2.5 text-[var(--aura-text)] disabled:opacity-40 cursor-pointer"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="px-3 text-sm font-medium tabular-nums text-[var(--aura-text)]">
                {quantity}
              </span>
              <button
                type="button"
                aria-label="Increase quantity"
                disabled={quantity >= product.stock || isOutOfStock}
                onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
                className="p-2.5 text-[var(--aura-text)] disabled:opacity-40 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              disabled={isOutOfStock}
              onClick={() =>
                void addToCart(product.id, quantity, {
                  size: selectedSize,
                  color: selectedColor,
                  finish: selectedFinish,
                })
              }
              className={`flex-1 inline-flex items-center justify-center gap-2 py-3 px-5 text-sm font-semibold rounded-md transition-colors ${
                isOutOfStock
                  ? 'bg-[var(--aura-surface-muted)] text-[var(--aura-text-muted)] cursor-not-allowed'
                  : 'bg-[var(--aura-accent)] text-[var(--aura-accent-contrast)] hover:bg-[var(--aura-accent-hover)] cursor-pointer'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>{isOutOfStock ? 'Out of Stock' : 'Add to Cart'}</span>
            </button>

            <button
              type="button"
              onClick={() => void toggleWishlist(product.id)}
              aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
              className="p-3 rounded-md border border-[var(--aura-border)] text-[var(--aura-text)] hover:bg-[var(--aura-surface-muted)] cursor-pointer"
            >
              <Heart
                className={`w-4 h-4 ${isWishlisted ? 'fill-[var(--aura-accent)] text-[var(--aura-accent)]' : ''}`}
              />
            </button>
          </div>

          <div className="pt-4 border-t border-[var(--aura-border)] space-y-3 text-xs text-[var(--aura-text-muted)]">
            <p>
              <strong className="text-[var(--aura-text)] font-medium">Materials:</strong>{' '}
              {product.materials}
            </p>
            <p>
              <strong className="text-[var(--aura-text)] font-medium">Dimensions:</strong>{' '}
              {product.dimensions}
            </p>
            {specEntries.length > 0 && (
              <div className="pt-2">
                <p className="font-medium text-[var(--aura-text)] mb-1.5">Specifications</p>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-[var(--aura-border)] pt-2">
                  {specEntries.map(([key, val]) => (
                    <div key={key} className="contents">
                      <dt className="text-[var(--aura-text-muted)]">{key}</dt>
                      <dd className="text-[var(--aura-text)] font-medium text-right">{val}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>

          {authToken && (
            <div className="pt-3 border-t border-[var(--aura-border)] space-y-2">
              <span className="block text-xs text-[var(--aura-text-muted)]">
                Test live price-drop &amp; stock-restock notifications:
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void simulatePriceDrop(product.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-[var(--aura-border)] text-[var(--aura-text)] hover:bg-[var(--aura-surface-muted)] cursor-pointer whitespace-nowrap shrink-0"
                >
                  <BellRing className="w-3.5 h-3.5" />
                  <span>Apply 15% Price Drop</span>
                </button>
                <button
                  type="button"
                  onClick={() => void simulateRestock(product.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-[var(--aura-border)] text-[var(--aura-text)] hover:bg-[var(--aura-surface-muted)] cursor-pointer whitespace-nowrap shrink-0"
                >
                  <PackagePlus className="w-3.5 h-3.5" />
                  <span>{isOutOfStock ? 'Restock Item (15 units)' : 'Add +10 Stock'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Customer Reviews */}
      <section className="pt-10 border-t border-[var(--aura-border)] space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs text-[var(--aura-text-muted)]">Verified Buyer Feedback</p>
            <h2 className="mt-1 font-display text-2xl font-semibold text-[var(--aura-text)]">
              Customer Reviews ({product.reviewCount || reviews.length})
            </h2>
          </div>
          <div className="inline-flex items-center gap-2 text-sm tabular-nums text-[var(--aura-text)]">
            <Star className="w-4 h-4 fill-[var(--aura-accent)] text-[var(--aura-accent)]" />
            <span className="font-semibold">{product.rating.toFixed(1)} out of 5</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5">
            {authToken ? (
              <form
                onSubmit={handleReviewSubmit}
                className="rounded-lg border border-[var(--aura-border)] bg-[var(--aura-surface)] p-5 space-y-4"
              >
                <h3 className="text-sm font-semibold text-[var(--aura-text)]">Write a Review</h3>
                <div>
                  <label className="block text-xs text-[var(--aura-text-muted)] mb-1">
                    Rating
                  </label>
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((starVal) => (
                      <button
                        key={starVal}
                        type="button"
                        onClick={() => setRevRating(starVal)}
                        className={`px-2.5 py-1 text-xs rounded border cursor-pointer tabular-nums ${
                          revRating >= starVal
                            ? 'border-[var(--aura-accent)] bg-[var(--aura-accent)] text-[var(--aura-accent-contrast)]'
                            : 'border-[var(--aura-border)] text-[var(--aura-text-muted)]'
                        }`}
                      >
                        {starVal} ★
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-[var(--aura-text-muted)] mb-1">
                    Headline
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    value={revTitle}
                    onChange={(e) => setRevTitle(e.target.value)}
                    placeholder="Summarize your experience"
                    className="w-full px-3 py-2 text-sm rounded-md border border-[var(--aura-border)] bg-[var(--aura-bg)] text-[var(--aura-text)]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[var(--aura-text-muted)] mb-1">
                    Review
                  </label>
                  <textarea
                    rows={3}
                    required
                    minLength={5}
                    value={revComment}
                    onChange={(e) => setRevComment(e.target.value)}
                    placeholder="Share quality, fit, or performance details..."
                    className="w-full px-3 py-2 text-sm rounded-md border border-[var(--aura-border)] bg-[var(--aura-bg)] text-[var(--aura-text)]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submittingReview}
                  className="px-4 py-2 text-xs font-semibold rounded-md bg-[var(--aura-accent)] text-[var(--aura-accent-contrast)] hover:bg-[var(--aura-accent-hover)] cursor-pointer disabled:opacity-60"
                >
                  {submittingReview ? 'Submitting...' : 'Submit Review'}
                </button>
              </form>
            ) : (
              <div className="rounded-lg border border-[var(--aura-border)] bg-[var(--aura-surface)] p-5 space-y-3">
                <p className="text-sm font-medium text-[var(--aura-text)]">
                  Purchased this product?
                </p>
                <p className="text-xs text-[var(--aura-text-muted)]">
                  Sign in to share your rating and review with fellow shoppers.
                </p>
                <button
                  type="button"
                  onClick={() => navigate({ view: 'auth', mode: 'login' })}
                  className="px-4 py-2 text-xs font-semibold rounded-md bg-[var(--aura-accent)] text-[var(--aura-accent-contrast)] cursor-pointer"
                >
                  Sign In to Review
                </button>
              </div>
            )}
          </div>

          <div className="lg:col-span-7 space-y-3">
            {reviews.length === 0 ? (
              <div className="rounded-lg border border-[var(--aura-border)] bg-[var(--aura-surface)] p-6 text-xs text-[var(--aura-text-muted)]">
                Rated {product.rating.toFixed(1)} / 5 across {product.reviewCount || 0} catalog
                ratings. Be the first to post a detailed written review.
              </div>
            ) : (
              reviews.map((rev) => (
                <div
                  key={rev.id}
                  className="rounded-lg border border-[var(--aura-border)] bg-[var(--aura-surface)] p-5 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[var(--aura-text)]">{rev.userName}</span>
                      {rev.verifiedPurchase && (
                        <span className="text-[var(--aura-accent)] font-medium">
                          · Verified Purchase
                        </span>
                      )}
                    </div>
                    <span className="tabular-nums text-[var(--aura-text-muted)]">
                      {new Date(rev.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[var(--aura-accent)] tabular-nums">
                      {rev.rating}.0 ★
                    </span>
                    <span className="text-sm font-semibold text-[var(--aura-text)]">
                      {rev.title}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-[var(--aura-text-muted)]">
                    {rev.comment}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Recommendations */}
      {related.length > 0 && (
        <section className="pt-10 border-t border-[var(--aura-border)]">
          <h2 className="font-display text-2xl font-semibold text-[var(--aura-text)] mb-6">
            You May Also Like
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {related.map((item) => (
              <ProductCard
                key={item.product.id}
                product={item.product}
                reasonLine={item.reason}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
