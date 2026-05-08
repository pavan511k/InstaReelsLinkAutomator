'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Shield, Zap, Check, MessageCircle, Heart, Send, MoreHorizontal, Bookmark, Sparkles, Activity, Lock } from 'lucide-react';
import { useStyles } from '@/lib/useStyles';
import darkStyles from './Hero.module.css';
import lightStyles from './Hero.light.module.css';

export default function Hero() {
  const styles = useStyles(darkStyles, lightStyles);
  return (
    <section className={styles.hero}>
      {/* Background — single subtle accent glow + dot grid.
          (Removed the previous triple stacked gradient orbs which read
          as AI-template default.) */}
      <div className={styles.bgGrid} />
      <div className={styles.bgGlow} />

      <div className={styles.inner}>

        {/* ── LEFT: Copy ───────────────────────────────── */}
        <div className={styles.copy}>

          <div className={styles.badge}>
            <Shield size={12} strokeWidth={2.5} />
            Official Meta Business Partner
          </div>

          <h1 className={styles.headline}>
            Reply to Instagram Comments with a DM,{' '}
            <span className={styles.highlight}>Instantly!</span>
          </h1>

          <p className={styles.subtitle}>
            AutoDM watches every Reel, Post, and Story. The moment someone comments — keyword, emoji, or @mention — they get a personal DM.
          </p>

          <ul className={styles.perks}>
            {[
              'Free up to 3,000 DMs / month',
              'Reels, Posts, Stories & Facebook Pages',
              'No Instagram password required — official OAuth',
            ].map((p) => (
              <li key={p} className={styles.perk}>
                <div className={styles.perkCheck}><Check size={11} strokeWidth={3} /></div>
                {p}
              </li>
            ))}
          </ul>

          <div className={styles.ctaRow}>
            <Link href="/signup" className={styles.ctaPrimary}>
              Start free — no credit card
              <ArrowRight size={15} strokeWidth={2.5} />
            </Link>
            <Link href="#how-it-works" className={styles.ctaSecondary}>
              See how it works
            </Link>
          </div>

          {/* Trust strip — replaces the abstract avatar stack with concrete,
              specific signals that take 30 seconds to scan. */}
          <div className={styles.trustStrip}>
            <div className={styles.trustItem}>
              <Activity size={11} className={styles.trustIcon} style={{ color: '#10B981' }} />
              <span className={styles.trustVal}>99.9%</span>
              <span className={styles.trustLbl}>delivery rate</span>
            </div>
            <div className={styles.trustDot} />
            <div className={styles.trustItem}>
              <span className={styles.trustVal}>3.2M+</span>
              <span className={styles.trustLbl}>DMs sent this month</span>
            </div>
            <div className={styles.trustDot} />
            <div className={styles.trustItem}>
              <Lock size={11} className={styles.trustIcon} />
              <span className={styles.trustLbl}>GDPR-ready · privacy-first</span>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Hero banner — Instagram phone mockup ───────────────── */}
        <div className={styles.visual}>

          {/* Soft single-color glow halo behind the phone.
              (Removed the fake CSS-drawn creator hand + the
              creator photo backdrop that referenced an asset
              never shipped — both read as AI-template noise.) */}
          <div className={styles.heroGlow} />

          {/* Phone mockup — Instagram post + comment thread */}
          <div className={styles.phone}>
            <div className={styles.phoneNotch} />
            <div className={styles.phoneScreen}>

              {/* IG status bar */}
              <div className={styles.igStatusBar}>
                <span>9:41</span>
                <span className={styles.igStatusIcons}>
                  <span className={styles.igSignal} />
                  <span className={styles.igBattery} />
                </span>
              </div>

              {/* IG header */}
              <div className={styles.igHeader}>
                <div className={styles.igAvatar}>
                  <Image src="/logo.png" alt="" width={16} height={16} />
                </div>
                <div className={styles.igHeaderInfo}>
                  <span className={styles.igHandle}>bloomstudio</span>
                  <span className={styles.igLocation}>Sponsored</span>
                </div>
                <MoreHorizontal size={16} className={styles.igMore} />
              </div>

              {/* IG post image — clean monochrome surface with the
                  Reel badge + drop title. Replaced previous double
                  radial-gradient placeholder which read as generated. */}
              <div className={styles.igPost}>
                <div className={styles.igPostOverlay}>
                  <span className={styles.igReelBadge}>
                    <Sparkles size={10} /> Reel
                  </span>
                  <span className={styles.igPostMeta}>NEW DROP</span>
                </div>
              </div>

              {/* IG action row */}
              <div className={styles.igActions}>
                <div className={styles.igActionsLeft}>
                  <Heart size={18} fill="#EF4444" stroke="#EF4444" />
                  <MessageCircle size={18} />
                  <Send size={18} />
                </div>
                <Bookmark size={18} className={styles.igBookmark} />
              </div>

              {/* IG caption + comments */}
              <div className={styles.igCaption}>
                <strong>bloomstudio</strong> Drop is live 🔥 Comment <em>LINK</em> to get yours
              </div>

              <div className={styles.igComment}>
                <div className={styles.igCommentAvatar}>S</div>
                <div className={styles.igCommentBody}>
                  <span className={styles.igCommentName}>sarah.k</span>
                  <span className={styles.igCommentText}>
                    <span className={styles.igCommentKw}>LINK</span>
                  </span>
                </div>
              </div>

            </div>
          </div>

          {/* Floating "trigger matched" pill — single line, iconified */}
          <div className={styles.triggerPill}>
            <span className={styles.triggerPillIcon}>
              <Zap size={11} strokeWidth={2.6} />
            </span>
            <div className={styles.triggerPillBody}>
              <span className={styles.triggerPillTitle}>Trigger matched</span>
              <span className={styles.triggerPillTime}>2.4s · DM queued</span>
            </div>
          </div>

          {/* Floating DM push-notification — looks like a real iOS push */}
          <div className={styles.dmFloat}>
            <div className={styles.dmHeaderRow}>
              <div className={styles.dmAppIcon}>
                <span className={styles.dmAppIconInner}>
                  <MessageCircle size={11} fill="#fff" strokeWidth={0} />
                </span>
              </div>
              <span className={styles.dmAppName}>Instagram</span>
              <span className={styles.dmTime}>now</span>
            </div>
            <div className={styles.dmContent}>
              <span className={styles.dmFrom}>@bloomstudio</span>
              <p className={styles.dmMsg}>Hey! Here&apos;s your link 🔗 Thanks for commenting.</p>
            </div>
          </div>

          {/* Floating stat pill */}
          <div className={styles.statFloat}>
            <div className={styles.statFloatIcon}><Heart size={13} fill="#10B981" strokeWidth={0} /></div>
            <div>
              <div className={styles.statFloatVal}>98.4%</div>
              <div className={styles.statFloatLbl}>delivery rate</div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
