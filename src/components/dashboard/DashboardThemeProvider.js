'use client';

import { ThemeProvider } from 'next-themes';

/**
 * DashboardThemeProvider — scopes next-themes to dashboard pages only.
 *
 * This intentionally does NOT live in the root layout. Auth pages
 * (login, signup, etc.) have hardcoded dark designs that must not be
 * affected by Shadcn token overrides triggered by [data-theme="dark"].
 *
 * attribute="data-theme" means <html> gets data-theme="dark" / "light",
 * NOT class="dark", so Chrome's dark-autofill heuristic never fires on
 * auth page inputs.
 */
export default function DashboardThemeProvider({ children }) {
    return (
        <ThemeProvider attribute="data-theme" defaultTheme="dark" enableSystem={false}>
            {children}
        </ThemeProvider>
    );
}
