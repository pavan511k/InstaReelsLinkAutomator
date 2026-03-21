'use client';
import { useTheme } from 'next-themes';
import { useState, useEffect } from 'react';

/**
 * Returns the correct CSS module styles object based on the current theme.
 *
 * The mounted guard ensures server and initial client render both use
 * darkStyles — React hydrates cleanly. After mount, the correct theme
 * styles are applied. This eliminates hydration mismatches at the cost
 * of a single-frame theme switch on first load (unavoidable with this
 * dual-CSS-module approach).
 */
export function useStyles(darkStyles, lightStyles) {
    const { resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return darkStyles;
    return resolvedTheme === 'light' ? lightStyles : darkStyles;
}

/**
 * Returns whether the current theme is dark.
 * Guarded by mounted state — before mount always returns true (dark)
 * so the server render (which defaults to dark) matches the initial
 * client render, preventing hydration mismatches in UI elements like
 * the Sun/Moon icon toggle.
 */
export function useIsDark() {
    const { resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return true; // server default is dark
    return resolvedTheme !== 'light';
}
