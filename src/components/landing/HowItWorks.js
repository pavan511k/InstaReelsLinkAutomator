'use client';

import { UserPlus, Instagram, Zap } from 'lucide-react';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import styles from './HowItWorks.module.css';

const STEPS = [
    {
        step: '01',
        icon: UserPlus,
        title: 'Create Your Free Account',
        description: 'Sign up in seconds. No credit card needed. Connect your Instagram business or creator account via Meta.',
        banner: 'Quick & Easy',
    },
    {
        step: '02',
        icon: Instagram,
        title: 'Choose Your Posts & Set Triggers',
        description: 'Select which posts, reels, or stories to automate. Add keyword triggers like "LINK" or "INFO" — or reply to all comments.',
        banner: 'Full Control',
    },
    {
        step: '03',
        icon: Zap,
        title: 'AutoDM Handles the Rest',
        description: 'When someone comments with your trigger word, AutoDM instantly sends them a personalized DM with your link or message.',
        banner: 'Fully Automated',
    },
];

export default function HowItWorks() {
    const [headerRef, headerVisible] = useScrollReveal({ threshold: 0.2 });
    const [gridRef, gridVisible] = useScrollReveal({ threshold: 0.15 });

    return (
        <section id="how-it-works" className={styles.section}>
            <div className={`container ${styles.container}`}>
                <div
                    className={`${styles.header} ${headerVisible ? styles.revealIn : styles.revealHidden}`}
                    ref={headerRef}
                >
                    <span className={styles.label}>How It Works</span>
                    <h2 className={styles.title}>Set up in 3 simple steps</h2>
                    <p className={styles.subtitle}>
                        No coding needed. No complex setup. Just connect, configure, and go.
                    </p>
                </div>

                <div className={styles.stepsGrid} ref={gridRef}>
                    {STEPS.map((step, index) => (
                        <div
                            key={step.step}
                            className={`${styles.stepCard} ${gridVisible ? styles.revealSlideUp : styles.revealHidden}`}
                            style={{ transitionDelay: `${0.15 + index * 0.2}s` }}
                        >
                            <div className={styles.stepBanner}>{step.banner}</div>
                            <div className={styles.stepNumber}>{step.step}</div>
                            <div className={styles.stepIconWrapper}>
                                <step.icon size={24} />
                            </div>
                            <h3 className={styles.stepTitle}>{step.title}</h3>
                            <p className={styles.stepDesc}>{step.description}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
