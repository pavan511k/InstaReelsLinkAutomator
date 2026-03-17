import styles from './Testimonials.module.css';
import { Star } from 'lucide-react';
import ScrollReveal from './ScrollReveal';

const TESTIMONIALS = [
  {
    quote: "I was manually DMing everyone who commented 'LINK' on my Reels. AutoDM took that from 3 hours a day to zero. My conversion rate actually went up because replies are instant now.",
    name: 'Sarah K.',
    role: 'Fitness creator · 280K followers',
    stars: 5,
    avatar: 'SK',
    color: '#7C3AED',
  },
  {
    quote: "Set it up in literally 4 minutes. Now every comment on my product posts auto-sends the checkout link. It's the best ROI tool I've added to my business this year.",
    name: 'James T.',
    role: 'E-commerce brand · 95K followers',
    stars: 5,
    avatar: 'JT',
    color: '#3B82F6',
  },
  {
    quote: "My team was spending hours on comment replies. AutoDM handles all of it while we sleep. The dashboard analytics help us see exactly which content drives the most DM conversations.",
    name: 'Priya M.',
    role: 'Digital marketer · 180K followers',
    stars: 5,
    avatar: 'PM',
    color: '#10B981',
  },
];

export default function Testimonials() {
  return (
    <section className={styles.section}>
      <div className={styles.inner}>

        <div className={styles.header}>
          <span className={styles.eyebrow}>Testimonials</span>
          <h2 className={styles.title}>Creators love AutoDM</h2>
          <p className={styles.subtitle}>
            Join 46,000+ creators who&apos;ve replaced manual DMs with AutoDM.
          </p>
        </div>

        <div className={styles.grid}>
          {TESTIMONIALS.map(({ quote, name, role, stars, avatar, color }, i) => (
            <ScrollReveal key={name} animation="fadeUp" delay={i * 100}>
            <div className={styles.card}>
              <div className={styles.stars}>
                {Array.from({ length: stars }).map((_, i) => (
                  <Star key={i} size={14} fill="#F59E0B" color="#F59E0B" />
                ))}
              </div>
              <p className={styles.quote}>&ldquo;{quote}&rdquo;</p>
              <div className={styles.author}>
                <div className={styles.avatar} style={{ background: `${color}22`, color, borderColor: `${color}33` }}>
                  {avatar}
                </div>
                <div>
                  <div className={styles.name}>{name}</div>
                  <div className={styles.role}>{role}</div>
                </div>
              </div>
            </div>
            </ScrollReveal>
          ))}
        </div>

      </div>
    </section>
  );
}
