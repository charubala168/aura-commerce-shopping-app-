import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  applyThemeToDocument,
  loadStoredTheme,
  saveStoredTheme,
  type StoredThemeConfig,
} from '../config/theme.ts';
import type {
  AccentPreset,
  DeviceTokenRecord,
  EnrichedCartItem,
  EnrichedSavedItem,
  NotificationCategoryPrefs,
  NotificationDeliveryLog,
  NotificationRecord,
  OrderRecord,
  Product,
  PublicUser,
  RecommendationItem,
  SelectedVariant,
  ThemeMode,
  UserPreferences,
} from '../types/ecommerce.ts';

export type AppRoute =
  | { view: 'splash' }
  | { view: 'home' }
  | { view: 'catalog'; category?: string }
  | { view: 'product'; productId: string }
  | { view: 'recently-viewed' }
  | { view: 'recommendations' }
  | { view: 'saved'; tab: 'wishlist' | 'later' }
  | { view: 'cart' }
  | { view: 'checkout' }
  | { view: 'orders' }
  | { view: 'order-detail'; orderId: string }
  | { view: 'invoice'; orderId: string }
  | { view: 'notifications' }
  | { view: 'account'; tab: 'profile' | 'theme' }
  | { view: 'contact' }
  | { view: 'faq' }
  | { view: 'admin' }
  | { view: 'auth'; mode: 'login' | 'register' };

interface ToastMessage {
  id: string;
  text: string;
  tone: 'info' | 'success' | 'error';
}

