'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, ChevronDown, Layers, Lock, Plus, Loader2 } from 'lucide-react';
import CreateWorkspaceModal from './CreateWorkspaceModal';

/**
 * Top-of-sidebar workspace pill + dropdown.
 *
 * Renders the active workspace name, opens a popover listing every
 * workspace the user owns, and exposes "Create workspace" with a
 * plan-gated CTA. Switching writes the cookie via /api/workspaces/switch
 * and hard-refreshes so every RSC re-scopes its queries to the new ws.
 */
export default function WorkspaceSwitcher({
    activeWorkspace,
    workspaces = [],
    canCreateWorkspace = false,
    workspaceLimit = 1,
    workspaceCount = 0,
    collapsed = false,
}) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [switching, setSwitching] = useState(null);  // id of ws being switched to
    const [showCreate, setShowCreate] = useState(false);
    const wrapRef = useRef(null);

    useEffect(() => {
        if (!open) return;
        const onClick = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', onClick);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onClick);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    const handleSwitch = async (workspaceId) => {
        if (workspaceId === activeWorkspace?.id) {
            setOpen(false);
            return;
        }
        setSwitching(workspaceId);
        try {
            const res = await fetch('/api/workspaces/switch', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ workspaceId }),
            });
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(json?.error || 'Failed to switch workspace');
            }
            setOpen(false);
            router.refresh();
        } catch (err) {
            toast.error(err.message || 'Failed to switch workspace');
        } finally {
            setSwitching(null);
        }
    };

    // Collapsed state: render just an icon button that opens the picker.
    if (collapsed) {
        return (
            <div ref={wrapRef} className="relative">
                <button
                    type="button"
                    onClick={() => setOpen((v) => !v)}
                    title={activeWorkspace?.name || 'Workspace'}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50 transition-colors"
                >
                    <Layers className="h-4 w-4" strokeWidth={2} />
                </button>
                {open && (
                    <DropdownPanel
                        workspaces={workspaces}
                        activeId={activeWorkspace?.id}
                        switchingId={switching}
                        canCreate={canCreateWorkspace}
                        limit={workspaceLimit}
                        count={workspaceCount}
                        onSwitch={handleSwitch}
                        onCreate={() => { setOpen(false); setShowCreate(true); }}
                        anchor="left"
                    />
                )}
                <CreateWorkspaceModal
                    open={showCreate}
                    onClose={() => setShowCreate(false)}
                    canCreate={canCreateWorkspace}
                    limit={workspaceLimit}
                    count={workspaceCount}
                />
            </div>
        );
    }

    return (
        <div ref={wrapRef} className="relative">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="group flex w-full items-center gap-2.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-left hover:border-neutral-300 hover:bg-neutral-50 transition-colors"
            >
                <span className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-neutral-900 text-white">
                    <Layers className="h-3.5 w-3.5" strokeWidth={2.5} />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                        Workspace
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="block truncate text-sm font-semibold text-neutral-900">
                            {activeWorkspace?.name || 'Default'}
                        </span>
                        {activeWorkspace?.is_locked && (
                            <Lock className="h-3 w-3 flex-shrink-0 text-amber-500" strokeWidth={2.5} />
                        )}
                    </span>
                </span>
                <ChevronDown className={`h-3.5 w-3.5 flex-shrink-0 text-neutral-400 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <DropdownPanel
                    workspaces={workspaces}
                    activeId={activeWorkspace?.id}
                    switchingId={switching}
                    canCreate={canCreateWorkspace}
                    limit={workspaceLimit}
                    count={workspaceCount}
                    onSwitch={handleSwitch}
                    onCreate={() => { setOpen(false); setShowCreate(true); }}
                />
            )}

            <CreateWorkspaceModal
                open={showCreate}
                onClose={() => setShowCreate(false)}
                canCreate={canCreateWorkspace}
                limit={workspaceLimit}
                count={workspaceCount}
            />
        </div>
    );
}

function DropdownPanel({ workspaces, activeId, switchingId, canCreate, limit, count, onSwitch, onCreate, anchor = 'full' }) {
    const positionClass = anchor === 'left'
        ? 'left-0 top-full mt-2 w-64'
        : 'left-0 right-0 top-full mt-2';
    return (
        <div className={`absolute z-50 ${positionClass} rounded-xl border border-neutral-200 bg-white shadow-lg overflow-hidden`}>
            <div className="max-h-72 overflow-y-auto py-1">
                {workspaces.map((ws) => {
                    const active   = ws.id === activeId;
                    const busy     = ws.id === switchingId;
                    return (
                        <button
                            key={ws.id}
                            type="button"
                            disabled={busy}
                            onClick={() => onSwitch(ws.id)}
                            className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${
                                active
                                    ? 'bg-[#E63946]/10 text-[#E63946]'
                                    : 'text-neutral-700 hover:bg-neutral-50'
                            }`}
                        >
                            <Layers className={`h-3.5 w-3.5 flex-shrink-0 ${active ? 'text-[#E63946]' : 'text-neutral-400'}`} strokeWidth={2.5} />
                            <span className="min-w-0 flex-1 truncate font-medium">{ws.name}</span>
                            {ws.is_locked && <Lock className="h-3 w-3 flex-shrink-0 text-amber-500" strokeWidth={2.5} />}
                            {busy
                                ? <Loader2 className="h-3.5 w-3.5 flex-shrink-0 animate-spin text-neutral-400" />
                                : active && <Check className="h-3.5 w-3.5 flex-shrink-0 text-[#E63946]" strokeWidth={2.5} />}
                        </button>
                    );
                })}
            </div>
            <div className="border-t border-neutral-200 bg-neutral-50/60 p-2">
                <button
                    type="button"
                    onClick={onCreate}
                    disabled={!canCreate}
                    title={canCreate ? 'Create a new workspace' : `Limit reached (${count}/${limit}). Upgrade for more.`}
                    className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                        canCreate
                            ? 'text-[#E63946] hover:bg-white'
                            : 'cursor-not-allowed text-neutral-400'
                    }`}
                >
                    <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                    Create workspace
                    <span className="ml-auto text-[10px] font-medium uppercase tracking-wider text-neutral-400">
                        {count}/{limit}
                    </span>
                </button>
            </div>
        </div>
    );
}
