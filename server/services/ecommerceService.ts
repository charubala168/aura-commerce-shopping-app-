import crypto from 'crypto';
import type { Server as SocketIOServer } from 'socket.io';
import { db, type DatabaseSchema } from '../db.ts';
import type {
  CartItemRecord,
  EnrichedCartItem,
  NotificationCategory,
  NotificationRecord,
  Product,
  RecommendationItem,
  SelectedVariant,
  UserPreferences,
} from '../../src/types/ecommerce.ts';

let ioRef: SocketIOServer | null = null;

export function setSocketServer(io: SocketIOServer) {
  ioRef = io;
}

export function emitToOwner(ownerKey: string, event: string, payload: unknown) {
  if (!ioRef) return;
  ioRef.to(ownerKey).emit(event, payload);
}

export function emitGlobal(event: string, payload: unknown) {
  if (!ioRef) return;
  ioRef.emit(event, payload);
}

export function getOrCreatePreferences(state: DatabaseSchema, userId: string): UserPreferences {
  let pref = state.userPreferences.find((p) => p.userId === userId);
  if (!pref) {
    pref = {
      userId,
      themeMode: 'system',
      accentPreset: 'bronze',
      highContrast: false,
      favoriteCategories: [],
      notificationCategories: {
        orders: true,
        payments: true,
        shipping: true,
        priceDrops: true,
        stockUpdates: true,
        promotions: true,
        abandonedCart: true,
      },
      updatedAt: new Date().toISOString(),
    };
    state.userPreferences.push(pref);
  }
  return pref;
}

export function buildVariantKey(variant?: SelectedVariant): string {
  const s = (variant?.size || '').trim().toLowerCase();
  const c = (variant?.color || '').trim().toLowerCase();
  const f = (variant?.finish || '').trim().toLowerCase();
  return `${s}|${c}|${f}`;
}

export function enrichCartItems(state: DatabaseSchema, ownerKey: string): EnrichedCartItem[] {
  const items = state.carts.filter((c) => c.ownerKey === ownerKey);
  return items.map((item) => {
    const product = state.products.find((p) => p.id === item.productId) || null;
    if (!product || !product.isAvailable) {
      return {
        ...item,
        product,
        currentPrice: item.unitPriceAtAdd,
        priceChanged: false,
        priceDelta: 0,
        availableStock: 0,
        isOutOfStock: true,
        isUnavailable: true,
        lineTotal: 0,
      };
    }
    const priceChanged = Math.abs(product.price - item.unitPriceAtAdd) > 0.001;
    const priceDelta = Number((product.price - item.unitPriceAtAdd).toFixed(2));
    const isOutOfStock = product.stock <= 0;
    const effectiveQty = Math.min(item.quantity, Math.max(0, product.stock));
    return {
      ...item,
      product,
      currentPrice: product.price,
      priceChanged,
      priceDelta,
      availableStock: product.stock,
      isOutOfStock,
      isUnavailable: false,
      lineTotal: Number((product.price * effectiveQty).toFixed(2)),
    };
  });
}

function isValidPushTokenFormat(token: string): boolean {
  return (
    /^ExponentPushToken\[[a-zA-Z0-9_-]+\]$/.test(token) ||
    /^ExpoPushToken\[[a-zA-Z0-9_-]+\]$/.test(token) ||
    /^WebPushToken\[[a-zA-Z0-9_-]+\]$/.test(token)
  );
}

