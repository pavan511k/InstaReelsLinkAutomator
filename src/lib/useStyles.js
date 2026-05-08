'use client';
import { useTheme } from 'next-themes';
import { useState, useEffect } from 'react';
import { useInitialTheme } from '@/components/ThemeProviderClient';

/**
 * Returns the correct CSS module styles object based on the current theme.
 *
 * Pre-mount (SSR + first client render) we use the cookie-derived initial
 * theme provided by ThemeProviderClient, so the markup React produces on
 * the server already matches the user's preference — no dark→light flash.
 *
 * Post-mount we switch to next-themes' resolvedTheme so live theme toggles
 * still work without a reload.
 */
export function useStyles(darkStyles, lightStyles) {
    const initialTheme = useInitialTheme();
    const { resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    const theme = mounted ? resolvedTheme : initialTheme;
    return theme === 'light' ? lightStyles : darkStyles;
}

/**
 * Returns whether the current theme is dark. Same SSR-aware strategy as
 * useStyles — reads cookie value pre-mount, next-themes value post-mount.
 */
export function useIsDark() {
    const initialTheme = useInitialTheme();
    const { resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    const theme = mounted ? resolvedTheme : initialTheme;
    return theme !== 'light';
}