interface StoreContextValue {
  route: AppRoute;
  navigate: (next: AppRoute) => void;
  user: PublicUser | null;
  authToken: string | null;
  preferences: UserPreferences | null;
  themeConfig: StoredThemeConfig;
  updateThemeConfig: (partial: Partial<StoredThemeConfig>) => Promise<void>;
  updateFavoriteCategories: (categories: string[]) => Promise<void>;
  products: Product[];
  categories: string[];
  productsLoading: boolean;
  productsError: string | null;
  recentlyViewed: Array<{ product: Product; viewedAt: string }>;
  continueShopping: Array<{ product: Product; viewedAt: string }>;
  recommendations: RecommendationItem[];
  wishlistIds: Set<string>;
  wishlistItems: Array<{ product: Product; addedPrice: number; priceDropAmount: number; createdAt: string }>;
  cartItems: EnrichedCartItem[];
  cartSubtotal: number;
  cartCount: number;
  hasPriceChanges: boolean;
  hasStockIssues: boolean;
  cartDrawerOpen: boolean;
  setCartDrawerOpen: (open: boolean) => void;
  savedItems: EnrichedSavedItem[];
  notifications: NotificationRecord[];
  unreadNotificationCount: number;
  deviceTokens: DeviceTokenRecord[];
  deliveryLogs: NotificationDeliveryLog[];
  notifPrefs: NotificationCategoryPrefs;
  socketConnected: boolean;
  toast: ToastMessage | null;
  showToast: (text: string, tone?: 'info' | 'success' | 'error') => void;
  // Actions
  login: (email: string, password: string) => Promise<boolean>;
  register: (name: string, email: string, password: string) => Promise<boolean>;
  applyAuthSession: (token: string, user: PublicUser, prefs: UserPreferences) => void;
  logout: () => Promise<void>;
  updateProfile: (payload: {
    name?: string;
    phone?: string;
    defaultAddress?: PublicUser['defaultAddress'];
  }) => Promise<boolean>;
  recordProductView: (productId: string) => Promise<void>;
  removeRecentlyViewed: (productId: string) => Promise<void>;
  clearRecentlyViewed: () => Promise<void>;
  toggleWishlist: (productId: string) => Promise<void>;
  addToCart: (productId: string, quantity?: number, variant?: SelectedVariant) => Promise<boolean>;
  updateCartItem: (
    itemId: string,
    payload: { quantity?: number; acceptPriceChange?: boolean }
  ) => Promise<boolean>;
  removeCartItem: (itemId: string) => Promise<void>;
  saveForLater: (itemId: string) => Promise<void>;
  moveSavedToCart: (savedItemId: string) => Promise<void>;
  removeSavedItem: (savedItemId: string) => Promise<void>;
  simulatePriceDrop: (productId: string) => Promise<void>;
  simulateRestock: (productId: string) => Promise<void>;
  refreshAll: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  updateNotificationCategoryPrefs: (partial: Partial<NotificationCategoryPrefs>) => Promise<void>;
  registerDeviceToken: (deviceName: string, platform: 'web' | 'ios' | 'android', customToken?: string) => Promise<void>;
  removeDeviceToken: (tokenId: string) => Promise<void>;
  triggerAbandonedCartCheck: (delaySeconds?: number) => Promise<void>;
  triggerPromoNotification: () => Promise<void>;
  triggerSampleNotification: (kind: 'priceDrops' | 'stockUpdates' | 'promotions') => Promise<void>;
  switchDemoAccount: (email?: 'aarav@auracommerce.in' | 'maya@auracommerce.in') => Promise<boolean>;
  pruneInvalidTokens: () => Promise<void>;
  apiFetch: <T>(url: string, options?: RequestInit) => Promise<{ ok: boolean; data?: T; error?: string }>;
  activeOrdersSnapshot: OrderRecord[];
  setActiveOrdersSnapshot: React.Dispatch<React.SetStateAction<OrderRecord[]>>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

function getOrCreateAnonSessionId(): string {
  const key = 'aura_anon_session_id';
  try {
    const existing = localStorage.getItem(key);
    if (existing && /^[a-zA-Z0-9_-]{8,64}$/.test(existing)) return existing;
    const created = `sess_${Math.random().toString(36).slice(2, 14)}${Date.now().toString(36)}`;
    localStorage.setItem(key, created);
    return created;
  } catch {
    return `sess_${Math.random().toString(36).slice(2, 14)}`;
  }
}

const DEFAULT_NOTIF_PREFS: NotificationCategoryPrefs = {
  orders: true,
  payments: true,
  shipping: true,
  priceDrops: true,
  stockUpdates: true,
  promotions: true,
  abandonedCart: true,
};

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [route, setRoute] = useState<AppRoute>({ view: 'home' });
  // Security rule: keep Bearer JWT strictly in React state (never localStorage/sessionStorage)
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [user, setUser] = useState<PublicUser | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [themeConfig, setThemeConfig] = useState<StoredThemeConfig>(() => loadStoredTheme());

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState<string | null>(null);

  const [recentlyViewed, setRecentlyViewed] = useState<Array<{ product: Product; viewedAt: string }>>([]);
  const [continueShopping, setContinueShopping] = useState<Array<{ product: Product; viewedAt: string }>>([]);
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [wishlistItems, setWishlistItems] = useState<
    Array<{ product: Product; addedPrice: number; priceDropAmount: number; createdAt: string }>
  >([]);

