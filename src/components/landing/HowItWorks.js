import ScrollReveal from './ScrollReveal';
import styles from './HowItWorks.module.css';

const STEPS = [
    {
        number: '01',
        title: 'Connect Your Account',
        description: 'Link your Instagram Business or Creator account in one click through the official Meta API.',
        color: '#2563EB',
    },
    {
        number: '02',
        title: 'Set Your Trigger',
        description: 'Choose which posts, reels, or stories should trigger an auto-DM. Add keyword filters or reply to all.',
        color: '#8B5CF6',
    },
    {
        number: '03',
        title: 'Write Your Message',
        description: 'Craft the perfect DM with your link, offer, or resource. Customize it however you like.',
        color: '#10B981',
    },
    {
        number: '04',
        title: 'Sit Back & Automate',
        description: 'Every qualifying comment automatically triggers a DM. Track results in your dashboard.',
        color: '#F59E0B',
    },
];

export default function HowItWorks() {
    return (
        <section className={styles.section}>
            <div className="container">
                <ScrollReveal animation="fadeUp">
                    <div className={styles.header}>
                        <span className={styles.label}>See How It Works</span>
                        <h2 className={styles.title}>Up and Running in Minutes</h2>
                        <p className={styles.subtitle}>
                            Four simple steps to turn every comment into a conversation
                        </p>
                    </div>
                </ScrollReveal>

                <div className={styles.stepsGrid}>
                    {STEPS.map((step, index) => (
                        <ScrollReveal key={step.number} animation="fadeUp" delay={index * 100}>
                            <div className={styles.stepCard}>
                                <div className={styles.stepNumber} style={{ color: step.color }}>
                                    {step.number}
                                </div>
                                <h3 className={styles.stepTitle}>{step.title}</h3>
                                <p className={styles.stepDesc}>{step.description}</p>
                            </div>
                        </ScrollReveal>
                    ))}
                </div>

                {/* Connecting line between steps (desktop only) */}
                <div className={styles.connector}>
                    <div className={styles.connectorLine} />
                </div>
            </div>
        </section>
    );
}
