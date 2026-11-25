import { useState, type FormEvent } from 'react';
import { ArrowRight } from 'lucide-react';
import { useStore } from '../context/StoreContext.tsx';

export function SplashView() {
  const { navigate } = useStore();

  return (
    <div className="min-h-[calc(100vh-140px)] flex flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-xs tracking-[0.2em] text-[var(--aura-text-muted)] uppercase">
        Atelier · Edition 2026
      </p>
      <h1 className="mt-4 font-display text-6xl sm:text-7xl font-semibold tracking-tight text-[var(--aura-text)]">
        Aura Commerce
      </h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-[var(--aura-text-muted)]">
        Architectural lighting, precision acoustic hardware, and natural textile essentials
        synchronized across every device.
      </p>
      <div className="mt-10 flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate({ view: 'home' })}
          className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-md bg-[var(--aura-accent)] text-[var(--aura-accent-contrast)] hover:bg-[var(--aura-accent-hover)] transition-colors cursor-pointer"
        >
          <span>Enter Storefront</span>
          <ArrowRight className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => navigate({ view: 'auth', mode: 'login' })}
          className="px-5 py-3 text-sm font-medium rounded-md border border-[var(--aura-border)] text-[var(--aura-text)] hover:bg-[var(--aura-surface-muted)] transition-colors cursor-pointer"
        >
          Sign In
        </button>
      </div>
    </div>
  );
}

export function AuthViews({ initialMode }: { initialMode: 'login' | 'register' }) {
  const { login, register, switchDemoAccount, navigate } = useStore();
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const ok =
      mode === 'login'
        ? await login(email, password)
        : await register(name, email, password);
    setSubmitting(false);
    if (ok) {
      navigate({ view: 'home' });
    }
  };

  return (
    <div className="mx-auto max-w-[460px] px-6 py-16">
      <div className="rounded-lg border border-[var(--aura-border)] bg-[var(--aura-surface)] p-8 space-y-6">
        <div>
          <p className="text-xs text-[var(--aura-text-muted)]">Aura Member Access</p>
          <h1 className="mt-1 font-display text-3xl font-semibold text-[var(--aura-text)]">
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </h1>
          <p className="mt-2 text-xs text-[var(--aura-text-muted)]">
            {mode === 'login'
              ? 'Your guest browsing history and shopping bag merge automatically upon sign in.'
              : 'Create a personal Aura profile to sync your cart, wishlist, and theme preferences.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-medium text-[var(--aura-text)] mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                required
                minLength={2}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Elena Vance"
                className="w-full px-3 py-2.5 text-sm rounded-md border border-[var(--aura-border)] bg-[var(--aura-bg)] text-[var(--aura-text)] focus:outline-none focus:ring-2 focus:ring-[var(--aura-accent)]"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[var(--aura-text)] mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="elena@studio.com"
              className="w-full px-3 py-2.5 text-sm rounded-md border border-[var(--aura-border)] bg-[var(--aura-bg)] text-[var(--aura-text)] focus:outline-none focus:ring-2 focus:ring-[var(--aura-accent)]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--aura-text)] mb-1.5">
              Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              className="w-full px-3 py-2.5 text-sm rounded-md border border-[var(--aura-border)] bg-[var(--aura-bg)] text-[var(--aura-text)] focus:outline-none focus:ring-2 focus:ring-[var(--aura-accent)]"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 px-4 text-sm font-semibold rounded-md bg-[var(--aura-accent)] text-[var(--aura-accent-contrast)] hover:bg-[var(--aura-accent-hover)] transition-colors cursor-pointer disabled:opacity-60"
          >
            {submitting
              ? 'Please wait...'
              : mode === 'login'
                ? 'Sign In'
                : 'Create Account'}
          </button>
        </form>

        <div className="pt-4 border-t border-[var(--aura-border)] space-y-3 text-center text-xs text-[var(--aura-text-muted)]">
          <div>
            {mode === 'login' ? (
              <>
                New to Aura?{' '}
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className="font-semibold text-[var(--aura-accent)] hover:underline cursor-pointer"
                >
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="font-semibold text-[var(--aura-accent)] hover:underline cursor-pointer"
                >
                  Sign in
                </button>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={async () => {
              const ok = await switchDemoAccount('aarav@auracommerce.in');
              if (ok) navigate({ view: 'home' });
            }}
            className="w-full py-2 px-4 text-xs font-medium rounded-md border border-[var(--aura-border)] text-[var(--aura-text)] hover:bg-[var(--aura-surface-muted)] cursor-pointer"
          >
            Continue with Demo Account (Aarav Sharma)
          </button>
        </div>
      </div>
    </div>
  );
}
