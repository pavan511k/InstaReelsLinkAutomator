'use client';

import Link from 'next/link';
import { MessageSquare, ArrowRight } from 'lucide-react';
import styles from './Footer.module.css';

export default function Footer() {
    return (
        <footer className={styles.footer}>
            {/* CTA Banner */}
            <div className={`container ${styles.ctaBanner}`}>
                <div className={styles.ctaContent}>
                    <h2 className={styles.ctaTitle}>
                        Ready to automate your Instagram DMs?
                    </h2>
                    <p className={styles.ctaSub}>
                        Create your free account and start sending automated DMs in minutes.
                    </p>
                    <Link href="/signup" className={styles.ctaBtn}>
                        <span>Get Started Free</span>
                        <ArrowRight size={18} />
                    </Link>
                </div>
            </div>

            {/* Footer Content */}
            <div className={`container ${styles.footerContent}`}>
                <div className={styles.footerGrid}>
                    <div className={styles.footerBrand}>
                        <div className={styles.logo}>
                            <div className={styles.logoIcon}>
                                <MessageSquare size={16} color="white" strokeWidth={2.5} />
                            </div>
                            <span className={styles.logoText}>Auto<span className={styles.logoDM}>DM</span></span>
                        </div>
                        <p className={styles.brandDesc}>
                            Automate your Instagram DM responses. Works with posts, reels, and stories.
                        </p>
                    </div>

                    <div className={styles.footerLinks}>
                        <h4 className={styles.linkTitle}>Product</h4>
                        <a href="#features">Features</a>
                        <a href="#how-it-works">How It Works</a>
                        <Link href="/signup">Sign Up</Link>
                        <Link href="/login">Login</Link>
                    </div>

                    <div className={styles.footerLinks}>
                        <h4 className={styles.linkTitle}>Legal</h4>
                        <Link href="/privacy">Privacy Policy</Link>
                        <Link href="/terms">Terms of Use</Link>
                    </div>
                </div>

                <div className={styles.footerBottom}>
                    <p>© {new Date().getFullYear()} AutoDM. All rights reserved.</p>
                </div>
            </div>
        </footer>
    );
}
