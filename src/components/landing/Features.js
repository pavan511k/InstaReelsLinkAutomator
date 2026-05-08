'use client';

import { useState } from 'react';
import {
    Film, MessageCircle, Reply, AtSign, Zap, BarChart3,
    Layers, ShieldCheck, ChevronLeft, ChevronRight, ChevronDown,
    ArrowRight, Heart, Send, Bookmark, MoreHorizontal, Sparkles, Plus,
    Mail, FlaskConical, Trophy,
} from 'lucide-react';
import ScrollReveal from './ScrollReveal';
import { useStyles } from '@/lib/useStyles';
import darkStyles from './Features.module.css';
import lightStyles from './Features.light.module.css';

/**
 * Feature ordering rationale:
 *   First 4 (always visible)  — the most differentiating + visually striking.
 *     They establish "this is more than a basic auto-DM bot".
 *   Last 4 (behind "See more") — breadth + supporting features.
 *     Important for completeness, but not required for the conversion pitch.
 *
 * The visible 4 cover one feature from each category we promote:
 *   1. Reel automation         — the headline use-case (visceral, common)
 *   2. Carousel cards          — visual / "rich DM" wow factor (Pro tier)
 *   3. Follow-gated rewards    — Pro tier, smart marketing tool
 *   4. Live analytics          — ROI proof for the buyer
 */
const FEATURED_COUNT = 4;

const FEATURES = [
    /* ── Visible by default ────────────────────────────────────── */
    {
        icon:  Film,
        title: 'Reel comment automation',
        desc:  'Drop a Reel, set a keyword, and every matching comment fires an instant DM. Your busiest content turns into your best lead source.',
        color: '#7C3AED',
        bg:    'rgba(124,58,237,0.10)',
        preview: 'reel',
    },
    {
        icon:  Layers,
        title: 'Swipeable product carousels',
        desc:  'Send a 3–10 card carousel inside the DM — image, headline, description and a tap-through button per card. Built natively on Instagram’s Generic Template, no shortener gimmicks.',
        color: '#06B6D4',
        bg:    'rgba(6,182,212,0.10)',
        preview: 'carousel',
    },
    {
        icon:  ShieldCheck,
        title: 'Follow-gated rewards',
        desc:  'Ask viewers to follow before unlocking the link. AutoDM verifies the follow, then drops the reward DM automatically — turn one-time clicks into permanent followers.',
        color: '#22C55E',
        bg:    'rgba(34,197,94,0.10)',
        preview: 'followgate',
    },
    {
        icon:  BarChart3,
        title: 'Live dashboard & analytics',
        desc:  'Track DM delivery, link clicks, and conversions in a real-time dashboard built for creators — no spreadsheet duty.',
        color: '#A78BFA',
        bg:    'rgba(167,139,250,0.10)',
        preview: 'analytics',
    },

    /* ── Hidden behind "See more features" ──────────────────────── */
    /* Order: highest-impact "depth" features first (lead capture +
       experimentation), then the supporting integrations. Users who
       expand "See more" get value-front-loaded too. */
    {
        icon:  Mail,
        title: 'Capture emails as leads',
        desc:  'Reply to a comment, ask for the visitor’s email inside the DM, and AutoDM saves the verified address as a lead. Export to CSV or sync to your CRM in one click.',
        color: '#0EA5E9',
        bg:    'rgba(14,165,233,0.10)',
        preview: 'email',
    },
    {
        icon:  FlaskConical,
        title: 'A/B test your DMs',
        desc:  'Run two variants of a DM at random and let AutoDM declare the winner once one beats the other on click-through. Make every campaign smarter than the last.',
        color: '#F97316',
        bg:    'rgba(249,115,22,0.10)',
        preview: 'abtest',
    },
    {
        icon:  Zap,
        title: 'Keyword triggers',
        desc:  'Pin specific trigger words. Only matching comments fire a DM, so your automation stays surgical instead of spammy.',
        color: '#EC4899',
        bg:    'rgba(236,72,153,0.10)',
        preview: 'keyword',
    },
    {
        icon:  MessageCircle,
        title: 'Post comment DMs',
        desc:  'Same automation logic for static posts. Capture interest from carousel and photo comments without lifting a finger.',
        color: '#3B82F6',
        bg:    'rgba(59,130,246,0.10)',
        preview: 'post',
    },
    {
        icon:  Reply,
        title: 'Story reply automation',
        desc:  "When a viewer replies to your Story, AutoDM responds in seconds — keeping the conversation going while their attention is hot.",
        color: '#10B981',
        bg:    'rgba(16,185,129,0.10)',
        preview: 'story',
    },
    {
        icon:  AtSign,
        title: 'Story mention outreach',
        desc:  "Get tagged in someone's story? Reply automatically with a thank-you, link, or coupon to turn UGC into a touchpoint.",
        color: '#F59E0B',
        bg:    'rgba(245,158,11,0.10)',
        preview: 'mention',
    },
];

