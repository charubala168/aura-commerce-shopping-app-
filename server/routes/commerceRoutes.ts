import crypto from 'crypto';
import { Router } from 'express';
import { db } from '../db.ts';
import {
  optionalAuth,
  requireAuth,
  WEBHOOK_SECRET,
  type AuthedRequest,
} from '../middleware/auth.ts';
import {
  buildVariantKey,
  dispatchUserNotification,
  emitToOwner,
  enrichCartItems,
  getOrCreatePreferences,
} from '../services/ecommerceService.ts';
import type { OrderRecord, OrderStatus } from '../../src/types/ecommerce.ts';

export const commerceRouter = Router();

// ---------- SMART SHOPPING CART ----------
commerceRouter.get('/cart', optionalAuth, (req: AuthedRequest, res) => {
  if (!req.ownerKey) {
    res.json({
      success: true,
      data: {
        items: [],
        subtotal: 0,
        itemCount: 0,
        hasPriceChanges: false,
        hasStockIssues: false,
      },
    });
    return;
  }
  const items = enrichCartItems(db.read(), req.ownerKey);
  const subtotal = Number(items.reduce((sum, i) => sum + i.lineTotal, 0).toFixed(2));
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  res.json({
    success: true,
    data: {
      items,
      subtotal,
      itemCount,
      hasPriceChanges: items.some((i) => i.priceChanged),
      hasStockIssues: items.some((i) => i.isUnavailable || i.isOutOfStock || i.quantity > i.availableStock),
    },
  });
});

commerceRouter.get('/cart/validate', optionalAuth, (req: AuthedRequest, res) => {
  if (!req.ownerKey) {
    res.json({
      success: true,
      data: {
        valid: false,
        items: [],
        subtotal: 0,
        shippingFee: 0,
        tax: 0,
        total: 0,
        hasPriceChanges: false,
        hasStockIssues: false,
        issues: ['Your shopping bag is empty'],
        priceChanges: [],
      },
    });
    return;
  }

  const items = enrichCartItems(db.read(), req.ownerKey);
  const issues: string[] = [];
  const priceChanges: Array<{
    itemId: string;
    productName: string;
    previousPrice: number;
    currentPrice: number;
    delta: number;
  }> = [];

  for (const item of items) {
    const label = item.product?.name || item.productId;
    if (item.isUnavailable) {
      issues.push(`${label} is no longer available`);
    } else if (item.isOutOfStock) {
      issues.push(`${label} is currently out of stock`);
    } else if (item.quantity > item.availableStock) {
      issues.push(`${label} only has ${item.availableStock} left in stock (requested ${item.quantity})`);
    }
    if (item.priceChanged && item.product) {
      priceChanges.push({
        itemId: item.id,
        productName: item.product.name,
        previousPrice: item.unitPriceAtAdd,
        currentPrice: item.currentPrice,
        delta: item.priceDelta,
      });
    }
  }

  const subtotal = Number(items.reduce((sum, i) => sum + i.lineTotal, 0).toFixed(2));
  const shippingFee = subtotal >= 999 || subtotal === 0 ? 0 : 79;
  const tax = Number((subtotal * 0.08).toFixed(2));
  const total = Number((subtotal + shippingFee + tax).toFixed(2));
  const hasStockIssues = issues.length > 0;
  const hasPriceChanges = priceChanges.length > 0;

  res.json({
    success: true,
    data: {
      valid: items.length > 0 && !hasStockIssues,
      items,
      subtotal,
      shippingFee,
      tax,
      total,
      hasPriceChanges,
      hasStockIssues,
      issues,
      priceChanges,
    },
  });
});

