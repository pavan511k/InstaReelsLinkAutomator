'use client';

import { useEffect, useRef, useState } from 'react';
import { Users, Send, MousePointerClick, MessageCircle } from 'lucide-react';
import ScrollReveal from './ScrollReveal';
import styles from './Stats.module.css';

const STATS = [
  { icon: Users,            value: 46000,  suffix: '+',        label: 'Creators using AutoDM',    color: '#F59E0B', bg: 'rgba(245,158,11,0.1)'  },
  { icon: Send,             value: 300,    suffix: 'M+',       label: 'Instagram DMs sent',       color: '#7C3AED', bg: 'rgba(124,58,237,0.1)' },
  { icon: MousePointerClick,value: 30,     suffix: 'M+',       label: 'Link clicks monthly',      color: '#10B981', bg: 'rgba(16,185,129,0.1)'  },
  { icon: MessageCircle,    value: 20,     suffix: 'M+',       label: 'Comments handled monthly', color: '#3B82F6', bg: 'rgba(59,130,246,0.1)'  },
];

function Counter({ target, suffix }) {
  const [val, setVal] = useState(0);
  const ref = useRef(null);
  const fired = useRef(false);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !fired.current) {
        fired.current = true;
        const steps = 60, dur = 1800;
        const inc = target / steps;
        let cur = 0;
        const t = setInterval(() => {
          cur += inc;
          if (cur >= target) { setVal(target); clearInterval(t); }
          else setVal(Math.floor(cur));
        }, dur / steps);
      }
    }, { threshold: 0.4 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [target]);

  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
}

export default function Stats() {
  return (
    <section className={styles.section}>
      <div className={styles.inner}>
        {STATS.map(({ icon: Icon, value, suffix, label, color, bg }, i) => (
          <ScrollReveal key={label} animation="fadeUp" delay={i * 80}>
          <div className={styles.card}>
            <div className={styles.iconWrap} style={{ background: bg, color }}>
              <Icon size={20} strokeWidth={2} />
            </div>
            <div className={styles.value}>
              <Counter target={value} suffix={suffix} />
            </div>
            <div className={styles.label}>{label}</div>
          </div>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}
