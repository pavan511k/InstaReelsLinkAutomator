'use client';

import Image from 'next/image';
import { Heart, MessageCircle, Send, ArrowRight, Zap, Bookmark, MoreHorizontal, Sparkles, Image as ImageIcon, Mic, ChevronLeft, Phone as PhoneIcon, Video, Smile, Camera } from 'lucide-react';
import ScrollReveal from './ScrollReveal';
import { useStyles } from '@/lib/useStyles';
import darkStyles from './DemoFlow.module.css';
import lightStyles from './DemoFlow.light.module.css';

/**
 * "See it live" — animated visualization of the core flow:
 *   1. Someone comments "LINK" on a Reel  (left phone, IG post screen)
 *   2. AutoDM detects the keyword           (centre, pulse)
 *   3. A personalised DM arrives in their inbox   (right phone, DM thread)
 * Pure CSS keyframes — no GIF asset required.
 */
export default function DemoFlow() {
    const styles = useStyles(darkStyles, lightStyles);
    return (
        <section className={styles.section}>
            <div className={styles.inner}>

                <ScrollReveal animation="fadeUp">
                    <div className={styles.header}>
                        <span className={styles.eyebrow}>See it live</span>
                        <h2 className={styles.title}>One comment. One DM. Fully automated.</h2>
                        <p className={styles.subtitle}>
                            From the comment landing on your Reel to the DM arriving in their inbox — under three seconds.
                        </p>
                    </div>
                </ScrollReveal>

                <ScrollReveal animation="fadeUp" delay={120}>
                    <div className={styles.stage}>

                        {/* ── LEFT phone: Instagram post + comment ────────── */}
                        <div className={`${styles.phone} ${styles.phoneLeft}`}>
                            <div className={styles.phoneNotch} />
                            <div className={styles.phoneScreen}>
                                <div className={styles.platformLabel}>Instagram</div>

                                <div className={styles.igHeader}>
                                    <div className={styles.igAvatar}>YB</div>
                                    <div className={styles.igHeaderInfo}>
                                        <span className={styles.igHandle}>bloomstudio</span>
                                        <span className={styles.igLocation}>Sponsored</span>
                                    </div>
                                    <MoreHorizontal size={14} className={styles.igMore} />
                                </div>

                                <div className={styles.igPost}>
                                    <div className={styles.igPostOverlay}>
                                        <span className={styles.igReelBadge}>
                                            <Sparkles size={9} /> Reel
                                        </span>
                                        <span className={styles.igPostMeta}>NEW DROP</span>
                                    </div>
                                </div>

                                <div className={styles.igActions}>
                                    <div className={styles.igActionsLeft}>
                                        <Heart size={15} fill="#EF4444" stroke="#EF4444" />
                                        <MessageCircle size={15} />
                                        <Send size={15} />
                                    </div>
                                    <Bookmark size={15} />
                                </div>

                                <div className={styles.igCaption}>
                                    <strong>bloomstudio</strong> Drop is live 🔥 Comment <em>LINK</em>
                                </div>

                                <div className={styles.igComment}>
                                    <div className={styles.igCommentAvatar}>S</div>
                                    <div className={styles.igCommentBody}>
                                        <span className={styles.igCommentName}>sarah.k</span>
                                        <span className={styles.igCommentText}>
                                            <span className={styles.igCommentKw}>LINK</span>
                                            <span className={styles.igCaret} />
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── CENTRE: detector pulse with connector ──────── */}
                        <div className={styles.middle}>
                            <div className={styles.midLineLeft} />
                            <div className={styles.detector}>
                                <div className={styles.detectorRing} />
                                <div className={styles.detectorCore}>
                                    <Zap size={16} strokeWidth={2.6} />
                                </div>
                            </div>
                            <div className={styles.detectorLabel}>
                                <span className={styles.detectorLabelTitle}>Trigger matched</span>
                                <span className={styles.detectorLabelTime}>~2.4s</span>
                            </div>
                            <div className={styles.midLineRight}>
                                <ArrowRight size={12} className={styles.midArrow} />
                            </div>
                        </div>

                        {/* ── RIGHT phone: realistic Instagram DM thread ───
                            Matches Instagram's actual dark-mode DM UI: iOS
                            status bar at top, header with chevron-back +
                            avatar + handle + active status + phone/video
                            icons, message thread with #262626 bubbles,
                            link-preview card, "Sent 1m" time stamp, and
                            the IG message-composer input bar at bottom.
                            The recognisability matters here — visitors
                            should think "yes that's a real Instagram DM",
                            not "that's a stylized illustration". */}
                        <div className={`${styles.phone} ${styles.phoneRight} ${styles.phoneIg}`}>
                            <div className={styles.phoneNotch} />
                            <div className={styles.phoneScreen}>

                                {/* iOS status bar */}
                                <div className={styles.iosStatusBar}>
                                    <span className={styles.iosTime}>9:41</span>
                                    <span className={styles.iosStatusIcons}>
                                        <span className={styles.iosSignal} />
                                        <span className={styles.iosWifi} />
                                        <span className={styles.iosBattery} />
                                    </span>
                                </div>

                                {/* IG DM header — back arrow, avatar, handle, call icons */}
                                <div className={styles.igDmHeader}>
                                    <ChevronLeft size={18} className={styles.igDmBack} strokeWidth={2.4} />
                                    <div className={styles.igDmAvatarRing}>
                                        <div className={styles.igDmAvatar}>
                                            <Image src="/logo.png" alt="" width={24} height={24} />
                                        </div>
                                    </div>
                                    <div className={styles.igDmHeaderInfo}>
                                        <span className={styles.igDmName}>bloomstudio</span>
                                        <span className={styles.igDmActive}>Active now</span>
                                    </div>
                                    <PhoneIcon size={16} className={styles.igDmHeaderIcon} strokeWidth={2.2} />
                                    <Video size={17} className={styles.igDmHeaderIcon} strokeWidth={2.2} />
                                </div>

                                {/* Message thread */}
                                <div className={styles.igDmThread}>
                                    <span className={styles.igDmDate}>Today</span>

                                    {/* Avatar + bubble row (received). Three pieces animate
                                        independently inside .igDmBubbleStack on a 7s
                                        infinite loop: typing-dots appear → text bubble
                                        lands → link card lands → timestamp shows →
                                        everything fades out → restart. The keyframes
                                        for each piece live in DemoFlow.module.css. */}
                                    <div className={styles.igDmRow}>
                                        <div className={styles.igDmRowAvatar}>
                                            <Image src="/logo.png" alt="" width={20} height={20} />
                                        </div>
                                        <div className={styles.igDmBubbleStack}>
                                            <div className={styles.igDmTyping} aria-hidden="true">
                                                <span className={styles.igDmTypingDot} />
                                                <span className={styles.igDmTypingDot} />
                                                <span className={styles.igDmTypingDot} />
                                            </div>
                                            <div className={styles.igDmBubble}>
                                                Hey Sarah! 🙌 Thanks for commenting on the Reel — here&apos;s the link you asked for:
                                            </div>
                                            <div className={`${styles.igDmBubble} ${styles.igDmBubbleLink}`}>
                                                <div className={styles.igDmLinkPreview}>
                                                    <div className={styles.igDmLinkThumb} />
                                                    <div className={styles.igDmLinkBody}>
                                                        <span className={styles.igDmLinkTitle}>The Drop is Live</span>
                                                        <span className={styles.igDmLinkDomain}>bloomstudio.co</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <span className={styles.igDmTime}>Sent · 1m</span>
                                        </div>
                                    </div>
                                </div>

                                {/* IG message composer */}
                                <div className={styles.igDmInputBar}>
                                    <div className={styles.igDmInputCam}>
                                        <Camera size={14} strokeWidth={2.2} color="#fff" />
                                    </div>
                                    <span className={styles.igDmInputField}>Message…</span>
                                    <Smile size={16} className={styles.igDmInputIcon} strokeWidth={2} />
                                    <Mic size={15} className={styles.igDmInputIcon} strokeWidth={2} />
                                    <ImageIcon size={15} className={styles.igDmInputIcon} strokeWidth={2} />
                                </div>
                            </div>
                        </div>

                    </div>
                </ScrollReveal>

            </div>
        </section>
    );
}