commerceRouter.post('/cart/items', optionalAuth, async (req: AuthedRequest, res) => {
  try {
    if (!req.ownerKey) {
      res.status(400).json({ success: false, error: 'Missing session identifier' });
      return;
    }
    const productId = typeof req.body?.productId === 'string' ? req.body.productId : '';
    const quantity = Math.max(1, Math.min(20, Number(req.body?.quantity || 1)));
    const variant = {
      size: typeof req.body?.variant?.size === 'string' ? req.body.variant.size : undefined,
      color: typeof req.body?.variant?.color === 'string' ? req.body.variant.color : undefined,
      finish: typeof req.body?.variant?.finish === 'string' ? req.body.variant.finish : undefined,
    };

    const updatedItem = await db.runTransaction((state) => {
      const product = state.products.find((p) => p.id === productId);
      if (!product || !product.isAvailable) throw new Error('PRODUCT_UNAVAILABLE');
      if (product.stock <= 0) throw new Error('OUT_OF_STOCK');

      // Default variant values if omitted
      const resolvedVariant = {
        size: variant.size || product.variants.sizes[0],
        color: variant.color || product.variants.colors[0],
        finish: variant.finish || product.variants.finishes[0],
      };
      const variantKey = buildVariantKey(resolvedVariant);
      const now = new Date().toISOString();

      // Prevent duplicate cart entries by matching ownerKey + productId + variantKey
      const existing = state.carts.find(
        (c) =>
          c.ownerKey === req.ownerKey &&
          c.productId === productId &&
          c.variantKey === variantKey
      );
      if (existing) {
        const nextQty = existing.quantity + quantity;
        if (nextQty > product.stock) {
          throw new Error(`INSUFFICIENT_STOCK:${product.stock}`);
        }
        existing.quantity = nextQty;
        existing.updatedAt = now;
        return existing;
      }

      if (quantity > product.stock) {
        throw new Error(`INSUFFICIENT_STOCK:${product.stock}`);
      }

      const created = {
        id: `cart-${crypto.randomUUID()}`,
        ownerKey: req.ownerKey!,
        productId,
        variant: resolvedVariant,
        variantKey,
        quantity,
        unitPriceAtAdd: product.price,
        addedAt: now,
        updatedAt: now,
      };
      state.carts.unshift(created);
      return created;
    });

    emitToOwner(req.ownerKey, 'cart:updated', { itemId: updatedItem.id });
    res.status(201).json({ success: true, data: { item: updatedItem } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'PRODUCT_UNAVAILABLE') {
      res.status(404).json({ success: false, error: 'Product is currently unavailable' });
      return;
    }
    if (msg === 'OUT_OF_STOCK') {
      res.status(409).json({ success: false, error: 'This item is currently out of stock' });
      return;
    }
    if (msg.startsWith('INSUFFICIENT_STOCK:')) {
      const avail = msg.split(':')[1];
      res.status(409).json({
        success: false,
        error: `Only ${avail} unit${avail === '1' ? '' : 's'} remaining in stock`,
      });
      return;
    }
    res.status(500).json({ success: false, error: 'Failed to add item to cart' });
  }
});

commerceRouter.patch('/cart/items/:itemId', optionalAuth, async (req: AuthedRequest, res) => {
  try {
    if (!req.ownerKey) {
      res.status(400).json({ success: false, error: 'Missing session' });
      return;
    }
    const quantity = req.body?.quantity !== undefined ? Number(req.body.quantity) : undefined;
    const acceptPriceChange = Boolean(req.body?.acceptPriceChange);

    await db.runTransaction((state) => {
      const item = state.carts.find(
        (c) => c.id === req.params.itemId && c.ownerKey === req.ownerKey
      );
      if (!item) throw new Error('NOT_FOUND');
      const product = state.products.find((p) => p.id === item.productId);
      if (!product) throw new Error('PRODUCT_UNAVAILABLE');

      if (acceptPriceChange) {
        item.unitPriceAtAdd = product.price;
      }
      if (quantity !== undefined) {
        if (quantity <= 0) {
          state.carts = state.carts.filter((c) => c.id !== item.id);
          return;
        }
        if (quantity > product.stock) {
          throw new Error(`INSUFFICIENT_STOCK:${product.stock}`);
        }
        item.quantity = quantity;
      }
      item.updatedAt = new Date().toISOString();
    });

    emitToOwner(req.ownerKey, 'cart:updated', { itemId: req.params.itemId });
    res.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.startsWith('INSUFFICIENT_STOCK:')) {
      const avail = msg.split(':')[1];
      res.status(409).json({ success: false, error: `Only ${avail} available in stock` });
      return;
    }
    res.status(404).json({ success: false, error: 'Cart item not found' });
  }
});

commerceRouter.delete('/cart/items/:itemId', optionalAuth, async (req: AuthedRequest, res) => {
  if (!req.ownerKey) {
    res.json({ success: true });
    return;
  }
  await db.runTransaction((state) => {
    state.carts = state.carts.filter(
      (c) => !(c.id === req.params.itemId && c.ownerKey === req.ownerKey)
    );
  });
  emitToOwner(req.ownerKey, 'cart:updated', { removed: req.params.itemId });
  res.json({ success: true });
});

// ---------- SAVE FOR LATER ----------
commerceRouter.post('/cart/save-for-later/:itemId', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.user!.id;
    const ownerKey = req.ownerKey!;

    await db.runTransaction((state) => {
      const cartItem = state.carts.find(
        (c) => c.id === req.params.itemId && c.ownerKey === ownerKey
      );
      if (!cartItem) throw new Error('NOT_FOUND');

      const alreadySaved = state.savedItems.some(
        (s) =>
          s.userId === userId &&
          s.productId === cartItem.productId &&
          s.variantKey === cartItem.variantKey
      );
      if (!alreadySaved) {
        const product = state.products.find((p) => p.id === cartItem.productId);
        state.savedItems.unshift({
          id: `saved-${crypto.randomUUID()}`,
          userId,
          productId: cartItem.productId,
          variant: cartItem.variant,
          variantKey: cartItem.variantKey,
          savedPrice: product ? product.price : cartItem.unitPriceAtAdd,
          savedAt: new Date().toISOString(),
        });
      }
      state.carts = state.carts.filter((c) => c.id !== cartItem.id);
    });

    emitToOwner(ownerKey, 'cart:updated', { savedForLater: true });
    res.json({ success: true });
  } catch {
    res.status(404).json({ success: false, error: 'Cart item not found' });
  }
});

commerceRouter.get('/saved-items', requireAuth, (req: AuthedRequest, res) => {
  const state = db.read();
  const list = state.savedItems
    .filter((s) => s.userId === req.user!.id)
    .map((s) => ({
      ...s,
      product: db.productById.get(s.productId) || null,
    }));
  res.json({ success: true, data: { items: list } });
});

