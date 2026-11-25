import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import { resolveDataDir } from '../catalogSeed.ts';
import { db } from '../db.ts';
import {
  hashPassword,
  optionalAuth,
  requireAuth,
  signAuthToken,
  toPublicUser,
  verifyPassword,
  type AuthedRequest,
} from '../middleware/auth.ts';
import {
  dispatchUserNotification,
  emitGlobal,
  emitToOwner,
  generatePersonalizedRecommendations,
  getOrCreatePreferences,
  mergeAnonymousSessionInState,
  recordProductViewInState,
} from '../services/ecommerceService.ts';
import type { AccentPreset, ThemeMode } from '../../src/types/ecommerce.ts';

export const coreRouter = Router();

// ---------- AUTHENTICATION ----------
coreRouter.post('/auth/register', async (req: AuthedRequest, res) => {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (name.length < 2) {
      res.status(400).json({ success: false, error: 'Name must be at least 2 characters' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ success: false, error: 'Valid email address is required' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
      return;
    }

    const result = await db.runTransaction((state) => {
      if (state.users.some((u) => u.email.toLowerCase() === email)) {
        throw new Error('EMAIL_EXISTS');
      }
      const now = new Date().toISOString();
      const user = {
        id: `usr-${crypto.randomUUID()}`,
        name,
        email,
        passwordHash: hashPassword(password),
        createdAt: now,
        updatedAt: now,
      };
      state.users.push(user);
      const prefs = getOrCreatePreferences(state, user.id);
      const allowedThemes: ThemeMode[] = ['system', 'light', 'dark'];
      const allowedAccents: AccentPreset[] = ['bronze', 'sage', 'slate', 'obsidian'];
      if (allowedThemes.includes(req.body?.themeMode)) {
        prefs.themeMode = req.body.themeMode;
      }
      if (allowedAccents.includes(req.body?.accentPreset)) {
        prefs.accentPreset = req.body.accentPreset;
      }
      if (typeof req.body?.highContrast === 'boolean') {
        prefs.highContrast = req.body.highContrast;
      }

      const anonId =
        typeof req.headers['x-session-id'] === 'string' ? req.headers['x-session-id'] : undefined;
      mergeAnonymousSessionInState(state, user.id, anonId);

      dispatchUserNotification(state, {
        userId: user.id,
        category: 'promotions',
        title: 'Welcome to Aura Commerce',
        body: 'Your account is active. Recently viewed items and cart selections sync automatically across devices.',
      });

      return { user, prefs };
    });

    const token = signAuthToken(result.user);
    res.status(201).json({
      success: true,
      data: {
        token,
        user: toPublicUser(result.user),
        preferences: result.prefs,
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'EMAIL_EXISTS') {
      res.status(409).json({ success: false, error: 'An account with this email already exists' });
      return;
    }
    res.status(500).json({ success: false, error: 'Registration failed' });
  }
});

coreRouter.post('/auth/login', async (req: AuthedRequest, res) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    const user = db.userByEmail.get(email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ success: false, error: 'Invalid email or password' });
      return;
    }

    const anonId =
      typeof req.headers['x-session-id'] === 'string' ? req.headers['x-session-id'] : undefined;

    const prefs = await db.runTransaction((state) => {
      mergeAnonymousSessionInState(state, user.id, anonId);
      return getOrCreatePreferences(state, user.id);
    });

    const token = signAuthToken(user);
    emitToOwner(`user:${user.id}`, 'cart:updated', { merged: true });
    emitToOwner(`user:${user.id}`, 'recentlyViewed:updated', { merged: true });

    res.json({
      success: true,
      data: {
        token,
        user: toPublicUser(user),
        preferences: prefs,
      },
    });
  } catch {
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

coreRouter.post('/auth/logout', requireAuth, (_req, res) => {
  res.json({ success: true, data: { loggedOut: true } });
});

coreRouter.post('/auth/demo-switch', async (req: AuthedRequest, res) => {
  try {
    const targetEmail =
      req.body?.email === 'maya@auracommerce.in'
        ? 'maya@auracommerce.in'
        : 'aarav@auracommerce.in';
    const anonId =
      typeof req.headers['x-session-id'] === 'string' ? req.headers['x-session-id'] : undefined;

    const result = await db.runTransaction((state) => {
      const demoProfiles = {
        'aarav@auracommerce.in': {
          name: 'Aarav Sharma',
          email: 'aarav@auracommerce.in',
          phone: '+91 98450 22190',
          defaultAddress: {
            line1: '42 Indiranagar 100ft Road',
            city: 'Bengaluru',
            state: 'Karnataka',
            postalCode: '560038',
            country: 'India',
          },
        },
        'maya@auracommerce.in': {
          name: 'Maya Nair',
          email: 'maya@auracommerce.in',
          phone: '+91 98201 44510',
          defaultAddress: {
            line1: '18 Pali Hill Terrace, Bandra West',
            city: 'Mumbai',
            state: 'Maharashtra',
            postalCode: '400050',
            country: 'India',
          },
        },
      } as const;

      const chosen = demoProfiles[targetEmail];
      const now = new Date().toISOString();
      let user = state.users.find((u) => u.email.toLowerCase() === chosen.email);
      if (!user) {
        user = {
          id: `usr-demo-${targetEmail.startsWith('aarav') ? 'aarav' : 'maya'}`,
          name: chosen.name,
          email: chosen.email,
          passwordHash: hashPassword('AuraDemo2026!'),
          role: 'customer',
          phone: chosen.phone,
          defaultAddress: chosen.defaultAddress,
          createdAt: now,
          updatedAt: now,
        };
        state.users.push(user);
      }

      const prefs = getOrCreatePreferences(state, user.id);
      if (state.deviceTokens.filter((t) => t.userId === user!.id).length === 0) {
        state.deviceTokens.unshift({
          id: `dtok-${crypto.randomUUID()}`,
          userId: user.id,
          token: `ExponentPushToken[AuraExpo_${user.id.slice(-5)}]`,
          platform: 'ios',
          deviceName: `${user.name.split(' ')[0]}'s iPhone (Expo)`,
          valid: true,
          lastActiveAt: now,
          createdAt: now,
        });
      }

      // Seed initial sample orders & notifications for demo account if empty (uses existing 65 products untouched)
      const userOrders = state.orders.filter((o) => o.userId === user!.id);
      if (userOrders.length === 0 && state.products.length >= 6) {
        const p1 = state.products[48] || state.products[0];
        const p2 = state.products[3] || state.products[1];
        const p3 = state.products[13] || state.products[2];
        const order1Id = `ord-demo-${user.id}-1`;
        const order2Id = `ord-demo-${user.id}-2`;
        const pay1Id = `pay-demo-${user.id}-1`;
        const pay2Id = `pay-demo-${user.id}-2`;
        const ord1Sub = p1.price + p2.price;
        const ord1Tax = Number((ord1Sub * 0.08).toFixed(2));
        const ord1Total = Number((ord1Sub + ord1Tax).toFixed(2));
        const ord2Sub = p3.price;
        const ord2Tax = Number((ord2Sub * 0.08).toFixed(2));
        const ord2Total = Number((ord2Sub + ord2Tax).toFixed(2));

        const t1 = new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString();
        const t2 = new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString();

        state.orders.unshift(
          {
            id: order1Id,
            orderNumber: 'ORD-2026-1048',
            userId: user.id,
            items: [
              {
                productId: p1.id,
                name: p1.name,
                brand: p1.brand,
                category: p1.category,
                image: p1.image,
                variant: { size: p1.variants.sizes[0], color: p1.variants.colors[0] },
                quantity: 1,
                unitPrice: p1.price,
                lineTotal: p1.price,
              },
              {
                productId: p2.id,
                name: p2.name,
                brand: p2.brand,
                category: p2.category,
                image: p2.image,
                variant: { size: p2.variants.sizes[0], color: p2.variants.colors[0] },
                quantity: 1,
                unitPrice: p2.price,
                lineTotal: p2.price,
              },
            ],
            subtotal: ord1Sub,
            tax: ord1Tax,
            shippingFee: 0,
            total: ord1Total,
            status: 'Shipped',
            shippingAddress: {
              fullName: chosen.name,
              phone: chosen.phone,
              ...chosen.defaultAddress,
            },
            paymentMethod: 'Card',
            paymentStatus: 'Paid',
            invoiceNumber: 'INV-2026-1048',
            trackingNumber: 'TRK88412048',
            timeline: [
              { status: 'Confirmed', timestamp: t1, note: 'Order received and inventory reserved' },
              { status: 'Processing', timestamp: t1, note: 'Quality inspection & studio packaging' },
              { status: 'Shipped', timestamp: now, note: `In transit to ${chosen.defaultAddress.city}` },
            ],
            createdAt: t1,
            updatedAt: now,
          },
          {
            id: order2Id,
            orderNumber: 'ORD-2026-1039',
            userId: user.id,
            items: [
              {
                productId: p3.id,
                name: p3.name,
                brand: p3.brand,
                category: p3.category,
                image: p3.image,
                variant: { size: p3.variants.sizes[0], color: p3.variants.colors[0] },
                quantity: 1,
                unitPrice: p3.price,
                lineTotal: p3.price,
              },
            ],
            subtotal: ord2Sub,
            tax: ord2Tax,
            shippingFee: 0,
            total: ord2Total,
            status: 'Delivered',
            shippingAddress: {
              fullName: chosen.name,
              phone: chosen.phone,
              ...chosen.defaultAddress,
            },
            paymentMethod: 'UPI',
            paymentStatus: 'Paid',
            invoiceNumber: 'INV-2026-1039',
            trackingNumber: 'TRK77109211',
            timeline: [
              { status: 'Confirmed', timestamp: t2, note: 'Order confirmed via Instant UPI' },
              { status: 'Shipped', timestamp: t2, note: 'Dispatched via Aura Express' },
              { status: 'Delivered', timestamp: t1, note: 'Delivered and signed at destination' },
            ],
            createdAt: t2,
            updatedAt: t1,
          }
        );

        state.payments.unshift(
          {
            id: pay1Id,
            orderId: order1Id,
            userId: user.id,
            idempotencyKey: `idem-demo-${user.id}-1`,
            amount: ord1Total,
            currency: 'INR',
            method: 'Card',
            status: 'Succeeded',
            transactionRef: 'TXN_CC_77412048',
            webhookVerified: true,
            createdAt: t1,
          },
          {
            id: pay2Id,
            orderId: order2Id,
            userId: user.id,
            idempotencyKey: `idem-demo-${user.id}-2`,
            amount: ord2Total,
            currency: 'INR',
            method: 'UPI',
            status: 'Succeeded',
            transactionRef: 'TXN_UPI_99210482',
            webhookVerified: true,
            createdAt: t2,
          }
        );

        state.paymentAuditLogs.unshift(
          {
            id: `pal-demo-${crypto.randomUUID()}`,
            paymentId: pay1Id,
            orderId: order1Id,
            event: 'webhook.payment_verified',
            details: `Webhook confirmed Card payment TXN_CC_77412048 for ORD-2026-1048`,
            timestamp: t1,
          },
          {
            id: `pal-demo-${crypto.randomUUID()}`,
            paymentId: pay2Id,
            orderId: order2Id,
            event: 'webhook.upi_settled',
            details: `Instant UPI payment TXN_UPI_99210482 verified via HMAC-SHA256`,
            timestamp: t2,
          }
        );
      }

      if (state.notifications.filter((n) => n.userId === user!.id).length === 0) {
        const promoProd = state.products[13] || state.products[0];
        state.notifications.unshift(
          {
            id: `notif-${crypto.randomUUID()}`,
            userId: user.id,
            category: 'priceDrops',
            title: `Price Drop Alert: ${promoProd.name}`,
            body: `Now ₹${promoProd.price.toLocaleString('en-IN')} (save on your curated pick). Grab yours before stock runs low.`,
            productId: promoProd.id,
            channel: 'expo_push',
            deliveryStatus: 'Delivered',
            read: false,
            createdAt: now,
          },
          {
            id: `notif-${crypto.randomUUID()}`,
            userId: user.id,
            category: 'shipping',
            title: 'Order ORD-2026-1048 Shipped',
            body: `Your courier shipment is in transit to ${chosen.defaultAddress.city}.`,
            channel: 'expo_push',
            deliveryStatus: 'Delivered',
            read: false,
            createdAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
          },
          {
            id: `notif-${crypto.randomUUID()}`,
            userId: user.id,
            category: 'payments',
            title: 'Payment Verified · ORD-2026-1048',
            body: 'Webhook confirmed Card payment TXN_CC_77412048 for ORD-2026-1048.',
            channel: 'websocket',
            deliveryStatus: 'Delivered',
            read: false,
            createdAt: new Date(Date.now() - 18 * 3600 * 1000).toISOString(),
          }
        );
      }

      mergeAnonymousSessionInState(state, user.id, anonId);
      return { user, prefs };
    });

    const token = signAuthToken(result.user);
    emitToOwner(`user:${result.user.id}`, 'cart:updated', { merged: true });
    emitToOwner(`user:${result.user.id}`, 'recentlyViewed:updated', { merged: true });

    res.json({
      success: true,
      data: {
        token,
        user: toPublicUser(result.user),
        preferences: result.prefs,
      },
    });
  } catch {
    res.status(500).json({ success: false, error: 'Could not switch demo account' });
  }
});

coreRouter.get('/auth/me', requireAuth, (req: AuthedRequest, res) => {
  const user = req.user!;
  const prefs = getOrCreatePreferences(db.read(), user.id);
  res.json({
    success: true,
    data: {
      user: toPublicUser(user),
      preferences: prefs,
    },
  });
});

coreRouter.patch('/auth/profile', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.user!.id;
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : undefined;
    const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : undefined;
    const defaultAddress = req.body?.defaultAddress;

    const updated = await db.runTransaction((state) => {
      const user = state.users.find((u) => u.id === userId);
      if (!user) throw new Error('NOT_FOUND');
      if (name && name.length >= 2) user.name = name;
      if (phone !== undefined) user.phone = phone;
      if (defaultAddress && typeof defaultAddress === 'object') {
        user.defaultAddress = {
          line1: String(defaultAddress.line1 || '').slice(0, 120),
          city: String(defaultAddress.city || '').slice(0, 60),
          state: String(defaultAddress.state || '').slice(0, 60),
          postalCode: String(defaultAddress.postalCode || '').slice(0, 20),
          country: String(defaultAddress.country || 'United States').slice(0, 60),
        };
      }
      user.updatedAt = new Date().toISOString();
      return user;
    });

    res.json({ success: true, data: { user: toPublicUser(updated) } });
  } catch {
    res.status(500).json({ success: false, error: 'Could not update profile' });
  }
});

