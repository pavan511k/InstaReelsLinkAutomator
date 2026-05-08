'use client';

import { ThemeProvider, useTheme } from 'next-themes';
import { createContext, useContext, useEffect } from 'react';
import { THEME_COOKIE_NAME } from '@/lib/theme-constants';
import { ConfirmProvider } from '@/components/ui/ConfirmDialog';

/**
 * Initial theme as read by the server from the cookie. Components that
 * pick CSS modules per theme (useStyles) read from this context so they
 * render the correct module on the very first paint — preventing the
 * dark→light flash that occurred when next-themes' localStorage value
 * was only available post-hydration.
 */
const InitialThemeContext = createContext('light');

export function useInitialTheme() {
    return useContext(InitialThemeContext);
}

/**
 * Mirrors next-themes' active theme into a cookie so the server can
 * read it on the next request. Without this, only localStorage knows
 * the user's preference and SSR has no way to render the right theme.
 */
function CookieSyncer() {
    const { resolvedTheme } = useTheme();
    useEffect(() => {
        if (!resolvedTheme) return;
        document.cookie = `${THEME_COOKIE_NAME}=${resolvedTheme}; path=/; max-age=31536000; samesite=lax`;
    }, [resolvedTheme]);
    return null;
}

export default function ThemeProviderClient({ children, initialTheme }) {
    return (
        <InitialThemeContext.Provider value={initialTheme}>
            <ThemeProvider
                attribute="data-theme"
                defaultTheme={initialTheme}
                enableSystem={false}
            >
                <CookieSyncer />
                <ConfirmProvider>
                    {children}
                </ConfirmProvider>
            </ThemeProvider>
        </InitialThemeContext.Provider>
    );
}
