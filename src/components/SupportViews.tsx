import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { ChevronDown, Mail, MapPin, Phone, Search, Send } from 'lucide-react';
import { useStore } from '../context/StoreContext.tsx';
import type { ContactMessage } from '../types/ecommerce.ts';

const FAQ_ITEMS: Array<{ category: string; question: string; answer: string }> = [
  {
    category: 'Orders & Delivery',
    question: 'How long does shipping take across India?',
    answer:
      'Orders placed before 2:00 PM IST dispatch the same business day. Metro deliveries arrive within 2–3 business days, and standard nationwide deliveries arrive within 4–6 business days. Orders above ₹999 qualify for complimentary shipping.',
  },
  {
    category: 'Orders & Delivery',
    question: 'Can I cancel or return an order after placing it?',
    answer:
      'Yes. Orders in Confirmed or Processing status can be cancelled directly from your Order History page with instant stock restoration. Once an order reaches Delivered status, you can submit a Return Request from the order detail view.',
  },
  {
    category: 'Payments & Invoices',
    question: 'Which payment methods are supported and how do PDF invoices work?',
    answer:
      'We support Credit/Debit Cards, UPI, and Cash on Delivery (COD). Every order includes server-side idempotency checks and webhook verification to prevent duplicate charges. You can preview or download an itemized PDF tax invoice anytime from Order History.',
  },
  {
    category: 'Recently Viewed & Sync',
    question: 'Does my browsing history and cart sync if I browse before signing in?',
    answer:
      'Yes. Guest activity tracks up to 20 unique Recently Viewed items and cart variants in your active session. When you sign in or create an account, guest browsing history and bag items automatically merge with your account across devices.',
  },
  {
    category: 'Notifications & Alerts',
    question: 'How do price-drop, restock, and abandoned-cart notifications work?',
    answer:
      'Real-time alerts are delivered in-app and via registered device push tokens. You can toggle individual notification categories (Orders, Payments, Shipping, Price Drops, Stock Updates, Promotions, and Abandoned Cart) inside Notifications Settings.',
  },
  {
    category: 'Theme & Personalization',
    question: 'How is Dark Mode and custom accent personalization saved?',
    answer:
      'On your first visit, Aura automatically detects your device color scheme. You can switch between System, Light, and Dark modes, select custom accent palettes, or enable High Contrast in Account > Theme Settings—saved locally and synced to your profile.',
  },
];