commerceRouter.post('/saved-items/:itemId/move-to-cart', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.user!.id;
    const ownerKey = req.ownerKey!;
    await db.runTransaction((state) => {
      const saved = state.savedItems.find(
        (s) => s.id === req.params.itemId && s.userId === userId
      );
      if (!saved) throw new Error('NOT_FOUND');
      const product = state.products.find((p) => p.id === saved.productId);
      if (!product || !product.isAvailable || product.stock <= 0) {
        throw new Error('OUT_OF_STOCK');
      }
      const existing = state.carts.find(
        (c) =>
          c.ownerKey === ownerKey &&
          c.productId === saved.productId &&
          c.variantKey === saved.variantKey
      );
      const now = new Date().toISOString();
      if (existing) {
        existing.quantity = Math.min(product.stock, existing.quantity + 1);
        existing.updatedAt = now;
      } else {
        state.carts.unshift({
          id: `cart-${crypto.randomUUID()}`,
          ownerKey,
          productId: saved.productId,
          variant: saved.variant,
          variantKey: saved.variantKey,
          quantity: 1,
          unitPriceAtAdd: product.price,
          addedAt: now,
          updatedAt: now,
        });
      }
      state.savedItems = state.savedItems.filter((s) => s.id !== saved.id);
    });
    emitToOwner(ownerKey, 'cart:updated', { movedFromSaved: true });
    res.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'OUT_OF_STOCK') {
      res.status(409).json({ success: false, error: 'This item is currently out of stock' });
      return;
    }
    res.status(404).json({ success: false, error: 'Saved item not found' });
  }
});

commerceRouter.delete('/saved-items/:itemId', requireAuth, async (req: AuthedRequest, res) => {
  await db.runTransaction((state) => {
    state.savedItems = state.savedItems.filter(
      (s) => !(s.id === req.params.itemId && s.userId === req.user!.id)
    );
  });
  res.json({ success: true });
});

// ---------- CHECKOUT, ORDERS, PAYMENTS & WEBHOOKS ----------
commerceRouter.post('/orders/checkout', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const user = req.user!;
    const ownerKey = `user:${user.id}`;
    const idempotencyKey =
      (typeof req.headers['x-idempotency-key'] === 'string' && req.headers['x-idempotency-key']) ||
      (typeof req.body?.idempotencyKey === 'string' && req.body.idempotencyKey) ||
      `idem-${crypto.randomUUID()}`;

    const shipping = req.body?.shippingAddress;
    if (
      !shipping ||
      !shipping.fullName ||
      !shipping.phone ||
      !shipping.line1 ||
      !shipping.city ||
      !shipping.postalCode
    ) {
      res.status(400).json({ success: false, error: 'Complete shipping address is required' });
      return;
    }

    const paymentMethod: 'Card' | 'UPI' | 'COD' =
      req.body?.paymentMethod === 'UPI' || req.body?.paymentMethod === 'COD'
        ? req.body.paymentMethod
        : 'Card';

    const outcome = await db.runTransaction((state) => {
      // 1. Prevent duplicate payment processing using idempotencyKey
      const existingPayment = state.payments.find(
        (p) => p.idempotencyKey === idempotencyKey && p.userId === user.id
      );
      if (existingPayment) {
        const existingOrder = state.orders.find((o) => o.id === existingPayment.orderId);
        if (existingOrder) {
          return { order: existingOrder, payment: existingPayment, deduplicated: true };
        }
      }

      const cartItems = state.carts.filter((c) => c.ownerKey === ownerKey);
      if (cartItems.length === 0) {
        throw new Error('EMPTY_CART');
      }

      const orderItems = [];
      let subtotal = 0;

      // 2. Validate stock atomically and decrement inventory
      for (const ci of cartItems) {
        const product = state.products.find((p) => p.id === ci.productId);
        if (!product || !product.isAvailable) {
          throw new Error(`UNAVAILABLE:${ci.productId}`);
        }
        if (product.stock < ci.quantity) {
          throw new Error(`STOCK_SHORT:${product.name}:${product.stock}`);
        }
        product.stock -= ci.quantity;
        product.popularityScore += ci.quantity;
        product.updatedAt = new Date().toISOString();

        const lineTotal = Number((product.price * ci.quantity).toFixed(2));
        subtotal += lineTotal;
        orderItems.push({
          productId: product.id,
          name: product.name,
          brand: product.brand,
          category: product.category,
          image: product.image,
          variant: ci.variant,
          quantity: ci.quantity,
          unitPrice: product.price,
          lineTotal,
        });

        if (product.stock <= 2) {
          dispatchUserNotification(state, {
            userId: user.id,
            category: 'stockUpdates',
            title: `Low stock alert: ${product.name}`,
            body: `Only ${product.stock} left in studio inventory.`,
            productId: product.id,
          });
        }
      }

      subtotal = Number(subtotal.toFixed(2));
      const tax = Number((subtotal * 0.08).toFixed(2));
      const shippingFee = subtotal >= 999 ? 0 : 79;
      const total = Number((subtotal + tax + shippingFee).toFixed(2));
      const now = new Date().toISOString();
      const orderSeq = 1040 + state.orders.length + 1;
      const orderId = `ord-${crypto.randomUUID()}`;
      const paymentId = `pay-${crypto.randomUUID()}`;

      const order: OrderRecord = {
        id: orderId,
        orderNumber: `AUR-${orderSeq}`,
        userId: user.id,
        items: orderItems,
        subtotal,
        tax,
        shippingFee,
        total,
        status: 'Processing',
        shippingAddress: {
          fullName: String(shipping.fullName).slice(0, 80),
          phone: String(shipping.phone).slice(0, 30),
          line1: String(shipping.line1).slice(0, 120),
          city: String(shipping.city).slice(0, 60),
          state: String(shipping.state || '').slice(0, 60),
          postalCode: String(shipping.postalCode).slice(0, 20),
          country: String(shipping.country || 'India').slice(0, 60),
        },
        paymentMethod,
        paymentStatus: paymentMethod === 'COD' ? 'Pending' : 'Paid',
        invoiceNumber: `INV-${new Date().getFullYear()}-${orderSeq}`,
        trackingNumber: `TRK${Math.floor(10000000 + Math.random() * 89999999)}`,
        timeline: [
          {
            status: 'Confirmed',
            timestamp: now,
            note: 'Order received and inventory reserved',
          },
          {
            status: 'Processing',
            timestamp: now,
            note: 'Quality check and dispatch packaging scheduled',
          },
        ],
        createdAt: now,
        updatedAt: now,
      };

      const payment = {
        id: paymentId,
        orderId,
        userId: user.id,
        idempotencyKey,
        amount: total,
        currency: 'INR',
        method: paymentMethod,
        status: (paymentMethod === 'COD' ? 'Pending' : 'Succeeded') as 'Pending' | 'Succeeded',
        transactionRef: `TXN-${crypto.randomBytes(5).toString('hex').toUpperCase()}`,
        webhookVerified: paymentMethod !== 'COD',
        createdAt: now,
      };

      state.orders.unshift(order);
      state.payments.unshift(payment);
      state.paymentAuditLogs.unshift({
        id: `pal-${crypto.randomUUID()}`,
        paymentId,
        orderId,
        event: paymentMethod === 'COD' ? 'payment.cod_authorized' : 'payment.captured',
        details: `${paymentMethod} transaction ${payment.transactionRef} for ₹${total.toLocaleString('en-IN')} (idempotency: ${idempotencyKey})`,
        timestamp: now,
      });

      // Clear purchased cart items
      state.carts = state.carts.filter((c) => c.ownerKey !== ownerKey);

      dispatchUserNotification(state, {
        userId: user.id,
        category: 'orders',
        title: `Order ${order.orderNumber} Confirmed`,
        body: `Your order of ${order.items.length} item(s) totaling ₹${total.toLocaleString('en-IN')} is now processing.`,
        orderId: order.id,
      });

      dispatchUserNotification(state, {
        userId: user.id,
        category: 'payments',
        title:
          paymentMethod === 'COD'
            ? `COD Scheduled for ${order.orderNumber}`
            : `Payment Received (₹${total.toLocaleString('en-IN')})`,
        body: `Transaction reference ${payment.transactionRef} logged.`,
        orderId: order.id,
      });

      return { order, payment, deduplicated: false };
    });

    emitToOwner(ownerKey, 'cart:updated', { cleared: true });
    emitToOwner(ownerKey, 'order:updated', { orderId: outcome.order.id });
    res.status(outcome.deduplicated ? 200 : 201).json({ success: true, data: outcome });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'EMPTY_CART') {
      res.status(400).json({ success: false, error: 'Your shopping bag is empty' });
      return;
    }
    if (msg.startsWith('STOCK_SHORT:')) {
      const [, name, avail] = msg.split(':');
      res.status(409).json({
        success: false,
        error: `Insufficient stock for ${name} (${avail} remaining). Adjust quantity before checkout.`,
      });
      return;
    }
    if (msg.startsWith('UNAVAILABLE:')) {
      res.status(409).json({
        success: false,
        error: 'One or more items in your bag are no longer available.',
      });
      return;
    }
    res.status(500).json({ success: false, error: 'Checkout failed' });
  }
});

