import Link from 'next/link';
import Image from 'next/image';
import { Check, Zap, Shield, ArrowRight, Heart, MessageCircle, Send } from 'lucide-react';
import styles from './HeroSection.module.css';

export default function HeroSection() {
    return (
        <section className={styles.hero}>
            <div className={`container ${styles.heroContent}`}>
                <div className={styles.heroText}>
                    <div className={styles.badge}>
                        <span className={styles.badgeDot} />
                        Official Meta Business Partner
                    </div>

                    <h1 className={styles.headline}>
                        Reply to Instagram Comments with a DM, <span className={styles.highlight}>Instantly!</span>
                    </h1>

                    <p className={styles.subtitle}>
                        Automatically send DMs when followers comment on your posts, reels, and stories. Set up in 2 minutes.
                    </p>

                    <ul className={styles.features}>
                        <li className={styles.feature}>
                            <Shield size={16} className={styles.checkIcon} />
                            <span>Meta Business Partner</span>
                        </li>
                        <li className={styles.feature}>
                            <Check size={16} className={styles.checkIconBlue} />
                            <span>Works with Facebook</span>
                        </li>
                        <li className={styles.feature}>
                            <Zap size={16} className={styles.checkIconGold} />
                            <span>Get started in seconds</span>
                        </li>
                    </ul>

                    <div className={styles.heroCta}>
                        <Link href="/signup" className={styles.heroCtaBtn}>
                            Get Started Free
                            <ArrowRight size={16} />
                        </Link>
                        <p className={styles.noCredit}>No credit card required</p>
                    </div>
                </div>

                <div className={styles.heroVisual}>
                    {/* Premium Phone Mockup */}
                    <div className={styles.phoneFrame}>
                        <div className={styles.phoneNotch}>
                            <div className={styles.phoneNotchCam} />
                        </div>
                        <div className={styles.phoneScreen}>
                            {/* Instagram Top Bar */}
                            <div className={styles.igTopBar}>
                                <span className={styles.igLogo}>Instagram</span>
                                <div className={styles.igIcons}>
                                    <div className={styles.igIconDot} />
                                    <div className={styles.igIconDot} />
                                </div>
                            </div>

                            {/* Post */}
                            <div className={styles.igPostHeader}>
                                <div className={styles.igAvatar}>
                                    <div className={styles.igAvatarInner}>
                                        <div className={styles.igAvatarDot} />
                                    </div>
                                </div>
                                <span className={styles.igUsername}>yourcreator</span>
                            </div>

                            <div className={styles.igImage}>
                                <div className={styles.igImageOverlay}>
                                    Comment &quot;LINK&quot; to get it 👇
                                </div>
                            </div>

                            <div className={styles.igActions}>
                                <Heart size={20} className={styles.igActionIcon} />
                                <MessageCircle size={20} className={styles.igActionIcon} />
                                <Send size={20} className={styles.igActionIcon} />
                            </div>

                            <div className={styles.igLikes}>2,847 likes</div>

                            <div className={styles.igComment}>
                                <span className={styles.igCommentUser}>user123 </span>
                                <span className={styles.igCommentKeyword}>LINK</span> please! 🙏
                            </div>
                        </div>
                    </div>

                    {/* DM Bubble */}
                    <div className={styles.dmBubble}>
                        <div className={styles.notification}>1</div>
                        <div className={styles.dmHeader}>
                            <div className={styles.dmAvatar}>
                                <Image src="/logo.png" alt="" width={16} height={16} className={styles.dmAvatarIcon} />
                            </div>
                            <div>
                                <div className={styles.dmFrom}>autodm</div>
                                <div className={styles.dmTime}>Just now</div>
                            </div>
                        </div>
                        <div className={styles.dmContent}>
                            <p className={styles.dmTitle}>Here&apos;s your link! 🔗</p>
                            <p className={styles.dmText}>Thanks for commenting! Here&apos;s what you asked for.</p>
                            <div className={styles.dmButton}>Open Link →</div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
