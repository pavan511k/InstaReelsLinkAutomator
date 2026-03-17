import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Shield, Zap, Check, MessageCircle, Heart, Send, MoreHorizontal } from 'lucide-react';
import styles from './Hero.module.css';

export default function Hero() {
  return (
    <section className={styles.hero}>
      {/* Background layers */}
      <div className={styles.bgGrid} />
      <div className={styles.bgGlow1} />
      <div className={styles.bgGlow2} />
      <div className={styles.bgGlow3} />

      <div className={styles.inner}>

        {/* ── LEFT: Copy ───────────────────────────────── */}
        <div className={styles.copy}>

          <div className={styles.badge}>
            <Shield size={12} strokeWidth={2.5} />
            Official Meta Business Partner
          </div>

          <h1 className={styles.headline}>
            Turn every comment into a{' '}
            <span className={styles.highlight}>paying customer</span>
          </h1>

          <p className={styles.subtitle}>
            AutoDM automatically sends a personalised DM the moment someone comments on your Reels, posts, or stories. Zero manual work. Zero missed leads.
          </p>

          <ul className={styles.perks}>
            {[
              'Works on Reels, Posts & Stories',
              'Keyword triggers or reply to all',
              '1,000 free DMs every month',
            ].map((p) => (
              <li key={p} className={styles.perk}>
                <div className={styles.perkCheck}><Check size={11} strokeWidth={3} /></div>
                {p}
              </li>
            ))}
          </ul>

          <div className={styles.ctaRow}>
            <Link href="/signup" className={styles.ctaPrimary}>
              Start for free
              <ArrowRight size={15} strokeWidth={2.5} />
            </Link>
            <Link href="#how-it-works" className={styles.ctaSecondary}>
              See how it works
            </Link>
          </div>

          <div className={styles.socialProof}>
            <div className={styles.avatarStack}>
              {[1,2,3,4,5].map(i => (
                <div key={i} className={styles.avatar}
                  style={{ background: `hsl(${250 + i * 20}, 70%, ${45 + i * 5}%)` }} />
              ))}
            </div>
            <span className={styles.proofText}>
              <strong>46,000+</strong> creators already using AutoDM
            </span>
          </div>
        </div>

        {/* ── RIGHT: Product visual ─────────────────────── */}
        <div className={styles.visual}>

          {/* Main dashboard card */}
          <div className={styles.dashCard}>
            <div className={styles.dashHeader}>
              <div className={styles.dashDots}>
                <span className={styles.dot} style={{background:'#FF5F57'}}/>
                <span className={styles.dot} style={{background:'#FFBD2E'}}/>
                <span className={styles.dot} style={{background:'#28C840'}}/>
              </div>
              <span className={styles.dashTitle}>AutoDM Dashboard</span>
            </div>

            {/* Automation row */}
            <div className={styles.autoRow}>
              <div className={styles.autoIcon}><Zap size={13} /></div>
              <div className={styles.autoInfo}>
                <span className={styles.autoName}>Reel — "Comment LINK"</span>
                <span className={styles.autoStat}>2,483 DMs sent today</span>
              </div>
              <div className={styles.autoBadge}>Live</div>
            </div>
            <div className={styles.autoRow}>
              <div className={styles.autoIcon} style={{background:'rgba(16,185,129,0.15)',color:'#10B981'}}><MessageCircle size={13} /></div>
              <div className={styles.autoInfo}>
                <span className={styles.autoName}>Post — "Type INFO"</span>
                <span className={styles.autoStat}>918 DMs sent today</span>
              </div>
              <div className={styles.autoBadge}>Live</div>
            </div>

            {/* Mini chart */}
            <div className={styles.chartRow}>
              <span className={styles.chartLabel}>DMs this week</span>
              <span className={styles.chartVal}>14,291</span>
              <span className={styles.chartUp}>↑ 23%</span>
            </div>
            <div className={styles.bars}>
              {[40, 65, 45, 80, 60, 90, 75].map((h, i) => (
                <div key={i} className={styles.bar} style={{ height: `${h}%`, opacity: i === 5 ? 1 : 0.45 + i * 0.07 }} />
              ))}
            </div>
          </div>

          {/* Floating DM notification */}
          <div className={styles.dmFloat}>
            <div className={styles.dmAvatar}>
              <Image src="/logo.png" alt="" width={14} height={14} />
            </div>
            <div className={styles.dmBody}>
              <div className={styles.dmTop}>
                <span className={styles.dmFrom}>autodm</span>
                <span className={styles.dmTime}>now</span>
              </div>
              <p className={styles.dmMsg}>Here&apos;s your link! 🔗 Thanks for commenting.</p>
            </div>
            <div className={styles.dmBadge}>1</div>
          </div>

          {/* Floating stat pill */}
          <div className={styles.statFloat}>
            <div className={styles.statFloatIcon}><Heart size={13} /></div>
            <div>
              <div className={styles.statFloatVal}>98.4%</div>
              <div className={styles.statFloatLbl}>Delivery rate</div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