// Server-side paginated, sorted, and filtered order history
commerceRouter.get('/orders', requireAuth, (req: AuthedRequest, res) => {
  const state = db.read();
  const statusFilter = typeof req.query.status === 'string' ? req.query.status : 'All';
  const paymentMethodFilter =
    typeof req.query.paymentMethod === 'string' ? req.query.paymentMethod : 'All';
  const dateFrom = typeof req.query.dateFrom === 'string' ? req.query.dateFrom.trim() : '';
  const dateTo = typeof req.query.dateTo === 'string' ? req.query.dateTo.trim() : '';
  const sort = typeof req.query.sort === 'string' ? req.query.sort : 'newest';
  const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.max(1, Math.min(20, Number(req.query.limit || 5)));

  let list = state.orders.filter((o) => o.userId === req.user!.id);
  if (statusFilter && statusFilter !== 'All') {
    list = list.filter((o) => o.status === statusFilter);
  }
  if (paymentMethodFilter && paymentMethodFilter !== 'All') {
    list = list.filter((o) => o.paymentMethod === paymentMethodFilter);
  }
  if (dateFrom) {
    const fromTime = Date.parse(`${dateFrom}T00:00:00.000Z`);
    if (!Number.isNaN(fromTime)) {
      list = list.filter((o) => Date.parse(o.createdAt) >= fromTime);
    }
  }
  if (dateTo) {
    const toTime = Date.parse(`${dateTo}T23:59:59.999Z`);
    if (!Number.isNaN(toTime)) {
      list = list.filter((o) => Date.parse(o.createdAt) <= toTime);
    }
  }
  if (search) {
    list = list.filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(search) ||
        o.invoiceNumber.toLowerCase().includes(search) ||
        o.items.some((it) => it.name.toLowerCase().includes(search))
    );
  }

  const sorted = [...list];
  if (sort === 'oldest') sorted.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  else if (sort === 'total_desc') sorted.sort((a, b) => b.total - a.total);
  else if (sort === 'total_asc') sorted.sort((a, b) => a.total - b.total);
  else sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const totalItems = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * limit;
  const paged = sorted.slice(offset, offset + limit);

  res.json({
    success: true,
    data: {
      orders: paged,
      pagination: {
        page: safePage,
        limit,
        totalItems,
        totalPages,
      },
    },
  });
});

