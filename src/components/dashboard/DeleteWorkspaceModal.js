'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, AlertTriangle, X } from 'lucide-react';

/**
 * Delete-workspace confirmation modal.
 *
 * Cascade-deletes EVERYTHING under the workspace:
 *   - The connected Meta account (tokens cleared, no Meta-side disconnect)
 *   - All automations, posts, leads, contacts, DM logs, broadcasts
 *
 * Requires the user to type the workspace name to confirm. That gate is
 * deliberate — it's the irreversible kind of action where one stray click
 * can wipe months of setup.
 */
export default function DeleteWorkspaceModal({ open, workspace, onClose }) {
    const router = useRouter();
    const [confirm, setConfirm] = useState('');
    const [busy, setBusy] = useState(false);
    // SSR-safe portal mount — only render to document.body after client mount.
    const [mounted, setMounted] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    useEffect(() => {
        if (open) { setConfirm(''); setBusy(false); }
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, busy, onClose]);

    if (!open || !workspace || !mounted) return null;

    const matches = confirm.trim() === workspace.name;
    const disabled = busy || !matches;

    const handleDelete = async () => {
        if (disabled) return;
        setBusy(true);
        try {
            const res = await fetch(`/api/workspaces/${workspace.id}`, { method: 'DELETE' });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json?.error || 'Failed to delete workspace');
            toast.success(`Workspace "${workspace.name}" deleted`);
            onClose();
            router.refresh();
        } catch (err) {
            toast.error(err.message || 'Failed to delete workspace');
        } finally {
            setBusy(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
                <div className="flex items-start justify-between gap-3 border-b border-neutral-200 px-5 py-4">
                    <div className="flex items-start gap-3">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-600">
                            <AlertTriangle className="h-4 w-4" strokeWidth={2.5} />
                        </span>
                        <div>
                            <h2 className="text-base font-bold text-neutral-900">Delete workspace</h2>
                            <p className="mt-0.5 text-xs text-neutral-600">
                                This action is permanent. There is no undo.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={busy}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition-colors"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="space-y-3 px-5 py-4">
                    <p className="text-sm text-neutral-700">
                        Deleting <strong className="font-semibold text-neutral-900">{workspace.name}</strong> will permanently remove:
                    </p>
                    <ul className="space-y-1 pl-5 text-sm text-neutral-700 marker:text-neutral-400 list-disc">
                        <li>The connected Instagram / Facebook account (tokens cleared on our side)</li>
                        <li>Every automation in this workspace</li>
                        <li>All synced posts, stories, and recipient history</li>
                        <li>DM logs, leads, contacts, and broadcasts</li>
                    </ul>
                    <p className="text-xs text-neutral-500">
                        Type <code className="rounded bg-neutral-100 px-1 py-0.5 font-mono text-neutral-800">{workspace.name}</code> to confirm.
                    </p>
                    <input
                        type="text"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        disabled={busy}
                        autoFocus
                        placeholder={workspace.name}
                        className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 outline-none transition-colors focus:border-red-500 focus:ring-2 focus:ring-red-500/15"
                    />
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-neutral-200 bg-neutral-50/60 px-5 py-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={busy}
                        className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleDelete}
                        disabled={disabled}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        Delete workspace
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}
