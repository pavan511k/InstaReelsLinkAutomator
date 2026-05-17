'use client';

import { useEffect } from 'react';
import { X, ArrowRight, Check, MessageSquare, AtSign, Mail, Workflow } from 'lucide-react';

/**
 * Help modal — visual reference for automation-precedence rules.
 * Triggered by the "?" icon in the Automations page header.
 * Tall scrollable card; sticky header + footer for context as user scrolls.
 */
export default function AutomationRulesModal({ open, onClose }) {
    // Esc to close + body-scroll lock while open
    useEffect(() => {
        if (!open) return;
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = prevOverflow;
        };
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rules-title"
        >
            {/* Backdrop */}
            <button
                type="button"
                aria-label="Close help"
                onClick={onClose}
                className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm transition-opacity"
            />

            {/* Modal card */}
            <div className="relative flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl">
                {/* Sticky header */}
                <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-neutral-200 bg-white px-6 py-4">
                    <div className="min-w-0">
                        <div className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-orange-700 mb-2">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-orange-500" />
                            How it works
                        </div>
                        <h2 id="rules-title" className="text-lg font-bold tracking-tight text-neutral-900 sm:text-xl">
                            Which automation fires?
                        </h2>
                        <p className="mt-0.5 text-sm text-neutral-600">
                            When multiple could match, these rules pick exactly one.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition-colors"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Scrollable body */}
                <div className="overflow-y-auto px-6 py-6 space-y-8">

                    {/* Trigger matrix */}
                    <section>
                        <h3 className="text-sm font-semibold text-neutral-900 mb-3 uppercase tracking-wide">
                            What can each fan action trigger?
                        </h3>
                        <div className="rounded-xl border border-neutral-200 overflow-hidden">
                            <TriggerRow
                                icon={<MessageSquare className="h-4 w-4" />}
                                action="Comments on a post"
                                firesLabel="Comment-to-DM"
                                firesNote="Bound to that post, or an 'Any Post' fallback"
                            />
                            <Divider />
                            <TriggerRow
                                icon={<AtSign className="h-4 w-4" />}
                                action="Replies to a story"
                                firesLabel="Story Reply"
                                firesNote="Bound to that story"
                            />
                            <Divider />
                            <TriggerRow
                                icon={<Mail className="h-4 w-4" />}
                                action="DMs you directly"
                                firesLabel="DM Auto-Responder"
                                firesNote="Or Email Collector if no Auto-Responder claims the keyword"
                            />
                        </div>
                    </section>

                    {/* Rules */}
                    <section className="space-y-5">
                        <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wide">
                            The tie-breaker rules
                        </h3>

                        <RuleCard
                            number="1"
                            title="An active specific-post automation wins over Any Post"
                        >
                            <Versus
                                left={{ label: 'Specific post (active)', detail: 'Bound to Post #X', winner: true }}
                                right={{ label: 'Any post', detail: 'Catch-all across posts', winner: false }}
                            />
                        </RuleCard>

                        <RuleCard
                            number="2"
                            title="More specific trigger wins on the same post"
                        >
                            <Versus
                                left={{ label: 'Keywords: "buy"', detail: 'Matches "I want to buy"', winner: true }}
                                right={{ label: 'All comments', detail: 'Would also match', winner: false }}
                            />
                        </RuleCard>

                        <RuleCard
                            number="3"
                            title="Tied on specificity? Newest edit wins"
                        >
                            <Versus
                                left={{ label: 'Automation A', detail: 'Updated 2 hours ago', winner: true }}
                                right={{ label: 'Automation B', detail: 'Updated 5 days ago', winner: false }}
                            />
                        </RuleCard>

                        <RuleCard
                            number="4"
                            title="A fan mid-flow stays in that flow"
                        >
                            <Versus
                                left={{ label: 'Email Collector (asked for email)', detail: 'Fan replies with their email', winner: true }}
                                right={{ label: 'DM Auto-Responder', detail: 'Any-keyword catch-all', winner: false }}
                            />
                        </RuleCard>

                        <RuleCard
                            number="5"
                            title="No flow in progress? Specific keyword beats any-keyword"
                        >
                            <Versus
                                left={{ label: 'Email Collector', detail: 'Keyword: "link"', winner: true }}
                                right={{ label: 'DM Auto-Responder', detail: 'Any keyword', winner: false }}
                            />
                        </RuleCard>
                    </section>

                    {/* Guarantee callout */}
                    <section>
                        <div className="rounded-xl border border-orange-100 bg-gradient-to-br from-orange-50 via-white to-white p-5">
                            <div className="flex items-start gap-3">
                                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-orange-100">
                                    <Workflow className="h-4 w-4 text-orange-700" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-semibold text-neutral-900 mb-1">
                                        One DM per comment, always
                                    </h4>
                                    <p className="text-sm text-neutral-700 leading-relaxed">
                                        No matter how many automations could match, only one fires per fan
                                        action. Fans won&apos;t get spammed by overlapping setups.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>

                {/* Sticky footer */}
                <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-neutral-200 bg-white px-6 py-3.5">
                    <p className="text-xs text-neutral-500">
                        Still wondering why something fired? Check <strong className="font-medium text-neutral-700">DM Logs</strong>.
                    </p>
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex items-center gap-1.5 rounded-md bg-neutral-900 hover:bg-black px-4 py-2 text-sm font-medium text-white transition-colors"
                    >
                        Got it
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─── Subcomponents ──────────────────────────────────────────────── */

function TriggerRow({ icon, action, firesLabel, firesNote }) {
    return (
        <div className="flex items-center gap-3 px-4 py-3 bg-white">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-neutral-100 text-neutral-600">
                {icon}
            </div>
            <div className="flex-1 min-w-0 text-sm font-medium text-neutral-900">{action}</div>
            <ArrowRight className="h-4 w-4 text-neutral-300 flex-shrink-0 hidden sm:block" />
            <div className="text-right">
                <div className="text-sm font-semibold text-neutral-900">{firesLabel}</div>
                <div className="text-[11px] text-neutral-500 mt-0.5 max-w-[200px]">{firesNote}</div>
            </div>
        </div>
    );
}

function Divider() {
    return <div className="border-t border-neutral-100" />;
}

function RuleCard({ number, title, children }) {
    return (
        <div className="rounded-xl border border-neutral-200 bg-white p-5">
            <div className="flex items-start gap-3 mb-3">
                <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white text-xs font-semibold">
                    {number}
                </div>
                <h4 className="text-[15px] font-semibold text-neutral-900 leading-snug pt-0.5">
                    {title}
                </h4>
            </div>
            <div className="ml-9 space-y-3">{children}</div>
        </div>
    );
}

function Versus({ left, right }) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-2 sm:gap-3 items-center">
            <VersusBox {...left} />
            <div className="text-[10px] font-bold text-neutral-400 text-center sm:text-left">vs</div>
            <VersusBox {...right} />
        </div>
    );
}

function VersusBox({ label, detail, winner }) {
    return (
        <div
            className={
                'rounded-lg border p-3 ' +
                (winner
                    ? 'border-emerald-200 bg-emerald-50/60'
                    : 'border-neutral-200 bg-neutral-50/60')
            }
        >
            <div className="flex items-center justify-between mb-0.5">
                <div className="text-[13px] font-semibold text-neutral-900">{label}</div>
                {winner ? (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5">
                        <Check className="h-2.5 w-2.5" /> wins
                    </span>
                ) : (
                    <span className="rounded-full bg-neutral-200 text-neutral-500 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5">
                        skipped
                    </span>
                )}
            </div>
            <div className="text-[11px] text-neutral-600">{detail}</div>
        </div>
    );
}
