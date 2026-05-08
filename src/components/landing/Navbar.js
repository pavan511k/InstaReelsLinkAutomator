'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useTheme } from 'next-themes';
import { Menu, X, ArrowRight, Sun, Moon } from 'lucide-react';
import { useStyles, useIsDark } from '@/lib/useStyles';
import darkStyles from './Navbar.module.css';
import lightStyles from './Navbar.light.module.css';

const NAV_LINKS = [
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Features',     href: '#features'     },
  { label: 'Pricing',      href: 'pricing'       },
];

export default function Navbar() {
  const styles = useStyles(darkStyles, lightStyles);
  const isDark = useIsDark();
  const { setTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 16);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const toggleTheme = () => setTheme(isDark ? 'light' : 'dark');

  return (
    <header className={`${styles.header} ${scrolled ? styles.scrolled : ''}`}>
      <div className={styles.inner}>

        {/* Logo */}
        <Link href="/" className={styles.logo}>
          <div className={styles.logoMark}>
            <Image src="/logo.png" alt="AutoDM" width={18} height={18} />
          </div>
          <span className={styles.logoText}>
            auto<span className={styles.logoDM}>dm</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className={styles.nav}>
          {NAV_LINKS.map(({ label, href }) => (
            <a key={label} href={href} className={styles.navLink}>{label}</a>
          ))}
        </nav>

        {/* Desktop CTAs */}
        <div className={styles.ctas}>
          <button
            type="button"
            onClick={toggleTheme}
            className={styles.themeToggle}
            aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            title={isDark ? 'Switch to light' : 'Switch to dark'}
          >
            {isDark ? <Sun size={16} strokeWidth={2} /> : <Moon size={16} strokeWidth={2} />}
          </button>
          <Link href="/login" className={styles.loginBtn}>Sign in</Link>
          <Link href="/signup" className={styles.signupBtn}>
            Get started free
            <ArrowRight size={14} strokeWidth={2.5} />
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          className={styles.toggle}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className={styles.mobileMenu}>
          {NAV_LINKS.map(({ label, href }) => (
            <a key={label} href={href} className={styles.mobileLink}
              onClick={() => setMenuOpen(false)}>
              {label}
            </a>
          ))}
          <button
            type="button"
            onClick={toggleTheme}
            className={styles.mobileThemeToggle}
          >
            {isDark ? <Sun size={16} strokeWidth={2} /> : <Moon size={16} strokeWidth={2} />}
            {isDark ? 'Switch to light' : 'Switch to dark'}
          </button>
          <div className={styles.mobileCtas}>
            <Link href="/login"  className={styles.mobileLogin}>Sign in</Link>
            <Link href="/signup" className={styles.signupBtn}>Get started free</Link>
          </div>
        </div>
      )}
    </header>
  );
}
