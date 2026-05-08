'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import Select from './Select';
import styles from './Pagination.module.css';

const DEFAULT_PAGE_SIZE_OPTIONS = [20, 50, 100];

/**
 * Generic table pagination footer. Client-side — slices the source array
 * via the `currentPage` and `pageSize` controlled by the parent.
 *
 * Renders nothing when totalItems === 0 (the parent's own empty-state
 * UI takes over).
 *
 * Props:
 *   totalItems         number   — full filtered count (NOT the sliced length)
 *   currentPage        number   — 1-indexed
 *   pageSize           number   — current items-per-page
 *   onPageChange       (n)=>void
 *   onPageSizeChange   (n)=>void
 *   pageSizeOptions    number[] — defaults to [20, 50, 100]
 */
export default function Pagination({
    totalItems,
    currentPage,
    pageSize,
    onPageChange,
    onPageSizeChange,
    pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
}) {
    if (!totalItems || totalItems <= 0) return null;

    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const safePage   = Math.min(Math.max(1, currentPage), totalPages);
    const startIdx   = (safePage - 1) * pageSize + 1;
    const endIdx     = Math.min(safePage * pageSize, totalItems);

    return (
        <div className={styles.pagination}>
            <div className={styles.info}>
                Showing <strong>{startIdx.toLocaleString()}-{endIdx.toLocaleString()}</strong> of <strong>{totalItems.toLocaleString()}</strong>
            </div>
            <div className={styles.controls}>
                <Select
                    size="sm"
                    value={pageSize}
                    onChange={(v) => onPageSizeChange(Number(v))}
                    options={pageSizeOptions.map((n) => ({ value: n, label: `${n} / page` }))}
                    aria-label="Items per page"
                    className={styles.pageSizeSelect}
                />

                <button
                    type="button"
                    className={styles.navBtn}
                    disabled={safePage <= 1}
                    onClick={() => onPageChange(safePage - 1)}
                    aria-label="Previous page"
                >
                    <ChevronLeft size={14} />
                    Prev
                </button>
                <span className={styles.pageNum}>
                    Page {safePage} of {totalPages}
                </span>
                <button
                    type="button"
                    className={styles.navBtn}
                    disabled={safePage >= totalPages}
                    onClick={() => onPageChange(safePage + 1)}
                    aria-label="Next page"
                >
                    Next
                    <ChevronRight size={14} />
                </button>
            </div>
        </div>
    );
}

/**
 * Helper that slices an array using the same conventions Pagination uses.
 * Keeps callers from off-by-one mistakes.
 */
export function paginate(items, currentPage, pageSize) {
    const safePage = Math.max(1, currentPage);
    return items.slice((safePage - 1) * pageSize, safePage * pageSize);
}
