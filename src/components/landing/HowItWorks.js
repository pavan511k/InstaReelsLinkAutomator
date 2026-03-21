import ScrollReveal from './ScrollReveal';
import styles from './HowItWorks.module.css';

const STEPS = [
  {
    num: '01',
    title: 'Connect your account',
    desc: 'Link your Instagram Business or Creator account in one click via the official Meta API. No passwords shared.',
    color: '#7C3AED',
    tag: 'Takes 30 seconds',
  },
  {
    num: '02',
    title: 'Choose your trigger',
    desc: 'Select which posts, reels, or stories should fire a DM. Set keyword filters or reply to every single comment.',
    color: '#3B82F6',
    tag: 'Full control',
  },
  {
    num: '03',
    title: "Write your message",
    desc: "Craft your DM with links, offers, or personalised copy. Use dynamic fields like the commenter's first name.",
    color: '#10B981',
    tag: 'Personalised',
  },
  {
    num: '04',
    title: 'Go live & scale',
    desc: 'Activate your automation. Every qualifying comment triggers an instant DM. Monitor live in your dashboard.',
    color: '#F59E0B',
    tag: 'Fully automated',
  },
];

export default function HowItWorks() {
  return (
    <section className={styles.section} id="how-it-works">
      <div className={styles.inner}>

        <ScrollReveal animation="fadeUp">
          <div className={styles.header}>
            <span className={styles.eyebrow}>How it works</span>
            <h2 className={styles.title}>Up and running in minutes</h2>
            <p className={styles.subtitle}>
              Four steps is all it takes to turn Instagram comments into automated, personalised DM conversations.
            </p>
          </div>
        </ScrollReveal>

        <div className={styles.grid}>
          {STEPS.map((step, i) => (
            <ScrollReveal key={step.num} animation="fadeUp" delay={i * 90}>
              <div className={styles.card}>
                <div className={styles.cardTop}>
                  <span className={styles.num} style={{ color: step.color }}>
                    {step.num}
                  </span>
                  <span
                    className={styles.tag}
                    style={{
                      color: step.color,
                      background: `${step.color}15`,
                      borderColor: `${step.color}30`,
                    }}
                  >
                    {step.tag}
                  </span>
                </div>
                <h3 className={styles.cardTitle}>{step.title}</h3>
                <p className={styles.cardDesc}>{step.desc}</p>
                {i < STEPS.length - 1 && (
                  <div
                    className={styles.connector}
                    style={{
                      background: `linear-gradient(90deg, ${step.color}40, ${STEPS[i + 1].color}40)`,
                    }}
                  />
                )}
              </div>
            </ScrollReveal>
          ))}
        </div>

      </div>
    </section>
  );
}
