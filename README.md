# Aura Commerce (SmartCart Storefront)

Full-stack e-commerce web application built with **React + TypeScript + Tailwind CSS v4** on the frontend and **Node.js + Express + Socket.IO** on the backend, running unified on port `3000`.

## Implemented Features

1. **Recently Viewed & Activity Tracking**: Tracks up to 20 unique products for both anonymous sessions (`x-session-id`) and authenticated accounts, merges guest history seamlessly on login, syncs across devices via Socket.IO, and powers the **Continue Shopping** section with viewed-but-unpurchased items.
2. **Dynamic Theme & Personalization**: Auto-detects OS preference on first visit (`system`), supports manual `light`/`dark` selection, custom accent presets (`bronze`, `sage`, `slate`, `obsidian`), and `highContrast` mode persisted locally and synced to the user profile.
3. **Real-Time Push Notifications**: Category-level controls (`orders`, `payments`, `shipping`, `priceDrops`, `stockUpdates`, `promotions`, `abandonedCart`), device push token registration, invalid token pruning, delivery audit logs, and abandoned-cart reminder triggers.
4. **Order & Transaction Management**: Paginated/sorted/filtered order history, item timelines, one-click reorder, status-aware cancellations & return requests, client-side PDF tax invoice downloads (`jsPDF`), idempotent payment processing, and HMAC-verified payment webhooks.
5. **Smart Shopping Cart & Save for Later**: Preserves selected variants (`size`, `color`, `finish`), syncs across devices, validates live stock & price changes prior to checkout, and guards mutations with serialized atomic transactions.
6. **You May Also Like Recommendations**: Scores in-stock, unpurchased products from up to 50 recent browsing records, wishlist items, purchase categories, and user preferences.
7. **Storefront, Reviews, Support & Admin Dashboard**: Promotional banners, category directory, Trending & Featured highlights, 65-product paginated catalog, verified buyer reviews, Contact Us & searchable FAQ, and a role-protected Admin Dashboard for product/inventory CRUD, order/return processing, customer overview, and transaction monitoring.

---

## Database Structure (`server/db.ts` & `data/aura-commerce.json`)

Collections & in-memory indexes (`userByEmail`, `userById`, `productById`, `productsByCategory`, `paymentByIdempotency`):

- `users`: `{ id, name, email, passwordHash (scrypt), role ('customer' | 'admin'), phone, defaultAddress, createdAt, updatedAt }`
- `products`: `{ id, slug, name, brand, category, subcategory, price, compareAtPrice, discountPercentage, rating, reviewCount, description, materials, dimensions, specifications, image, stock, popularityScore, featured, variants, isAvailable, updatedAt }`
- `reviews`: `{ id, productId, userId, userName, rating, title, comment, verifiedPurchase, createdAt }`
- `contactMessages`: `{ id, name, email, subject, orderNumber, message, userId, status, createdAt }`
- `recentlyViewed`: `{ ownerKey, productId, viewedAt }` (latest 20 per owner)
- `browsingHistory`: `{ ownerKey, productId, viewCount, lastViewedAt }` (latest 50 per owner)
- `wishlists`: `{ userId, productId, addedPrice, createdAt }`
- `carts`: `{ id, ownerKey, productId, variant, variantKey, quantity, unitPriceAtAdd, addedAt, updatedAt }`
- `savedItems`: `{ id, userId, productId, variant, variantKey, savedPrice, savedAt }`
- `orders`: `{ id, orderNumber, userId, items, subtotal, tax, shippingFee, total, status, shippingAddress, paymentMethod, paymentStatus, invoiceNumber, trackingNumber, timeline, createdAt, updatedAt }`
- `payments`: `{ id, orderId, userId, idempotencyKey, amount, currency, method, status, transactionRef, webhookVerified, createdAt }`
- `paymentAuditLogs`: `{ id, paymentId, orderId, event, details, timestamp }`
- `notifications`, `notificationDeliveryLogs`, `deviceTokens`, `userPreferences`

---

## REST API Documentation

### Authentication & Preferences
- `POST /api/auth/register` — Register user & merge anonymous session
- `POST /api/auth/login` — Authenticate user, issue JWT & merge anonymous session
- `POST /api/auth/logout` — Log out session
- `GET /api/auth/me` — Fetch current user & preferences
- `PATCH /api/auth/profile` — Update profile name, phone & default address
- `GET /api/preferences` / `PATCH /api/preferences` — Read/update theme, accent, high contrast, favorite categories & notification prefs

### Products, Reviews & Discovery
- `GET /api/products` — Query catalog (`q`, `category`, `subcategory`, `inStock`, `sort`, `page`, `limit`)
- `GET /api/products/export` — Export raw 65-product SmartCart JSON dataset
- `GET /api/products/:id` — Product detail by ID or slug
- `GET /api/products/:id/reviews` / `POST /api/products/:id/reviews` — Read/publish product reviews
- `POST /api/products/:id/simulate-price-drop` — Trigger 15% price drop & notify wishlist watchers
- `POST /api/products/:id/simulate-restock` — Restock product & dispatch back-in-stock notifications
- `GET /api/recently-viewed` / `POST /api/recently-viewed` / `DELETE /api/recently-viewed/:productId`
- `GET /api/recommendations` — Personalized You May Also Like feed

### Cart, Wishlist, Orders & Notifications
- `GET /api/wishlist` / `POST /api/wishlist/toggle`
- `GET /api/cart` / `POST /api/cart/items` / `PATCH /api/cart/items/:id` / `DELETE /api/cart/items/:id`
- `POST /api/cart/save-for-later/:id` / `GET /api/saved-items` / `POST /api/saved-items/:id/move-to-cart` / `DELETE /api/saved-items/:id`
- `POST /api/checkout` — Idempotent atomic order + payment creation + webhook signature verification
- `GET /api/orders` / `GET /api/orders/:id` / `POST /api/orders/:id/reorder` / `POST /api/orders/:id/cancel` / `POST /api/orders/:id/return`
- `GET /api/notifications` / `PATCH /api/notifications/:id/read` / `POST /api/notifications/read-all`
- `POST /api/notifications/device-tokens` / `DELETE /api/notifications/device-tokens/:id`
- `POST /api/notifications/abandoned-cart-check` / `POST /api/notifications/prune-invalid-tokens`

### Support & Admin Operations
- `POST /api/support/contact` / `GET /api/support/my-messages`
- `GET /api/admin/setup-status` / `POST /api/admin/claim-setup`
- `GET /api/admin/overview` — Admin metrics, catalog, orders, customers, payments & inquiries
- `POST /api/admin/products` / `PATCH /api/admin/products/:id` / `DELETE /api/admin/products/:id`
- `PATCH /api/admin/orders/:id` — Update order fulfillment status or approve return & refund
- `PATCH /api/admin/contact/:id` — Mark customer inquiry reviewed

---

## Development & Production Deployment

```bash
# 1. Install dependencies
npm install

# 2. Configure optional secrets in environment (see .env.example)
# JWT_SECRET, PAYMENT_WEBHOOK_SECRET, ADMIN_PASSCODE

# 3. Start full-stack dev server on port 3000
npm run dev

# 4. Build frontend bundle & run production server
npm run build
npm start
```
