import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import styles from './CtaBanner.module.css';

export default function CtaBanner() {
  return (
    <section className={styles.section} id="pricing">
      <div className={styles.inner}>
        <div className={styles.bgGlow} />
        <div className={styles.bgGrid} />

        <div className={styles.content}>
          <div className={styles.badge}>Free forever — no credit card</div>
          <h2 className={styles.title}>
            Start automating your Instagram DMs today
          </h2>
          <p className={styles.subtitle}>
            Your first 1,000 DMs every month are completely free. Upgrade when you&apos;re ready to scale.
          </p>

          <ul className={styles.perks}>
            {[
              '1,000 free DMs per month',
              'All features included on free plan',
              'Official Meta API — 100% account safe',
              'Set up in under 5 minutes',
            ].map((p) => (
              <li key={p} className={styles.perk}>
                <div className={styles.perkCheck}><Check size={11} strokeWidth={3} /></div>
                {p}
              </li>
            ))}
          </ul>

          <div className={styles.ctas}>
            <Link href="/signup" className={styles.primary}>
              Get started for free
              <ArrowRight size={15} strokeWidth={2.5} />
            </Link>
            <Link href="/login" className={styles.secondary}>
              Already have an account?
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