async function sendExpoPushAsync(
  tokens: Array<{ id: string; userId: string; token: string; deviceName: string }>,
  title: string,
  body: string,
  notificationId: string
) {
  const expoTokens = tokens.filter(
    (t) => t.token.startsWith('ExponentPushToken[') || t.token.startsWith('ExpoPushToken[')
  );
  if (expoTokens.length === 0) return;

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(
        expoTokens.map((t) => ({
          to: t.token,
          sound: 'default',
          title,
          body,
          data: { notificationId },
        }))
      ),
    });
    if (!response.ok) return;
    const json = (await response.json().catch(() => null)) as {
      data?: Array<{ status?: string; details?: { error?: string } }>;
    } | null;
    if (!json || !Array.isArray(json.data)) return;

    const invalidIds: Array<{ id: string; userId: string; deviceName: string }> = [];
    json.data.forEach((ticket, idx) => {
      if (ticket?.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
        const target = expoTokens[idx];
        if (target) invalidIds.push(target);
      }
    });

    if (invalidIds.length > 0) {
      await db.runTransaction((state) => {
        const dropSet = new Set(invalidIds.map((x) => x.id));
        state.deviceTokens = state.deviceTokens.filter((dt) => !dropSet.has(dt.id));
        const now = new Date().toISOString();
        for (const item of invalidIds) {
          state.notificationDeliveryLogs.unshift({
            id: `ndlog-${crypto.randomUUID()}`,
            userId: item.userId,
            notificationId,
            tokenId: item.id,
            status: 'invalid_token_removed',
            detail: `Removed unregistered Expo token (${item.deviceName})`,
            timestamp: now,
          });
        }
      });
    }
  } catch {
    // Non-blocking best-effort Expo relay
  }
}

export function dispatchUserNotification(
  state: DatabaseSchema,
  params: {
    userId: string;
    category: NotificationCategory;
    title: string;
    body: string;
    productId?: string;
    orderId?: string;
  }
): NotificationRecord | null {
  const prefs = getOrCreatePreferences(state, params.userId);
  const now = new Date().toISOString();
  const notification: NotificationRecord = {
    id: `notif-${crypto.randomUUID()}`,
    userId: params.userId,
    category: params.category,
    title: params.title,
    body: params.body,
    productId: params.productId,
    orderId: params.orderId,
    read: false,
    createdAt: now,
  };

  if (!prefs.notificationCategories[params.category]) {
    state.notificationDeliveryLogs.unshift({
      id: `ndlog-${crypto.randomUUID()}`,
      userId: params.userId,
      notificationId: notification.id,
      tokenId: 'none',
      status: 'skipped_category',
      detail: `Skipped ${params.category} notification per user preferences`,
      timestamp: now,
    });
    state.notificationDeliveryLogs = state.notificationDeliveryLogs.slice(0, 100);
    return null;
  }

  const userTokens = state.deviceTokens.filter((t) => t.userId === params.userId);
  const validTokenIdsToKeep = new Set<string>();
  const validExpoTargets: Array<{ id: string; userId: string; token: string; deviceName: string }> =
    [];

  for (const dt of userTokens) {
    const looksValid = dt.valid && isValidPushTokenFormat(dt.token);
    if (!looksValid) {
      state.notificationDeliveryLogs.unshift({
        id: `ndlog-${crypto.randomUUID()}`,
        userId: params.userId,
        notificationId: notification.id,
        tokenId: dt.id,
        status: 'invalid_token_removed',
        detail: `Removed invalid push token (${dt.deviceName})`,
        timestamp: now,
      });
    } else {
      validTokenIdsToKeep.add(dt.id);
      validExpoTargets.push({
        id: dt.id,
        userId: dt.userId,
        token: dt.token,
        deviceName: dt.deviceName,
      });
      state.notificationDeliveryLogs.unshift({
        id: `ndlog-${crypto.randomUUID()}`,
        userId: params.userId,
        notificationId: notification.id,
        tokenId: dt.id,
        status: 'delivered',
        detail: `Delivered to ${dt.deviceName} (${dt.platform})`,
        timestamp: now,
      });
    }
  }

  const hasExpoToken = validExpoTargets.some(
    (t) => t.token.startsWith('ExponentPushToken[') || t.token.startsWith('ExpoPushToken[')
  );
  notification.channel = hasExpoToken ? 'expo_push' : 'websocket';
  notification.deliveryStatus = 'Delivered';

  state.notifications.unshift(notification);
  state.notifications = state.notifications.slice(0, 200);

  if (validExpoTargets.length === 0) {
    state.notificationDeliveryLogs.unshift({
      id: `ndlog-${crypto.randomUUID()}`,
      userId: params.userId,
      notificationId: notification.id,
      tokenId: 'websocket',
      status: 'delivered',
      detail: `Delivered over real-time WebSocket stream (${params.category})`,
      timestamp: now,
    });
  }

  // Remove invalid tokens for this user
  state.deviceTokens = state.deviceTokens.filter(
    (t) => t.userId !== params.userId || validTokenIdsToKeep.has(t.id)
  );
  state.notificationDeliveryLogs = state.notificationDeliveryLogs.slice(0, 100);

  emitToOwner(`user:${params.userId}`, 'notification:new', notification);
  if (validExpoTargets.length > 0) {
    void sendExpoPushAsync(validExpoTargets, notification.title, notification.body, notification.id);
  }
  return notification;
}

