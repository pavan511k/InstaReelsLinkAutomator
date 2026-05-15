import Link from 'next/link';
import { Lock } from 'lucide-react';

/**
 * Shown at the top of every dashboard page when the user's active
 * workspace is soft-locked. Locked workspaces are read-only — no new
 * automations, no activations — until the user upgrades or deletes
 * other workspaces.
 *
 * Server component (no client state needed). Rendered from the layout
 * only when activeWorkspace.is_locked is true.
 */
export default function LockedWorkspaceBanner({ workspaceName, workspaceLimit, plan }) {
    return (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                    <span className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                        <Lock className="h-4 w-4" strokeWidth={2.5} />
                    </span>
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-amber-900">
                            &quot;{workspaceName}&quot; is locked
                        </p>
                        <p className="mt-0.5 text-xs text-amber-800">
                            Your <span className="font-semibold capitalize">{plan}</span> plan covers {workspaceLimit} workspace{workspaceLimit === 1 ? '' : 's'}, so this one is read-only.
                            Automations here can&apos;t be activated until you upgrade — or delete another workspace to free up the slot.
                        </p>
                    </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                    <Link
                        href="/settings"
                        className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 transition-colors"
                    >
                        Manage workspaces
                    </Link>
                    <Link
                        href="/pricing"
                        className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 transition-colors"
                    >
                        Upgrade plan
                    </Link>
                </div>
            </div>
        </div>
    );
}
