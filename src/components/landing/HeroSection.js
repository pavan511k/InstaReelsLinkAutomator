import Link from 'next/link';
import { Check, Zap, Users, Shield } from 'lucide-react';
import styles from './HeroSection.module.css';

export default function HeroSection() {
    return (
        <section className={styles.hero}>
            <div className={`container ${styles.heroContent}`}>
                <div className={styles.heroText}>
                    <h1 className={styles.headline}>
                        Reply to Instagram Comments with a DM, <span className={styles.highlight}>Instantly!</span>
                    </h1>
                    <p className={styles.subtitle}>The #1 AutoDM Platform for Creators</p>

                    <ul className={styles.features}>
                        <li className={styles.feature}>
                            <Check size={18} className={styles.checkIcon} />
                            <span>Meta Business Partner</span>
                        </li>
                        <li className={styles.feature}>
                            <Shield size={18} className={styles.checkIconBlue} />
                            <span>Works with Facebook</span>
                        </li>
                        <li className={styles.feature}>
                            <Users size={18} className={styles.checkIconGold} />
                            <span>Used by 46,000+ creators, brands and agencies!</span>
                        </li>
                        <li className={styles.feature}>
                            <Zap size={18} className={styles.checkIconGold} />
                            <span>Get started in seconds</span>
                        </li>
                    </ul>

                    <div className={styles.heroCta}>
                        <Link href="/signup" className="btn btn-primary btn-lg">
                            Create Account — It&apos;s Free!
                        </Link>
                        <p className={styles.noCredit}>No credit card required</p>
                    </div>
                </div>

                <div className={styles.heroVisual}>
                    <div className={styles.phoneFrame}>
                        <div className={styles.phoneScreen}>
                            <div className={styles.mockPost}>
                                <div className={styles.mockHeader}>
                                    <div className={styles.mockAvatar}></div>
                                    <div className={styles.mockUsername}>@yourcreator</div>
                                </div>
                                <div className={styles.mockImage}></div>
                                <div className={styles.mockActions}>
                                    <span>❤️</span>
                                    <span>💬</span>
                                    <span>📤</span>
                                </div>
                                <div className={styles.mockComment}>
                                    <strong>user123</strong> Comment &quot;RECIPE&quot; for the link!
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className={styles.dmBubble}>
                        <div className={styles.notification}>1</div>
                        <div className={styles.dmContent}>
                            <p className={styles.dmTitle}>Here&apos;s your link! 🔗</p>
                            <p className={styles.dmText}>Thanks for commenting! Here&apos;s the recipe link you asked for.</p>
                            <div className={styles.dmButton}>See Recipe</div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
