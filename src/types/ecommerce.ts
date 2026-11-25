export type ThemeMode = 'system' | 'light' | 'dark';
export type AccentPreset = 'bronze' | 'sage' | 'slate' | 'obsidian';

export interface NotificationCategoryPrefs {
  orders: boolean;
  payments: boolean;
  shipping: boolean;
  priceDrops: boolean;
  stockUpdates: boolean;
  promotions: boolean;
  abandonedCart: boolean;
}

export interface UserPreferences {
  userId: string;
  themeMode: ThemeMode;
  accentPreset: AccentPreset;
  highContrast: boolean;
  favoriteCategories: string[];
  notificationCategories: NotificationCategoryPrefs;
  updatedAt: string;
}

export type UserRole = 'customer' | 'admin';

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role?: UserRole;
  phone?: string;
  defaultAddress?: {
    line1: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role?: UserRole;
  phone?: string;
  defaultAddress?: UserRecord['defaultAddress'];
  createdAt: string;
}

export interface ProductVariantOptions {
  sizes: string[];
  colors: string[];
  finishes: string[];
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  brand: string;
  category: string;
  subcategory: string;
  price: number;
  compareAtPrice?: number;
  discountPercentage: number;
  rating: number;
  reviewCount?: number;
  description: string;
  materials: string;
  dimensions: string;
  specifications: Record<string, string>;
  image: string;
  imageFocus?: string;
  imageScale?: number;
  stock: number;
  popularityScore: number;
  featured: boolean;
  variants: ProductVariantOptions;
  isAvailable: boolean;
  updatedAt: string;
}

export interface RecentlyViewedEntry {
  ownerKey: string; // "user:<id>" or "anon:<sessionId>"
  productId: string;
  viewedAt: string;
}

export interface BrowsingHistoryEntry {
  ownerKey: string;
  productId: string;
  viewCount: number;
  lastViewedAt: string;
}

export interface WishlistEntry {
  userId: string;
  productId: string;
  addedPrice: number;
  createdAt: string;
}

export interface SelectedVariant {
  size?: string;
  color?: string;
  finish?: string;
}

export interface CartItemRecord {
  id: string;
  ownerKey: string; // "user:<id>" or "anon:<sessionId>"
  productId: string;
  variant: SelectedVariant;
  variantKey: string;
  quantity: number;
  unitPriceAtAdd: number;
  addedAt: string;
  updatedAt: string;
}

export interface EnrichedCartItem extends CartItemRecord {
  product: Product | null;
  currentPrice: number;
  priceChanged: boolean;
  priceDelta: number;
  availableStock: number;
  isOutOfStock: boolean;
  isUnavailable: boolean;
  lineTotal: number;
}

export interface SavedItemRecord {
  id: string;
  userId: string;
  productId: string;
  variant: SelectedVariant;
  variantKey: string;
  savedPrice: number;
  savedAt: string;
}

export interface EnrichedSavedItem extends SavedItemRecord {
  product: Product | null;
}

export type OrderStatus =
  | 'Confirmed'
  | 'Processing'
  | 'Shipped'
  | 'Delivered'
  | 'Cancelled'
  | 'Return Requested';

export interface OrderItemSnapshot {
  productId: string;
  name: string;
  brand: string;
  category: string;
  image: string;
  variant: SelectedVariant;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface OrderRecord {
  id: string;
  orderNumber: string;
  userId: string;
  items: OrderItemSnapshot[];
  subtotal: number;
  tax: number;
  shippingFee: number;
  total: number;
  status: OrderStatus;
  shippingAddress: {
    fullName: string;
    phone: string;
    line1: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  paymentMethod: 'Card' | 'UPI' | 'COD';
  paymentStatus: 'Paid' | 'Pending' | 'Refunded';
  invoiceNumber: string;
  trackingNumber: string;
  timeline: Array<{ status: string; timestamp: string; note: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentRecord {
  id: string;
  orderId: string;
  userId: string;
  idempotencyKey: string;
  amount: number;
  currency: string;
  method: 'Card' | 'UPI' | 'COD';
  status: 'Succeeded' | 'Pending' | 'Refunded' | 'Failed';
  transactionRef: string;
  webhookVerified: boolean;
  createdAt: string;
}

export interface PaymentAuditLog {
  id: string;
  paymentId: string;
  orderId: string;
  event: string;
  details: string;
  timestamp: string;
}

export type NotificationCategory =
  | 'orders'
  | 'payments'
  | 'shipping'
  | 'priceDrops'
  | 'stockUpdates'
  | 'promotions'
  | 'abandonedCart';

export interface NotificationRecord {
  id: string;
  userId: string;
  category: NotificationCategory;
  title: string;
  body: string;
  productId?: string;
  orderId?: string;
  channel?: 'expo_push' | 'websocket';
  deliveryStatus?: 'Delivered' | 'Skipped (Muted)' | 'Failed';
  read: boolean;
  createdAt: string;
}

export interface DeviceTokenRecord {
  id: string;
  userId: string;
  token: string;
  platform: 'ios' | 'android' | 'web';
  deviceName: string;
  valid: boolean;
  lastActiveAt: string;
  createdAt: string;
}

export interface NotificationDeliveryLog {
  id: string;
  userId: string;
  notificationId: string;
  tokenId: string;
  status: 'delivered' | 'invalid_token_removed' | 'skipped_category';
  detail: string;
  timestamp: string;
}

export interface RecommendationItem {
  product: Product;
  score: number;
  reason: string;
}

export interface ProductReview {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  rating: number;
  title: string;
  comment: string;
  verifiedPurchase: boolean;
  createdAt: string;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  orderNumber?: string;
  message: string;
  userId?: string;
  status: 'New' | 'Reviewed';
  createdAt: string;
}
