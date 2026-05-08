// Shared constants for the theme cookie. Kept in its own file so both
// server modules (which call cookies() from next/headers) and client
// modules (which write document.cookie) can import the name without
// pulling server-only code into the client bundle.

export const THEME_COOKIE_NAME = 'autodm-theme';
