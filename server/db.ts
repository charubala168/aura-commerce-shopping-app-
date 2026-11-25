import fs from 'fs';
import os from 'os';
import path from 'path';
import type {
  BrowsingHistoryEntry,
  CartItemRecord,
  ContactMessage,
  DeviceTokenRecord,
  NotificationDeliveryLog,
  NotificationRecord,
  OrderRecord,
  PaymentAuditLog,
  PaymentRecord,
  Product,
  ProductReview,
  RecentlyViewedEntry,
  SavedItemRecord,
  UserPreferences,
  UserRecord,
  WishlistEntry,
} from '../src/types/ecommerce.ts';

export interface DatabaseSchema {
  users: UserRecord[];
  products: Product[];
  reviews: ProductReview[];
  contactMessages: ContactMessage[];
  recentlyViewed: RecentlyViewedEntry[];
  browsingHistory: BrowsingHistoryEntry[];
  wishlists: WishlistEntry[];
  carts: CartItemRecord[];
  savedItems: SavedItemRecord[];
  orders: OrderRecord[];
  payments: PaymentRecord[];
  paymentAuditLogs: PaymentAuditLog[];
  notifications: NotificationRecord[];
  notificationDeliveryLogs: NotificationDeliveryLog[];
  deviceTokens: DeviceTokenRecord[];
  userPreferences: UserPreferences[];
}

import { resolveDataDir, SEED_PRODUCTS_65 } from './catalogSeed.ts';

const SEED_DATA_DIR = resolveDataDir();
const SEED_DB_FILE = path.join(SEED_DATA_DIR, 'aura-commerce.json');
const IS_SERVERLESS = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const WRITABLE_DATA_DIR = IS_SERVERLESS
  ? path.join(os.tmpdir(), 'aura-commerce-data')
  : SEED_DATA_DIR;
const WRITABLE_DB_FILE = path.join(WRITABLE_DATA_DIR, 'aura-commerce.json');

function createEmptyDb(): DatabaseSchema {
  return {
    users: [],
    products: structuredClone(SEED_PRODUCTS_65),
    reviews: [],
    contactMessages: [],
    recentlyViewed: [],
    browsingHistory: [],
    wishlists: [],
    carts: [],
    savedItems: [],
    orders: [],
    payments: [],
    paymentAuditLogs: [],
    notifications: [],
    notificationDeliveryLogs: [],
    deviceTokens: [],
    userPreferences: [],
  };
}

class AuraDatabase {
  private state: DatabaseSchema;
  private writeQueue: Promise<void> = Promise.resolve();

  // In-memory indexes mirroring MongoDB collection indexes for fast lookups
  public userByEmail = new Map<string, UserRecord>();
  public userById = new Map<string, UserRecord>();
  public productById = new Map<string, Product>();
  public productsByCategory = new Map<string, Product[]>();
  public paymentByIdempotency = new Map<string, PaymentRecord>();

  constructor() {
    this.state = this.loadFromDisk();
    this.rebuildIndexes();
  }

  private loadFromDisk(): DatabaseSchema {
    try {
      const sourceFile = fs.existsSync(WRITABLE_DB_FILE)
        ? WRITABLE_DB_FILE
        : fs.existsSync(SEED_DB_FILE)
          ? SEED_DB_FILE
          : null;

      if (sourceFile) {
        const raw = fs.readFileSync(sourceFile, 'utf-8');
        const parsed = JSON.parse(raw) as Partial<DatabaseSchema>;
        const base = createEmptyDb();
        const hasSmartCartCatalog =
          Array.isArray(parsed.products) &&
          parsed.products.length > 0 &&
          parsed.products.some((p) => typeof p.id === 'string' && p.id.startsWith('sc-'));
        let syncedImages = false;
        let productsList = hasSmartCartCatalog ? parsed.products! : base.products;
        if (hasSmartCartCatalog) {
          const seedById = new Map(base.products.map((p) => [p.id, p]));
          productsList = productsList.map((p) => {
            const seed = seedById.get(p.id);
            if (!seed) return p;
            if (p.image !== seed.image || p.imageFocus !== undefined || p.imageScale !== undefined) {
              syncedImages = true;
              const next = { ...p, image: seed.image };
              delete next.imageFocus;
              delete next.imageScale;
              return next;
            }
            return p;
          });
        }
        const upgraded = {
          ...base,
          ...parsed,
          products: productsList,
        };
        if (!hasSmartCartCatalog || syncedImages || (IS_SERVERLESS && !fs.existsSync(WRITABLE_DB_FILE))) {
          this.persistSync(upgraded);
        }
        return upgraded;
      }
    } catch (err) {
      console.error('Database load warning, initializing fresh store:', err);
    }
    const fresh = createEmptyDb();
    this.persistSync(fresh);
    return fresh;
  }

  private persistSync(snapshot: DatabaseSchema) {
    try {
      if (!fs.existsSync(WRITABLE_DATA_DIR)) {
        fs.mkdirSync(WRITABLE_DATA_DIR, { recursive: true });
      }
      const tmp = `${WRITABLE_DB_FILE}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(snapshot, null, 2), 'utf-8');
      fs.renameSync(tmp, WRITABLE_DB_FILE);
    } catch (err) {
      console.warn('Database persist warning (continuing in-memory):', err);
    }
  }

  public rebuildIndexes() {
    this.userByEmail.clear();
    this.userById.clear();
    for (const u of this.state.users) {
      this.userByEmail.set(u.email.toLowerCase(), u);
      this.userById.set(u.id, u);
    }

    this.productById.clear();
    this.productsByCategory.clear();
    for (const p of this.state.products) {
      this.productById.set(p.id, p);
      const list = this.productsByCategory.get(p.category) || [];
      list.push(p);
      this.productsByCategory.set(p.category, list);
    }

    this.paymentByIdempotency.clear();
    for (const pay of this.state.payments) {
      this.paymentByIdempotency.set(pay.idempotencyKey, pay);
    }
  }

  public read(): DatabaseSchema {
    return this.state;
  }

  /**
   * Serialized atomic transaction with rollback on error (models MongoDB multi-document transactions).
   */
  public async runTransaction<T>(fn: (db: DatabaseSchema) => T | Promise<T>): Promise<T> {
    let release!: () => void;
    const prev = this.writeQueue;
    this.writeQueue = new Promise<void>((res) => {
      release = res;
    });
    await prev;

    const rollbackSnapshot = structuredClone(this.state);
    try {
      const result = await fn(this.state);
      this.rebuildIndexes();
      this.persistSync(this.state);
      return result;
    } catch (err) {
      this.state = rollbackSnapshot;
      this.rebuildIndexes();
      throw err;
    } finally {
      release();
    }
  }
}

export const db = new AuraDatabase();
