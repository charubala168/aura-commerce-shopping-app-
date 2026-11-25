import { Eye, Heart, ShoppingBag, Star } from 'lucide-react';
import { useStore } from '../context/StoreContext.tsx';
import { formatINR } from '../utils/currency.ts';
import { handleProductImageError, resolveProductImageSrc } from '../utils/imageFallback.ts';
import type { Product } from '../types/ecommerce.ts';

interface ProductCardProps {
  product: Product;
  reasonLine?: string;
}

export function ProductCard({ product, reasonLine }: ProductCardProps) {
  const { navigate, addToCart, toggleWishlist, wishlistIds } = useStore();
  const isWishlisted = wishlistIds.has(product.id);
  const isOutOfStock = product.stock <= 0;
  const discountPct =
    product.discountPercentage > 0
      ? product.discountPercentage
      : product.compareAtPrice && product.compareAtPrice > product.price
        ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
        : 0;

  return (
    <article className="group flex flex-col rounded-lg border border-[var(--aura-border)] bg-[var(--aura-surface)] overflow-hidden transition-transform duration-200 hover:-translate-y-0.5">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[var(--aura-surface-muted)]">
        <button
          type="button"
          onClick={() => navigate({ view: 'product', productId: product.id })}
          className="block h-full w-full cursor-pointer text-left overflow-hidden"
          aria-label={`View ${product.name}`}
        >
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
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        </button>

        <button
          type="button"
          onClick={() => void toggleWishlist(product.id)}
          aria-label={isWishlisted ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
          title={isWishlisted ? 'Remove from Wishlist' : 'Add to Wishlist'}
          className="absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-md bg-[var(--aura-surface)]/90 text-[var(--aura-text)] border border-[var(--aura-border)] hover:bg-[var(--aura-surface)] transition-colors cursor-pointer"
        >
          <Heart
            className={`h-4 w-4 ${isWishlisted ? 'fill-[var(--aura-accent)] text-[var(--aura-accent)]' : ''}`}
          />
        </button>
      </div>

      <div className="flex flex-1 flex-col justify-between p-4 gap-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-xs text-[var(--aura-text-muted)]">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-medium text-[var(--aura-text)] truncate">{product.brand}</span>
              <span aria-hidden="true">·</span>
              <span className="truncate">{product.subcategory || product.category}</span>
            </div>
            <div className="inline-flex items-center gap-1 shrink-0 tabular-nums text-[var(--aura-text)]">
              <Star className="w-3.5 h-3.5 fill-[var(--aura-accent)] text-[var(--aura-accent)]" />
              <span className="font-medium">{product.rating.toFixed(1)}</span>
              {product.reviewCount ? (
                <span className="text-[var(--aura-text-muted)]">({product.reviewCount})</span>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate({ view: 'product', productId: product.id })}
            className="block text-left font-semibold text-base text-[var(--aura-text)] hover:text-[var(--aura-accent)] transition-colors cursor-pointer line-clamp-1"
          >
            {product.name}
          </button>

          <p className="text-xs leading-relaxed text-[var(--aura-text-muted)] line-clamp-2">
            {reasonLine || product.description}
          </p>
        </div>

        <div className="space-y-3 pt-3 border-t border-[var(--aura-border)]">
          <div className="flex items-baseline justify-between gap-2 tabular-nums">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-[15px] font-semibold text-[var(--aura-text)]">
                {formatINR(product.price)}
              </span>
              {product.compareAtPrice && product.compareAtPrice > product.price && (
                <span className="text-xs line-through text-[var(--aura-text-muted)]">
                  {formatINR(product.compareAtPrice)}
                </span>
              )}
              {discountPct > 0 && (
                <span className="text-xs font-semibold text-[var(--aura-accent)]">
                  {discountPct}% off
                </span>
              )}
            </div>
            <span
              className={`text-xs shrink-0 ${
                isOutOfStock ? 'text-red-500 font-medium' : 'text-[var(--aura-text-muted)]'
              }`}
            >
              {isOutOfStock
                ? 'Out of stock'
                : product.stock <= 5
                  ? `${product.stock} left`
                  : `In stock (${product.stock})`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isOutOfStock}
              onClick={() => void addToCart(product.id, 1)}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                isOutOfStock
                  ? 'bg-[var(--aura-surface-muted)] text-[var(--aura-text-muted)] cursor-not-allowed'
                  : 'bg-[var(--aura-accent)] text-[var(--aura-accent-contrast)] hover:bg-[var(--aura-accent-hover)] cursor-pointer'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>{isOutOfStock ? 'Out of Stock' : 'Add to Cart'}</span>
            </button>

            <button
              type="button"
              onClick={() => navigate({ view: 'product', productId: product.id })}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border border-[var(--aura-border)] text-[var(--aura-text)] hover:bg-[var(--aura-surface-muted)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>View Details</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
