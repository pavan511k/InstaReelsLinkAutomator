import styles from './FeatureCard.module.css';

export default function FeatureCard({ title, description, icon, reverse }) {
    return (
        <div className={`${styles.feature} ${reverse ? styles.reverse : ''}`}>
            <div className={styles.featureText}>
                <h3 className={styles.featureTitle}>{title}</h3>
                <p className={styles.featureDesc}>{description}</p>
            </div>
            <div className={styles.featureVisual}>
                <div className={styles.phoneWrapper}>
                    <div className={styles.phoneMockup}>
                        <div className={styles.phoneNotch}></div>
                        <div className={styles.phoneContent}>
                            <div className={styles.iconBox}>{icon}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
