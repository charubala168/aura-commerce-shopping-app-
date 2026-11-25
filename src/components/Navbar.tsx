import { useState } from 'react';
import { Menu, ShoppingBag, X } from 'lucide-react';
import { useStore } from '../context/StoreContext.tsx';

export function Navbar() {
  const { route, navigate, cartCount, setCartDrawerOpen, unreadNotificationCount, user } =
    useStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks: Array<{ label: string; active: boolean; onClick: () => void }> = [
    {
      label: 'Catalog',
      active: route.view === 'catalog' || route.view === 'product',
      onClick: () => navigate({ view: 'catalog' }),
    },
    {
      label: 'For You',
      active: route.view === 'recommendations' || route.view === 'recently-viewed',
      onClick: () => navigate({ view: 'recommendations' }),
    },
    {
      label: 'Orders',
      active:
        route.view === 'orders' ||
        route.view === 'order-detail' ||
        route.view === 'invoice',
      onClick: () => navigate({ view: 'orders' }),
    },
    {
      label: unreadNotificationCount > 0 ? `Alerts (${unreadNotificationCount})` : 'Alerts',
      active: route.view === 'notifications',
      onClick: () => navigate({ view: 'notifications' }),
    },
    {
      label: user ? 'Account' : 'Sign In',
      active: route.view === 'account' || route.view === 'auth',
      onClick: () =>
        navigate(user ? { view: 'account', tab: 'profile' } : { view: 'auth', mode: 'login' }),
    },
    {
      label: 'Admin',
      active: route.view === 'admin',
      onClick: () => navigate({ view: 'admin' }),
    },
    {
      label: 'FAQ & Contact',
      active: route.view === 'contact' || route.view === 'faq',
      onClick: () => navigate({ view: 'contact' }),
    },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--aura-border)] bg-[var(--aura-bg)]/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between gap-6 px-6">
        <button
          type="button"
          onClick={() => navigate({ view: 'home' })}
          className="font-display text-2xl font-semibold tracking-tight text-[var(--aura-text)] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--aura-accent)] rounded-sm"
        >
          Aura Commerce
        </button>

        <nav className="hidden lg:flex items-center gap-6" aria-label="Primary navigation">
          {navLinks.map((link) => (
            <button
              key={link.label}
              type="button"
              onClick={link.onClick}
              className={`text-sm font-medium whitespace-nowrap shrink-0 cursor-pointer pb-0.5 transition-colors border-b ${
                link.active
                  ? 'text-[var(--aura-text)] border-[var(--aura-accent)] font-semibold'
                  : 'text-[var(--aura-text-muted)] border-transparent hover:text-[var(--aura-text)]'
              }`}
            >
              {link.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => navigate({ view: 'saved', tab: 'wishlist' })}
            className="hidden sm:inline-flex px-3 py-1.5 text-xs font-medium rounded-md border border-[var(--aura-border)] text-[var(--aura-text)] hover:bg-[var(--aura-surface-muted)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Saved
          </button>

          <button
            type="button"
            onClick={() => setCartDrawerOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md bg-[var(--aura-accent)] text-[var(--aura-accent-contrast)] hover:bg-[var(--aura-accent-hover)] transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Bag ({cartCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="lg:hidden p-2 rounded-md text-[var(--aura-text)] hover:bg-[var(--aura-surface-muted)] cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-[var(--aura-border)] bg-[var(--aura-surface)] px-6 py-4 space-y-2">
          {navLinks.map((link) => (
            <button
              key={link.label}
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                link.onClick();
              }}
              className={`block w-full text-left py-2.5 text-sm font-medium ${
                link.active ? 'text-[var(--aura-accent)]' : 'text-[var(--aura-text)]'
              }`}
            >
              {link.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              navigate({ view: 'saved', tab: 'wishlist' });
            }}
            className="block w-full text-left py-2.5 text-sm font-medium text-[var(--aura-text)]"
          >
            Saved &amp; Wishlist
          </button>
        </div>
      )}
    </header>
  );
}