// ---------- PRODUCTS ----------
coreRouter.get('/products/export', (_req, res) => {
  try {
    const filePath = path.join(resolveDataDir(), 'smartcart-products.json');
    const raw = fs.readFileSync(filePath, 'utf-8');
    const products = JSON.parse(raw);
    res.json({
      success: true,
      data: {
        total: Array.isArray(products) ? products.length : 0,
        products,
      },
    });
  } catch {
    res.status(500).json({ success: false, error: 'Could not read SmartCart catalog JSON' });
  }
});

coreRouter.get('/products', (req, res) => {
  const state = db.read();
  const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
  const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
  const subcategory = typeof req.query.subcategory === 'string' ? req.query.subcategory.trim() : '';
  const sort = typeof req.query.sort === 'string' ? req.query.sort : 'featured';
  const inStockOnly = req.query.inStock === 'true';

  let list = state.products.filter((p) => p.isAvailable);
  if (category && category !== 'All') {
    list = list.filter((p) => p.category === category);
  }
  if (subcategory && subcategory !== 'All') {
    list = list.filter((p) => p.subcategory === subcategory);
  }
  if (inStockOnly) {
    list = list.filter((p) => p.stock > 0);
  }
  if (q) {
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.subcategory || '').toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
    );
  }

  const sorted = [...list];
  if (sort === 'price_asc') sorted.sort((a, b) => a.price - b.price);
  else if (sort === 'price_desc') sorted.sort((a, b) => b.price - a.price);
  else if (sort === 'rating_desc') sorted.sort((a, b) => b.rating - a.rating || b.popularityScore - a.popularityScore);
  else if (sort === 'popular') sorted.sort((a, b) => b.popularityScore - a.popularityScore);
  else sorted.sort((a, b) => Number(b.featured) - Number(a.featured) || b.popularityScore - a.popularityScore);

  const categories = Array.from(new Set(state.products.map((p) => p.category)));
  const total = sorted.length;

  const hasPagination = req.query.page !== undefined || req.query.limit !== undefined;
  if (hasPagination) {
    const page = Math.max(1, Number(req.query.page || 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 12) || 12));
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * limit;
    res.json({
      success: true,
      data: {
        products: sorted.slice(start, start + limit),
        categories,
        total,
        page: safePage,
        limit,
        totalPages,
      },
    });
    return;
  }

  res.json({
    success: true,
    data: {
      products: sorted,
      categories,
      total,
    },
  });
});

