'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Twitter, Instagram, Linkedin, Github } from 'lucide-react';
import styles from './Footer.module.css';

const LINKS = {
  Product: [
    { label: 'How it works', href: '#how-it-works' },
    { label: 'Features',     href: '#features'     },
    { label: 'Pricing',      href: '#pricing'       },
    { label: 'Dashboard',    href: '/dashboard'     },
  ],
  Account: [
    { label: 'Sign up free', href: '/signup'          },
    { label: 'Sign in',      href: '/login'           },
    { label: 'Forgot password', href: '/forgot-password' },
  ],
  Legal: [
    { label: 'Privacy policy', href: '/privacy' },
    { label: 'Terms of use',   href: '/terms'   },
    { label: 'Cookie policy',  href: '#'         },
  ],
};

const SOCIALS = [
  { icon: Twitter,   href: '#', label: 'Twitter'   },
  { icon: Instagram, href: '#', label: 'Instagram'  },
  { icon: Linkedin,  href: '#', label: 'LinkedIn'   },
  { icon: Github,    href: '#', label: 'GitHub'     },
];

export default function Footer() {
  return (
    <footer className={styles.footer}>

      {/* Top border glow */}
      <div className={styles.topBorder} />

      <div className={styles.inner}>

        {/* ── Brand column ───────────────────────────── */}
        <div className={styles.brand}>
          <Link href="/" className={styles.logo}>
            <div className={styles.logoMark}>
              <Image src="/logo.png" alt="AutoDM" width={18} height={18} />
            </div>
            <span className={styles.logoText}>
              auto<span className={styles.logoDM}>dm</span>
            </span>
          </Link>

          <p className={styles.brandDesc}>
            The #1 Instagram DM automation platform for creators, brands, and agencies. Official Meta Business Partner.
          </p>

          {/* Meta partner badge */}
          <div className={styles.metaBadge}>
            <div className={styles.metaDot} />
            <span>Official Meta Business Partner</span>
          </div>

          {/* Socials */}
          <div className={styles.socials}>
            {SOCIALS.map(({ icon: Icon, href, label }) => (
              <a key={label} href={href} className={styles.socialBtn} aria-label={label}>
                <Icon size={15} strokeWidth={2} />
              </a>
            ))}
          </div>
        </div>

        {/* ── Link columns ───────────────────────────── */}
        {Object.entries(LINKS).map(([group, items]) => (
          <div key={group} className={styles.linkGroup}>
            <h4 className={styles.groupTitle}>{group}</h4>
            <ul className={styles.linkList}>
              {items.map(({ label, href }) => (
                <li key={label}>
                  <Link href={href} className={styles.link}>{label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {/* ── Newsletter column ──────────────────────── */}
        <div className={styles.newsletter}>
          <h4 className={styles.groupTitle}>Stay in the loop</h4>
          <p className={styles.newsletterDesc}>
            Get product updates and automation tips straight to your inbox.
          </p>
          <form className={styles.newsletterForm} onSubmit={(e) => e.preventDefault()}>
            <input
              type="email"
              placeholder="you@company.com"
              className={styles.newsletterInput}
            />
            <button type="submit" className={styles.newsletterBtn}>
              <ArrowRight size={15} strokeWidth={2.5} />
            </button>
          </form>
          <p className={styles.newsletterNote}>No spam. Unsubscribe any time.</p>
        </div>

      </div>

      {/* ── Bottom bar ─────────────────────────────── */}
      <div className={styles.bottom}>
        <div className={styles.bottomInner}>
          <p className={styles.copyright}>
            © {new Date().getFullYear()} AutoDM. All rights reserved.
          </p>
          <div className={styles.bottomLinks}>
            <Link href="/privacy" className={styles.bottomLink}>Privacy</Link>
            <span className={styles.bottomSep} />
            <Link href="/terms"   className={styles.bottomLink}>Terms</Link>
            <span className={styles.bottomSep} />
            <a href="#"           className={styles.bottomLink}>Cookies</a>
          </div>
        </div>
      </div>

    </footer>
  );
}