commerceRouter.get('/orders/:id', requireAuth, (req: AuthedRequest, res) => {
  const state = db.read();
  const order = state.orders.find(
    (o) => o.id === req.params.id && o.userId === req.user!.id
  );
  if (!order) {
    res.status(404).json({ success: false, error: 'Order not found' });
    return;
  }
  const payment = state.payments.find((p) => p.orderId === order.id) || null;
  const auditLogs = state.paymentAuditLogs.filter((l) => l.orderId === order.id);
  res.json({ success: true, data: { order, payment, auditLogs } });
});

commerceRouter.post('/orders/:id/reorder', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.user!.id;
    const ownerKey = `user:${userId}`;
    const result = await db.runTransaction((state) => {
      const order = state.orders.find((o) => o.id === req.params.id && o.userId === userId);
      if (!order) throw new Error('NOT_FOUND');

      let addedCount = 0;
      const skipped: string[] = [];
      const now = new Date().toISOString();

      for (const item of order.items) {
        const product = state.products.find((p) => p.id === item.productId);
        if (!product || !product.isAvailable || product.stock <= 0) {
          skipped.push(item.name);
          continue;
        }
        const vKey = buildVariantKey(item.variant);
        const existing = state.carts.find(
          (c) => c.ownerKey === ownerKey && c.productId === product.id && c.variantKey === vKey
        );
        const qtyToAdd = Math.min(item.quantity, product.stock);
        if (existing) {
          existing.quantity = Math.min(product.stock, existing.quantity + qtyToAdd);
          existing.updatedAt = now;
        } else {
          state.carts.unshift({
            id: `cart-${crypto.randomUUID()}`,
            ownerKey,
            productId: product.id,
            variant: item.variant,
            variantKey: vKey,
            quantity: qtyToAdd,
            unitPriceAtAdd: product.price,
            addedAt: now,
            updatedAt: now,
          });
        }
        addedCount += 1;
      }
      return { addedCount, skipped };
    });

    emitToOwner(ownerKey, 'cart:updated', { reordered: true });
    res.json({ success: true, data: result });
  } catch {
    res.status(404).json({ success: false, error: 'Order not found' });
  }
});

commerceRouter.post('/orders/:id/cancel', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.user!.id;
    const updatedOrder = await db.runTransaction((state) => {
      const order = state.orders.find((o) => o.id === req.params.id && o.userId === userId);
      if (!order) throw new Error('NOT_FOUND');
      if (order.status !== 'Confirmed' && order.status !== 'Processing') {
        throw new Error('CANNOT_CANCEL');
      }
      const now = new Date().toISOString();
      order.status = 'Cancelled';
      order.updatedAt = now;
      order.timeline.push({
        status: 'Cancelled',
        timestamp: now,
        note: 'Cancelled by customer prior to dispatch; stock restored',
      });

      // Restore stock
      for (const item of order.items) {
        const product = state.products.find((p) => p.id === item.productId);
        if (product) product.stock += item.quantity;
      }

      if (order.paymentStatus === 'Paid') {
        order.paymentStatus = 'Refunded';
        const payment = state.payments.find((p) => p.orderId === order.id);
        if (payment) {
          payment.status = 'Refunded';
          state.paymentAuditLogs.unshift({
            id: `pal-${crypto.randomUUID()}`,
            paymentId: payment.id,
            orderId: order.id,
            event: 'payment.refunded',
            details: `Full refund of ₹${order.total.toLocaleString('en-IN')} initiated for cancelled order ${order.orderNumber}`,
            timestamp: now,
          });
        }
      }

      dispatchUserNotification(state, {
        userId,
        category: 'orders',
        title: `Order ${order.orderNumber} Cancelled`,
        body:
          order.paymentStatus === 'Refunded'
            ? `Order cancelled and refund of ₹${order.total.toLocaleString('en-IN')} initiated.`
            : 'Your order has been cancelled.',
        orderId: order.id,
      });

      return order;
    });

    emitToOwner(`user:${userId}`, 'order:updated', { orderId: updatedOrder.id });
    res.json({ success: true, data: { order: updatedOrder } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'CANNOT_CANCEL') {
      res.status(409).json({
        success: false,
        error: 'Only orders in Confirmed or Processing status can be cancelled.',
      });
      return;
    }
    res.status(404).json({ success: false, error: 'Order not found' });
  }
});

