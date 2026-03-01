'use client';

import { useEffect, useRef, useState } from 'react';
import { Users, Send, MousePointerClick, MessageCircle } from 'lucide-react';
import styles from './StatsBar.module.css';

const STATS = [
    { icon: Users, value: 46000, suffix: '+', label: 'Happy AutoDM Users', color: '#F59E0B' },
    { icon: Send, value: 300, suffix: ' Million', label: 'Instagram DMs Sent', color: '#2563EB' },
    { icon: MousePointerClick, value: 30, suffix: ' Million', label: 'Link Clicks Monthly', color: '#10B981' },
    { icon: MessageCircle, value: 20, suffix: ' Million', label: 'Comments Sent Monthly', color: '#8B5CF6' },
];

function AnimatedCounter({ target, suffix }) {
    const [count, setCount] = useState(0);
    const ref = useRef(null);
    const hasAnimated = useRef(false);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && !hasAnimated.current) {
                    hasAnimated.current = true;
                    const duration = 2000;
                    const steps = 60;
                    const increment = target / steps;
                    let current = 0;
                    const timer = setInterval(() => {
                        current += increment;
                        if (current >= target) {
                            setCount(target);
                            clearInterval(timer);
                        } else {
                            setCount(Math.floor(current));
                        }
                    }, duration / steps);
                }
            },
            { threshold: 0.3 }
        );

        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
    }, [target]);

    return (
        <span ref={ref}>
            {count.toLocaleString()}{suffix}
        </span>
    );
}

export default function StatsBar() {
    return (
        <section className={styles.stats}>
            <div className={`container ${styles.statsGrid}`}>
                {STATS.map((stat) => (
                    <div key={stat.label} className={styles.statItem}>
                        <stat.icon size={28} color={stat.color} />
                        <div className={styles.statValue}>
                            <AnimatedCounter target={stat.value} suffix={stat.suffix} />
                        </div>
                        <div className={styles.statLabel}>{stat.label}</div>
                    </div>
                ))}
            </div>
        </section>
    );
}
