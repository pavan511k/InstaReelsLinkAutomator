/**
 * Generic dashboard page skeleton shown while a route's server data is loading.
 *
 * Rendered by the `loading.js` files in each (dashboard)/* route. The dashboard
 * layout (sidebar, trial banner, theme shell) stays mounted across navigations,
 * so this component only fills the main content area.
 *
 * Uses neutral semi-transparent fills that work in both themes without needing
 * paired CSS modules — the skeleton flashes away within a few hundred ms anyway.
 */
export default function PageSkeleton() {
    const block = {
        backgroundColor: 'rgba(127, 127, 127, 0.12)',
        borderRadius: 12,
    };

    return (
        <div
            aria-busy="true"
            aria-live="polite"
            style={{
                display:        'flex',
                flexDirection:  'column',
                gap:            24,
                padding:        '24px 32px',
                width:          '100%',
            }}
        >
            {/* Page title bar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ ...block, height: 32, width: '40%', maxWidth: 320 }} />
                <div style={{ ...block, height: 16, width: '60%', maxWidth: 480 }} />
            </div>

            {/* Stat cards row */}
            <div
                style={{
                    display:             'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap:                 16,
                }}
            >
                {[0, 1, 2, 3].map((i) => (
                    <div key={i} style={{ ...block, height: 96 }} />
                ))}
            </div>

            {/* Main content panel */}
            <div style={{ ...block, height: 360 }} />

            <style>{`
                [aria-busy="true"] > * {
                    animation: page-skeleton-pulse 1.4s ease-in-out infinite;
                }
                @keyframes page-skeleton-pulse {
                    0%, 100% { opacity: 1;   }
                    50%      { opacity: 0.55; }
                }
                @media (prefers-reduced-motion: reduce) {
                    [aria-busy="true"] > * { animation: none; }
                }
            `}</style>
        </div>
    );
}