  const [cartItems, setCartItems] = useState<EnrichedCartItem[]>([]);
  const [cartSubtotal, setCartSubtotal] = useState(0);
  const [cartCount, setCartCount] = useState(0);
  const [hasPriceChanges, setHasPriceChanges] = useState(false);
  const [hasStockIssues, setHasStockIssues] = useState(false);
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);

  const [savedItems, setSavedItems] = useState<EnrichedSavedItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [deviceTokens, setDeviceTokens] = useState<DeviceTokenRecord[]>([]);
  const [deliveryLogs, setDeliveryLogs] = useState<NotificationDeliveryLog[]>([]);
  const [notifPrefs, setNotifPrefs] = useState<NotificationCategoryPrefs>(DEFAULT_NOTIF_PREFS);
  const [activeOrdersSnapshot, setActiveOrdersSnapshot] = useState<OrderRecord[]>([]);

  const [socketConnected, setSocketConnected] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const anonSessionId = useMemo(() => getOrCreateAnonSessionId(), []);
  const socketRef = useRef<Socket | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((text: string, tone: 'info' | 'success' | 'error' = 'info') => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToast({ id: String(Date.now()), text, tone });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
    }, 3600);
  }, []);

  const navigate = useCallback((next: AppRoute) => {
    setRoute(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Apply theme to DOM and listen to OS system color-scheme changes
  useEffect(() => {
    applyThemeToDocument(themeConfig);
    saveStoredTheme(themeConfig);

    if (themeConfig.themeMode === 'system' && window.matchMedia) {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => applyThemeToDocument(themeConfig);
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    }
  }, [themeConfig]);

  const apiFetch = useCallback(
    async <T,>(
      url: string,
      options: RequestInit = {}
    ): Promise<{ ok: boolean; data?: T; error?: string }> => {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'x-session-id': anonSessionId,
          ...(options.headers as Record<string, string> | undefined),
        };
        if (authToken) {
          headers['Authorization'] = `Bearer ${authToken}`;
        }
        const res = await fetch(url, { ...options, headers });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json.success === false) {
          return { ok: false, error: json.error || `Request failed (${res.status})` };
        }
        return { ok: true, data: json.data as T };
      } catch {
        return { ok: false, error: 'Network connection unavailable' };
      }
    },
    [anonSessionId, authToken]
  );

  const fetchProducts = useCallback(async () => {
    setProductsLoading(true);
    setProductsError(null);
    const res = await apiFetch<{ products: Product[]; categories: string[] }>('/api/products');
    if (res.ok && res.data) {
      setProducts(res.data.products);
      setCategories(res.data.categories);
    } else {
      setProductsError(res.error || 'Unable to load product catalogue');
    }
    setProductsLoading(false);
  }, [apiFetch]);

  const fetchRecentlyViewed = useCallback(async () => {
    const res = await apiFetch<{
      items: Array<{ product: Product; viewedAt: string }>;
      unpurchasedItems?: Array<{ product: Product; viewedAt: string }>;
    }>('/api/recently-viewed');
    if (res.ok && res.data) {
      setRecentlyViewed(res.data.items);
      setContinueShopping(res.data.unpurchasedItems || res.data.items);
    }
  }, [apiFetch]);

  const fetchRecommendations = useCallback(async () => {
    const res = await apiFetch<{ recommendations: RecommendationItem[] }>(
      '/api/recommendations?limit=8'
    );
    if (res.ok && res.data) {
      setRecommendations(res.data.recommendations);
    }
  }, [apiFetch]);

  const fetchCart = useCallback(async () => {
    const res = await apiFetch<{
      items: EnrichedCartItem[];
      subtotal: number;
      itemCount: number;
      hasPriceChanges: boolean;
      hasStockIssues: boolean;
    }>('/api/cart');
    if (res.ok && res.data) {
      setCartItems(res.data.items);
      setCartSubtotal(res.data.subtotal);
      setCartCount(res.data.itemCount);
      setHasPriceChanges(res.data.hasPriceChanges);
      setHasStockIssues(res.data.hasStockIssues);
    }
  }, [apiFetch]);

  const fetchAuthedCollections = useCallback(async () => {
    if (!authToken) {
      setWishlistItems([]);
      setSavedItems([]);
      setNotifications([]);
      setUnreadNotificationCount(0);
      setDeviceTokens([]);
      setDeliveryLogs([]);
      return;
    }
    const [wishRes, savedRes, notifRes] = await Promise.all([
      apiFetch<{
        items: Array<{ product: Product; addedPrice: number; priceDropAmount: number; createdAt: string }>;
      }>('/api/wishlist'),
      apiFetch<{ items: EnrichedSavedItem[] }>('/api/saved-items'),
      apiFetch<{
        notifications: NotificationRecord[];
        unreadCount: number;
        deviceTokens: DeviceTokenRecord[];
        deliveryLogs: NotificationDeliveryLog[];
        preferences: NotificationCategoryPrefs;
      }>('/api/notifications'),
    ]);

    if (wishRes.ok && wishRes.data) setWishlistItems(wishRes.data.items);
    if (savedRes.ok && savedRes.data) setSavedItems(savedRes.data.items);
    if (notifRes.ok && notifRes.data) {
      setNotifications(notifRes.data.notifications);
      setUnreadNotificationCount(notifRes.data.unreadCount);
      setDeviceTokens(notifRes.data.deviceTokens);
      setDeliveryLogs(notifRes.data.deliveryLogs);
      setNotifPrefs(notifRes.data.preferences);
    }
  }, [apiFetch, authToken]);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      fetchProducts(),
      fetchRecentlyViewed(),
      fetchRecommendations(),
      fetchCart(),
      fetchAuthedCollections(),
    ]);
  }, [fetchProducts, fetchRecentlyViewed, fetchRecommendations, fetchCart, fetchAuthedCollections]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  // Real-time Socket.IO connection (enabled when server supports WebSockets)
  useEffect(() => {
    let active = true;
    let socket: Socket | null = null;

    const connectRealtime = async () => {
      try {
        const res = await fetch('/api/health');
        if (res.ok) {
          const health = (await res.json().catch(() => null)) as { realtime?: boolean } | null;
          if (health && health.realtime === false) {
            return;
          }
        }
      } catch {
        // Proceed with Socket.IO attempt if health check fails transiently
      }

      if (!active) return;

      socket = io('/', {
        auth: {
          token: authToken || '',
          sessionId: anonSessionId,
        },
        reconnectionAttempts: 5,
      });
      socketRef.current = socket;

      socket.on('connect', () => setSocketConnected(true));
      socket.on('disconnect', () => setSocketConnected(false));

      socket.on('cart:updated', () => {
        void fetchCart();
        void fetchAuthedCollections();
      });
      socket.on('recentlyViewed:updated', () => {
        void fetchRecentlyViewed();
        void fetchRecommendations();
      });
      socket.on('wishlist:updated', () => {
        void fetchAuthedCollections();
        void fetchRecommendations();
      });
      socket.on('catalog:updated', () => {
        void fetchProducts();
        void fetchCart();
        void fetchAuthedCollections();
      });
      socket.on('preferences:updated', (prefs: UserPreferences) => {
        setPreferences(prefs);
        setThemeConfig({
          themeMode: prefs.themeMode,
          accentPreset: prefs.accentPreset,
          highContrast: prefs.highContrast,
        });
        setNotifPrefs(prefs.notificationCategories);
      });
      socket.on('notification:new', (notif: NotificationRecord) => {
        setNotifications((prev) => [notif, ...prev.filter((n) => n.id !== notif.id)]);
        setUnreadNotificationCount((c) => c + 1);
        showToast(notif.title, 'info');
        void fetchAuthedCollections();
      });
      socket.on('order:updated', () => {
        void fetchProducts();
        void fetchRecentlyViewed();
        void fetchRecommendations();
      });
    };

    void connectRealtime();

    return () => {
      active = false;
      if (socket) {
        socket.disconnect();
      }
      socketRef.current = null;
      setSocketConnected(false);
    };
  }, [
    anonSessionId,
    authToken,
    fetchAuthedCollections,
    fetchCart,
    fetchProducts,
    fetchRecentlyViewed,
    fetchRecommendations,
    showToast,
  ]);

  const wishlistIds = useMemo(
    () => new Set(wishlistItems.map((w) => w.product.id)),
    [wishlistItems]
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await apiFetch<{
        token: string;
        user: PublicUser;
        preferences: UserPreferences;
      }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok || !res.data) {
        showToast(res.error || 'Sign in failed', 'error');
        return false;
      }
      setAuthToken(res.data.token);
      setUser(res.data.user);
      setPreferences(res.data.preferences);
      setThemeConfig({
        themeMode: res.data.preferences.themeMode,
        accentPreset: res.data.preferences.accentPreset,
        highContrast: res.data.preferences.highContrast,
      });
      showToast(`Signed in as ${res.data.user.name}. Session synced.`, 'success');
      return true;
    },
    [apiFetch, showToast]
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const res = await apiFetch<{
        token: string;
        user: PublicUser;
        preferences: UserPreferences;
      }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name,
          email,
          password,
          themeMode: themeConfig.themeMode,
          accentPreset: themeConfig.accentPreset,
          highContrast: themeConfig.highContrast,
        }),
      });
      if (!res.ok || !res.data) {
        showToast(res.error || 'Registration failed', 'error');
        return false;
      }
      setAuthToken(res.data.token);
      setUser(res.data.user);
      setPreferences(res.data.preferences);
      setThemeConfig({
        themeMode: res.data.preferences.themeMode,
        accentPreset: res.data.preferences.accentPreset,
        highContrast: res.data.preferences.highContrast,
      });
      showToast(`Welcome, ${res.data.user.name}. Your account is ready.`, 'success');
      return true;
    },
    [apiFetch, showToast, themeConfig]
  );

  const applyAuthSession = useCallback(
    (token: string, nextUser: PublicUser, nextPrefs: UserPreferences) => {
      setAuthToken(token);
      setUser(nextUser);
      setPreferences(nextPrefs);
      setThemeConfig({
        themeMode: nextPrefs.themeMode,
        accentPreset: nextPrefs.accentPreset,
        highContrast: nextPrefs.highContrast,
      });
    },
    []
  );

  const switchDemoAccount = useCallback(
    async (targetEmail?: 'aarav@auracommerce.in' | 'maya@auracommerce.in') => {
      const nextEmail =
        targetEmail ||
        (user?.email === 'aarav@auracommerce.in'
          ? 'maya@auracommerce.in'
          : 'aarav@auracommerce.in');
      const res = await apiFetch<{
        token: string;
        user: PublicUser;
        preferences: UserPreferences;
      }>('/api/auth/demo-switch', {
        method: 'POST',
        body: JSON.stringify({ email: nextEmail }),
      });
      if (!res.ok || !res.data) {
        showToast(res.error || 'Could not switch demo account', 'error');
        return false;
      }
      setAuthToken(res.data.token);
      setUser(res.data.user);
      setPreferences(res.data.preferences);
      setThemeConfig({
        themeMode: res.data.preferences.themeMode,
        accentPreset: res.data.preferences.accentPreset,
        highContrast: res.data.preferences.highContrast,
      });
      showToast(`Active account: ${res.data.user.name} (${res.data.user.email})`, 'success');
      return true;
    },
    [apiFetch, showToast, user?.email]
  );

  const logout = useCallback(async () => {
    if (authToken) {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    }
    setAuthToken(null);
    setUser(null);
    setPreferences(null);
    setWishlistItems([]);
    setSavedItems([]);
    setNotifications([]);
    setUnreadNotificationCount(0);
    setActiveOrdersSnapshot([]);
    showToast('Signed out cleanly', 'info');
    navigate({ view: 'home' });
  }, [apiFetch, authToken, navigate, showToast]);

  const updateProfile = useCallback(
    async (payload: {
      name?: string;
      phone?: string;
      defaultAddress?: PublicUser['defaultAddress'];
    }) => {
      const res = await apiFetch<{ user: PublicUser }>('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      if (!res.ok || !res.data) {
        showToast(res.error || 'Profile update failed', 'error');
        return false;
      }
      setUser(res.data.user);
      showToast('Profile details saved', 'success');
      return true;
    },
    [apiFetch, showToast]
  );

  const updateThemeConfig = useCallback(
    async (partial: Partial<StoredThemeConfig>) => {
      const next = { ...themeConfig, ...partial };
      setThemeConfig(next);
      if (authToken) {
        await apiFetch('/api/preferences', {
          method: 'PATCH',
          body: JSON.stringify(partial),
        });
      }
    },
    [apiFetch, authToken, themeConfig]
  );

  const updateFavoriteCategories = useCallback(
    async (cats: string[]) => {
      if (!authToken) {
        showToast('Sign in to save favorite categories', 'info');
        return;
      }
      const res = await apiFetch<{ preferences: UserPreferences }>('/api/preferences', {
        method: 'PATCH',
        body: JSON.stringify({ favoriteCategories: cats }),
      });
      if (res.ok && res.data) {
        setPreferences(res.data.preferences);
        await fetchRecommendations();
        showToast('Recommendation preferences updated', 'success');
      }
    },
    [apiFetch, authToken, fetchRecommendations, showToast]
  );

  const recordProductView = useCallback(
    async (productId: string) => {
      await apiFetch('/api/recently-viewed', {
        method: 'POST',
        body: JSON.stringify({ productId }),
      });
      void fetchRecentlyViewed();
      void fetchRecommendations();
    },
    [apiFetch, fetchRecentlyViewed, fetchRecommendations]
  );

  const removeRecentlyViewed = useCallback(
    async (productId: string) => {
      await apiFetch(`/api/recently-viewed/${productId}`, { method: 'DELETE' });
      void fetchRecentlyViewed();
    },
    [apiFetch, fetchRecentlyViewed]
  );

  const clearRecentlyViewed = useCallback(async () => {
    await apiFetch('/api/recently-viewed', { method: 'DELETE' });
    setRecentlyViewed([]);
    setContinueShopping([]);
    showToast('Recently viewed history cleared', 'info');
  }, [apiFetch, showToast]);

  const toggleWishlist = useCallback(
    async (productId: string) => {
      if (!authToken) {
        showToast('Sign in to save items to your wishlist', 'info');
        navigate({ view: 'auth', mode: 'login' });
        return;
      }
      const res = await apiFetch<{ added: boolean }>('/api/wishlist/toggle', {
        method: 'POST',
        body: JSON.stringify({ productId }),
      });
      if (res.ok && res.data) {
        await fetchAuthedCollections();
        await fetchRecommendations();
        showToast(
          res.data.added ? 'Saved to your wishlist' : 'Removed from wishlist',
          'success'
        );
      }
    },
    [apiFetch, authToken, fetchAuthedCollections, fetchRecommendations, navigate, showToast]
  );

  const addToCart = useCallback(
    async (productId: string, quantity = 1, variant?: SelectedVariant) => {
      const res = await apiFetch('/api/cart/items', {
        method: 'POST',
        body: JSON.stringify({ productId, quantity, variant }),
      });
      if (!res.ok) {
        showToast(res.error || 'Could not add item to bag', 'error');
        return false;
      }
      await fetchCart();
      setCartDrawerOpen(true);
      showToast('Added to shopping bag', 'success');
      return true;
    },
    [apiFetch, fetchCart, showToast]
  );

  const updateCartItem = useCallback(
    async (itemId: string, payload: { quantity?: number; acceptPriceChange?: boolean }) => {
      const res = await apiFetch(`/api/cart/items/${itemId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        showToast(res.error || 'Could not update bag item', 'error');
        return false;
      }
      await fetchCart();
      return true;
    },
    [apiFetch, fetchCart, showToast]
  );

  const removeCartItem = useCallback(
    async (itemId: string) => {
      await apiFetch(`/api/cart/items/${itemId}`, { method: 'DELETE' });
      await fetchCart();
      showToast('Removed from bag', 'info');
    },
    [apiFetch, fetchCart, showToast]
  );

  const saveForLater = useCallback(
    async (itemId: string) => {
      if (!authToken) {
        showToast('Sign in to move items to Save for Later', 'info');
        navigate({ view: 'auth', mode: 'login' });
        return;
      }
      const res = await apiFetch(`/api/cart/save-for-later/${itemId}`, { method: 'POST' });
      if (res.ok) {
        await Promise.all([fetchCart(), fetchAuthedCollections()]);
        showToast('Moved to Save for Later', 'success');
      }
    },
    [apiFetch, authToken, fetchAuthedCollections, fetchCart, navigate, showToast]
  );

  const moveSavedToCart = useCallback(
    async (savedItemId: string) => {
      const res = await apiFetch(`/api/saved-items/${savedItemId}/move-to-cart`, {
        method: 'POST',
      });
      if (!res.ok) {
        showToast(res.error || 'Item cannot be moved to bag', 'error');
        return;
      }
      await Promise.all([fetchCart(), fetchAuthedCollections()]);
      showToast('Moved back to shopping bag', 'success');
    },
    [apiFetch, fetchAuthedCollections, fetchCart, showToast]
  );

  const removeSavedItem = useCallback(
    async (savedItemId: string) => {
      await apiFetch(`/api/saved-items/${savedItemId}`, { method: 'DELETE' });
      await fetchAuthedCollections();
    },
    [apiFetch, fetchAuthedCollections]
  );

  const simulatePriceDrop = useCallback(
    async (productId: string) => {
      if (!authToken) {
        showToast('Sign in to test live price-drop notifications', 'info');
        return;
      }
      const res = await apiFetch<{ oldPrice: number; newPrice: number }>(
        `/api/products/${productId}/simulate-price-drop`,
        { method: 'POST' }
      );
      if (res.ok && res.data) {
        await Promise.all([fetchProducts(), fetchCart(), fetchAuthedCollections()]);
        showToast(
          `Price updated from ₹${res.data.oldPrice.toLocaleString('en-IN')} to ₹${res.data.newPrice.toLocaleString('en-IN')}`,
          'success'
        );
      }
    },
    [apiFetch, authToken, fetchAuthedCollections, fetchCart, fetchProducts, showToast]
  );

  const simulateRestock = useCallback(
    async (productId: string) => {
      if (!authToken) {
        showToast('Sign in to test live restock notifications', 'info');
        return;
      }
      const res = await apiFetch<{ newStock: number; notifiedCount: number }>(
        `/api/products/${productId}/simulate-restock`,
        { method: 'POST' }
      );
      if (res.ok && res.data) {
        await Promise.all([
          fetchProducts(),
          fetchCart(),
          fetchRecommendations(),
          fetchAuthedCollections(),
        ]);
        showToast(`Restocked to ${res.data.newStock} units`, 'success');
      }
    },
    [
      apiFetch,
      authToken,
      fetchAuthedCollections,
      fetchCart,
      fetchProducts,
      fetchRecommendations,
      showToast,
    ]
  );

  const markNotificationRead = useCallback(
    async (id: string) => {
      await apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      setUnreadNotificationCount((c) => Math.max(0, c - 1));
    },
    [apiFetch]
  );

  const markAllNotificationsRead = useCallback(async () => {
    await apiFetch('/api/notifications/read-all', { method: 'POST' });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadNotificationCount(0);
  }, [apiFetch]);

  const updateNotificationCategoryPrefs = useCallback(
    async (partial: Partial<NotificationCategoryPrefs>) => {
      const next = { ...notifPrefs, ...partial };
      setNotifPrefs(next);
      await apiFetch('/api/preferences', {
        method: 'PATCH',
        body: JSON.stringify({ notificationCategories: next }),
      });
      showToast('Notification categories updated', 'success');
    },
    [apiFetch, notifPrefs, showToast]
  );

  const registerDeviceToken = useCallback(
    async (deviceName: string, platform: 'web' | 'ios' | 'android', customToken?: string) => {
      const res = await apiFetch('/api/notifications/device-tokens', {
        method: 'POST',
        body: JSON.stringify({ deviceName, platform, token: customToken }),
      });
      if (res.ok) {
        await fetchAuthedCollections();
        showToast('Device push token registered', 'success');
      }
    },
    [apiFetch, fetchAuthedCollections, showToast]
  );

  const removeDeviceToken = useCallback(
    async (tokenId: string) => {
      await apiFetch(`/api/notifications/device-tokens/${tokenId}`, { method: 'DELETE' });
      await fetchAuthedCollections();
    },
    [apiFetch, fetchAuthedCollections]
  );

  const triggerAbandonedCartCheck = useCallback(
    async (delaySeconds = 0) => {
      const res = await apiFetch<{ triggered: boolean; scheduled?: boolean; delaySeconds?: number }>(
        '/api/notifications/abandoned-cart-check',
        {
          method: 'POST',
          body: JSON.stringify({ delaySeconds }),
        }
      );
      if (res.ok && res.data) {
        await fetchAuthedCollections();
        if (res.data.scheduled) {
          showToast(
            `Scheduled abandoned-cart reminder in ${res.data.delaySeconds}s`,
            'success'
          );
        } else {
          showToast(
            res.data.triggered
              ? 'Abandoned-cart reminder dispatched'
              : 'No abandoned-cart reminder needed (bag empty or category muted)',
            'info'
          );
        }
      }
    },
    [apiFetch, fetchAuthedCollections, showToast]
  );

  const triggerPromoNotification = useCallback(async () => {
    const res = await apiFetch<{ sent: boolean }>('/api/notifications/simulate-promo', {
      method: 'POST',
    });
    if (res.ok && res.data) {
      await fetchAuthedCollections();
      showToast(
        res.data.sent
          ? 'Promotional campaign alert delivered'
          : 'Promotional alerts are muted in your category preferences',
        res.data.sent ? 'success' : 'info'
      );
    }
  }, [apiFetch, fetchAuthedCollections, showToast]);

  const triggerSampleNotification = useCallback(
    async (kind: 'priceDrops' | 'stockUpdates' | 'promotions') => {
      const res = await apiFetch<{ sent: boolean; notification?: NotificationRecord }>(
        '/api/notifications/simulate-event',
        {
          method: 'POST',
          body: JSON.stringify({ kind }),
        }
      );
      if (res.ok && res.data) {
        await fetchAuthedCollections();
        const label =
          kind === 'priceDrops'
            ? 'Wishlist price drop alert'
            : kind === 'stockUpdates'
              ? 'Back-in-stock alert'
              : 'Promotional campaign alert';
        showToast(
          res.data.sent ? `${label} dispatched` : `${label} skipped (category muted)`,
          res.data.sent ? 'success' : 'info'
        );
      }
    },
    [apiFetch, fetchAuthedCollections, showToast]
  );

  const pruneInvalidTokens = useCallback(async () => {
    const res = await apiFetch<{ removedCount: number }>('/api/notifications/prune-invalid-tokens', {
      method: 'POST',
    });
    if (res.ok && res.data) {
      await fetchAuthedCollections();
      showToast(`Removed ${res.data.removedCount} invalid token(s)`, 'info');
    }
  }, [apiFetch, fetchAuthedCollections, showToast]);

  const value: StoreContextValue = {
    route,
    navigate,
    user,
    authToken,
    preferences,
    themeConfig,
    updateThemeConfig,
    updateFavoriteCategories,
    products,
    categories,
    productsLoading,
    productsError,
    recentlyViewed,
    continueShopping,
    recommendations,
    wishlistIds,
    wishlistItems,
    cartItems,
    cartSubtotal,
    cartCount,
    hasPriceChanges,
    hasStockIssues,
    cartDrawerOpen,
    setCartDrawerOpen,
    savedItems,
    notifications,
    unreadNotificationCount,
    deviceTokens,
    deliveryLogs,
    notifPrefs,
    socketConnected,
    toast,
    showToast,
    login,
    register,
    applyAuthSession,
    logout,
    updateProfile,
    recordProductView,
    removeRecentlyViewed,
    clearRecentlyViewed,
    toggleWishlist,
    addToCart,
    updateCartItem,
    removeCartItem,
    saveForLater,
    moveSavedToCart,
    removeSavedItem,
    simulatePriceDrop,
    simulateRestock,
    refreshAll,
    markNotificationRead,
    markAllNotificationsRead,
    updateNotificationCategoryPrefs,
    registerDeviceToken,
    removeDeviceToken,
    triggerAbandonedCartCheck,
    triggerPromoNotification,
    triggerSampleNotification,
    switchDemoAccount,
    pruneInvalidTokens,
    apiFetch,
    activeOrdersSnapshot,
    setActiveOrdersSnapshot,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
