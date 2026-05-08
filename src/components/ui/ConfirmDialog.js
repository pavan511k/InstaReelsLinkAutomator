'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Info, X } from 'lucide-react';
import { useStyles } from '@/lib/useStyles';
import darkStyles from './ConfirmDialog.module.css';
import lightStyles from './ConfirmDialog.light.module.css';
import Modal from './Modal';

const ConfirmContext = createContext(null);

export function useConfirm() {
    const ctx = useContext(ConfirmContext);
    if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
    return ctx;
}

export function ConfirmProvider({ children }) {
    const [state, setState] = useState(null);
    const [inputValue, setInputValue] = useState('');
    const styles = useStyles(darkStyles, lightStyles);
    // Note: portalReady wiring removed — the Modal primitive handles SSR
    // safety internally via its own mount guard.

    // Refs the Modal uses to set initial focus. Original code relied on
    // React's autoFocus attribute; we use refs now so Modal's own focus
    // manager doesn't override the intended target.
    const confirmBtnRef = useRef(null);
    const promptInputRef = useRef(null);

    const confirm = useCallback((opts = {}) => new Promise((resolve) => {
        setState({
            mode: 'confirm',
            title: opts.title || 'Are you sure?',
            message: opts.message || '',
            confirmText: opts.confirmText || 'Confirm',
            cancelText: opts.cancelText || 'Cancel',
            danger: opts.danger !== false,
            resolve,
        });
    }), []);

    const alertDialog = useCallback((opts = {}) => new Promise((resolve) => {
        setState({
            mode: 'alert',
            title: opts.title || 'Notice',
            message: opts.message || '',
            confirmText: opts.confirmText || 'OK',
            danger: !!opts.danger,
            resolve,
        });
    }), []);

    const prompt = useCallback((opts = {}) => new Promise((resolve) => {
        setInputValue(opts.defaultValue || '');
        setState({
            mode: 'prompt',
            title: opts.title || 'Enter a value',
            message: opts.message || '',
            placeholder: opts.placeholder || '',
            confirmText: opts.confirmText || 'OK',
            cancelText: opts.cancelText || 'Cancel',
            danger: !!opts.danger,
            resolve,
        });
    }), []);

    const close = (value) => {
        if (state) {
            if (state.mode === 'prompt' && value === true) {
                state.resolve(inputValue);
            } else if (state.mode === 'prompt') {
                state.resolve(null);
            } else {
                state.resolve(value);
            }
        }
        setState(null);
        setInputValue('');
    };

    useEffect(() => {
        if (!state) return;
        const onKey = (e) => {
            if (e.key === 'Escape') close(state.mode === 'alert' ? true : false);
            if (e.key === 'Enter' && state.mode !== 'prompt') close(true);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [state, inputValue]);

    return (
        <ConfirmContext.Provider value={{ confirm, alert: alertDialog, prompt }}>
            {children}
            <Modal
                open={!!state}
                /* Backdrop click maps to: confirm → false, alert/prompt → true.
                   Matches the original `e.target === e.currentTarget` handler. */
                onClose={() => state && close(state.mode === 'confirm' ? false : true)}
                /* Escape and Enter are still handled by the existing useEffect
                   above so the per-mode return values stay identical. */
                closeOnEscape={false}
                /* X button is rendered inline below so it can carry the same
                   per-mode close logic as the original. */
                showCloseButton={false}
                noPadding
                size={null}
                /* Level 400 keeps the confirm above any other modal that opens it
                   (BroadcastModal calls confirm() to ask "cancel this broadcast?"). */
                level={400}
                ariaLabel={state?.title || 'Confirmation dialog'}
                className={styles.modal}
                initialFocusRef={state?.mode === 'prompt' ? promptInputRef : confirmBtnRef}
            >
                {state && (
                    <>
                        <div className={styles.header}>
                            <div className={styles.headerLeft}>
                                <div className={`${styles.headerIcon} ${state.danger ? styles.headerIconDanger : styles.headerIconInfo}`}>
                                    {state.danger ? <AlertTriangle size={18} /> : <Info size={18} />}
                                </div>
                                <h2 id="confirm-title" className={styles.title}>{state.title}</h2>
                            </div>
                            <button
                                className={styles.closeBtn}
                                onClick={() => close(state.mode === 'confirm' ? false : true)}
                                aria-label="Close"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        {(state.message || state.mode === 'prompt') && (
                            <div className={styles.body}>
                                {state.message && <p className={styles.message}>{state.message}</p>}
                                {state.mode === 'prompt' && (
                                    <input
                                        ref={promptInputRef}
                                        type="text"
                                        className={styles.input}
                                        value={inputValue}
                                        onChange={(e) => setInputValue(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') { e.preventDefault(); close(true); }
                                        }}
                                        placeholder={state.placeholder}
                                    />
                                )}
                            </div>
                        )}
                        <div className={styles.footer}>
                            {(state.mode === 'confirm' || state.mode === 'prompt') && (
                                <button className={styles.btnCancel} onClick={() => close(false)}>
                                    {state.cancelText}
                                </button>
                            )}
                            <button
                                ref={confirmBtnRef}
                                className={state.danger ? styles.btnDanger : styles.btnPrimary}
                                onClick={() => close(true)}
                            >
                                {state.confirmText}
                            </button>
                        </div>
                    </>
                )}
            </Modal>
        </ConfirmContext.Provider>
    );
}