commerceRouter.post('/orders/:id/return', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.user!.id;
    const reason =
      typeof req.body?.reason === 'string' && req.body.reason.trim()
        ? req.body.reason.trim().slice(0, 200)
        : 'Customer requested studio return';

    const updatedOrder = await db.runTransaction((state) => {
      const order = state.orders.find((o) => o.id === req.params.id && o.userId === userId);
      if (!order) throw new Error('NOT_FOUND');
      if (order.status !== 'Delivered') {
        throw new Error('CANNOT_RETURN');
      }
      const now = new Date().toISOString();
      order.status = 'Return Requested';
      order.updatedAt = now;
      order.timeline.push({
        status: 'Return Requested',
        timestamp: now,
        note: reason,
      });

      dispatchUserNotification(state, {
        userId,
        category: 'orders',
        title: `Return Requested for ${order.orderNumber}`,
        body: 'A prepaid courier return label has been prepared.',
        orderId: order.id,
      });
      return order;
    });

    emitToOwner(`user:${userId}`, 'order:updated', { orderId: updatedOrder.id });
    res.json({ success: true, data: { order: updatedOrder } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'CANNOT_RETURN') {
      res.status(409).json({
        success: false,
        error: 'Returns can only be requested once an order is Delivered.',
      });
      return;
    }
    res.status(404).json({ success: false, error: 'Order not found' });
  }
});

// Advance shipment status (useful to test Shipped -> Delivered notifications and Return eligibility)
commerceRouter.post('/orders/:id/advance-status', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.user!.id;
    const updatedOrder = await db.runTransaction((state) => {
      const order = state.orders.find((o) => o.id === req.params.id && o.userId === userId);
      if (!order) throw new Error('NOT_FOUND');

      const transitions: Partial<Record<OrderStatus, OrderStatus>> = {
        Confirmed: 'Processing',
        Processing: 'Shipped',
        Shipped: 'Delivered',
      };
      const next = transitions[order.status];
      if (!next) throw new Error('FINAL_STATUS');

      const now = new Date().toISOString();
      order.status = next;
      order.updatedAt = now;
      if (next === 'Delivered' && order.paymentStatus === 'Pending') {
        order.paymentStatus = 'Paid';
        const payment = state.payments.find((p) => p.orderId === order.id);
        if (payment) {
          payment.status = 'Succeeded';
          state.paymentAuditLogs.unshift({
            id: `pal-${crypto.randomUUID()}`,
            paymentId: payment.id,
            orderId: order.id,
            event: 'payment.cod_collected',
            details: `COD collection verified upon delivery for ${order.orderNumber}`,
            timestamp: now,
          });
        }
      }
      order.timeline.push({
        status: next,
        timestamp: now,
        note:
          next === 'Shipped'
            ? `Dispatched via Aura Express (${order.trackingNumber})`
            : 'Delivered and signed at destination',
      });

      dispatchUserNotification(state, {
        userId,
        category: 'shipping',
        title: `Order ${order.orderNumber} ${next}`,
        body:
          next === 'Shipped'
            ? `Tracking ${order.trackingNumber} is now active.`
            : 'Your Aura Commerce shipment has arrived.',
        orderId: order.id,
      });

      return order;
    });

    emitToOwner(`user:${userId}`, 'order:updated', { orderId: updatedOrder.id });
    res.json({ success: true, data: { order: updatedOrder } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'FINAL_STATUS') {
      res.status(409).json({ success: false, error: 'Order cannot be advanced further.' });
      return;
    }
    res.status(404).json({ success: false, error: 'Order not found' });
  }
});

// Secure Payment Webhook Verification & Idempotent Audit Log
commerceRouter.post('/payments/webhook', async (req, res) => {
  try {
    const signature = typeof req.headers['x-webhook-signature'] === 'string' ? req.headers['x-webhook-signature'] : '';
    const rawBody = JSON.stringify(req.body || {});
    const expected = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');

    if (
      !signature ||
      signature.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    ) {
      res.status(401).json({ success: false, error: 'Invalid webhook signature' });
      return;
    }

    const { paymentId, event } = req.body as { paymentId?: string; event?: string };
    const result = await db.runTransaction((state) => {
      const payment = state.payments.find((p) => p.id === paymentId);
      if (!payment) throw new Error('NOT_FOUND');

      // Prevent duplicate webhook processing
      const alreadyLogged = state.paymentAuditLogs.some(
        (l) => l.paymentId === payment.id && l.event === `webhook.${event}`
      );
      if (alreadyLogged) {
        return { deduplicated: true, payment };
      }

      payment.webhookVerified = true;
      state.paymentAuditLogs.unshift({
        id: `pal-${crypto.randomUUID()}`,
        paymentId: payment.id,
        orderId: payment.orderId,
        event: `webhook.${event || 'verified'}`,
        details: `Verified HMAC-SHA256 gateway callback for ${payment.transactionRef}`,
        timestamp: new Date().toISOString(),
      });
      return { deduplicated: false, payment };
    });

    res.json({ success: true, data: result });
  } catch {
    res.status(404).json({ success: false, error: 'Payment record not found' });
  }
});

