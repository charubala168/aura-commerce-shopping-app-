import { useState, type FormEvent } from 'react';
import {
  Bell,
  Check,
  Clock,
  LogOut,
  Palette,
  Plus,
  RefreshCw,
  Send,
  Smartphone,
  Trash2,
  User,
} from 'lucide-react';
import { CURATED_THEME_CARDS, THEME_ICONS } from '../config/theme.ts';
import { useStore } from '../context/StoreContext.tsx';
import type { NotificationCategory, NotificationCategoryPrefs } from '../types/ecommerce.ts';

function formatNotifTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return iso;
  }
}

const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  orders: 'Order Confirmations',
  payments: 'Payment Updates',
  shipping: 'Shipping Delivery',
  priceDrops: 'Wishlist Price Drop',
  stockUpdates: 'Back-in-Stock Alert',
  abandonedCart: 'Abandoned Cart Reminder',
  promotions: 'Promotional Campaign',
};

export function NotificationsView() {
  const {
    user,
    notifications,
    unreadNotificationCount,
    deviceTokens,
    deliveryLogs,
    notifPrefs,
    markNotificationRead,
    markAllNotificationsRead,
    updateNotificationCategoryPrefs,
    registerDeviceToken,
    removeDeviceToken,
    triggerAbandonedCartCheck,
    triggerSampleNotification,
    pruneInvalidTokens,
    switchDemoAccount,
    navigate,
  } = useStore();

  const [deviceName, setDeviceName] = useState('Studio Mobile Client');
  const [platform, setPlatform] = useState<'web' | 'ios' | 'android'>('ios');
  const [customToken, setCustomToken] = useState('');

  if (!user) {
    return (
      <div className="mx-auto max-w-[560px] px-6 py-20 text-center space-y-5">
        <Bell className="w-8 h-8 mx-auto text-[var(--aura-text-muted)]" />
        <h1 className="font-display text-3xl font-semibold text-[var(--aura-text)]">
          Sign in for Push Notifications &amp; Delivery Log
        </h1>
        <p className="text-sm text-[var(--aura-text-muted)]">
          Manage real-time WebSocket and Expo push notifications, device tokens, category switches, and scheduled reminders.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => navigate({ view: 'auth', mode: 'login' })}
            className="px-6 py-2.5 text-sm font-semibold rounded-md bg-[var(--aura-accent)] text-[var(--aura-accent-contrast)] cursor-pointer"
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => void switchDemoAccount('aarav@auracommerce.in')}
            className="px-5 py-2.5 text-sm font-medium rounded-md border border-[var(--aura-border)] text-[var(--aura-text)] hover:bg-[var(--aura-surface-muted)] cursor-pointer"
          >
            Open Demo Account (Aarav)
          </button>
        </div>
      </div>
    );
  }

  const categoryList: Array<{
    key: keyof NotificationCategoryPrefs;
    label: string;
    desc: string;
  }> = [
    {
      key: 'orders',
      label: 'Order Confirmations',
      desc: 'Instant receipts when orders are placed or updated.',
    },
    {
      key: 'payments',
      label: 'Payment Updates',
      desc: 'Verified webhook confirmations and refund notices.',
    },
    {
      key: 'shipping',
      label: 'Shipping & Delivery',
      desc: 'Dispatch scans, courier tracking, and delivery alerts.',
    },
    {
      key: 'priceDrops',
      label: 'Wishlist Price Drops',
      desc: 'Real-time alerts when saved wishlist items drop in price.',
    },
    {
      key: 'stockUpdates',
      label: 'Back-in-Stock Alerts',
      desc: 'Notifications when unavailable items are replenished.',
    },
    {
      key: 'abandonedCart',
      label: 'Abandoned Cart Reminders',
      desc: 'Scheduled nudges for items waiting in your shopping bag.',
    },
    {
      key: 'promotions',
      label: 'Promotional Campaigns',
      desc: 'Seasonal edits and member-exclusive shipping offers.',
    },
  ];

  const handleRegisterToken = async (e: FormEvent) => {
    e.preventDefault();
    await registerDeviceToken(deviceName, platform, customToken.trim() || undefined);
    setCustomToken('');
  };

  return (
    <div className="mx-auto max-w-[1240px] px-6 py-10 space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--aura-border)] pb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[var(--aura-text)]">
            Push Notifications &amp; Delivery Log
          </h1>
          <p className="mt-1.5 text-sm text-[var(--aura-text-muted)]">
            Real-time WebSocket &amp; Expo Push notification center with category controls, device token registry, and scheduled reminders.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void markAllNotificationsRead()}
          disabled={unreadNotificationCount === 0}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-md border border-[var(--aura-border)] bg-[var(--aura-surface)] text-[var(--aura-text)] hover:bg-[var(--aura-surface-muted)] disabled:opacity-50 cursor-pointer"
        >
          <Check className="w-3.5 h-3.5" />
          <span>Mark All Read</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Notification History */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-[var(--aura-text)]">
              Notification History ({notifications.length})
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void triggerSampleNotification('priceDrops')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-[var(--aura-border)] bg-[var(--aura-surface)] text-[var(--aura-text)] hover:bg-[var(--aura-surface-muted)] cursor-pointer"
              >
                <Send className="w-3 h-3" />
                <span>Price Drop Alert</span>
              </button>
              <button
                type="button"
                onClick={() => void triggerAbandonedCartCheck(0)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-[var(--aura-border)] bg-[var(--aura-surface)] text-[var(--aura-text)] hover:bg-[var(--aura-surface-muted)] cursor-pointer"
              >
                <Send className="w-3 h-3" />
                <span>Abandoned Cart Reminder</span>
              </button>
              <button
                type="button"
                onClick={() => void triggerSampleNotification('stockUpdates')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-[var(--aura-border)] bg-[var(--aura-surface)] text-[var(--aura-text)] hover:bg-[var(--aura-surface-muted)] cursor-pointer"
              >
                <Send className="w-3 h-3" />
                <span>Back-in-Stock Alert</span>
              </button>
              <button
                type="button"
                onClick={() => void triggerAbandonedCartCheck(5)}
                title="Schedule abandoned cart notification in 5 seconds"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-[var(--aura-border)] bg-[var(--aura-surface)] text-[var(--aura-text)] hover:bg-[var(--aura-surface-muted)] cursor-pointer"
              >
                <Clock className="w-3 h-3" />
                <span>Schedule (5s)</span>
              </button>
              <button
                type="button"
                onClick={() => void triggerSampleNotification('promotions')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-[var(--aura-border)] bg-[var(--aura-surface)] text-[var(--aura-text)] hover:bg-[var(--aura-surface-muted)] cursor-pointer"
              >
                <Send className="w-3 h-3" />
                <span>Promo Alert</span>
              </button>
            </div>
          </div>

          {notifications.length === 0 ? (
            <div className="rounded-xl border border-[var(--aura-border)] bg-[var(--aura-surface)] p-10 text-center text-sm text-[var(--aura-text-muted)]">
              No notifications yet. Trigger an alert above, update wishlist items, or complete an order to see real-time updates.
            </div>
          ) : (
            <div className="divide-y divide-[var(--aura-border)] rounded-xl border border-[var(--aura-border)] bg-[var(--aura-surface)] overflow-hidden">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-5 space-y-2 transition-colors ${
                    !n.read ? 'bg-[var(--aura-surface-muted)]/35' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-sm font-semibold text-[var(--aura-text)]">{n.title}</p>
                    <span className="text-xs text-[var(--aura-text-muted)] whitespace-nowrap shrink-0 tabular-nums">
                      {formatNotifTimestamp(n.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--aura-text-muted)] leading-relaxed">{n.body}</p>
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--aura-text-muted)]">
                      <span>{CATEGORY_LABELS[n.category] || n.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>Channel: {n.channel || 'websocket'}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-medium text-emerald-700 dark:text-emerald-400">
                        Status: {n.deliveryStatus || 'Delivered'}
                      </span>
                    </div>
                    {!n.read && (
                      <button
                        type="button"
                        onClick={() => void markNotificationRead(n.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md border border-[var(--aura-border)] text-[var(--aura-text)] hover:bg-[var(--aura-surface-muted)] cursor-pointer"
                      >
                        <Check className="w-3 h-3" />
                        <span>Mark Read</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Categories, Registered Expo Push Devices & Audit Logs */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-xl border border-[var(--aura-border)] bg-[var(--aura-surface)] p-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-[var(--aura-text)]">
                Notification Categories
              </h2>
              <p className="text-xs text-[var(--aura-text-muted)] mt-0.5">
                Enable or mute specific real-time notification streams.
              </p>
            </div>
            <div className="space-y-4">
              {categoryList.map(({ key, label, desc }) => {
                const enabled = notifPrefs[key];
                return (
                  <div key={key} className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--aura-text)]">{label}</p>
                      <p className="text-xs text-[var(--aura-text-muted)]">{desc}</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={enabled}
                      aria-label={`Toggle ${label}`}
                      onClick={() =>
                        void updateNotificationCategoryPrefs({ [key]: !enabled })
                      }
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                        enabled ? 'bg-[var(--aura-text)]' : 'bg-[var(--aura-surface-muted)]'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-[var(--aura-surface)] shadow-sm transition duration-200 ${
                          enabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--aura-border)] bg-[var(--aura-surface)] p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-[var(--aura-text)]">
                Registered Expo Push Devices
              </h2>
              <button
                type="button"
                onClick={() => void pruneInvalidTokens()}
                className="text-xs font-medium text-[var(--aura-accent)] hover:underline cursor-pointer"
              >
                Prune Invalid
              </button>
            </div>

            <form onSubmit={handleRegisterToken} className="space-y-2.5">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  placeholder="Device label"
                  className="flex-1 px-3 py-2 text-xs rounded-md border border-[var(--aura-border)] bg-[var(--aura-bg)] text-[var(--aura-text)]"
                />
                <select
                  aria-label="Device platform"
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value as 'web' | 'ios' | 'android')}
                  className="px-2.5 py-2 text-xs rounded-md border border-[var(--aura-border)] bg-[var(--aura-bg)] text-[var(--aura-text)]"
                >
                  <option value="ios">iOS (Expo)</option>
                  <option value="android">Android (Expo)</option>
                  <option value="web">Web Push</option>
                </select>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customToken}
                  onChange={(e) => setCustomToken(e.target.value)}
                  placeholder="ExponentPushToken[...] (auto-generated if blank)"
                  className="flex-1 px-3 py-2 text-xs rounded-md border border-[var(--aura-border)] bg-[var(--aura-bg)] text-[var(--aura-text)]"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold rounded-md bg-[var(--aura-accent)] text-[var(--aura-accent-contrast)] cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Register</span>
                </button>
              </div>
            </form>

            {deviceTokens.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-[var(--aura-border)]">
                {deviceTokens.map((dt) => (
                  <div
                    key={dt.id}
                    className="flex items-center justify-between gap-2 text-xs py-1.5"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-[var(--aura-text)] flex items-center gap-1.5">
                        <Smartphone className="w-3.5 h-3.5 text-[var(--aura-text-muted)]" />
                        <span>
                          {dt.deviceName} ({dt.platform})
                        </span>
                      </p>
                      <p className="font-mono-tabular text-[11px] text-[var(--aura-text-muted)] truncate">
                        {dt.token}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label="Remove token"
                      onClick={() => void removeDeviceToken(dt.id)}
                      className="p-1.5 text-[var(--aura-text-muted)] hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {deliveryLogs.length > 0 && (
            <div className="rounded-xl border border-[var(--aura-border)] bg-[var(--aura-surface)] p-6 space-y-3">
              <h2 className="text-base font-semibold text-[var(--aura-text)]">
                Delivery Audit Logs
              </h2>
              <div className="space-y-2 max-h-48 overflow-y-auto text-xs">
                {deliveryLogs.map((log) => (
                  <div
                    key={log.id}
                    className="border-t border-[var(--aura-border)] pt-2 first:border-t-0 first:pt-0"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-mono-tabular font-medium text-[var(--aura-text)]">
                        {log.status}
                      </p>
                      <span className="font-mono-tabular text-[11px] text-[var(--aura-text-muted)]">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-[var(--aura-text-muted)]">{log.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function AccountViews({ initialTab: _initialTab }: { initialTab: 'profile' | 'theme' }) {
  const {
    user,
    logout,
    updateProfile,
    themeConfig,
    updateThemeConfig,
    switchDemoAccount,
    recentlyViewed,
    navigate,
  } = useStore();

  const [editingProfile, setEditingProfile] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [line1, setLine1] = useState(user?.defaultAddress?.line1 || '');
  const [city, setCity] = useState(user?.defaultAddress?.city || '');
  const [stateCode, setStateCode] = useState(user?.defaultAddress?.state || '');
  const [postalCode, setPostalCode] = useState(user?.defaultAddress?.postalCode || '');
  const [country, setCountry] = useState(user?.defaultAddress?.country || 'India');

  const openEditor = () => {
    setName(user?.name || '');
    setPhone(user?.phone || '');
    setLine1(user?.defaultAddress?.line1 || '');
    setCity(user?.defaultAddress?.city || '');
    setStateCode(user?.defaultAddress?.state || '');
    setPostalCode(user?.defaultAddress?.postalCode || '');
    setCountry(user?.defaultAddress?.country || 'India');
    setEditingProfile(true);
  };

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await updateProfile({
      name,
      phone,
      defaultAddress: { line1, city, state: stateCode, postalCode, country },
    });
    if (ok) {
      setEditingProfile(false);
    }
  };

  const SystemIcon = THEME_ICONS.semantic.system;

  return (
    <div className="mx-auto max-w-[1240px] px-6 py-10 space-y-8">
      <div className="border-b border-[var(--aura-border)] pb-6">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[var(--aura-text)]">
          Account &amp; Personalization
        </h1>
        <p className="mt-1.5 text-sm text-[var(--aura-text-muted)]">
          Manage your cross-device account profile, shipping details, automatic anonymous history merge, and centralized theme preferences.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Dynamic Theme Personalization (2x2 Theme Grid) */}
        <div className="lg:col-span-7 space-y-5">
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-[var(--aura-text)]" />
            <h2 className="text-lg font-semibold text-[var(--aura-text)]">
              Dynamic Theme Personalization
            </h2>
          </div>
          <p className="text-xs leading-relaxed text-[var(--aura-text-muted)]">
            Automatically detects your device theme on first launch, persists locally, and synchronizes across all signed-in devices in real time.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {CURATED_THEME_CARDS.map((card) => {
              const isSelected =
                themeConfig.themeMode === card.themeMode &&
                themeConfig.accentPreset === card.accentPreset;
              return (
                <button
                  key={card.key}
                  type="button"
                  onClick={() =>
                    void updateThemeConfig({
                      themeMode: card.themeMode,
                      accentPreset: card.accentPreset,
                    })
                  }
                  className={`relative rounded-xl border p-5 text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'border-2 border-[var(--aura-text)] bg-[var(--aura-surface)] shadow-xs'
                      : 'border-[var(--aura-border)] bg-[var(--aura-surface)] hover:border-[var(--aura-accent)]'
                  }`}
                >
                  {isSelected && (
                    <span className="absolute top-4 right-4 text-[var(--aura-text)]">
                      <Check className="w-4 h-4" />
                    </span>
                  )}
                  <div className="flex items-center gap-2">
                    {card.swatches.map((hex, i) => (
                      <span
                        key={i}
                        className="w-4 h-4 rounded-full border border-black/15 dark:border-white/20"
                        style={{ backgroundColor: hex }}
                      />
                    ))}
                  </div>
                  <p className="mt-4 text-sm font-semibold text-[var(--aura-text)]">
                    {card.label}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--aura-text-muted)]">
                    {card.description}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="rounded-xl border border-[var(--aura-border)] bg-[var(--aura-surface)] p-4 flex flex-wrap items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => void updateThemeConfig({ themeMode: 'system' })}
              className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border cursor-pointer ${
                themeConfig.themeMode === 'system'
                  ? 'border-[var(--aura-accent)] bg-[var(--aura-surface-muted)] text-[var(--aura-text)]'
                  : 'border-[var(--aura-border)] text-[var(--aura-text-muted)] hover:text-[var(--aura-text)]'
              }`}
            >
              <SystemIcon className="w-3.5 h-3.5" />
              <span>Use Device Auto Theme ({themeConfig.themeMode === 'system' ? 'Active' : 'Enable'})</span>
            </button>

            <label className="inline-flex items-center gap-2 text-xs font-medium text-[var(--aura-text)] cursor-pointer">
              <input
                type="checkbox"
                aria-label="Enable high-contrast borders"
                checked={themeConfig.highContrast}
                onChange={(e) => void updateThemeConfig({ highContrast: e.target.checked })}
                className="h-4 w-4 accent-[var(--aura-accent)] cursor-pointer"
              />
              <span>High-Contrast Accessibility Borders</span>
            </label>
          </div>
        </div>

        {/* Right Column: Profile & Cross-Device Sync */}
        <div className="lg:col-span-5 space-y-5">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-[var(--aura-text)]" />
            <h2 className="text-lg font-semibold text-[var(--aura-text)]">
              Profile &amp; Cross-Device Sync
            </h2>
          </div>

          {!user ? (
            <div className="rounded-xl border border-[var(--aura-border)] bg-[var(--aura-surface)] p-6 space-y-4">
              <p className="text-base font-semibold text-[var(--aura-text)]">
                Guest Session Active
              </p>
              <p className="text-xs leading-relaxed text-[var(--aura-text-muted)]">
                Your anonymous recently viewed products ({recentlyViewed.length}/20) and shopping bag merge automatically when you sign in or switch to a demo account.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => void switchDemoAccount('aarav@auracommerce.in')}
                  className="py-2.5 px-4 text-xs font-semibold rounded-md border border-[var(--aura-border)] bg-[var(--aura-surface)] text-[var(--aura-text)] hover:bg-[var(--aura-surface-muted)] cursor-pointer"
                >
                  Use Demo Account (Aarav)
                </button>
                <button
                  type="button"
                  onClick={() => navigate({ view: 'auth', mode: 'login' })}
                  className="py-2.5 px-4 text-xs font-semibold rounded-md bg-[var(--aura-accent)] text-[var(--aura-accent-contrast)] hover:bg-[var(--aura-accent-hover)] cursor-pointer"
                >
                  Sign In / Register
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--aura-border)] bg-[var(--aura-surface)] p-6 space-y-5">
              {!editingProfile ? (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-base font-semibold text-[var(--aura-text)]">{user.name}</p>
                      <p className="text-xs text-[var(--aura-text-muted)]">{user.email}</p>
                      <p className="text-xs text-[var(--aura-text-muted)] pt-1 leading-relaxed">
                        {user.phone || 'Add phone'}{' '}
                        {user.defaultAddress?.line1
                          ? `· ${user.defaultAddress.line1}, ${user.defaultAddress.city}, ${user.defaultAddress.state} (${user.defaultAddress.postalCode})`
                          : '· Add shipping address'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={openEditor}
                      className="px-3 py-1.5 text-xs font-medium rounded-md border border-[var(--aura-border)] text-[var(--aura-text)] hover:bg-[var(--aura-surface-muted)] shrink-0 cursor-pointer"
                    >
                      Edit Profile
                    </button>
                  </div>

                  <div className="rounded-lg bg-[var(--aura-surface-muted)] p-4 flex items-start gap-3 text-xs text-[var(--aura-text-muted)] leading-relaxed">
                    <RefreshCw className="w-4 h-4 shrink-0 mt-0.5 text-[var(--aura-text)]" />
                    <span>
                      Cart, Save for Later, Recently Viewed (20), Browsing History (50), Theme, and Push Notifications are synced live across devices for this account.
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => void switchDemoAccount()}
                      className="sm:col-span-2 py-2.5 px-4 text-xs font-semibold rounded-md border border-[var(--aura-border)] bg-[var(--aura-surface)] text-[var(--aura-text)] hover:bg-[var(--aura-surface-muted)] cursor-pointer"
                    >
                      Switch Demo Account
                    </button>
                    <button
                      type="button"
                      onClick={() => void logout()}
                      className="inline-flex items-center justify-center gap-1.5 py-2.5 px-4 text-xs font-semibold rounded-md border border-[var(--aura-border)] text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </>
              ) : (
                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-[var(--aura-text)]">Edit Profile</h3>
                    <button
                      type="button"
                      onClick={() => setEditingProfile(false)}
                      className="text-xs text-[var(--aura-text-muted)] hover:text-[var(--aura-text)] cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Full Name"
                      className="px-3 py-2 text-xs rounded-md border border-[var(--aura-border)] bg-[var(--aura-bg)] text-[var(--aura-text)]"
                    />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Phone"
                      className="px-3 py-2 text-xs rounded-md border border-[var(--aura-border)] bg-[var(--aura-bg)] text-[var(--aura-text)]"
                    />
                  </div>
                  <input
                    type="text"
                    value={line1}
                    onChange={(e) => setLine1(e.target.value)}
                    placeholder="Street Address"
                    className="w-full px-3 py-2 text-xs rounded-md border border-[var(--aura-border)] bg-[var(--aura-bg)] text-[var(--aura-text)]"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="City"
                      className="px-3 py-2 text-xs rounded-md border border-[var(--aura-border)] bg-[var(--aura-bg)] text-[var(--aura-text)]"
                    />
                    <input
                      type="text"
                      value={stateCode}
                      onChange={(e) => setStateCode(e.target.value)}
                      placeholder="State"
                      className="px-3 py-2 text-xs rounded-md border border-[var(--aura-border)] bg-[var(--aura-bg)] text-[var(--aura-text)]"
                    />
                    <input
                      type="text"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      placeholder="Postal Code"
                      className="px-3 py-2 text-xs rounded-md border border-[var(--aura-border)] bg-[var(--aura-bg)] text-[var(--aura-text)]"
                    />
                    <input
                      type="text"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      placeholder="Country"
                      className="px-3 py-2 text-xs rounded-md border border-[var(--aura-border)] bg-[var(--aura-bg)] text-[var(--aura-text)]"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 text-xs font-semibold rounded-md bg-[var(--aura-accent)] text-[var(--aura-accent-contrast)] hover:bg-[var(--aura-accent-hover)] cursor-pointer"
                  >
                    Save Profile Details
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