coreRouter.get('/products/:id', (req, res) => {
  const product = db.read().products.find(
    (p) => p.id === req.params.id || p.slug === req.params.id
  );
  if (!product) {
    res.status(404).json({ success: false, error: 'Product not found' });
    return;
  }
  res.json({ success: true, data: { product } });
});

// Trigger a real price drop to demonstrate live price-drop & smart cart alerts
coreRouter.post('/products/:id/simulate-price-drop', requireAuth, async (req, res) => {
  try {
    const productId = req.params.id;
    const outcome = await db.runTransaction((state) => {
      const product = state.products.find((p) => p.id === productId);
      if (!product) throw new Error('NOT_FOUND');
      const oldPrice = product.price;
      const newPrice = Math.max(25, Math.round(oldPrice * 0.85));
      const baseMrp = product.compareAtPrice && product.compareAtPrice > oldPrice ? product.compareAtPrice : oldPrice;
      product.compareAtPrice = baseMrp;
      product.price = newPrice;
      product.discountPercentage = Math.max(1, Math.round(((baseMrp - newPrice) / baseMrp) * 100));
      product.updatedAt = new Date().toISOString();

      // Notify all users who have this product in wishlist
      const watchers = state.wishlists.filter((w) => w.productId === product.id);
      for (const w of watchers) {
        dispatchUserNotification(state, {
          userId: w.userId,
          category: 'priceDrops',
          title: `Price drop on ${product.name}`,
          body: `Now ₹${newPrice.toLocaleString('en-IN')} (down from ₹${oldPrice.toLocaleString('en-IN')}).`,
          productId: product.id,
        });
      }
      return { product, oldPrice, newPrice, notifiedCount: watchers.length };
    });

    emitGlobal('catalog:updated', { productId: outcome.product.id });
    res.json({ success: true, data: outcome });
  } catch {
    res.status(404).json({ success: false, error: 'Product not found' });
  }
});

