'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';
import { useStyles } from '@/lib/useStyles';
import darkStyles from './Select.module.css';
import lightStyles from './Select.light.module.css';

// Match a layoutEffect to SSR-safe behaviour.
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * Themed dropdown that replaces native <select>. Native option lists
 * inherit OS chrome and can't be styled cross-browser; this component
 * uses CSS modules so it tracks the app's dark/light theme and matches
 * the rest of the dashboard.
 *
 * Props:
 *   value         current value
 *   onChange      (newValue) => void
 *   options       [{ value, label, icon?, badge?, desc?, disabled? }]
 *   placeholder   shown when no value matches an option
 *   size          'md' (default) | 'sm'
 *   className     extra class on the trigger
 */
export default function Select({
    value,
    onChange,
    options = [],
    placeholder = 'Select…',
    size = 'md',
    className = '',
    'aria-label': ariaLabel,
}) {
    const styles = useStyles(darkStyles, lightStyles);
    const [open, setOpen] = useState(false);
    const [menuPos, setMenuPos] = useState(null); // { top, left, width, openUp }
    const [portalReady, setPortalReady] = useState(false);
    const wrapRef = useRef(null);
    const menuRef = useRef(null);

    const selected = options.find((o) => o.value === value);

    useEffect(() => { setPortalReady(true); }, []);

    // Compute menu position relative to viewport. Re-runs on open + on
    // scroll/resize while open so the menu tracks the trigger.
    const updatePosition = () => {
        if (!wrapRef.current) return;
        const r = wrapRef.current.getBoundingClientRect();
        const menuMaxH = 280;  // matches CSS max-height
        const spaceBelow = window.innerHeight - r.bottom;
        const openUp = spaceBelow < menuMaxH + 12 && r.top > spaceBelow;
        setMenuPos({
            top: openUp ? r.top - 6 : r.bottom + 6,
            left: r.left,
            width: r.width,
            openUp,
        });
    };

    useIsoLayoutEffect(() => {
        if (!open) return;
        updatePosition();
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const onDocClick = (e) => {
            if (wrapRef.current?.contains(e.target)) return;
            if (menuRef.current?.contains(e.target)) return;
            setOpen(false);
        };
        const onKey = (e) => {
            if (e.key === 'Escape') setOpen(false);
        };
        const onScrollOrResize = () => updatePosition();
        document.addEventListener('mousedown', onDocClick);
        document.addEventListener('keydown', onKey);
        // Capture phase so we catch scrolls inside any ancestor (modal body, etc).
        window.addEventListener('scroll', onScrollOrResize, true);
        window.addEventListener('resize', onScrollOrResize);
        return () => {
            document.removeEventListener('mousedown', onDocClick);
            document.removeEventListener('keydown', onKey);
            window.removeEventListener('scroll', onScrollOrResize, true);
            window.removeEventListener('resize', onScrollOrResize);
        };
    }, [open]);

    const handlePick = (opt) => {
        if (opt.disabled) return;
        onChange?.(opt.value, opt);
        setOpen(false);
    };

    return (
        <div className={`${styles.wrap} ${className}`} ref={wrapRef}>
            <button
                type="button"
                className={`${styles.trigger} ${size === 'sm' ? styles.triggerSm : ''} ${open ? styles.triggerOpen : ''}`}
                onClick={() => setOpen((v) => !v)}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label={ariaLabel}
            >
                <span className={styles.triggerLabel}>
                    {selected
                        ? (
                            <>
                                {selected.icon && <span className={styles.triggerIcon}>{selected.icon}</span>}
                                <span className={styles.triggerText}>{selected.label}</span>
                                {selected.badge && <span className={styles.triggerBadge}>{selected.badge}</span>}
                            </>
                        )
                        : <span className={styles.triggerPlaceholder}>{placeholder}</span>
                    }
                </span>
                <ChevronDown size={size === 'sm' ? 13 : 15} className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`} />
            </button>

            {open && portalReady && menuPos && createPortal(
                <div
                    ref={menuRef}
                    className={`${styles.menu} ${styles.menuPortaled}`}
                    role="listbox"
                    style={{
                        top: menuPos.openUp ? 'auto' : menuPos.top,
                        bottom: menuPos.openUp ? (window.innerHeight - menuPos.top) : 'auto',
                        left: menuPos.left,
                        width: menuPos.width,
                    }}
                >
                    {options.map((opt) => {
                        const isSelected = opt.value === value;
                        return (
                            <button
                                key={opt.value}
                                type="button"
                                className={`${styles.option} ${isSelected ? styles.optionSelected : ''} ${opt.disabled ? styles.optionDisabled : ''}`}
                                onClick={() => handlePick(opt)}
                                role="option"
                                aria-selected={isSelected}
                                disabled={opt.disabled}
                            >
                                <span className={styles.optionMain}>
                                    {opt.icon && <span className={styles.optionIcon}>{opt.icon}</span>}
                                    <span className={styles.optionText}>{opt.label}</span>
                                    {opt.badge && <span className={styles.optionBadge}>{opt.badge}</span>}
                                </span>
                                {opt.desc && <span className={styles.optionDesc}>{opt.desc}</span>}
                                {isSelected && <Check size={13} className={styles.optionCheck} />}
                            </button>
                        );
                    })}
                </div>,
                document.body,
            )}
        </div>
    );
}
