import crypto from 'crypto';
import { Router } from 'express';
import { db } from '../db.ts';
import {
  hashPassword,
  optionalAuth,
  requireAdmin,
  requireAuth,
  signAuthToken,
  toPublicUser,
  verifyAdminPasscode,
  type AuthedRequest,
} from '../middleware/auth.ts';
import {
  dispatchUserNotification,
  emitGlobal,
  emitToOwner,
  getOrCreatePreferences,
} from '../services/ecommerceService.ts';
import type { OrderStatus, Product } from '../../src/types/ecommerce.ts';

export const adminAndSupportRouter = Router();

function isSafeImageSrc(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 500) return null;
  if (trimmed.startsWith('/')) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return trimmed;
    }
  } catch {
    return null;
  }
  return null;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

// ---------- PRODUCT REVIEWS ----------
adminAndSupportRouter.get('/products/:id/reviews', (req, res) => {
  const product = db.read().products.find(
    (p) => p.id === req.params.id || p.slug === req.params.id
  );
  if (!product) {
    res.status(404).json({ success: false, error: 'Product not found' });
    return;
  }
  const reviews = db
    .read()
    .reviews.filter((r) => r.productId === product.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  res.json({
    success: true,
    data: {
      reviews,
      averageRating: product.rating,
      reviewCount: product.reviewCount || reviews.length,
    },
  });
});

adminAndSupportRouter.post('/products/:id/reviews', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const user = req.user!;
    const ratingRaw = Number(req.body?.rating);
    const title = typeof req.body?.title === 'string' ? req.body.title.trim().slice(0, 100) : '';
    const comment =
      typeof req.body?.comment === 'string' ? req.body.comment.trim().slice(0, 1000) : '';

    if (!Number.isFinite(ratingRaw) || ratingRaw < 1 || ratingRaw > 5) {
      res.status(400).json({ success: false, error: 'Rating must be between 1 and 5' });
      return;
    }
    if (title.length < 2 || comment.length < 5) {
      res
        .status(400)
        .json({ success: false, error: 'Review title and comment (min 5 chars) are required' });
      return;
    }

    const rating = Math.round(ratingRaw);
    const outcome = await db.runTransaction((state) => {
      const product = state.products.find(
        (p) => p.id === req.params.id || p.slug === req.params.id
      );
      if (!product) throw new Error('PRODUCT_NOT_FOUND');

      const verifiedPurchase = state.orders.some(
        (o) =>
          o.userId === user.id &&
          o.status !== 'Cancelled' &&
          o.items.some((it) => it.productId === product.id)
      );

      const review = {
        id: `rev-${crypto.randomUUID()}`,
        productId: product.id,
        userId: user.id,
        userName: user.name,
        rating,
        title,
        comment,
        verifiedPurchase,
        createdAt: new Date().toISOString(),
      };
      state.reviews.unshift(review);

      const prevCount = product.reviewCount || 0;
      const newCount = prevCount + 1;
      const weighted = (product.rating * prevCount + rating) / newCount;
      product.rating = Number(weighted.toFixed(1));
      product.reviewCount = newCount;
      product.updatedAt = new Date().toISOString();

      return { review, product };
    });

    emitGlobal('catalog:updated', { productId: outcome.product.id });
    res.status(201).json({ success: true, data: outcome });
  } catch (err) {
    if (err instanceof Error && err.message === 'PRODUCT_NOT_FOUND') {
      res.status(404).json({ success: false, error: 'Product not found' });
      return;
    }
    res.status(500).json({ success: false, error: 'Could not submit review' });
  }
});