export function ContactView() {
  const { user, authToken, apiFetch, showToast, navigate } = useStore();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [subject, setSubject] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lastTicketId, setLastTicketId] = useState<string | null>(null);
  const [myMessages, setMyMessages] = useState<ContactMessage[]>([]);

  const loadMyMessages = useCallback(async () => {
    if (!authToken) {
      setMyMessages([]);
      return;
    }
    const res = await apiFetch<{ messages: ContactMessage[] }>('/api/support/my-messages');
    if (res.ok && res.data) {
      setMyMessages(res.data.messages);
    }
  }, [apiFetch, authToken]);

  useEffect(() => {
    if (user) {
      setName((prev) => prev || user.name);
      setEmail((prev) => prev || user.email);
    }
    void loadMyMessages();
  }, [user, loadMyMessages]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const res = await apiFetch<{ message: ContactMessage }>('/api/support/contact', {
      method: 'POST',
      body: JSON.stringify({ name, email, subject, orderNumber, message }),
    });
    setSubmitting(false);

    if (!res.ok || !res.data) {
      showToast(res.error || 'Could not send message', 'error');
      return;
    }

    setLastTicketId(res.data.message.id);
    setSubject('');
    setOrderNumber('');
    setMessage('');
    showToast(`Support inquiry ${res.data.message.id} received`, 'success');
    await loadMyMessages();
  };

  return (
    <div className="mx-auto max-w-[1160px] px-6 py-12 space-y-12">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--aura-border)] pb-6">
        <div>
          <p className="text-xs text-[var(--aura-text-muted)]">Customer Care &amp; Concierge</p>
          <h1 className="mt-1 font-display text-4xl font-semibold text-[var(--aura-text)]">
            Contact Us
          </h1>
        </div>
        <button
          type="button"
          onClick={() => navigate({ view: 'faq' })}
          className="text-sm font-medium text-[var(--aura-text)] border-b border-[var(--aura-border)] hover:border-[var(--aura-accent)] pb-0.5 cursor-pointer"
        >
          Browse Frequently Asked Questions
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Support Details */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-lg border border-[var(--aura-border)] bg-[var(--aura-surface)] p-6 space-y-5">
            <h2 className="font-display text-2xl font-semibold text-[var(--aura-text)]">
              Direct Support Channels
            </h2>
            <p className="text-sm leading-relaxed text-[var(--aura-text-muted)]">
              Questions about an order, invoice, return, or product specification? Send a message
              and our team responds within one business day.
            </p>

            <div className="space-y-4 pt-2 text-sm text-[var(--aura-text)]">
              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 mt-0.5 text-[var(--aura-accent)] shrink-0" />
                <div>
                  <p className="font-medium">concierge@auracommerce.in</p>
                  <p className="text-xs text-[var(--aura-text-muted)]">24/7 ticket intake</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="w-4 h-4 mt-0.5 text-[var(--aura-accent)] shrink-0" />
                <div>
                  <p className="font-medium tabular-nums">+91 80 4120 8890</p>
                  <p className="text-xs text-[var(--aura-text-muted)]">
                    Monday – Saturday, 9:30 AM – 7:00 PM IST
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 mt-0.5 text-[var(--aura-accent)] shrink-0" />
                <div>
                  <p className="font-medium">Aura Studio &amp; Fulfillment Hub</p>
                  <p className="text-xs text-[var(--aura-text-muted)]">
                    14 Indiranagar 100 Feet Road, Bengaluru 560038
                  </p>
                </div>
              </div>
            </div>
          </div>

          {myMessages.length > 0 && (
            <div className="rounded-lg border border-[var(--aura-border)] bg-[var(--aura-surface)] p-6 space-y-3">
              <h3 className="text-sm font-semibold text-[var(--aura-text)]">
                Your Recent Inquiries ({myMessages.length})
              </h3>
              <div className="divide-y divide-[var(--aura-border)]">
                {myMessages.slice(0, 5).map((m) => (
                  <div key={m.id} className="py-3 space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-medium text-[var(--aura-text)]">{m.subject}</span>
                      <span className="text-[var(--aura-text-muted)] tabular-nums">
                        {m.status} · {m.id}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--aura-text-muted)] line-clamp-2">{m.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Contact Form */}
        <div className="lg:col-span-7">
          <form
            onSubmit={handleSubmit}
            className="rounded-lg border border-[var(--aura-border)] bg-[var(--aura-surface)] p-6 sm:p-8 space-y-4"
          >
            <h2 className="font-display text-2xl font-semibold text-[var(--aura-text)]">
              Send a Message
            </h2>

            {lastTicketId && (
              <div className="rounded-md border border-[var(--aura-border)] bg-[var(--aura-surface-muted)] p-3 text-xs text-[var(--aura-text)]">
                Thank you. Reference ID <strong className="tabular-nums">{lastTicketId}</strong>{' '}
                has been logged for our support team.
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  className="w-full px-3 py-2 text-sm rounded-md border border-[var(--aura-border)] bg-[var(--aura-bg)] text-[var(--aura-text)] focus:outline-none focus:ring-2 focus:ring-[var(--aura-accent)]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--aura-text)] mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-md border border-[var(--aura-border)] bg-[var(--aura-bg)] text-[var(--aura-text)] focus:outline-none focus:ring-2 focus:ring-[var(--aura-accent)]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[var(--aura-text)] mb-1.5">
                  Subject
                </label>
                <input
                  type="text"
                  required
                  minLength={3}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Order delivery, product inquiry, or billing"
                  className="w-full px-3 py-2 text-sm rounded-md border border-[var(--aura-border)] bg-[var(--aura-bg)] text-[var(--aura-text)] focus:outline-none focus:ring-2 focus:ring-[var(--aura-accent)]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--aura-text)] mb-1.5">
                  Order Number (Optional)
                </label>
                <input
                  type="text"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  placeholder="AUR-..."
                  className="w-full px-3 py-2 text-sm rounded-md border border-[var(--aura-border)] bg-[var(--aura-bg)] text-[var(--aura-text)] focus:outline-none focus:ring-2 focus:ring-[var(--aura-accent)]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--aura-text)] mb-1.5">
                Message
              </label>
              <textarea
                rows={5}
                required
                minLength={10}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us how we can assist you..."
                className="w-full px-3 py-2 text-sm rounded-md border border-[var(--aura-border)] bg-[var(--aura-bg)] text-[var(--aura-text)] focus:outline-none focus:ring-2 focus:ring-[var(--aura-accent)]"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-md bg-[var(--aura-accent)] text-[var(--aura-accent-contrast)] hover:bg-[var(--aura-accent-hover)] transition-colors cursor-pointer disabled:opacity-60"
            >
              <Send className="w-4 h-4" />
              <span>{submitting ? 'Sending...' : 'Submit Inquiry'}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export function FaqView() {
  const { navigate } = useStore();
  const [query, setQuery] = useState('');
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const filteredFaqs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FAQ_ITEMS;
    return FAQ_ITEMS.filter(
      (f) =>
        f.question.toLowerCase().includes(q) ||
        f.answer.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <div className="mx-auto max-w-[960px] px-6 py-12 space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--aura-border)] pb-6">
        <div>
          <p className="text-xs text-[var(--aura-text-muted)]">Help Center</p>
          <h1 className="mt-1 font-display text-4xl font-semibold text-[var(--aura-text)]">
            Frequently Asked Questions
          </h1>
        </div>
        <button
          type="button"
          onClick={() => navigate({ view: 'contact' })}
          className="px-4 py-2 text-xs font-semibold rounded-md bg-[var(--aura-accent)] text-[var(--aura-accent-contrast)] hover:bg-[var(--aura-accent-hover)] cursor-pointer"
        >
          Contact Support
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-[var(--aura-text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search questions about orders, invoices, or sync..."
          className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-[var(--aura-border)] bg-[var(--aura-surface)] text-[var(--aura-text)] placeholder:text-[var(--aura-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--aura-accent)]"
        />
      </div>

      <div className="divide-y divide-[var(--aura-border)] rounded-lg border border-[var(--aura-border)] bg-[var(--aura-surface)]">
        {filteredFaqs.length === 0 ? (
          <div className="p-8 text-center text-sm text-[var(--aura-text-muted)]">
            No matching FAQ entries found. Try another search term or contact our team directly.
          </div>
        ) : (
          filteredFaqs.map((item, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div key={item.question} className="p-5 sm:p-6">
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  aria-expanded={isOpen}
                  className="flex w-full items-start justify-between gap-4 text-left cursor-pointer"
                >
                  <div>
                    <p className="text-xs text-[var(--aura-text-muted)] mb-1">{item.category}</p>
                    <h2 className="text-base font-semibold text-[var(--aura-text)]">
                      {item.question}
                    </h2>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 mt-1 shrink-0 text-[var(--aura-text-muted)] transition-transform ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <p className="mt-3 text-sm leading-relaxed text-[var(--aura-text-muted)]">
                    {item.answer}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