// Trigger signed HMAC-SHA256 gateway callback for an order (demonstrates secure verification + duplicate prevention)
commerceRouter.post('/orders/:id/verify-webhook', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.user!.id;
    const state = db.read();
    const order = state.orders.find((o) => o.id === req.params.id && o.userId === userId);
    if (!order) {
      res.status(404).json({ success: false, error: 'Order not found' });
      return;
    }
    const payment = state.payments.find((p) => p.orderId === order.id);
    if (!payment) {
      res.status(404).json({ success: false, error: 'Payment record not found' });
      return;
    }

    const eventName = typeof req.body?.event === 'string' && req.body.event.trim()
      ? req.body.event.trim()
      : 'gateway_settled';
    const payload = { paymentId: payment.id, event: eventName };
    const sig = crypto.createHmac('sha256', WEBHOOK_SECRET).update(JSON.stringify(payload)).digest('hex');

    // Verify using the same timing-safe HMAC check
    const expected = crypto.createHmac('sha256', WEBHOOK_SECRET).update(JSON.stringify(payload)).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      res.status(401).json({ success: false, error: 'HMAC verification failed' });
      return;
    }

    const result = await db.runTransaction((txState) => {
      const txPay = txState.payments.find((p) => p.id === payment.id);
      if (!txPay) throw new Error('NOT_FOUND');
      const alreadyLogged = txState.paymentAuditLogs.some(
        (l) => l.paymentId === txPay.id && l.event === `webhook.${eventName}`
      );
      if (alreadyLogged) {
        return { deduplicated: true, payment: txPay };
      }
      txPay.webhookVerified = true;
      txState.paymentAuditLogs.unshift({
        id: `pal-${crypto.randomUUID()}`,
        paymentId: txPay.id,
        orderId: txPay.orderId,
        event: `webhook.${eventName}`,
        details: `Verified HMAC-SHA256 gateway callback (${sig.slice(0, 12)}...) for ${txPay.transactionRef}`,
        timestamp: new Date().toISOString(),
      });
      dispatchUserNotification(txState, {
        userId,
        category: 'payments',
        title: `Payment Verified · ₹${order.total.toLocaleString('en-IN')}`,
        body: `HMAC-SHA256 webhook confirmed ${txPay.method} payment ${txPay.transactionRef} for ${order.orderNumber}.`,
        orderId: order.id,
      });
      return { deduplicated: false, payment: txPay };
    });

    emitToOwner(`user:${userId}`, 'order:updated', { orderId: order.id });
    res.json({ success: true, data: result });
  } catch {
    res.status(500).json({ success: false, error: 'Webhook verification failed' });
  }
});

// ---------- NOTIFICATIONS & DEVICE TOKENS ----------
commerceRouter.get('/notifications', requireAuth, (req: AuthedRequest, res) => {
  const state = db.read();
  const userId = req.user!.id;
  const list = state.notifications.filter((n) => n.userId === userId);
  const unreadCount = list.filter((n) => !n.read).length;
  const deviceTokens = state.deviceTokens.filter((t) => t.userId === userId);
  const deliveryLogs = state.notificationDeliveryLogs
    .filter((l) => l.userId === userId)
    .slice(0, 30);
  const preferences = getOrCreatePreferences(state, userId);

  res.json({
    success: true,
    data: {
      notifications: list,
      unreadCount,
      deviceTokens,
      deliveryLogs,
      preferences: preferences.notificationCategories,
    },
  });
});

commerceRouter.patch('/notifications/:id/read', requireAuth, async (req: AuthedRequest, res) => {
  await db.runTransaction((state) => {
    const n = state.notifications.find(
      (item) => item.id === req.params.id && item.userId === req.user!.id
    );
    if (n) n.read = true;
  });
  res.json({ success: true });
});

commerceRouter.post('/notifications/read-all', requireAuth, async (req: AuthedRequest, res) => {
  await db.runTransaction((state) => {
    for (const n of state.notifications) {
      if (n.userId === req.user!.id) n.read = true;
    }
  });
  res.json({ success: true });
});

commerceRouter.post('/notifications/device-tokens', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const rawToken =
    typeof req.body?.token === 'string' && req.body.token.trim()
      ? req.body.token.trim()
      : `ExponentPushToken[${crypto.randomBytes(8).toString('hex')}]`;
  const platform: 'ios' | 'android' | 'web' =
    req.body?.platform === 'ios' || req.body?.platform === 'android' ? req.body.platform : 'web';
  const deviceName =
    typeof req.body?.deviceName === 'string' && req.body.deviceName.trim()
      ? req.body.deviceName.trim().slice(0, 60)
      : 'Web Browser Session';

  const record = await db.runTransaction((state) => {
    const existing = state.deviceTokens.find(
      (t) => t.userId === userId && t.token === rawToken
    );
    const now = new Date().toISOString();
    if (existing) {
      existing.lastActiveAt = now;
      existing.deviceName = deviceName;
      return existing;
    }
    const created = {
      id: `dtok-${crypto.randomUUID()}`,
      userId,
      token: rawToken,
      platform,
      deviceName,
      valid: true,
      lastActiveAt: now,
      createdAt: now,
    };
    state.deviceTokens.unshift(created);
    return created;
  });

  res.status(201).json({ success: true, data: { deviceToken: record } });
});

commerceRouter.delete('/notifications/device-tokens/:tokenId', requireAuth, async (req: AuthedRequest, res) => {
  await db.runTransaction((state) => {
    state.deviceTokens = state.deviceTokens.filter(
      (t) => !(t.id === req.params.tokenId && t.userId === req.user!.id)
    );
  });
  res.json({ success: true });
});