let schedulerStarted = false;
export function startAbandonedCartScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;
  const IDLE_MS = 15 * 60 * 1000;
  const COOLDOWN_MS = 6 * 60 * 60 * 1000;

  setInterval(() => {
    const nowMs = Date.now();
    const state = db.read();
    const userLatestCart = new Map<string, { latestMs: number; totalQty: number }>();

    for (const c of state.carts) {
      if (!c.ownerKey.startsWith('user:')) continue;
      const userId = c.ownerKey.slice(5);
      const updatedMs = Date.parse(c.updatedAt || c.addedAt);
      const prev = userLatestCart.get(userId);
      if (!prev) {
        userLatestCart.set(userId, { latestMs: updatedMs, totalQty: c.quantity });
      } else {
        userLatestCart.set(userId, {
          latestMs: Math.max(prev.latestMs, updatedMs),
          totalQty: prev.totalQty + c.quantity,
        });
      }
    }

    const candidates: Array<{ userId: string; totalQty: number }> = [];
    for (const [userId, info] of userLatestCart.entries()) {
      if (nowMs - info.latestMs < IDLE_MS) continue;
      const recentReminder = state.notifications.some(
        (n) =>
          n.userId === userId &&
          n.category === 'abandonedCart' &&
          nowMs - Date.parse(n.createdAt) < COOLDOWN_MS
      );
      if (!recentReminder) {
        candidates.push({ userId, totalQty: info.totalQty });
      }
    }

    if (candidates.length > 0) {
      void db.runTransaction((txState) => {
        for (const item of candidates) {
          dispatchUserNotification(txState, {
            userId: item.userId,
            category: 'abandonedCart',
            title: 'Items waiting in your Aura bag',
            body: `You still have ${item.totalQty} item${item.totalQty === 1 ? '' : 's'} saved in your bag. Complete checkout before stock runs out.`,
          });
        }
      });
    }
  }, 60 * 1000);
}

export function recordProductViewInState(
  state: DatabaseSchema,
  ownerKey: string,
  productId: string
) {
  const now = new Date().toISOString();

  // 1. Recently Viewed: latest 20 unique products, remove older automatically
  const otherRecent = state.recentlyViewed.filter((r) => r.ownerKey !== ownerKey);
  const ownerRecent = state.recentlyViewed
    .filter((r) => r.ownerKey === ownerKey && r.productId !== productId)
    .sort((a, b) => b.viewedAt.localeCompare(a.viewedAt));
  const updatedRecent = [{ ownerKey, productId, viewedAt: now }, ...ownerRecent].slice(0, 20);
  state.recentlyViewed = [...updatedRecent, ...otherRecent];

  // 2. Browsing History (Recommendations): latest 50 unique products
  const otherHistory = state.browsingHistory.filter((h) => h.ownerKey !== ownerKey);
  const ownerHistory = state.browsingHistory.filter((h) => h.ownerKey === ownerKey);
  const existing = ownerHistory.find((h) => h.productId === productId);
  const withoutExisting = ownerHistory.filter((h) => h.productId !== productId);
  const updatedEntry = {
    ownerKey,
    productId,
    viewCount: (existing?.viewCount || 0) + 1,
    lastViewedAt: now,
  };
  const updatedHistory = [updatedEntry, ...withoutExisting]
    .sort((a, b) => b.lastViewedAt.localeCompare(a.lastViewedAt))
    .slice(0, 50);
  state.browsingHistory = [...updatedHistory, ...otherHistory];
}