// Trigger a real stock restock to demonstrate restock alerts and stock management
coreRouter.post('/products/:id/simulate-restock', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const productId = req.params.id;
    const outcome = await db.runTransaction((state) => {
      const product = state.products.find((p) => p.id === productId);
      if (!product) throw new Error('NOT_FOUND');
      const previousStock = product.stock;
      product.stock = previousStock <= 0 ? 15 : previousStock + 10;
      product.isAvailable = true;
      product.updatedAt = new Date().toISOString();

      const watcherIds = new Set<string>();
      for (const w of state.wishlists) {
        if (w.productId === product.id) watcherIds.add(w.userId);
      }
      for (const s of state.savedItems) {
        if (s.productId === product.id) watcherIds.add(s.userId);
      }
      if (req.user?.id) watcherIds.add(req.user.id);

      for (const uid of watcherIds) {
        dispatchUserNotification(state, {
          userId: uid,
          category: 'stockUpdates',
          title: `${product.name} is back in stock`,
          body: `${product.stock} units are now available to order at ₹${product.price.toLocaleString('en-IN')}.`,
          productId: product.id,
        });
      }
      return { product, previousStock, newStock: product.stock, notifiedCount: watcherIds.size };
    });

    emitGlobal('catalog:updated', { productId: outcome.product.id });
    res.json({ success: true, data: outcome });
  } catch {
    res.status(404).json({ success: false, error: 'Product not found' });
  }
});

