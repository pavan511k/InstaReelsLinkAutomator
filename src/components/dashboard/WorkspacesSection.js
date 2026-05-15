'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Layers, Plus, Pencil, Trash2, Lock, Loader2, Check, X, Crown } from 'lucide-react';
import CreateWorkspaceModal from './CreateWorkspaceModal';
import DeleteWorkspaceModal from './DeleteWorkspaceModal';

const MAX_NAME = 60;

export default function WorkspacesSection({
    workspaces = [],
    activeWorkspaceId,
    workspaceLimit = 1,
    canCreate = false,
    effectivePlan = 'free',
}) {
    const router = useRouter();
    const [showCreate, setShowCreate] = useState(false);
    const [deletingWs, setDeletingWs] = useState(null);
    const [renamingId, setRenamingId] = useState(null);
    const [renameValue, setRenameValue] = useState('');
    const [busyId, setBusyId] = useState(null);

    const startRename = (ws) => {
        setRenamingId(ws.id);
        setRenameValue(ws.name);
    };
    const cancelRename = () => {
        setRenamingId(null);
        setRenameValue('');
    };

    const submitRename = async (ws) => {
        const next = renameValue.trim();
        if (!next || next === ws.name) { cancelRename(); return; }
        if (next.length > MAX_NAME) {
            toast.error(`Name must be ${MAX_NAME} characters or fewer.`);
            return;
        }
        setBusyId(ws.id);
        try {
            const res = await fetch(`/api/workspaces/${ws.id}`, {
                method:  'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ name: next }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json?.error || 'Failed to rename workspace');
            toast.success('Workspace renamed');
            cancelRename();
            router.refresh();
        } catch (err) {
            toast.error(err.message || 'Failed to rename workspace');
        } finally {
            setBusyId(null);
        }
    };

    const atLimit = !canCreate;
    const isPaid  = effectivePlan === 'pro' || effectivePlan === 'business' || effectivePlan === 'trial';

    return (
        <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <header className="mb-5 flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h2 className="flex items-center gap-2 text-lg font-bold text-neutral-900">
                        <Layers className="h-4 w-4 text-neutral-500" strokeWidth={2.5} />
                        Workspaces
                    </h2>
                    <p className="mt-1 text-sm text-neutral-600">
                        Each workspace holds one connected account, its own automations, and its own leads. Use them to keep multiple Instagram or Facebook accounts separate.
                    </p>
                </div>
                <div className="flex-shrink-0 text-right">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-0.5 text-[11px] font-semibold text-neutral-700">
                        {workspaces.length} / {workspaceLimit} used
                    </span>
                </div>
            </header>

            <ul className="space-y-2">
                {workspaces.map((ws) => {
                    const isActive   = ws.id === activeWorkspaceId;
                    const isRenaming = renamingId === ws.id;
                    const busy       = busyId === ws.id;
                    return (
                        <li
                            key={ws.id}
                            className={[
                                'flex items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors',
                                isActive
                                    ? 'border-[#E63946]/30 bg-[#FFF1F2]/50'
                                    : 'border-neutral-200 bg-neutral-50/50',
                            ].join(' ')}
                        >
                            <span className={[
                                'inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg',
                                isActive ? 'bg-[#E63946] text-white' : 'bg-neutral-900 text-white',
                            ].join(' ')}>
                                <Layers className="h-4 w-4" strokeWidth={2.5} />
                            </span>

                            <div className="min-w-0 flex-1">
                                {isRenaming ? (
                                    <input
                                        type="text"
                                        value={renameValue}
                                        onChange={(e) => setRenameValue(e.target.value)}
                                        maxLength={MAX_NAME}
                                        autoFocus
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') submitRename(ws);
                                            if (e.key === 'Escape') cancelRename();
                                        }}
                                        className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm font-semibold text-neutral-900 outline-none focus:border-[#E63946] focus:ring-2 focus:ring-[#E63946]/15"
                                    />
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <span className="truncate text-sm font-semibold text-neutral-900">{ws.name}</span>
                                        {isActive && (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-[#E63946] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                                                Active
                                            </span>
                                        )}
                                        {ws.is_locked && (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-800">
                                                <Lock className="h-2.5 w-2.5" strokeWidth={3} />
                                                Locked
                                            </span>
                                        )}
                                    </div>
                                )}
                                <p className="mt-0.5 text-[11px] text-neutral-500">
                                    Created {new Date(ws.created_at).toLocaleDateString()}
                                </p>
                            </div>

                            {isRenaming ? (
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => submitRename(ws)}
                                        disabled={busy}
                                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50"
                                        title="Save"
                                    >
                                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" strokeWidth={2.5} />}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={cancelRename}
                                        disabled={busy}
                                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 transition-colors"
                                        title="Cancel"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => startRename(ws)}
                                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 hover:bg-white hover:text-neutral-900 transition-colors"
                                        title="Rename"
                                    >
                                        <Pencil className="h-3.5 w-3.5" strokeWidth={2.5} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setDeletingWs(ws)}
                                        disabled={workspaces.length === 1}
                                        title={workspaces.length === 1 ? 'You need at least one workspace' : 'Delete workspace'}
                                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-red-500 hover:bg-red-50 transition-colors disabled:cursor-not-allowed disabled:text-neutral-300 disabled:hover:bg-transparent"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" strokeWidth={2.5} />
                                    </button>
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>

            <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-dashed border-neutral-300 bg-neutral-50/40 px-4 py-3">
                <div className="min-w-0">
                    {atLimit ? (
                        <div className="flex items-start gap-2">
                            <Crown className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" strokeWidth={2.5} />
                            <p className="text-xs text-neutral-700">
                                {isPaid
                                    ? `You're at the ${workspaceLimit}-workspace limit for your plan.`
                                    : 'Free plan includes 1 workspace.'}
                                {' '}
                                <span className="font-semibold text-[#E63946]">Upgrade</span> to manage more accounts in parallel.
                            </p>
                        </div>
                    ) : (
                        <p className="text-xs text-neutral-600">
                            Create another workspace to manage a separate Instagram or Facebook account.
                        </p>
                    )}
                </div>
                <button
                    type="button"
                    onClick={() => setShowCreate(true)}
                    disabled={atLimit}
                    className={[
                        'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors flex-shrink-0',
                        atLimit
                            ? 'cursor-not-allowed border border-neutral-200 bg-white text-neutral-400'
                            : 'bg-neutral-900 text-white hover:bg-neutral-800',
                    ].join(' ')}
                >
                    <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                    New workspace
                </button>
            </div>

            <CreateWorkspaceModal
                open={showCreate}
                onClose={() => setShowCreate(false)}
                canCreate={canCreate}
                limit={workspaceLimit}
                count={workspaces.length}
            />
            <DeleteWorkspaceModal
                open={Boolean(deletingWs)}
                workspace={deletingWs}
                onClose={() => setDeletingWs(null)}
            />
        </section>
    );
}
