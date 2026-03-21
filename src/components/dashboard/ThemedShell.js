'use client';

import darkStyles from '@/app/(dashboard)/layout.module.css';
import lightStyles from '@/app/(dashboard)/layout.light.module.css';
import { useStyles } from '@/lib/useStyles';

/**
 * ThemedShell — client wrapper for the server dashboard layout.
 *
 * Both darkStyles.shell and lightStyles.shell now use var(--page-bg),
 * so the background color responds instantly to data-theme via CSS —
 * no JS mount required, no flash. The useStyles hook still handles
 * other structural class differences if any are added in future.
 */
export default function ThemedShell({ children }) {
    const styles = useStyles(darkStyles, lightStyles);
    return <div className={styles.shell}>{children}</div>;
}
