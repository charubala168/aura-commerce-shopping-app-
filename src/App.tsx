import { StoreProvider, useStore } from './context/StoreContext.tsx';
import { Navbar } from './components/Navbar.tsx';
import { HomeView } from './components/HomeView.tsx';
import { CatalogView } from './components/CatalogView.tsx';
import { ProductDetailView } from './components/ProductDetailView.tsx';
import { RecentlyViewedView, RecommendationsView } from './components/DiscoveryViews.tsx';
import { AuthViews, SplashView } from './components/SplashAndAuthViews.tsx';
import { CartDrawer, CartView, SavedAndWishlistView } from './components/CartAndSavedViews.tsx';
import { CheckoutView } from './components/CheckoutView.tsx';
import { InvoiceView, OrderDetailView, OrderHistoryView } from './components/OrdersViews.tsx';
import { AccountViews, NotificationsView } from './components/AccountAndNotifsViews.tsx';
import { ContactView, FaqView } from './components/SupportViews.tsx';
import { AdminView } from './components/AdminView.tsx';

function AppShell() {
  const { route, navigate, toast } = useStore();

  const renderRoute = () => {
    switch (route.view) {
      case 'splash':
        return <SplashView />;
      case 'home':
        return <HomeView />;
      case 'catalog':
        return <CatalogView initialCategory={route.category} />;
      case 'product':
        return <ProductDetailView productId={route.productId} />;
      case 'recently-viewed':
        return <RecentlyViewedView />;
      case 'recommendations':
        return <RecommendationsView />;
      case 'saved':
        return <SavedAndWishlistView initialTab={route.tab} />;
      case 'cart':
        return <CartView />;
      case 'checkout':
        return <CheckoutView />;
      case 'orders':
        return <OrderHistoryView />;
      case 'order-detail':
        return <OrderDetailView orderId={route.orderId} />;
      case 'invoice':
        return <InvoiceView orderId={route.orderId} />;
      case 'notifications':
        return <NotificationsView />;
      case 'account':
        return <AccountViews initialTab={route.tab} />;
      case 'contact':
        return <ContactView />;
      case 'faq':
        return <FaqView />;
      case 'admin':
        return <AdminView />;
      case 'auth':
        return <AuthViews initialMode={route.mode} />;
      default:
        return <HomeView />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--aura-bg)] text-[var(--aura-text)] transition-colors duration-200">
      <Navbar />

      <main className="flex-1">{renderRoute()}</main>

      <footer className="border-t border-[var(--aura-border)] bg-[var(--aura-surface)]">
        <div className="mx-auto max-w-[1280px] px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-xs">
          <div className="col-span-2 md:col-span-1 space-y-2">
            <p className="font-display text-2xl font-semibold text-[var(--aura-text)]">Aura</p>
            <p className="text-[var(--aura-text-muted)] leading-relaxed max-w-[26ch]">
              SmartCart curated marketplace featuring 65 everyday essentials across 6 categories.
            </p>
          </div>

          <div className="space-y-2">
            <p className="font-semibold text-[var(--aura-text)]">Explore</p>
            <ul className="space-y-1.5 text-[var(--aura-text-muted)]">
              <li>
                <button
                  type="button"
                  onClick={() => navigate({ view: 'catalog' })}
                  className="hover:text-[var(--aura-text)] cursor-pointer"
                >
                  All Products
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate({ view: 'recommendations' })}
                  className="hover:text-[var(--aura-text)] cursor-pointer"
                >
                  You May Also Like
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate({ view: 'recently-viewed' })}
                  className="hover:text-[var(--aura-text)] cursor-pointer"
                >
                  Recently Viewed
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate({ view: 'splash' })}
                  className="hover:text-[var(--aura-text)] cursor-pointer"
                >
                  Brand Intro
                </button>
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="font-semibold text-[var(--aura-text)]">Shopping</p>
            <ul className="space-y-1.5 text-[var(--aura-text-muted)]">
              <li>
                <button
                  type="button"
                  onClick={() => navigate({ view: 'cart' })}
                  className="hover:text-[var(--aura-text)] cursor-pointer"
                >
                  Smart Bag
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate({ view: 'saved', tab: 'wishlist' })}
                  className="hover:text-[var(--aura-text)] cursor-pointer"
                >
                  Wishlist
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate({ view: 'saved', tab: 'later' })}
                  className="hover:text-[var(--aura-text)] cursor-pointer"
                >
                  Save for Later
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate({ view: 'orders' })}
                  className="hover:text-[var(--aura-text)] cursor-pointer"
                >
                  Order History
                </button>
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="font-semibold text-[var(--aura-text)]">Preferences &amp; Support</p>
            <ul className="space-y-1.5 text-[var(--aura-text-muted)]">
              <li>
                <button
                  type="button"
                  onClick={() => navigate({ view: 'account', tab: 'profile' })}
                  className="hover:text-[var(--aura-text)] cursor-pointer"
                >
                  Profile
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate({ view: 'account', tab: 'theme' })}
                  className="hover:text-[var(--aura-text)] cursor-pointer"
                >
                  Theme Settings
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate({ view: 'notifications' })}
                  className="hover:text-[var(--aura-text)] cursor-pointer"
                >
                  Notifications
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate({ view: 'contact' })}
                  className="hover:text-[var(--aura-text)] cursor-pointer"
                >
                  Contact Us
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate({ view: 'faq' })}
                  className="hover:text-[var(--aura-text)] cursor-pointer"
                >
                  FAQ
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate({ view: 'admin' })}
                  className="hover:text-[var(--aura-text)] cursor-pointer"
                >
                  Admin Dashboard
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-[var(--aura-border)] py-4 px-6">
          <div className="mx-auto max-w-[1280px] flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--aura-text-muted)]">
            <span>© {new Date().getFullYear()} Aura Commerce</span>
            <span>All rights reserved</span>
          </div>
        </div>
      </footer>

      <CartDrawer />

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-5 right-5 z-50 max-w-sm rounded-md border px-4 py-3 text-xs font-medium shadow-lg ${
            toast.tone === 'error'
              ? 'border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100'
              : 'border-[var(--aura-border)] bg-[var(--aura-surface)] text-[var(--aura-text)]'
          }`}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <AppShell />
    </StoreProvider>
  );
}
