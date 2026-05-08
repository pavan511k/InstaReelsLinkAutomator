'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import styles from './Modal.module.css';

/**
 * Shared modal primitive.
 *
 * Handles every cross-cutting concern the older modal implementations did
 * inconsistently: portal, backdrop, escape-to-close, body scroll lock,
 * focus trap, focus restoration, sized variants, and a touch-friendly close
 * button. Theming is inherited from the global `[data-theme]` CSS variables —
 * no paired light/dark module needed.
 *
 * Migration path: existing modals (BroadcastModal, DuplicateModal,
 * DisconnectModal, ClickStatsModal, SetupDMModal) keep their content and
 * just swap their hand-rolled overlay/modal wrappers for this component.
 *
 * Props:
 *   open              boolean  — control visibility (parent state)
 *   onClose           ()=>void — fired on Esc, backdrop click, or close button
 *   title             string|node — header title (rendered inside <h2>)
 *   subtitle          string|node — small text under the title (optional)
 *   icon              node     — optional decorative icon left of title
 *   size              'sm'|'md'|'lg'|'xl'|'full'|null  — width bucket; default
 *                                'md'. Pass null when the consumer's own
 *                                CSS module already sets a max-width that
 *                                doesn't match a bucket (e.g. BroadcastModal
 *                                uses 640px) — Modal will skip its size class
 *                                so the consumer's width wins.
 *   closable          boolean  — default true. Set false during in-progress
 *                                actions to disable Esc, backdrop, and the
 *                                close button (prevents accidental dismiss).
 *   closeOnEscape     boolean  — default true; ignored if !closable
 *   closeOnBackdrop   boolean  — default true; ignored if !closable
 *   showCloseButton   boolean  — default true
 *   initialFocusRef   ref      — element to focus when modal opens
 *   level             number   — z-index override; default 200. ConfirmDialog
 *                                uses 400 so it can stack on top of any modal.
 *   ariaLabel         string   — when title is non-string, pass an a11y label
 *   className         string   — extra classes on the modal panel
 *   footer            node     — optional pinned footer (right-aligned)
 *   noPadding         boolean  — drop the default body padding so the consumer
 *                                can fully control the inner layout (used by
 *                                modals migrating in with their own header /
 *                                body / footer divs).
 *   children          node     — body content
 */
export default function Modal({
    open,
    onClose,
    title,
    subtitle,
    icon,
    size = 'md',
    closable = true,
    closeOnEscape = true,
    closeOnBackdrop = true,
    showCloseButton = true,
    initialFocusRef,
    level,
    ariaLabel,
    className,
    footer,
    noPadding = false,
    children,
}) {
    const [mounted, setMounted] = useState(false);
    const modalRef = useRef(null);
    const previouslyFocusedRef = useRef(null);

    // SSR safety — only attach the portal after first client render.
    useEffect(() => { setMounted(true); }, []);

    const requestClose = useCallback(() => {
        if (!closable) return;
        onClose?.();
    }, [closable, onClose]);

    // NOTE: We deliberately do NOT mutate document.body.style.overflow.
    // The dashboard sidebar uses `position: sticky` and any temporary toggle
    // of body overflow breaks the sticky calculation in the browser. The
    // existing modals avoid this by relying on overlay-level scroll
    // containment (overlay has position:fixed; inset:0; overflow:hidden),
    // which is enough to stop page scroll while the modal is open.
    //
    // See SetupDMModal.module.css:11 — "overflow: hidden on overlay stops
    // page scroll without touching body" — for the original rationale.

    // Escape key handler.
    useEffect(() => {
        if (!open || !closable || !closeOnEscape) return;
        const onKey = (e) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                onClose?.();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, closable, closeOnEscape, onClose]);

    // Focus management — capture outside focus, move it into the modal,
    // restore it on close.
    useEffect(() => {
        if (!open || !mounted) return;

        previouslyFocusedRef.current = document.activeElement;

        // Defer one frame so refs inside <children> are populated.
        const id = requestAnimationFrame(() => {
            if (initialFocusRef?.current) {
                initialFocusRef.current.focus();
                return;
            }
            if (!modalRef.current) return;
            const focusable = getFocusable(modalRef.current);
            (focusable[0] || modalRef.current).focus();
        });

        return () => {
            cancelAnimationFrame(id);
            const prev = previouslyFocusedRef.current;
            if (prev && typeof prev.focus === 'function') {
                // Schedule on a microtask so React's unmount order doesn't
                // race with the focus call.
                queueMicrotask(() => prev.focus());
            }
        };
    }, [open, mounted, initialFocusRef]);

    // Focus trap on Tab.
    useEffect(() => {
        if (!open) return;
        const onKey = (e) => {
            if (e.key !== 'Tab' || !modalRef.current) return;
            const focusable = getFocusable(modalRef.current);
            if (focusable.length === 0) {
                e.preventDefault();
                modalRef.current.focus();
                return;
            }
            const first = focusable[0];
            const last  = focusable[focusable.length - 1];
            const active = document.activeElement;
            if (e.shiftKey && active === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && active === last) {
                e.preventDefault();
                first.focus();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open]);

    if (!mounted || !open) return null;

    const sizeClass =
        size === null     ? ''
      : size === 'sm'     ? styles.sizeSm
      : size === 'lg'     ? styles.sizeLg
      : size === 'xl'     ? styles.sizeXl
      : size === 'full'   ? styles.sizeFull
      :                     styles.sizeMd;

    const overlayStyle = level != null ? { '--modal-z': level } : undefined;

    const handleBackdrop = (e) => {
        if (e.target !== e.currentTarget) return;
        if (!closable || !closeOnBackdrop) return;
        onClose?.();
    };

    const labelledById = typeof title === 'string' ? 'modal-title' : undefined;

    return createPortal(
        <div
            className={styles.overlay}
            style={overlayStyle}
            onClick={handleBackdrop}
        >
            <div
                ref={modalRef}
                className={`${styles.modal} ${sizeClass} ${className || ''}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby={labelledById}
                aria-label={!labelledById ? ariaLabel : undefined}
                tabIndex={-1}
            >
                {(title || showCloseButton || icon) && (
                    <div className={styles.header}>
                        <div className={styles.headerLeft}>
                            {icon}
                            {title && (
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    {typeof title === 'string'
                                        ? <h2 id={labelledById} className={styles.title}>{title}</h2>
                                        : title}
                                    {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
                                </div>
                            )}
                        </div>
                        {showCloseButton && (
                            <button
                                type="button"
                                className={styles.closeBtn}
                                onClick={requestClose}
                                disabled={!closable}
                                aria-label="Close"
                            >
                                <X size={18} />
                            </button>
                        )}
                    </div>
                )}

                <div className={`${styles.body} ${noPadding ? styles.bodyNoPadding : ''}`}>{children}</div>

                {footer && <div className={styles.footer}>{footer}</div>}
            </div>
        </div>,
        document.body,
    );
}

// ── helpers ────────────────────────────────────────────────────────────────

const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(',');

function getFocusable(root) {
    return Array.from(root.querySelectorAll(FOCUSABLE_SELECTOR))
        .filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null);
}
