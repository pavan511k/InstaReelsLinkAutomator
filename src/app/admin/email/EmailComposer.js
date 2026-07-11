'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Send, Sparkles } from 'lucide-react';

const PLAIN_PLACEHOLDER = `Hi Pavan,

Quick update on the AutoDM launch — Meta verification just cleared. Your account is ready to use.

— The AutoDM team`;

const HTML_PLACEHOLDER = `<p>Hi Pavan,</p>
<p>Quick update on the AutoDM launch — Meta verification just cleared. Your account is ready to use.</p>
<p>— The AutoDM team</p>`;

export default function EmailComposer() {
    const router = useRouter();

    const [recipients, setRecipients] = useState('');
    const [subject, setSubject]       = useState('');
    const [bodyFormat, setBodyFormat] = useState('html');
    const [branded, setBranded]       = useState(true);
    const [body, setBody]             = useState('');
    const [isSending, setIsSending]   = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!recipients.trim()) { toast.error('At least one recipient is required.'); return; }
        if (!subject.trim())    { toast.error('Subject is required.');                 return; }
        if (!body.trim())       { toast.error('Body is required.');                    return; }

        setIsSending(true);
        const tId = toast.loading('Sending…');

        try {
            const res = await fetch('/api/admin/email/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipients,
                    subject,
                    bodyFormat,
                    body,
                    branded,
                }),
            });
            const json = await res.json();

            if (!res.ok) {
                toast.error(json.error || 'Send failed.', { id: tId });
                return;
            }

            const sent = json.sent ?? 0;
            const failedNote = json.failed ? ` (${json.failed} failed)` : '';
            toast.success(
                `Email sent to ${sent} recipient${sent === 1 ? '' : 's'}${failedNote}.`,
                { id: tId },
            );
            setRecipients(''); setSubject(''); setBody('');
            router.refresh(); // pull the new row into the log table
        } catch (err) {
            toast.error(err.message || 'Network error.', { id: tId });
        } finally {
            setIsSending(false);
        }
    };

    const inputClass =
        'block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#E63946] focus:outline-none focus:ring-2 focus:ring-[#E63946]/15 disabled:cursor-not-allowed disabled:opacity-60 transition-colors';

    return (
        <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm shadow-neutral-200/40 sm:p-8"
        >
            {/* Recipients block */}
            <div className="space-y-3">
                <FieldRow label="Recipients" required>
                    <textarea
                        value={recipients}
                        onChange={(e) => setRecipients(e.target.value)}
                        placeholder="alice@example.com, bob@example.com"
                        autoComplete="off"
                        rows={3}
                        disabled={isSending}
                        className={`${inputClass} resize-y`}
                    />
                    <p className="mt-1 text-xs text-neutral-500">
                        Separate with commas, spaces, or new lines. Each person gets their
                        own private copy — no one sees the other recipients.
                    </p>
                </FieldRow>

                <FieldRow label="Subject" required>
                    <input
                        type="text"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="What's this email about?"
                        autoComplete="off"
                        maxLength={200}
                        disabled={isSending}
                        className={inputClass}
                    />
                </FieldRow>
            </div>

            <hr className="my-5 border-neutral-200" />

            {/* Format + branded toggles */}
            <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2">
                <fieldset className="flex items-center gap-3">
                    <legend className="sr-only">Body format</legend>
                    <FormatRadio
                        label="HTML"
                        checked={bodyFormat === 'html'}
                        onChange={() => setBodyFormat('html')}
                        disabled={isSending}
                    />
                    <FormatRadio
                        label="Plain text"
                        checked={bodyFormat === 'text'}
                        onChange={() => setBodyFormat('text')}
                        disabled={isSending}
                    />
                </fieldset>

                <label
                    className={[
                        'inline-flex items-center gap-2 text-xs',
                        bodyFormat === 'html'
                            ? 'text-neutral-700'
                            : 'cursor-not-allowed text-neutral-400',
                    ].join(' ')}
                >
                    <input
                        type="checkbox"
                        checked={branded && bodyFormat === 'html'}
                        onChange={(e) => setBranded(e.target.checked)}
                        disabled={isSending || bodyFormat !== 'html'}
                        className="h-3.5 w-3.5 rounded border-neutral-300 text-[#E63946] focus:ring-[#E63946]/30"
                    />
                    <Sparkles className="h-3.5 w-3.5" />
                    Wrap in AutoDM branded layout
                </label>
            </div>

            {/* Body */}
            <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={bodyFormat === 'html' ? HTML_PLACEHOLDER : PLAIN_PLACEHOLDER}
                rows={12}
                disabled={isSending}
                className="block w-full rounded-md border border-neutral-300 bg-white px-3 py-2.5 font-mono text-[13px] leading-relaxed text-neutral-900 placeholder:text-neutral-400 focus:border-[#E63946] focus:outline-none focus:ring-2 focus:ring-[#E63946]/15 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
            />

            <p className="mt-1.5 text-xs text-neutral-500">
                {bodyFormat === 'html'
                    ? 'Paste any HTML. Branded wrapper adds the AutoDM card, logo, and footer.'
                    : 'Plain text — line breaks are preserved.'}
            </p>

            {/* Submit */}
            <div className="mt-6 flex items-center justify-end">
                <button
                    type="submit"
                    disabled={isSending}
                    className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-black disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
                >
                    {isSending ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Sending…
                        </>
                    ) : (
                        <>
                            <Send className="h-4 w-4" />
                            Send email
                        </>
                    )}
                </button>
            </div>
        </form>
    );
}

function FieldRow({ label, required, children }) {
    return (
        <div className="flex items-start gap-3">
            <label className="mt-2 w-[80px] flex-shrink-0 text-right text-xs font-semibold text-neutral-700">
                {label}
                {required && <span className="ml-0.5 text-[#E63946]">*</span>}
            </label>
            <div className="min-w-0 flex-1">{children}</div>
        </div>
    );
}

function FormatRadio({ label, checked, onChange, disabled }) {
    return (
        <label className="inline-flex items-center gap-1.5 text-xs text-neutral-700">
            <input
                type="radio"
                checked={checked}
                onChange={onChange}
                disabled={disabled}
                className="h-3.5 w-3.5 border-neutral-300 text-[#E63946] focus:ring-[#E63946]/30"
            />
            {label}
        </label>
    );
}