// ---------- RECENTLY VIEWED (20 cap + 50 recommendation history + merge + unpurchased Continue Shopping) ----------
coreRouter.get('/recently-viewed', optionalAuth, (req: AuthedRequest, res) => {
  if (!req.ownerKey) {
    res.json({ success: true, data: { items: [], unpurchasedItems: [] } });
    return;
  }
  const state = db.read();
  const entries = state.recentlyViewed
    .filter((r) => r.ownerKey === req.ownerKey)
    .sort((a, b) => b.viewedAt.localeCompare(a.viewedAt))
    .slice(0, 20);

  const purchasedIds = new Set<string>();
  if (req.user?.id) {
    for (const order of state.orders) {
      if (order.userId === req.user.id && order.status !== 'Cancelled') {
        for (const item of order.items) {
          purchasedIds.add(item.productId);
        }
      }
    }
  }

  const allItems = entries
    .map((e) => {
      const product = db.productById.get(e.productId);
      return product ? { product, viewedAt: e.viewedAt } : null;
    })
    .filter((item): item is { product: NonNullable<typeof item>['product']; viewedAt: string } => Boolean(item));

  const unpurchasedItems = allItems.filter((item) => !purchasedIds.has(item.product.id));
  const excludePurchased = req.query.excludePurchased === 'true';

  res.json({
    success: true,
    data: {
      items: excludePurchased ? unpurchasedItems : allItems,
      unpurchasedItems,
    },
  });
});

