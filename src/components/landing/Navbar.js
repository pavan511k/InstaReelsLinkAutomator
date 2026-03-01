'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X, MessageSquare } from 'lucide-react';
import styles from './Navbar.module.css';

export default function Navbar() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    return (
        <nav className={styles.navbar}>
            <div className={`container ${styles.navContent}`}>
                <Link href="/" className={styles.logo}>
                    <MessageSquare size={28} strokeWidth={2.5} />
                    <span className={styles.logoText}>Auto<span className={styles.logoDM}>DM</span></span>
                </Link>

                <div className={`${styles.navLinks} ${isMenuOpen ? styles.open : ''}`}>
                    <a href="#features" className={styles.navLink}>Features</a>
                    <Link href="/login" className={styles.navLink}>Log In</Link>
                    <Link href="/signup" className={`btn btn-primary ${styles.ctaBtn}`}>
                        Create Free Account
                    </Link>
                </div>

                <button
                    className={styles.menuToggle}
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    aria-label="Toggle menu"
                >
                    {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </div>
        </nav>
    );
}
