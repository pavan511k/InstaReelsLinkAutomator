import { cookies } from 'next/headers';
import { THEME_COOKIE_NAME } from './theme-constants';

/**
 * Server-side: reads the user's theme preference from a cookie so the
 * very first SSR pass renders with the correct CSS modules and global
 * variables. Without this, the dual-CSS-module pattern (Foo.module.css
 * + Foo.light.module.css) causes a light→dark flash on every reload.
 *
 * Returns 'light' | 'dark' (defaults to 'light' when no cookie is set —
 * first-time visitors land on the bright SaaS palette; users who chose
 * dark previously keep dark via their saved cookie).
 */
export async function readThemeCookie() {
    const store = await cookies();
    const value = store.get(THEME_COOKIE_NAME)?.value;
    return value === 'dark' ? 'dark' : 'light';
}