coreRouter.post('/recently-viewed', optionalAuth, async (req: AuthedRequest, res) => {
  try {
    const productId = typeof req.body?.productId === 'string' ? req.body.productId : '';
    if (!productId || !db.productById.has(productId)) {
      res.status(404).json({ success: false, error: 'Product not found' });
      return;
    }
    if (!req.ownerKey) {
      res.status(400).json({ success: false, error: 'Session identifier missing' });
      return;
    }

    await db.runTransaction((state) => {
      recordProductViewInState(state, req.ownerKey!, productId);
    });

    emitToOwner(req.ownerKey, 'recentlyViewed:updated', { productId });
    res.json({ success: true, data: { recorded: true } });
  } catch {
    res.status(500).json({ success: false, error: 'Could not record view' });
  }
});

coreRouter.delete('/recently-viewed/:productId', optionalAuth, async (req: AuthedRequest, res) => {
  if (!req.ownerKey) {
    res.json({ success: true });
    return;
  }
  await db.runTransaction((state) => {
    state.recentlyViewed = state.recentlyViewed.filter(
      (r) => !(r.ownerKey === req.ownerKey && r.productId === req.params.productId)
    );
  });
  emitToOwner(req.ownerKey, 'recentlyViewed:updated', { cleared: false });
  res.json({ success: true });
});

