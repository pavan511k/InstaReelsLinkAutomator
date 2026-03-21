/**
 * Auth layout — forces color-scheme: light on all auth pages.
 *
 * next-themes sets style="color-scheme: dark" on <html> when dark theme
 * is active. Chrome uses this to apply its dark-mode autofill styling to
 * inputs (gray background, light text). Auth pages have hardcoded light
 * designs — the inputs must look light regardless of the global theme.
 *
 * Setting color-scheme: light on this wrapper overrides the html-level
 * color-scheme for all inputs inside, restoring normal (light) autofill.
 */
export default function AuthLayout({ children }) {
    return (
        <div style={{ colorScheme: 'light', minHeight: '100vh' }}>
            {children}
        </div>
    );
}
