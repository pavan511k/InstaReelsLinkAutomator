'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';

const NAV_LINKS = [
  { href: '#how',          label: 'How it works' },
  { href: '#pricing',      label: 'Pricing' },
  { href: '#testimonials', label: 'Reviews' },
  { href: '#faq',          label: 'FAQ' },
];

/**
 * Hybrid navbar: floating pill at the top of the hero, solid full-width bar
 * once the user scrolls past the hero. The pill gets lost on the white
 * content sections (low contrast, looks orphaned), so the switch to a
 * grounded edge-to-edge header on scroll is intentional — clearer mental
 * model for long marketing pages.
 *
 * Both modes share the same content; only the chrome (chunkiness, radius,
 * width, bg opacity) animates between states.
 */
export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={[
        'fixed inset-x-0 top-0 z-50 transition-all duration-300',
        scrolled
          ? 'pointer-events-auto border-b border-neutral-200 bg-white/95 shadow-sm backdrop-blur-xl'
          : 'pointer-events-none flex justify-center px-4 pt-4',
      ].join(' ')}
    >
      <div
        className={[
          'pointer-events-auto flex w-full items-center gap-2 transition-all duration-300',
          scrolled
            ? 'mx-auto max-w-7xl px-6 py-3'
            : 'max-w-3xl rounded-2xl border border-white/40 bg-white/85 px-3 py-2.5 shadow-lg shadow-black/10 backdrop-blur-xl',
        ].join(' ')}
      >
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 pl-1 pr-3">
          <span className="inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-md bg-white ring-1 ring-neutral-200">
            <Image
              src="/logo.png"
              alt="AutoDM"
              width={32}
              height={32}
              className="h-8 w-8 object-contain"
              priority
            />
          </span>
          <span className="text-base font-semibold tracking-tight">
            <span className="text-neutral-900">Auto</span>
            <span className="text-[#E63946]">DM</span>
          </span>
        </Link>

        {/* Nav links — centered, hidden under md */}
        <nav className="hidden flex-1 items-center justify-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* CTAs */}
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <Link
            href="/login"
            className="hidden rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 sm:inline-flex"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center rounded-lg bg-[#E63946] px-4 py-2 text-sm font-semibold text-white hover:bg-[#CC2E3B] transition-colors"
          >
            Start for free
          </Link>
        </div>
      </div>
    </header>
  );
}