coreRouter.delete('/recently-viewed', optionalAuth, async (req: AuthedRequest, res) => {
  if (!req.ownerKey) {
    res.json({ success: true });
    return;
  }
  await db.runTransaction((state) => {
    state.recentlyViewed = state.recentlyViewed.filter((r) => r.ownerKey !== req.ownerKey);
  });
  emitToOwner(req.ownerKey, 'recentlyViewed:updated', { cleared: true });
  res.json({ success: true });
});

// ---------- PERSONALIZED RECOMMENDATIONS ----------
coreRouter.get('/recommendations', optionalAuth, (req: AuthedRequest, res) => {
  const limitRaw = Number(req.query.limit || 6);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), 20) : 6;
  const recommendations = generatePersonalizedRecommendations(
    db.read(),
    req.ownerKey,
    req.user?.id,
    limit
  );
  res.json({ success: true, data: { recommendations } });
});

// ---------- WISHLIST ----------
coreRouter.get('/wishlist', requireAuth, (req: AuthedRequest, res) => {
  const state = db.read();
  const entries = state.wishlists
    .filter((w) => w.userId === req.user!.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const items = entries
    .map((entry) => {
      const product = db.productById.get(entry.productId);
      if (!product) return null;
      return {
        ...entry,
        product,
        priceDropAmount: Math.max(0, Number((entry.addedPrice - product.price).toFixed(2))),
      };
    })
    .filter(Boolean);

  res.json({ success: true, data: { items } });
});

coreRouter.post('/wishlist/toggle', requireAuth, async (req: AuthedRequest, res) => {
  const productId = typeof req.body?.productId === 'string' ? req.body.productId : '';
  const product = db.productById.get(productId);
  if (!product) {
    res.status(404).json({ success: false, error: 'Product not found' });
    return;
  }
  const userId = req.user!.id;
  const added = await db.runTransaction((state) => {
    const idx = state.wishlists.findIndex(
      (w) => w.userId === userId && w.productId === productId
    );
    if (idx >= 0) {
      state.wishlists.splice(idx, 1);
      return false;
    }
    state.wishlists.unshift({
      userId,
      productId,
      addedPrice: product.price,
      createdAt: new Date().toISOString(),
    });
    return true;
  });

  emitToOwner(`user:${userId}`, 'wishlist:updated', { productId, added });
  res.json({ success: true, data: { added } });
});

// ---------- THEME & USER PREFERENCES ----------
coreRouter.get('/preferences', requireAuth, (req: AuthedRequest, res) => {
  const prefs = getOrCreatePreferences(db.read(), req.user!.id);
  res.json({ success: true, data: { preferences: prefs } });
});

coreRouter.patch('/preferences', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const allowedThemes: ThemeMode[] = ['system', 'light', 'dark'];
  const allowedAccents: AccentPreset[] = ['bronze', 'sage', 'slate', 'obsidian'];

  const updated = await db.runTransaction((state) => {
    const prefs = getOrCreatePreferences(state, userId);
    if (allowedThemes.includes(req.body?.themeMode)) {
      prefs.themeMode = req.body.themeMode;
    }
    if (allowedAccents.includes(req.body?.accentPreset)) {
      prefs.accentPreset = req.body.accentPreset;
    }
    if (typeof req.body?.highContrast === 'boolean') {
      prefs.highContrast = req.body.highContrast;
    }
    if (Array.isArray(req.body?.favoriteCategories)) {
      prefs.favoriteCategories = req.body.favoriteCategories.filter(
        (c: unknown) => typeof c === 'string'
      );
    }
    if (req.body?.notificationCategories && typeof req.body.notificationCategories === 'object') {
      prefs.notificationCategories = {
        ...prefs.notificationCategories,
        ...req.body.notificationCategories,
      };
    }
    prefs.updatedAt = new Date().toISOString();
    return prefs;
  });

  emitToOwner(`user:${userId}`, 'preferences:updated', updated);
  res.json({ success: true, data: { preferences: updated } });
});