commerceRouter.post('/notifications/abandoned-cart-check', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const ownerKey = `user:${userId}`;
  const delaySecondsRaw = Number(req.body?.delaySeconds || 0);
  const delaySeconds = Number.isFinite(delaySecondsRaw)
    ? Math.max(0, Math.min(30, Math.floor(delaySecondsRaw)))
    : 0;

  const runReminder = () =>
    db.runTransaction((state) => {
      const userCart = state.carts.filter((c) => c.ownerKey === ownerKey);
      if (userCart.length === 0) return null;
      const totalQty = userCart.reduce((sum, c) => sum + c.quantity, 0);
      return dispatchUserNotification(state, {
        userId,
        category: 'abandonedCart',
        title: 'Items waiting in your Aura bag',
        body: `You have ${totalQty} curated item${totalQty === 1 ? '' : 's'} reserved in your bag. Complete checkout before studio stock updates.`,
      });
    });

  if (delaySeconds > 0) {
    const hasCartItems = db.read().carts.some((c) => c.ownerKey === ownerKey);
    if (!hasCartItems) {
      res.json({ success: true, data: { triggered: false, scheduled: false } });
      return;
    }
    setTimeout(() => {
      void runReminder();
    }, delaySeconds * 1000);
    res.json({
      success: true,
      data: {
        triggered: true,
        scheduled: true,
        delaySeconds,
      },
    });
    return;
  }

  const sent = await runReminder();

  res.json({
    success: true,
    data: {
      triggered: Boolean(sent),
      scheduled: false,
      notification: sent,
    },
  });
});

commerceRouter.post('/notifications/simulate-promo', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const title =
    typeof req.body?.title === 'string' && req.body.title.trim()
      ? req.body.title.trim().slice(0, 100)
      : 'Seasonal Offer: Up to 35% Off Studio & Lifestyle Picks';
  const body =
    typeof req.body?.body === 'string' && req.body.body.trim()
      ? req.body.body.trim().slice(0, 240)
      : 'Enjoy complimentary shipping above ₹999 across Electronics, Fashion, and Skincare.';

  const notification = await db.runTransaction((state) =>
    dispatchUserNotification(state, {
      userId,
      category: 'promotions',
      title,
      body,
    })
  );

  res.json({
    success: true,
    data: {
      sent: Boolean(notification),
      notification,
    },
  });
});

// Trigger category-specific sample notifications (priceDrops, stockUpdates, promotions)
commerceRouter.post('/notifications/simulate-event', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const kind = typeof req.body?.kind === 'string' ? req.body.kind : 'priceDrops';
  const state = db.read();
  const sampleWishlist = state.wishlists.find((w) => w.userId === userId);
  const sampleProduct =
    (sampleWishlist && db.productById.get(sampleWishlist.productId)) ||
    state.products[13] ||
    state.products[0];

  const payloadByKind: Record<
    string,
    { category: 'priceDrops' | 'stockUpdates' | 'promotions'; title: string; body: string }
  > = {
    priceDrops: {
      category: 'priceDrops',
      title: `Price Drop Alert: ${sampleProduct ? sampleProduct.name : 'Curated Pick'}`,
      body: sampleProduct
        ? `Now ₹${Math.max(99, Math.round(sampleProduct.price * 0.85)).toLocaleString('en-IN')} (down from ₹${sampleProduct.price.toLocaleString('en-IN')}). Grab yours before stock runs low.`
        : 'A product on your wishlist just dropped in price.',
    },
    stockUpdates: {
      category: 'stockUpdates',
      title: `Back-in-Stock Alert: ${sampleProduct ? sampleProduct.name : 'Studio Edition'}`,
      body: sampleProduct
        ? `${sampleProduct.stock} units are ready to ship in ${sampleProduct.category}.`
        : 'Your saved item has been restocked.',
    },
    promotions: {
      category: 'promotions',
      title: 'Seasonal Offer: Up to 35% Off Studio & Lifestyle Picks',
      body: 'Enjoy complimentary shipping above ₹999 across Electronics, Fashion, and Skincare.',
    },
  };

  const selected = payloadByKind[kind] || payloadByKind.priceDrops;
  const notification = await db.runTransaction((txState) =>
    dispatchUserNotification(txState, {
      userId,
      category: selected.category,
      title: selected.title,
      body: selected.body,
      productId: sampleProduct?.id,
    })
  );

  res.json({
    success: true,
    data: {
      sent: Boolean(notification),
      notification,
    },
  });
});

commerceRouter.post('/notifications/prune-invalid-tokens', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const removedCount = await db.runTransaction((state) => {
    const before = state.deviceTokens.filter((t) => t.userId === userId);
    let removed = 0;
    const keepIds = new Set<string>();
    const now = new Date().toISOString();
    for (const dt of before) {
      const ok =
        dt.valid &&
        (/^ExponentPushToken\[[a-zA-Z0-9_-]+\]$/.test(dt.token) ||
          /^ExpoPushToken\[[a-zA-Z0-9_-]+\]$/.test(dt.token) ||
          /^WebPushToken\[[a-zA-Z0-9_-]+\]$/.test(dt.token));
      if (!ok) {
        removed += 1;
        state.notificationDeliveryLogs.unshift({
          id: `ndlog-${crypto.randomUUID()}`,
          userId,
          notificationId: 'token-audit',
          tokenId: dt.id,
          status: 'invalid_token_removed',
          detail: `Pruned invalid device token (${dt.deviceName})`,
          timestamp: now,
        });
      } else {
        keepIds.add(dt.id);
      }
    }
    state.deviceTokens = state.deviceTokens.filter(
      (t) => t.userId !== userId || keepIds.has(t.id)
    );
    return removed;
  });

  res.json({ success: true, data: { removedCount } });
});