// ─── Phone wrapper ─────────────────────────────────────────────
// Helpers accept `styles` as a prop so they pick up the right
// CSS module per theme (Features dropped its module-scoped import
// when the parent switched to useStyles()).
function Phone({ children, styles }) {
    return (
        <div className={styles.phone}>
            <div className={styles.phoneNotch} />
            <div className={styles.phoneScreen}>{children}</div>
        </div>
    );
}

// ─── Per-feature animated phone preview ───────────────────────
function FeaturePreview({ kind, color, styles }) {
    if (kind === 'reel' || kind === 'post') {
        const isReel = kind === 'reel';
        return (
            <Phone styles={styles}>
                <div className={styles.platformLabel}>Instagram</div>
                <div className={styles.igHeader}>
                    <div className={styles.igAvatar}>YB</div>
                    <div className={styles.igHeaderInfo}>
                        <span className={styles.igHandle}>bloomstudio</span>
                        <span className={styles.igLocation}>{isReel ? 'Reel' : 'Post'}</span>
                    </div>
                    <MoreHorizontal size={14} className={styles.igMore} />
                </div>
                <div className={styles.igPost}>
                    <div className={styles.igPostOverlay}>
                        {isReel && (
                            <span className={styles.igReelBadge}>
                                <Sparkles size={9} /> Reel
                            </span>
                        )}
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
                <div className={styles.igCommentRow} style={{ borderColor: `${color}40`, background: `${color}14` }}>
                    <div className={styles.igCommentAvatar}>S</div>
                    <div className={styles.igCommentBody}>
                        <span className={styles.igCommentName}>sarah.k</span>
                        <span className={styles.igCommentText}>
                            <span className={styles.igCommentKw} style={{ color }}>LINK</span>
                        </span>
                    </div>
                    <span className={styles.igCommentBadge} style={{ background: `${color}30`, color }}>
                        DM
                    </span>
                </div>
            </Phone>
        );
    }

    if (kind === 'story') {
        return (
            <Phone styles={styles}>
                <div className={styles.platformLabel}>Story · Reply</div>
                <div className={styles.storyMeta}>
                    <div className={styles.storyRing} style={{ background: `linear-gradient(135deg, ${color}, ${color}AA)` }}>
                        <div className={styles.storyRingInner}>YB</div>
                    </div>
                    <div className={styles.storyHandle}>bloomstudio</div>
                    <div className={styles.storyTime}>2h</div>
                </div>
                <div className={styles.storyImage}>
                    <div className={styles.storyImageBlob} style={{ background: `radial-gradient(circle at 40% 30%, ${color}66 0%, transparent 60%), linear-gradient(135deg, #1F1242, #2A1850)` }} />
                </div>
                <div className={styles.dmThreadMini}>
                    <div className={`${styles.dmRecv} ${styles.bubble}`}>
                        Loved this 🙌
                    </div>
                    <div
                        className={`${styles.dmSent} ${styles.bubble}`}
                        style={{ background: `${color}22`, borderColor: `${color}55`, color }}
                    >
                        Thanks! Check your DMs for the link 🔗
                    </div>
                    <span className={styles.dmDelivered}>Delivered</span>
                </div>
            </Phone>
        );
    }

    if (kind === 'mention') {
        return (
            <Phone styles={styles}>
                <div className={styles.platformLabel}>Story · Mention</div>
                <div className={styles.storyImage}>
                    <div className={styles.storyImageBlob} style={{ background: `radial-gradient(circle at 60% 50%, ${color}66 0%, transparent 60%), linear-gradient(135deg, #2A1B0D, #1F1242)` }} />
                    <div className={styles.mentionTag} style={{ borderColor: `${color}55`, color }}>
                        <AtSign size={11} /> bloomstudio
                    </div>
                </div>
                <div className={styles.mentionFooter}>
                    <div className={styles.mentionAvatar} style={{ background: `linear-gradient(135deg, ${color}, ${color}AA)` }}>M</div>
                    <div className={styles.mentionBody}>
                        <span className={styles.mentionName}>mike_92</span>
                        <span className={styles.mentionAction}>tagged you in a story</span>
                    </div>
                    <span className={styles.mentionPing} style={{ background: color }} />
                </div>
                <div className={styles.dmSentBlock} style={{ background: `${color}1A`, borderColor: `${color}55`, color }}>
                    Auto-DM sent: &quot;Thanks for the love! Here&apos;s a code for you 🎁&quot;
                </div>
            </Phone>
        );
    }

    if (kind === 'keyword') {
        return (
            <Phone styles={styles}>
                <div className={styles.platformLabel}>AutoDM · Triggers</div>
                <div className={styles.kwHeader}>WHEN COMMENT CONTAINS</div>
                <div className={styles.kwField}>
                    {['LINK', 'INFO', 'DROP'].map((kw, i) => (
                        <span
                            key={kw}
                            className={styles.kwChip}
                            style={i < 2
                                ? { background: `${color}22`, borderColor: `${color}55`, color }
                                : { background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.10)' }}
                        >
                            {kw}
                            {i < 2 && <span className={styles.kwX}>×</span>}
                        </span>
                    ))}
                    <span className={styles.kwAdd}>
                        <Plus size={9} /> add
                    </span>
                </div>
                <div className={styles.kwRule}>
                    <span className={styles.kwRuleDot} style={{ background: color }} />
                    Reply with template
                </div>
                <div className={styles.kwRule}>
                    <span className={styles.kwRuleDot} style={{ background: '#10B981' }} />
                    Send once per user
                </div>
                <div className={styles.kwResult} style={{ background: `${color}14`, borderColor: `${color}40`, color }}>
                    412 DMs fired today
                </div>
            </Phone>
        );
    }

    if (kind === 'carousel') {
        // Swipeable carousel preview — three product cards with the middle
        // card "active". Mirrors what an actual button_template DM looks
        // like in Instagram's inbox.
        const cards = [
            { tag: 'NEW',     name: 'Linen Tee',    cta: 'Shop Now', accent: '#06B6D4' },
            { tag: 'BEST',    name: 'Canvas Tote',  cta: 'Get Yours', accent: '#06B6D4' },
            { tag: 'LIMITED', name: 'Wool Cap',     cta: 'Pre-Order', accent: '#06B6D4' },
        ];
        return (
            <Phone styles={styles}>
                <div className={styles.platformLabel}>DM · Carousel</div>
                <div className={styles.dmHeaderMini}>
                    <div className={styles.dmHeaderAvatar} style={{ background: `linear-gradient(135deg, ${color}, ${color}AA)` }}>YB</div>
                    <div>
                        <div className={styles.dmHeaderName}>bloomstudio</div>
                        <div className={styles.dmHeaderSub}>Active now</div>
                    </div>
                </div>
                <div className={styles.bubbleRecv} style={{ background: 'rgba(255,255,255,0.06)' }}>
                    Hey Sarah! Here&apos;s what&apos;s new this week 👇
                </div>
                <div className={styles.carouselTrack}>
                    {cards.map((c, idx) => (
                        <div
                            key={c.name}
                            className={styles.carouselCard}
                            style={{
                                borderColor: idx === 1 ? `${color}66` : 'rgba(255,255,255,0.10)',
                                background:  idx === 1 ? `${color}10` : 'rgba(255,255,255,0.04)',
                                transform:   idx === 1 ? 'translateY(-4px)' : 'none',
                            }}
                        >
                            <div className={styles.carouselImg} style={{ background: `linear-gradient(135deg, ${c.accent}55, ${c.accent}22)` }}>
                                <span className={styles.carouselTag} style={{ background: `${color}33`, color, borderColor: `${color}55` }}>{c.tag}</span>
                            </div>
                            <div className={styles.carouselName}>{c.name}</div>
                            <div className={styles.carouselBtn} style={{ background: idx === 1 ? color : `${color}33`, color: idx === 1 ? '#0B1426' : color }}>
                                {c.cta}
                            </div>
                        </div>
                    ))}
                </div>
                <div className={styles.carouselNav}>
                    <ChevronLeft size={11} style={{ opacity: 0.4 }} />
                    <span className={styles.carouselDots}>
                        <span className={styles.carouselDot} style={{ opacity: 0.3 }} />
                        <span className={styles.carouselDot} style={{ background: color }} />
                        <span className={styles.carouselDot} style={{ opacity: 0.3 }} />
                    </span>
                    <ChevronRight size={11} style={{ color }} />
                </div>
            </Phone>
        );
    }

    if (kind === 'followgate') {
        // Follow Gate flow — gate message + ✅/❌ reply chips, then the
        // reward DM appearing once the user has followed. Compresses two
        // chronological screens into one preview using a soft divider.
        return (
            <Phone styles={styles}>
                <div className={styles.platformLabel}>DM · Follow Gate</div>
                <div className={styles.dmHeaderMini}>
                    <div className={styles.dmHeaderAvatar} style={{ background: `linear-gradient(135deg, ${color}, ${color}AA)` }}>YB</div>
                    <div>
                        <div className={styles.dmHeaderName}>bloomstudio</div>
                        <div className={styles.dmHeaderSub}>Active now</div>
                    </div>
                </div>
                <div className={styles.bubbleRecv} style={{ background: 'rgba(255,255,255,0.06)' }}>
                    Hey Sarah! 👋 Follow the page first, then tap ✅ Yes to grab your link.
                </div>
                <div className={styles.gateChips}>
                    <span className={styles.gateChip} style={{ borderColor: '#10B981', color: '#10B981', background: 'rgba(16,185,129,0.08)' }}>
                        ✅ Yes, I followed
                    </span>
                    <span className={styles.gateChip} style={{ borderColor: 'rgba(239,68,68,0.6)', color: 'rgba(239,68,68,0.85)' }}>
                        ❌ Not yet
                    </span>
                </div>
                <div className={styles.gateDivider}>
                    <span />
                    <span style={{ color: `${color}88` }}>follow verified</span>
                    <span />
                </div>
                <div
                    className={styles.bubbleSent}
                    style={{ background: `${color}22`, borderColor: `${color}55`, color }}
                >
                    🎉 Welcome to the family! Here&apos;s your link → bloomstudio.co/drop
                </div>
                <span className={styles.dmDelivered}>Delivered</span>
            </Phone>
        );
    }

    if (kind === 'email') {
        // Email-collector preview — DM thread showing AutoDM asking for the
        // email, the user's reply, and the auto-confirmation. Plus a
        // "Lead saved" pill at the bottom to make the dashboard outcome
        // visible.
        return (
            <Phone styles={styles}>
                <div className={styles.platformLabel}>DM · Lead capture</div>
                <div className={styles.dmHeaderMini}>
                    <div className={styles.dmHeaderAvatar} style={{ background: `linear-gradient(135deg, ${color}, ${color}AA)` }}>YB</div>
                    <div>
                        <div className={styles.dmHeaderName}>bloomstudio</div>
                        <div className={styles.dmHeaderSub}>Active now</div>
                    </div>
                </div>
                <div className={styles.bubbleRecv} style={{ background: 'rgba(255,255,255,0.06)' }}>
                    Hey Sarah! Drop your email and I&apos;ll send you the early-access link 📧
                </div>
                <div className={styles.bubbleSent} style={{ background: '#262626', borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.92)' }}>
                    sarah@example.com
                </div>
                <div className={styles.bubbleRecv} style={{ background: `${color}22`, borderColor: `${color}55`, color, fontWeight: 600 }}>
                    Got it 🎉 You&apos;re on the list — link sent.
                </div>
                <div className={styles.emailLeadPill} style={{ background: `${color}1A`, borderColor: `${color}55`, color }}>
                    <Mail size={11} />
                    <span>Lead saved · 1 of 1,247</span>
                </div>
            </Phone>
        );
    }

    if (kind === 'abtest') {
        // A/B test preview — two variant cards stacked with their CTRs.
        // Variant B has a small "Winner" trophy badge to communicate that
        // AutoDM auto-declares once the gap is statistically clear.
        const variants = [
            { letter: 'A', headline: 'Tap below for the link', ctr: 18.4, winner: false },
            { letter: 'B', headline: 'Grab your free drop ↓',  ctr: 24.1, winner: true  },
        ];
        return (
            <Phone styles={styles}>
                <div className={styles.platformLabel}>A/B test · live</div>
                <div className={styles.abTrack}>
                    {variants.map((v) => (
                        <div
                            key={v.letter}
                            className={styles.abCard}
                            style={{
                                borderColor: v.winner ? `${color}88` : 'rgba(255,255,255,0.10)',
                                background:  v.winner ? `${color}10` : 'rgba(255,255,255,0.04)',
                            }}
                        >
                            <div className={styles.abCardTop}>
                                <span className={styles.abLetter} style={{ background: `${color}22`, color, borderColor: `${color}55` }}>
                                    {v.letter}
                                </span>
                                <span className={styles.abHeadline}>{v.headline}</span>
                                {v.winner && (
                                    <span className={styles.abWinner} style={{ color }}>
                                        <Trophy size={11} /> Winner
                                    </span>
                                )}
                            </div>
                            <div className={styles.abMeter}>
                                <span
                                    className={styles.abMeterFill}
                                    style={{
                                        width: `${(v.ctr / 30) * 100}%`,
                                        background: v.winner ? color : `${color}66`,
                                    }}
                                />
                            </div>
                            <div className={styles.abFooter}>
                                <span className={styles.abFooterLabel}>CTR</span>
                                <span className={styles.abFooterValue} style={{ color: v.winner ? color : 'rgba(255,255,255,0.85)' }}>
                                    {v.ctr.toFixed(1)}%
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
                <div className={styles.abFootnote} style={{ color: `${color}AA` }}>
                    AutoDM declared the winner after 1,200 sends.
                </div>
            </Phone>
        );
    }

    if (kind === 'analytics') {
        return (
            <Phone styles={styles}>
                <div className={styles.platformLabel}>Dashboard</div>
                <div className={styles.analyticsHeader}>
                    <span className={styles.analyticsDot} style={{ background: color, boxShadow: `0 0 0 4px ${color}30` }} />
                    <span className={styles.analyticsLabel}>Live · today</span>
                </div>
                <div className={styles.analyticsValue}>14,291</div>
                <div className={styles.analyticsSubLabel}>DMs sent · this week</div>
                <div className={styles.analyticsBars}>
                    {[36, 58, 44, 78, 62, 92, 70].map((h, i) => (
                        <span
                            key={i}
                            className={styles.analyticsBar}
                            style={{ height: `${h}%`, background: i === 5 ? color : `${color}66` }}
                        />
                    ))}
                </div>
                <div className={styles.analyticsRow}>
                    <div className={styles.analyticsTile}>
                        <span className={styles.tileLabel}>Delivery</span>
                        <span className={styles.tileVal} style={{ color: '#10B981' }}>98.4%</span>
                    </div>
                    <div className={styles.analyticsTile}>
                        <span className={styles.tileLabel}>Click rate</span>
                        <span className={styles.tileVal} style={{ color }}>23.6%</span>
                    </div>
                </div>
            </Phone>
        );
    }

    return null;
}

export default function Features() {
    const styles = useStyles(darkStyles, lightStyles);
    /* Show the first FEATURED_COUNT features by default; the rest collapse
       behind a "See more" toggle. Keeps the landing page short for casual
       visitors while still letting interested ones see the full breadth. */
    const [expanded, setExpanded] = useState(false);
    const visible = expanded ? FEATURES : FEATURES.slice(0, FEATURED_COUNT);
    const hiddenCount = FEATURES.length - FEATURED_COUNT;

    return (
        <section className={styles.section} id="features">
            <div className={styles.inner}>

                <ScrollReveal animation="fadeUp">
                    <div className={styles.header}>
                        <span className={styles.eyebrow}>Features</span>
                        <h2 className={styles.title}>Every comment, an opportunity</h2>
                        <p className={styles.subtitle}>
                            AutoDM covers every touchpoint on Instagram — from Reels to Stories to posts. One platform, total automation.
                        </p>
                    </div>
                </ScrollReveal>

                <div className={styles.rows}>
                    {visible.map(({ icon: Icon, title, desc, color, bg, preview }, i) => {
                        const isReverse = i % 2 === 1;
                        return (
                            <ScrollReveal key={title} animation="fadeUp" delay={Math.min(i, 2) * 60}>
                                <div className={`${styles.row} ${isReverse ? styles.rowReverse : ''}`}>
                                    <div className={styles.copy}>
                                        <div className={styles.iconWrap} style={{ background: bg, color, borderColor: `${color}40` }}>
                                            <Icon size={22} strokeWidth={2} />
                                        </div>
                                        <h3 className={styles.rowTitle}>{title}</h3>
                                        <p className={styles.rowDesc}>{desc}</p>
                                        <span className={styles.rowAccent} style={{ color }}>
                                            <ArrowRight size={13} /> Watch it work
                                        </span>
                                    </div>
                                    <div className={styles.previewSlot}>
                                        <div
                                            className={styles.previewGlow}
                                            style={{ background: `radial-gradient(circle, ${color}33 0%, transparent 60%)` }}
                                        />
                                        <FeaturePreview kind={preview} color={color} styles={styles} />
                                    </div>
                                </div>
                            </ScrollReveal>
                        );
                    })}
                </div>

                {hiddenCount > 0 && !expanded && (
                    <div className={styles.expandWrap}>
                        <div className={styles.expandFade} />
                        <button
                            type="button"
                            className={styles.expandBtn}
                            onClick={() => setExpanded(true)}
                        >
                            See {hiddenCount} more {hiddenCount === 1 ? 'feature' : 'features'}
                            <ChevronDown size={15} strokeWidth={2.5} />
                        </button>
                    </div>
                )}

                {expanded && (
                    <div className={styles.collapseWrap}>
                        <button
                            type="button"
                            className={styles.expandBtn}
                            onClick={() => setExpanded(false)}
                        >
                            Show fewer features
                            <ChevronDown size={15} strokeWidth={2.5} style={{ transform: 'rotate(180deg)' }} />
                        </button>
                    </div>
                )}

            </div>
        </section>
    );
}
