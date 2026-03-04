'use client';

import { useScrollReveal } from '@/hooks/useScrollReveal';
import styles from './FeatureCard.module.css';

export default function FeatureCard({ title, description, icon, reverse }) {
    const [ref, isVisible] = useScrollReveal({ threshold: 0.15 });

    const animClass = isVisible
        ? (reverse ? styles.revealSlideRight : styles.revealSlideLeft)
        : styles.revealHidden;

    return (
        <div
            ref={ref}
            className={`${styles.feature} ${reverse ? styles.reverse : ''} ${animClass}`}
        >
            <div className={styles.featureText}>
                <h3 className={styles.featureTitle}>{title}</h3>
                <p className={styles.featureDesc}>{description}</p>
            </div>
            <div className={styles.featureVisual}>
                <div className={styles.iconCard}>
                    <div className={styles.iconGlow} />
                    <div className={styles.iconContainer}>
                        {icon}
                    </div>
                </div>
            </div>
        </div>
    );
}