export function mergeAnonymousSessionInState(
  state: DatabaseSchema,
  userId: string,
  anonymousSessionId?: string
) {
  if (!anonymousSessionId) return;
  const anonKey = `anon:${anonymousSessionId}`;
  const userKey = `user:${userId}`;

  // Merge Recently Viewed (keep latest 20 unique)
  const anonRecent = state.recentlyViewed.filter((r) => r.ownerKey === anonKey);
  const userRecent = state.recentlyViewed.filter((r) => r.ownerKey === userKey);
  const mergedRecentMap = new Map<string, string>();
  for (const r of [...userRecent, ...anonRecent]) {
    const prev = mergedRecentMap.get(r.productId);
    if (!prev || r.viewedAt > prev) {
      mergedRecentMap.set(r.productId, r.viewedAt);
    }
  }
  const finalRecent = Array.from(mergedRecentMap.entries())
    .map(([productId, viewedAt]) => ({ ownerKey: userKey, productId, viewedAt }))
    .sort((a, b) => b.viewedAt.localeCompare(a.viewedAt))
    .slice(0, 20);
  state.recentlyViewed = [
    ...state.recentlyViewed.filter((r) => r.ownerKey !== anonKey && r.ownerKey !== userKey),
    ...finalRecent,
  ];

  // Merge Browsing History (keep latest 50 unique)
  const anonHist = state.browsingHistory.filter((h) => h.ownerKey === anonKey);
  const userHist = state.browsingHistory.filter((h) => h.ownerKey === userKey);
  const mergedHistMap = new Map<string, { viewCount: number; lastViewedAt: string }>();
  for (const h of [...userHist, ...anonHist]) {
    const prev = mergedHistMap.get(h.productId);
    if (!prev) {
      mergedHistMap.set(h.productId, { viewCount: h.viewCount, lastViewedAt: h.lastViewedAt });
    } else {
      mergedHistMap.set(h.productId, {
        viewCount: prev.viewCount + h.viewCount,
        lastViewedAt: h.lastViewedAt > prev.lastViewedAt ? h.lastViewedAt : prev.lastViewedAt,
      });
    }
  }
  const finalHist = Array.from(mergedHistMap.entries())
    .map(([productId, data]) => ({
      ownerKey: userKey,
      productId,
      viewCount: data.viewCount,
      lastViewedAt: data.lastViewedAt,
    }))
    .sort((a, b) => b.lastViewedAt.localeCompare(a.lastViewedAt))
    .slice(0, 50);
  state.browsingHistory = [
    ...state.browsingHistory.filter((h) => h.ownerKey !== anonKey && h.ownerKey !== userKey),
    ...finalHist,
  ];

  // Merge Anonymous Cart into User Cart preserving variants and avoiding duplicates
  const anonCart = state.carts.filter((c) => c.ownerKey === anonKey);
  for (const ac of anonCart) {
    const product = state.products.find((p) => p.id === ac.productId);
    const maxStock = product ? product.stock : ac.quantity;
    const existing = state.carts.find(
      (c) =>
        c.ownerKey === userKey &&
        c.productId === ac.productId &&
        c.variantKey === ac.variantKey
    );
    if (existing) {
      existing.quantity = Math.min(maxStock || existing.quantity, existing.quantity + ac.quantity);
      existing.updatedAt = new Date().toISOString();
    } else {
      const migrated: CartItemRecord = {
        ...ac,
        ownerKey: userKey,
        updatedAt: new Date().toISOString(),
      };
      state.carts.push(migrated);
    }
  }
  state.carts = state.carts.filter((c) => c.ownerKey !== anonKey);
}

