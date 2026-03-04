'use client';

import Link from 'next/link';
import { Check, ArrowRight } from 'lucide-react';
import styles from './HeroSection.module.css';

export default function HeroSection() {
    return (
        <section className={styles.hero}>
            {/* Background orbs */}
            <div className={styles.heroOrb1} />
            <div className={styles.heroOrb2} />
            <div className={styles.heroOrb3} />

            <div className={`container ${styles.heroContent}`}>
                <div className={styles.heroText}>
                    <div className={styles.heroBadge}>
                        <span className={styles.badgeDot} />
                        <span>Instagram DM Automation Platform</span>
                    </div>

                    <h1 className={styles.headline}>
                        Reply to Instagram Comments with a DM,{' '}
                        <span className={styles.highlight}>Instantly</span>
                    </h1>

                    <p className={styles.subtitle}>
                        AutoDM automatically sends personalized DMs to users who comment on your posts, reels, and stories. Set up keyword triggers once and let it run.
                    </p>

                    <ul className={styles.checklist}>
                        <li className={styles.checkItem}>
                            <Check size={16} className={styles.checkIcon} />
                            <span>Works with Reels, Posts &amp; Stories</span>
                        </li>
                        <li className={styles.checkItem}>
                            <Check size={16} className={styles.checkIcon} />
                            <span>Keyword-based smart triggers</span>
                        </li>
                        <li className={styles.checkItem}>
                            <Check size={16} className={styles.checkIcon} />
                            <span>Free to get started — no credit card</span>
                        </li>
                    </ul>

                    <div className={styles.heroCta}>
                        <Link href="/signup" className={styles.ctaPrimary}>
                            <span>Get Started Free</span>
                            <ArrowRight size={18} />
                        </Link>
                        <a href="#how-it-works" className={styles.ctaSecondary}>
                            See how it works
                        </a>
                    </div>
                </div>

                {/* Right side — Interactive demo visual */}
                <div className={styles.heroVisual}>
                    <div className={styles.visualCard}>
                        {/* Simulated Instagram comment → DM flow */}
                        <div className={styles.flowStep}>
                            <div className={styles.flowLabel}>Comment</div>
                            <div className={styles.commentBox}>
                                <div className={styles.commentAvatar}>
                                    <span>🧑</span>
                                </div>
                                <div className={styles.commentContent}>
                                    <strong>@user</strong> Send me the link! 🔗
                                </div>
                            </div>
                        </div>

                        <div className={styles.flowArrow}>
                            <div className={styles.flowArrowLine} />
                            <div className={styles.flowArrowDot} />
                            <span className={styles.flowArrowLabel}>AutoDM triggers</span>
                        </div>

                        <div className={styles.flowStep}>
                            <div className={styles.flowLabel}>DM Sent</div>
                            <div className={styles.dmBox}>
                                <div className={styles.dmHeader}>
                                    <span className={styles.dmBotIcon}>🤖</span>
                                    <span className={styles.dmBotName}>AutoDM</span>
                                </div>
                                <p className={styles.dmMessage}>Hey! Here&apos;s the link you asked for 👇</p>
                                <div className={styles.dmLink}>
                                    <span>📎</span> yourlink.com/recipe
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
