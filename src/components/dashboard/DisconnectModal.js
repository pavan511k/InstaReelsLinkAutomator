'use client';

import { AlertTriangle, LogOut, Loader2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';

/**
 * DisconnectModal — destructive confirmation dialog.
 *
 * Click-outside is disabled so users can't lose work by misclicking.
 * The X close button + Cancel are the only ways out (Esc is also off
 * via the Modal primitive when closable=false during in-progress).
 */
export default function DisconnectModal({ isOpen, onClose, onConfirm, isDisconnecting }) {
  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="md"
      closable={!isDisconnecting}
      closeOnBackdrop={false}
      showCloseButton={false}
      ariaLabel="Disconnect account"
    >
      <div className="px-2 pt-4 pb-2">
        <div className="flex justify-center">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <AlertTriangle className="h-7 w-7" strokeWidth={2} />
          </span>
        </div>
        <h3 className="mt-5 text-left text-xl font-bold text-neutral-900">
          Disconnect this account?
        </h3>
        <p className="mt-2 text-left text-sm leading-relaxed text-neutral-600">
          Per <strong className="text-neutral-900">Meta policy</strong>, disconnecting permanently deletes all Platform Data fetched from Instagram/Facebook:
        </p>
        <ul className="mt-4 list-disc space-y-1.5 pl-6 text-sm text-neutral-700">
          <li>All synced posts, reels, and stories</li>
          <li>Profile info, usernames, and media data</li>
          <li>Stored access tokens</li>
        </ul>

        <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50/60 p-3">
          <p className="text-xs leading-relaxed text-neutral-700">
            Your <strong className="text-neutral-900">DM automation configurations</strong> will be preserved (paused) and can be reactivated if you reconnect later.
          </p>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isDisconnecting}
            className="inline-flex items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-200 hover:border-neutral-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 disabled:opacity-60 transition-all duration-150"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDisconnecting}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-black hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 transition-all duration-150"
          >
            {isDisconnecting
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <LogOut className="h-3.5 w-3.5" strokeWidth={2.5} />}
            {isDisconnecting ? 'Disconnecting…' : 'Yes, disconnect'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
