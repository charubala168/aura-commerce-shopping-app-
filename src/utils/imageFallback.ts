import type { SyntheticEvent } from 'react';

export const FALLBACK_PRODUCT_IMAGE = '/images/product-fallback.svg';

export function resolveProductImageSrc(src?: string | null): string {
  if (typeof src !== 'string') return FALLBACK_PRODUCT_IMAGE;
  const trimmed = src.trim();
  return trimmed.length > 0 ? trimmed : FALLBACK_PRODUCT_IMAGE;
}

export function handleProductImageError(event: SyntheticEvent<HTMLImageElement>): void {
  const img = event.currentTarget;
  if (img.dataset.fallbackApplied === 'true') return;
  img.dataset.fallbackApplied = 'true';
  img.src = FALLBACK_PRODUCT_IMAGE;
}