// ---------- CONTACT & SUPPORT ----------
adminAndSupportRouter.post('/support/contact', optionalAuth, async (req: AuthedRequest, res) => {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 80) : '';
    const email =
      typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase().slice(0, 120) : '';
    const subject =
      typeof req.body?.subject === 'string' ? req.body.subject.trim().slice(0, 120) : '';
    const orderNumber =
      typeof req.body?.orderNumber === 'string'
        ? req.body.orderNumber.trim().slice(0, 40)
        : undefined;
    const message =
      typeof req.body?.message === 'string' ? req.body.message.trim().slice(0, 2000) : '';

    if (name.length < 2) {
      res.status(400).json({ success: false, error: 'Name is required' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ success: false, error: 'Valid email is required' });
      return;
    }
    if (subject.length < 3 || message.length < 10) {
      res
        .status(400)
        .json({ success: false, error: 'Subject and message (min 10 chars) are required' });
      return;
    }

    const created = await db.runTransaction((state) => {
      const entry = {
        id: `msg-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        name,
        email,
        subject,
        orderNumber: orderNumber || undefined,
        message,
        userId: req.user?.id,
        status: 'New' as const,
        createdAt: new Date().toISOString(),
      };
      state.contactMessages.unshift(entry);
      return entry;
    });

    res.status(201).json({ success: true, data: { message: created } });
  } catch {
    res.status(500).json({ success: false, error: 'Could not submit support message' });
  }
});

adminAndSupportRouter.get('/support/my-messages', requireAuth, (req: AuthedRequest, res) => {
  const user = req.user!;
  const items = db
    .read()
    .contactMessages.filter(
      (m) => m.userId === user.id || m.email.toLowerCase() === user.email.toLowerCase()
    );
  res.json({ success: true, data: { messages: items } });
});

// ---------- ADMIN SETUP / CLAIM BOOTSTRAP ----------
adminAndSupportRouter.get('/admin/setup-status', (_req, res) => {
  const state = db.read();
  const hasAdmin = state.users.some((u) => u.role === 'admin');
  const envPasscodeConfigured = Boolean(
    process.env.ADMIN_PASSCODE && process.env.ADMIN_PASSCODE.trim().length > 0
  );
  res.json({
    success: true,
    data: {
      hasAdmin,
      envPasscodeConfigured,
    },
  });
});

adminAndSupportRouter.post('/admin/claim-setup', optionalAuth, async (req: AuthedRequest, res) => {
  try {
    const passcode = typeof req.body?.passcode === 'string' ? req.body.passcode : '';
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    const envPasscodeConfigured = Boolean(
      process.env.ADMIN_PASSCODE && process.env.ADMIN_PASSCODE.trim().length > 0
    );

    const result = await db.runTransaction((state) => {
      const hasAdmin = state.users.some((u) => u.role === 'admin');

      if (envPasscodeConfigured) {
        if (!passcode || !verifyAdminPasscode(passcode)) {
          throw new Error('INVALID_PASSCODE');
        }
        if (req.user) {
          const target = state.users.find((u) => u.id === req.user!.id);
          if (!target) throw new Error('USER_NOT_FOUND');
          target.role = 'admin';
          target.updatedAt = new Date().toISOString();
          return { user: target, prefs: getOrCreatePreferences(state, target.id) };
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8 || name.length < 2) {
          throw new Error('INVALID_INPUT');
        }
        let target = state.users.find((u) => u.email.toLowerCase() === email);
        if (target) {
          target.role = 'admin';
          target.updatedAt = new Date().toISOString();
        } else {
          const now = new Date().toISOString();
          target = {
            id: `usr-${crypto.randomUUID()}`,
            name,
            email,
            passwordHash: hashPassword(password),
            role: 'admin',
            createdAt: now,
            updatedAt: now,
          };
          state.users.push(target);
        }
        return { user: target, prefs: getOrCreatePreferences(state, target.id) };
      }

      // First-run fallback when ADMIN_PASSCODE env secret is not set:
      // Allows claiming the very first admin once and locks immediately once an admin exists.
      if (hasAdmin) {
        throw new Error('ALREADY_CLAIMED');
      }

      if (req.user) {
        const target = state.users.find((u) => u.id === req.user!.id);
        if (!target) throw new Error('USER_NOT_FOUND');
        target.role = 'admin';
        target.updatedAt = new Date().toISOString();
        return { user: target, prefs: getOrCreatePreferences(state, target.id) };
      }

      if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) {
        throw new Error('INVALID_INPUT');
      }
      if (state.users.some((u) => u.email.toLowerCase() === email)) {
        throw new Error('EMAIL_EXISTS');
      }

      const now = new Date().toISOString();
      const adminUser = {
        id: `usr-${crypto.randomUUID()}`,
        name,
        email,
        passwordHash: hashPassword(password),
        role: 'admin' as const,
        createdAt: now,
        updatedAt: now,
      };
      state.users.push(adminUser);
      return { user: adminUser, prefs: getOrCreatePreferences(state, adminUser.id) };
    });

    const token = signAuthToken(result.user);
    res.json({
      success: true,
      data: {
        token,
        user: toPublicUser(result.user),
        preferences: result.prefs,
      },
    });
  } catch (err) {
    const code = err instanceof Error ? err.message : '';
    if (code === 'INVALID_PASSCODE') {
      res.status(403).json({ success: false, error: 'Invalid administrator passcode' });
      return;
    }
    if (code === 'ALREADY_CLAIMED') {
      res.status(403).json({
        success: false,
        error: 'Administrator already claimed. Sign in with the admin account.',
      });
      return;
    }
    if (code === 'EMAIL_EXISTS') {
      res.status(409).json({
        success: false,
        error: 'Email already registered. Sign in with that account first or use a new email.',
      });
      return;
    }
    if (code === 'INVALID_INPUT') {
      res.status(400).json({
        success: false,
        error: 'Provide valid name, email, and password (minimum 8 characters).',
      });
      return;
    }
    res.status(500).json({ success: false, error: 'Could not complete admin setup' });
  }
});

// ---------- ADMIN DASHBOARD ROUTES ----------
adminAndSupportRouter.get('/admin/overview', requireAuth, requireAdmin, (_req, res) => {
  const state = db.read();
  const totalRevenue = state.orders
    .filter((o) => o.status !== 'Cancelled' && o.paymentStatus !== 'Refunded')
    .reduce((acc, o) => acc + o.total, 0);

  const pendingReturns = state.orders.filter((o) => o.status === 'Return Requested').length;
  const outOfStockCount = state.products.filter((p) => p.stock <= 0 || !p.isAvailable).length;
  const lowStockCount = state.products.filter((p) => p.stock > 0 && p.stock <= 5).length;

  const customers = state.users.map((u) => {
    const userOrders = state.orders.filter((o) => o.userId === u.id);
    const totalSpent = userOrders
      .filter((o) => o.status !== 'Cancelled' && o.paymentStatus !== 'Refunded')
      .reduce((sum, o) => sum + o.total, 0);
    return {
      ...toPublicUser(u),
      orderCount: userOrders.length,
      totalSpent: Number(totalSpent.toFixed(2)),
    };
  });

  res.json({
    success: true,
    data: {
      metrics: {
        totalRevenue: Number(totalRevenue.toFixed(2)),
        totalOrders: state.orders.length,
        totalProducts: state.products.length,
        totalCustomers: state.users.length,
        pendingReturns,
        outOfStockCount,
        lowStockCount,
        openMessages: state.contactMessages.filter((m) => m.status === 'New').length,
      },
      products: state.products,
      orders: [...state.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      customers,
      payments: [...state.payments].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      paymentAuditLogs: state.paymentAuditLogs.slice(0, 100),
      contactMessages: state.contactMessages,
    },
  });
});

adminAndSupportRouter.post('/admin/products', requireAuth, requireAdmin, async (req, res) => {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 120) : '';
    const brand = typeof req.body?.brand === 'string' ? req.body.brand.trim().slice(0, 80) : '';
    const category =
      typeof req.body?.category === 'string' ? req.body.category.trim().slice(0, 80) : '';
    const subcategory =
      typeof req.body?.subcategory === 'string'
        ? req.body.subcategory.trim().slice(0, 80)
        : 'General';
    const description =
      typeof req.body?.description === 'string' ? req.body.description.trim().slice(0, 800) : '';
    const price = Number(req.body?.price);
    const compareAtRaw = req.body?.compareAtPrice !== undefined ? Number(req.body.compareAtPrice) : 0;
    const stock = Math.max(0, Math.floor(Number(req.body?.stock ?? 10)));
    const image =
      isSafeImageSrc(req.body?.image) || '/src/assets/images/hero_aura_atelier_1795613731604.jpg';
    const featured = Boolean(req.body?.featured);

    if (name.length < 2 || brand.length < 2 || category.length < 2 || description.length < 5) {
      res.status(400).json({
        success: false,
        error: 'Name, brand, category, and description are required',
      });
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      res.status(400).json({ success: false, error: 'Valid positive price is required' });
      return;
    }

    const compareAtPrice =
      Number.isFinite(compareAtRaw) && compareAtRaw > price ? compareAtRaw : undefined;
    const discountPercentage = compareAtPrice
      ? Math.round(((compareAtPrice - price) / compareAtPrice) * 100)
      : 0;

    const colors = Array.isArray(req.body?.colors)
      ? req.body.colors.map((c: unknown) => String(c).trim()).filter(Boolean)
      : ['Classic'];
    const sizes = Array.isArray(req.body?.sizes)
      ? req.body.sizes.map((s: unknown) => String(s).trim()).filter(Boolean)
      : [];

    const created = await db.runTransaction((state) => {
      const slugBase = slugify(name) || 'product';
      const id = `sc-custom-${slugBase}-${crypto.randomUUID().slice(0, 4)}`;
      const product: Product = {
        id,
        slug: `${slugBase}-${crypto.randomUUID().slice(0, 4)}`,
        name,
        brand,
        category,
        subcategory: subcategory || 'General',
        price: Math.round(price),
        compareAtPrice: compareAtPrice ? Math.round(compareAtPrice) : undefined,
        discountPercentage,
        rating: 4.6,
        reviewCount: 1,
        description,
        materials:
          typeof req.body?.materials === 'string' && req.body.materials.trim()
            ? req.body.materials.trim().slice(0, 120)
            : 'Standard Retail Grade',
        dimensions:
          typeof req.body?.dimensions === 'string' && req.body.dimensions.trim()
            ? req.body.dimensions.trim().slice(0, 120)
            : 'Standard Packaging',
        specifications: { Category: category, Brand: brand },
        image,
        stock,
        popularityScore: 80,
        featured,
        variants: {
          sizes,
          colors: colors.length > 0 ? colors : ['Standard'],
          finishes: ['Original'],
        },
        isAvailable: true,
        updatedAt: new Date().toISOString(),
      };
      state.products.unshift(product);
      return product;
    });

    emitGlobal('catalog:updated', { productId: created.id });
    res.status(201).json({ success: true, data: { product: created } });
  } catch {
    res.status(500).json({ success: false, error: 'Could not add product' });
  }
});

adminAndSupportRouter.patch('/admin/products/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const productId = req.params.id;
    const outcome = await db.runTransaction((state) => {
      const product = state.products.find((p) => p.id === productId);
      if (!product) throw new Error('NOT_FOUND');

      const oldPrice = product.price;
      const oldStock = product.stock;

      if (typeof req.body?.name === 'string' && req.body.name.trim().length >= 2) {
        product.name = req.body.name.trim().slice(0, 120);
      }
      if (typeof req.body?.brand === 'string' && req.body.brand.trim().length >= 2) {
        product.brand = req.body.brand.trim().slice(0, 80);
      }
      if (typeof req.body?.category === 'string' && req.body.category.trim().length >= 2) {
        product.category = req.body.category.trim().slice(0, 80);
      }
      if (typeof req.body?.subcategory === 'string' && req.body.subcategory.trim()) {
        product.subcategory = req.body.subcategory.trim().slice(0, 80);
      }
      if (typeof req.body?.description === 'string' && req.body.description.trim().length >= 5) {
        product.description = req.body.description.trim().slice(0, 800);
      }
      if (req.body?.price !== undefined) {
        const nextPrice = Number(req.body.price);
        if (Number.isFinite(nextPrice) && nextPrice > 0) {
          product.price = Math.round(nextPrice);
        }
      }
      if (req.body?.compareAtPrice !== undefined) {
        const cmp = Number(req.body.compareAtPrice);
        product.compareAtPrice = Number.isFinite(cmp) && cmp > product.price ? Math.round(cmp) : undefined;
      }
      if (product.compareAtPrice && product.compareAtPrice > product.price) {
        product.discountPercentage = Math.round(
          ((product.compareAtPrice - product.price) / product.compareAtPrice) * 100
        );
      } else {
        product.discountPercentage = 0;
      }
      if (req.body?.stock !== undefined) {
        const nextStock = Math.floor(Number(req.body.stock));
        if (Number.isFinite(nextStock) && nextStock >= 0) {
          product.stock = nextStock;
        }
      }
      if (typeof req.body?.featured === 'boolean') {
        product.featured = req.body.featured;
      }
      if (typeof req.body?.isAvailable === 'boolean') {
        product.isAvailable = req.body.isAvailable;
      }
      const safeImg = isSafeImageSrc(req.body?.image);
      if (safeImg) {
        product.image = safeImg;
      }

      product.updatedAt = new Date().toISOString();

      // Automatic price-drop alerts
      if (product.price < oldPrice) {
        const watchers = state.wishlists.filter((w) => w.productId === product.id);
        for (const w of watchers) {
          dispatchUserNotification(state, {
            userId: w.userId,
            category: 'priceDrops',
            title: `Price drop on ${product.name}`,
            body: `Now ₹${product.price.toLocaleString('en-IN')} (down from ₹${oldPrice.toLocaleString('en-IN')}).`,
            productId: product.id,
          });
        }
      }

      // Automatic back-in-stock alerts
      if (oldStock <= 0 && product.stock > 0 && product.isAvailable) {
        const watcherIds = new Set<string>();
        for (const w of state.wishlists) {
          if (w.productId === product.id) watcherIds.add(w.userId);
        }
        for (const s of state.savedItems) {
          if (s.productId === product.id) watcherIds.add(s.userId);
        }
        for (const uid of watcherIds) {
          dispatchUserNotification(state, {
            userId: uid,
            category: 'stockUpdates',
            title: `${product.name} is back in stock`,
            body: `${product.stock} units are now ready to ship.`,
            productId: product.id,
          });
        }
      }

      return product;
    });

    emitGlobal('catalog:updated', { productId: outcome.id });
    res.json({ success: true, data: { product: outcome } });
  } catch {
    res.status(404).json({ success: false, error: 'Product not found' });
  }
});

adminAndSupportRouter.delete('/admin/products/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const productId = req.params.id;
    await db.runTransaction((state) => {
      const idx = state.products.findIndex((p) => p.id === productId);
      if (idx === -1) throw new Error('NOT_FOUND');
      state.products.splice(idx, 1);
      state.carts = state.carts.filter((c) => c.productId !== productId);
      state.wishlists = state.wishlists.filter((w) => w.productId !== productId);
      state.savedItems = state.savedItems.filter((s) => s.productId !== productId);
      state.recentlyViewed = state.recentlyViewed.filter((r) => r.productId !== productId);
      state.browsingHistory = state.browsingHistory.filter((h) => h.productId !== productId);
    });

    emitGlobal('catalog:updated', { deletedProductId: productId });
    res.json({ success: true, data: { deleted: true } });
  } catch {
    res.status(404).json({ success: false, error: 'Product not found' });
  }
});

adminAndSupportRouter.patch('/admin/orders/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const orderId = req.params.id;
    const action = typeof req.body?.action === 'string' ? req.body.action : '';
    const nextStatus = typeof req.body?.status === 'string' ? (req.body.status as OrderStatus) : null;
    const note = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 200) : '';

    const allowedStatuses: OrderStatus[] = [
      'Confirmed',
      'Processing',
      'Shipped',
      'Delivered',
      'Cancelled',
      'Return Requested',
    ];

    const updatedOrder = await db.runTransaction((state) => {
      const order = state.orders.find((o) => o.id === orderId);
      if (!order) throw new Error('NOT_FOUND');

      const now = new Date().toISOString();

      if (action === 'approve_return') {
        if (order.status !== 'Return Requested') {
          throw new Error('NOT_RETURN_REQUESTED');
        }
        order.status = 'Cancelled';
        if (order.paymentStatus === 'Paid') {
          order.paymentStatus = 'Refunded';
        }
        order.timeline.push({
          status: 'Return Approved & Refunded',
          timestamp: now,
          note: note || 'Return verified by admin. Inventory restocked and refund issued.',
        });

        for (const it of order.items) {
          const prod = state.products.find((p) => p.id === it.productId);
          if (prod) prod.stock += it.quantity;
        }

        const pay = state.payments.find((p) => p.orderId === order.id);
        if (pay) {
          pay.status = 'Refunded';
          state.paymentAuditLogs.unshift({
            id: `paud-${crypto.randomUUID()}`,
            paymentId: pay.id,
            orderId: order.id,
            event: 'ADMIN_RETURN_REFUND',
            details: `Return approved & refunded ₹${pay.amount.toLocaleString('en-IN')}`,
            timestamp: now,
          });
        }

        dispatchUserNotification(state, {
          userId: order.userId,
          category: 'payments',
          title: `Refund processed for ${order.orderNumber}`,
          body: `Your return was approved and ₹${order.total.toLocaleString('en-IN')} has been refunded.`,
          orderId: order.id,
        });
      } else {
        if (!nextStatus || !allowedStatuses.includes(nextStatus)) {
          throw new Error('INVALID_STATUS');
        }
        const prevStatus = order.status;
        order.status = nextStatus;
        order.timeline.push({
          status: nextStatus,
          timestamp: now,
          note: note || `Order status updated from ${prevStatus} to ${nextStatus} by admin.`,
        });

        if (nextStatus === 'Delivered' && order.paymentStatus === 'Pending') {
          order.paymentStatus = 'Paid';
          const pay = state.payments.find((p) => p.orderId === order.id);
          if (pay) {
            pay.status = 'Succeeded';
            state.paymentAuditLogs.unshift({
              id: `paud-${crypto.randomUUID()}`,
              paymentId: pay.id,
              orderId: order.id,
              event: 'COD_SETTLED_ON_DELIVERY',
              details: `COD payment settled upon delivery`,
              timestamp: now,
            });
          }
        }

        const notifCat =
          nextStatus === 'Shipped' || nextStatus === 'Delivered' ? 'shipping' : 'orders';
        dispatchUserNotification(state, {
          userId: order.userId,
          category: notifCat,
          title: `Order ${order.orderNumber}: ${nextStatus}`,
          body:
            nextStatus === 'Delivered'
              ? `Your order ${order.orderNumber} has been delivered.`
              : `Your order status is now ${nextStatus}. Tracking: ${order.trackingNumber}`,
          orderId: order.id,
        });
      }

      order.updatedAt = now;
      return order;
    });

    emitToOwner(`user:${updatedOrder.userId}`, 'order:updated', { orderId: updatedOrder.id });
    emitGlobal('catalog:updated', { orderId: updatedOrder.id });
    res.json({ success: true, data: { order: updatedOrder } });
  } catch (err) {
    const code = err instanceof Error ? err.message : '';
    if (code === 'NOT_FOUND') {
      res.status(404).json({ success: false, error: 'Order not found' });
      return;
    }
    if (code === 'NOT_RETURN_REQUESTED' || code === 'INVALID_STATUS') {
      res.status(400).json({ success: false, error: 'Invalid order action or status' });
      return;
    }
    res.status(500).json({ success: false, error: 'Could not update order' });
  }
});

adminAndSupportRouter.patch(
  '/admin/contact/:id',
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const updated = await db.runTransaction((state) => {
        const msg = state.contactMessages.find((m) => m.id === req.params.id);
        if (!msg) throw new Error('NOT_FOUND');
        msg.status = req.body?.status === 'New' ? 'New' : 'Reviewed';
        return msg;
      });
      res.json({ success: true, data: { message: updated } });
    } catch {
      res.status(404).json({ success: false, error: 'Message not found' });
    }
  }
);

adminAndSupportRouter.post(
  '/admin/promotions/send',
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const title = typeof req.body?.title === 'string' ? req.body.title.trim().slice(0, 100) : '';
    const body = typeof req.body?.body === 'string' ? req.body.body.trim().slice(0, 240) : '';
    if (title.length < 3 || body.length < 5) {
      res.status(400).json({ success: false, error: 'Campaign title and message are required' });
      return;
    }

    const result = await db.runTransaction((state) => {
      let sentCount = 0;
      for (const u of state.users) {
        const sent = dispatchUserNotification(state, {
          userId: u.id,
          category: 'promotions',
          title,
          body,
        });
        if (sent) sentCount += 1;
      }
      return { sentCount, totalUsers: state.users.length };
    });

    res.json({ success: true, data: result });
  }
);
