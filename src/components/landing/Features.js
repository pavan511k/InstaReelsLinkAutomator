import { Film, MessageCircle, Reply, AtSign, Zap, BarChart3 } from 'lucide-react';
import ScrollReveal from './ScrollReveal';
import styles from './Features.module.css';

const FEATURES = [
  {
    icon:  Film,
    title: 'Reel comment automation',
    desc:  'Automatically DM anyone who comments on your Reels. Use keyword triggers or reply to every comment — and watch your conversions climb.',
    size:  'large',
    color: '#7C3AED',
    bg:    'rgba(124,58,237,0.08)',
  },
  {
    icon:  MessageCircle,
    title: 'Post comment DMs',
    desc:  'Turn post engagement into 1-on-1 conversations at scale.',
    size:  'small',
    color: '#3B82F6',
    bg:    'rgba(59,130,246,0.08)',
  },
  {
    icon:  Reply,
    title: 'Story reply automation',
    desc:  'DM everyone who replies to your stories instantly.',
    size:  'small',
    color: '#10B981',
    bg:    'rgba(16,185,129,0.08)',
  },
  {
    icon:  AtSign,
    title: 'Story mention outreach',
    desc:  'When someone mentions you, reach out automatically and build the relationship.',
    size:  'small',
    color: '#F59E0B',
    bg:    'rgba(245,158,11,0.08)',
  },
  {
    icon:  Zap,
    title: 'Keyword triggers',
    desc:  'Set specific trigger words. Only matching comments fire a DM — keeping your automation laser-targeted.',
    size:  'small',
    color: '#EC4899',
    bg:    'rgba(236,72,153,0.08)',
  },
  {
    icon:  BarChart3,
    title: 'Live dashboard & analytics',
    desc:  'Track DM delivery, open rates, link clicks, and more in a real-time dashboard built for creators.',
    size:  'large',
    color: '#A78BFA',
    bg:    'rgba(167,139,250,0.08)',
  },
];

export default function Features() {
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

        {/* Bento grid — ScrollReveal receives the span class so grid layout is preserved */}
        <div className={styles.bento}>
          {FEATURES.map(({ icon: Icon, title, desc, size, color, bg }, i) => (
            <ScrollReveal
              key={title}
              animation="fadeUp"
              delay={i * 70}
              className={size === 'large' ? styles.large : styles.small}
            >
              <div className={styles.card}>
                <div className={styles.iconWrap} style={{ background: bg, color }}>
                  <Icon size={20} strokeWidth={2} />
                </div>
                <h3 className={styles.cardTitle}>{title}</h3>
                <p className={styles.cardDesc}>{desc}</p>
                <div
                  className={styles.glow}
                  style={{ background: `radial-gradient(circle at 20% 80%, ${color}18, transparent 60%)` }}
                />
              </div>
            </ScrollReveal>
          ))}
        </div>

      </div>
    </section>
  );
}
