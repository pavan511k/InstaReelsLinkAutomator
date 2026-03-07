'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * ScrollReveal — wraps children and animates them on scroll into view.
 * Uses IntersectionObserver. No external dependencies.
 *
 * @param {string} animation - 'fadeUp' | 'fadeIn' | 'fadeLeft' | 'fadeRight'
 * @param {number} delay - delay in ms before animation starts
 * @param {number} threshold - 0-1, how much of the element must be visible
 */
export default function ScrollReveal({
    children,
    animation = 'fadeUp',
    delay = 0,
    threshold = 0.15,
    className = '',
}) {
    const ref = useRef(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.unobserve(entry.target);
                }
            },
            { threshold }
        );

        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
    }, [threshold]);

    const baseStyle = {
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'none' : getInitialTransform(animation),
        transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
        willChange: 'opacity, transform',
    };

    return (
        <div ref={ref} style={baseStyle} className={className}>
            {children}
        </div>
    );
}

function getInitialTransform(animation) {
    switch (animation) {
        case 'fadeUp': return 'translateY(32px)';
        case 'fadeIn': return 'none';
        case 'fadeLeft': return 'translateX(-32px)';
        case 'fadeRight': return 'translateX(32px)';
        default: return 'translateY(32px)';
    }
}
