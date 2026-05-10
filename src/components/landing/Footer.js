import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

const COLS = [
  {
    title: 'Product',
    links: [
      { label: 'How it works', href: '#how' },
      { label: 'Features',     href: '#how' },
      { label: 'Pricing',      href: '#pricing' },
      { label: 'Dashboard',    href: '/dashboard' },
    ],
  },
  {
    title: 'Account',
    links: [
      { label: 'Sign up free',     href: '/signup' },
      { label: 'Sign in',          href: '/login' },
      { label: 'Forgot password',  href: '/forgot-password' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy policy',   href: '/privacy' },
      { label: 'Terms of use',     href: '/terms' },
      { label: 'Contact support',  href: 'mailto:support@autodm.pro' },
    ],
  },
];

const SOCIAL = [
  {
    label: 'Twitter',
    href:  'https://twitter.com/autodmpro',
    path:  'M18.244 2H21.5l-7.27 8.31L23 22h-6.84l-5.32-6.95L4.7 22H1.44l7.78-8.89L1 2h6.96l4.81 6.36L18.244 2Zm-1.2 18h1.92L7.07 4H5.04l12 16Z',
  },
  {
    label: 'Instagram',
    href:  'https://instagram.com/autodmpro',
    path:  'M12 2.5c-2.58 0-2.9.01-3.91.06-1.01.05-1.7.2-2.3.44a4.65 4.65 0 0 0-1.68 1.1A4.65 4.65 0 0 0 3 5.78c-.24.6-.4 1.29-.44 2.3C2.51 9.1 2.5 9.42 2.5 12s.01 2.9.06 3.91c.05 1.01.2 1.7.44 2.3a4.65 4.65 0 0 0 1.1 1.68 4.65 4.65 0 0 0 1.68 1.1c.6.24 1.29.4 2.3.44 1.01.05 1.33.06 3.91.06s2.9-.01 3.91-.06c1.01-.05 1.7-.2 2.3-.44a4.85 4.85 0 0 0 2.78-2.78c.24-.6.4-1.29.44-2.3.05-1.01.06-1.33.06-3.91s-.01-2.9-.06-3.91c-.05-1.01-.2-1.7-.44-2.3a4.65 4.65 0 0 0-1.1-1.68A4.65 4.65 0 0 0 18.22 3c-.6-.24-1.29-.4-2.3-.44C14.9 2.51 14.58 2.5 12 2.5Zm0 1.8c2.54 0 2.84 0 3.84.05.93.04 1.43.2 1.77.33.45.17.76.38 1.1.72.33.33.55.65.72 1.1.13.34.29.84.33 1.77.05 1 .05 1.3.05 3.84s0 2.84-.05 3.84c-.04.93-.2 1.43-.33 1.77-.18.45-.39.76-.72 1.1-.34.33-.65.55-1.1.72-.34.13-.84.29-1.77.33-1 .05-1.3.05-3.84.05s-2.84 0-3.84-.05c-.93-.04-1.43-.2-1.77-.33a3.05 3.05 0 0 1-1.1-.72 3.05 3.05 0 0 1-.72-1.1c-.13-.34-.29-.84-.33-1.77C4.3 14.84 4.3 14.54 4.3 12s0-2.84.05-3.84c.04-.93.2-1.43.33-1.77.17-.45.38-.76.72-1.1.33-.33.65-.55 1.1-.72.34-.13.84-.29 1.77-.33 1-.05 1.3-.05 3.83-.05Zm0 3.05a4.65 4.65 0 1 0 0 9.3 4.65 4.65 0 0 0 0-9.3Zm0 7.66a3.01 3.01 0 1 1 0-6.02 3.01 3.01 0 0 1 0 6.02Zm5.92-7.86a1.09 1.09 0 1 1-2.18 0 1.09 1.09 0 0 1 2.18 0Z',
  },
  {
    label: 'LinkedIn',
    href:  'https://linkedin.com/company/autodmpro',
    path:  'M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.95v5.66H9.36V9h3.41v1.56h.05a3.74 3.74 0 0 1 3.37-1.85c3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12Zm1.78 13.02H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.99 0 1.78-.77 1.78-1.72V1.72C24 .77 23.21 0 22.22 0Z',
  },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-neutral-950 text-neutral-300">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-12">
          {/* Brand block */}
          <div className="lg:col-span-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-white">
                <Image src="/logo.png" alt="AutoDM" width={36} height={36} className="h-9 w-9 object-contain" />
              </span>
              <span className="text-base font-semibold tracking-tight">
                <span className="text-white">Auto</span>
                <span className="text-[#FF6B7A]">DM</span>
              </span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-neutral-400">
              The #1 Instagram DM automation platform for creators, brands, and agencies. Official Meta Business Partner.
            </p>
            <div className="mt-5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E63946]/30 bg-[#E63946]/10 px-3 py-1 text-xs font-semibold text-[#FFB4B4]">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#E63946]" />
                Official Meta Business Partner
              </span>
            </div>
            <div className="mt-6 flex items-center gap-3">
              {SOCIAL.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  aria-label={s.label}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-neutral-700 hover:text-white transition-colors"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                    <path d={s.path} />
                  </svg>
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {COLS.map((col) => (
            <div key={col.title} className="lg:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
                {col.title}
              </p>
              <ul className="mt-4 space-y-3">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-sm text-neutral-300 hover:text-white transition-colors"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Stay in the loop */}
          <div className="md:col-span-2 lg:col-span-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
              Stay in the loop
            </p>
            <p className="mt-4 max-w-xs text-sm text-neutral-400">
              Get product updates and automation tips straight to your inbox.
            </p>
            <form
              action="/api/newsletter"
              method="POST"
              className="mt-4 flex max-w-sm items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900 p-1 focus-within:border-[#2563EB] focus-within:ring-2 focus-within:ring-[#2563EB]/20"
            >
              <input
                type="email"
                name="email"
                required
                placeholder="you@company.com"
                className="flex-1 bg-transparent px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:outline-none"
              />
              <button
                type="submit"
                aria-label="Subscribe"
                className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded bg-[#2563EB] text-white hover:bg-[#1D4ED8] transition-colors"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
            <p className="mt-2 text-xs text-neutral-500">No spam. Unsubscribe any time.</p>
          </div>
        </div>

        {/* Bottom row */}
        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-neutral-800 pt-6 sm:flex-row sm:items-center">
          <p className="text-xs text-neutral-500">© {year} AutoDM. All rights reserved.</p>
          <div className="flex items-center gap-5 text-xs text-neutral-500">
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            <Link href="/terms"   className="hover:text-white transition-colors">Terms</Link>
            <Link href="/cookies" className="hover:text-white transition-colors">Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
