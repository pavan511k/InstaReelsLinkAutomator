import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import styles from './Footer.module.css';

export default function Footer() {
    return (
        <footer className={styles.footer}>
            <div className={`container ${styles.footerContent}`}>
                <div className={styles.footerCta}>
                    <h2 className={styles.footerHeadline}>
                        Ready to automate your DMs?
                    </h2>
                    <p className={styles.footerSub}>
                        Join thousands of creators and get started with your free AutoDM account today.
                    </p>
                    <Link href="/signup" className={styles.footerCtaBtn}>
                        Get Started Free
                        <ArrowRight size={16} />
                    </Link>
                </div>

                <div className={styles.footerGrid}>
                    <div className={styles.footerBrand}>
                        <div className={styles.logo}>
                            <Image src="/logo.png" alt="AutoDM" width={28} height={28} style={{ filter: 'brightness(2)' }} />
                            <span className={styles.logoText}>auto<span className={styles.logoDM}>dm</span></span>
                        </div>
                        <p className={styles.brandDesc}>
                            The #1 AutoDM platform for Instagram creators, brands, and agencies.
                        </p>
                    </div>

                    <div className={styles.footerLinks}>
                        <h4 className={styles.linkTitle}>Product</h4>
                        <Link href="/signup">Sign Up</Link>
                        <Link href="/login">Login</Link>
                    </div>

                    <div className={styles.footerLinks}>
                        <h4 className={styles.linkTitle}>Legal</h4>
                        <a href="#">Privacy Policy</a>
                        <a href="#">Terms of Use</a>
                    </div>
                </div>

                <div className={styles.footerBottom}>
                    <p>© {new Date().getFullYear()} autodm. All rights reserved.</p>
                </div>
            </div>
        </footer>
    );
}
