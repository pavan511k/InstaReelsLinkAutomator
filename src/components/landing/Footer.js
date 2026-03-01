import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import styles from './Footer.module.css';

export default function Footer() {
    return (
        <footer className={styles.footer}>
            <div className={`container ${styles.footerContent}`}>
                <div className={styles.footerCta}>
                    <h2 className={styles.footerHeadline}>
                        Just like Instagram... AutoDM is free to use!
                    </h2>
                    <p className={styles.footerSub}>
                        Join thousands of creators & get started with your free AutoDM account today!
                    </p>
                    <Link href="/signup" className="btn btn-primary btn-lg">
                        👉 Create your Free Account
                    </Link>
                </div>

                <div className={styles.footerGrid}>
                    <div className={styles.footerBrand}>
                        <div className={styles.logo}>
                            <MessageSquare size={24} />
                            <span className={styles.logoText}>Auto<span className={styles.logoDM}>DM</span></span>
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
                    <p>© {new Date().getFullYear()} AutoDM. All rights reserved.</p>
                </div>
            </div>
        </footer>
    );
}