export function generatePersonalizedRecommendations(
  state: DatabaseSchema,
  ownerKey?: string,
  userId?: string,
  limit = 6
): RecommendationItem[] {
  const purchasedProductIds = new Set<string>();
  const purchasedCategories = new Map<string, number>();

  if (userId) {
    const recentOrders = state.orders
      .filter((o) => o.userId === userId && o.status !== 'Cancelled')
      .slice(0, 10);
    for (const order of recentOrders) {
      for (const item of order.items) {
        purchasedProductIds.add(item.productId);
        purchasedCategories.set(
          item.category,
          (purchasedCategories.get(item.category) || 0) + 1
        );
      }
    }
  }

  const wishlistIds = new Set<string>();
  const wishlistCategories = new Map<string, number>();
  if (userId) {
    for (const w of state.wishlists.filter((x) => x.userId === userId)) {
      wishlistIds.add(w.productId);
      const prod = db.productById.get(w.productId);
      if (prod) {
        wishlistCategories.set(prod.category, (wishlistCategories.get(prod.category) || 0) + 1);
      }
    }
  }

  const historyCategories = new Map<string, number>();
  const viewedIds = new Set<string>();
  if (ownerKey) {
    const history = state.browsingHistory
      .filter((h) => h.ownerKey === ownerKey)
      .slice(0, 50);
    for (const h of history) {
      viewedIds.add(h.productId);
      const prod = db.productById.get(h.productId);
      if (prod) {
        historyCategories.set(
          prod.category,
          (historyCategories.get(prod.category) || 0) + h.viewCount
        );
      }
    }
  }

  const favCategories = new Set<string>(
    userId ? getOrCreatePreferences(state, userId).favoriteCategories : []
  );

  // Exclude recently purchased and out-of-stock/unavailable products
  const eligible = state.products.filter(
    (p) => p.isAvailable && p.stock > 0 && !purchasedProductIds.has(p.id)
  );

  const hasPersonalSignals =
    historyCategories.size > 0 ||
    wishlistCategories.size > 0 ||
    purchasedCategories.size > 0 ||
    favCategories.size > 0;

  const scored: RecommendationItem[] = eligible.map((product: Product) => {
    let score = product.popularityScore * 0.4;
    let reason = 'Popular across Aura Commerce';

    const reasons: Array<{ weight: number; label: string }> = [];

    if (favCategories.has(product.category)) {
      score += 35;
      reasons.push({ weight: 35, label: `Matches your favorite category: ${product.category}` });
    }
    const histWeight = (historyCategories.get(product.category) || 0) * 14;
    if (histWeight > 0) {
      score += Math.min(histWeight, 45);
      reasons.push({
        weight: histWeight,
        label: `Based on your browsing in ${product.category}`,
      });
    }
    const wishWeight = (wishlistCategories.get(product.category) || 0) * 24;
    if (wishWeight > 0) {
      score += wishWeight;
      reasons.push({
        weight: wishWeight,
        label: `Pairs with your ${product.category} wishlist items`,
      });
    }
    const purchWeight = (purchasedCategories.get(product.category) || 0) * 22;
    if (purchWeight > 0) {
      score += purchWeight;
      reasons.push({
        weight: purchWeight,
        label: `Complements your recent ${product.category} order`,
      });
    }
    if (wishlistIds.has(product.id)) {
      score += 18;
      reasons.push({ weight: 18, label: 'Saved in your wishlist' });
    }
    if (viewedIds.has(product.id)) {
      score += 10;
    }

    if (hasPersonalSignals && reasons.length > 0) {
      reasons.sort((a, b) => b.weight - a.weight);
      reason = reasons[0].label;
    } else if (product.featured) {
      reason = 'Trending editorial selection';
    }

    return {
      product,
      score: Math.round(score),
      reason,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}
