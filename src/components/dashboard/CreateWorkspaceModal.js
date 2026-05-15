'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Layers, X, Crown } from 'lucide-react';

const MAX_NAME = 60;

export default function CreateWorkspaceModal({ open, onClose, canCreate, limit, count }) {
    const router = useRouter();
    const [name, setName] = useState('');
    const [busy, setBusy] = useState(false);
    // SSR-safe portal mount — only render to document.body after client mount.
    const [mounted, setMounted] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    useEffect(() => {
        if (open) { setName(''); setBusy(false); }
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, busy, onClose]);

    if (!open || !mounted) return null;

    const trimmed = name.trim();
    const disabled = busy || !trimmed || trimmed.length > MAX_NAME || !canCreate;

    const handleSubmit = async (e) => {
        e?.preventDefault();
        if (disabled) return;
        setBusy(true);
        try {
            const res = await fetch('/api/workspaces', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ name: trimmed }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json?.error || 'Failed to create workspace');
            toast.success(`Workspace "${json.workspace.name}" created`);
            onClose();
            router.refresh();
        } catch (err) {
            toast.error(err.message || 'Failed to create workspace');
        } finally {
            setBusy(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
                <div className="flex items-start justify-between gap-3 border-b border-neutral-200 px-5 py-4">
                    <div className="flex items-start gap-3">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-900 text-white">
                            <Layers className="h-4 w-4" strokeWidth={2.5} />
                        </span>
                        <div>
                            <h2 className="text-base font-bold text-neutral-900">Create workspace</h2>
                            <p className="mt-0.5 text-xs text-neutral-600">
                                A separate space for another Instagram or Facebook account.
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

                <form onSubmit={handleSubmit} className="px-5 py-4">
                    {!canCreate ? (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                            <div className="flex items-start gap-2.5">
                                <Crown className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" strokeWidth={2.5} />
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-amber-900">
                                        You&apos;re at the workspace limit ({count}/{limit}).
                                    </p>
                                    <p className="mt-1 text-xs text-amber-800">
                                        Upgrade your plan to create more workspaces. Each workspace can hold one connected account, its own automations, and its own leads.
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            <label htmlFor="ws-name" className="block text-xs font-semibold uppercase tracking-wider text-neutral-500">
                                Name
                            </label>
                            <input
                                id="ws-name"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                maxLength={MAX_NAME}
                                disabled={busy}
                                autoFocus
                                placeholder="e.g. Marketing, Personal, Client A"
                                className="mt-1.5 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 outline-none transition-colors focus:border-[#E63946] focus:ring-2 focus:ring-[#E63946]/15"
                            />
                            <p className="mt-1.5 text-[11px] text-neutral-500">
                                {trimmed.length}/{MAX_NAME} characters · {count}/{limit} workspaces used
                            </p>
                        </>
                    )}
                </form>

                <div className="flex items-center justify-end gap-2 border-t border-neutral-200 bg-neutral-50/60 px-5 py-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={busy}
                        className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    {canCreate && (
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={disabled}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            Create workspace
                        </button>
                    )}
                </div>
            </div>
        </div>,
        document.body,
    );
}
