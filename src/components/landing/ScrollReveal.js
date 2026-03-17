'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * ScrollReveal — animates children into view on scroll.
 * Uses IntersectionObserver + inline CSS transitions.
 * No external dependencies.
 *
 * @param {'fadeUp'|'fadeDown'|'fadeLeft'|'fadeRight'|'fadeIn'|'scaleUp'} animation
 * @param {number} delay  - extra delay in ms (stagger children by passing index * 80)
 * @param {number} threshold - 0–1, fraction visible before triggering
 * @param {number} duration  - transition duration in ms
 */
export default function ScrollReveal({
  children,
  animation = 'fadeUp',
  delay     = 0,
  threshold = 0.12,
  duration  = 560,
  className = '',
}) {
  const ref     = useRef(null);
  const [vis, setVis] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVis(true);
          obs.unobserve(el);
        }
      },
      { threshold }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  const transforms = {
    fadeUp:    'translateY(28px)',
    fadeDown:  'translateY(-28px)',
    fadeLeft:  'translateX(28px)',
    fadeRight: 'translateX(-28px)',
    fadeIn:    'none',
    scaleUp:   'scale(0.95)',
  };

  const style = {
    opacity:    vis ? 1 : 0,
    transform:  vis ? 'none' : (transforms[animation] ?? 'translateY(28px)'),
    transition: `opacity ${duration}ms cubic-bezier(0.22,1,0.36,1) ${delay}ms,
                 transform ${duration}ms cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
    willChange: 'opacity, transform',
  };

  return (
    <div ref={ref} style={style} className={className}>
      {children}
    </div>
  );
}
