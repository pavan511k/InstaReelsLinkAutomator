'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Mail, Loader2, ArrowLeft, CheckCircle, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';

export default function ForgotPasswordPage() {
  const [email, setEmail]         = useState('');
  const [error, setError]         = useState('');
  const [sent, setSent]           = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email) { setError('Please enter your email address.'); return; }

    setIsLoading(true);
    try {
      const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      if (authError) setError(authError.message);
      else           setSent(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-white">
      {/* Soft crimson tint behind the card — same brand-bridge gradient as
          login/signup, so the auth surface reads as one consistent flow. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(142,27,38,0.10) 0%, transparent 70%), radial-gradient(ellipse 60% 60% at 50% 100%, rgba(230,57,70,0.06) 0%, transparent 70%)',
        }}
      />

      <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12 sm:px-6">
        {/* Logo + brand mark */}
        <Link href="/" className="mb-8 flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-neutral-200 shadow-sm">
            <Image src="/logo.png" alt="AutoDM" width={36} height={36} className="h-9 w-9 object-contain" priority />
          </span>
          <span className="text-base font-semibold tracking-tight">
            <span className="text-neutral-900">Auto</span>
            <span className="text-[#E63946]">DM</span>
          </span>
        </Link>

        {/* Card */}
        <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-7 shadow-xl shadow-neutral-200/50 sm:p-8">
          {!sent ? (
            // ─── Request reset link ──────────────────────────────────────
            <>
              <div className="mb-6 text-center sm:text-left">
                <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
                  Forgot password?
                </h1>
                <p className="mt-2 text-sm text-neutral-600">
                  Enter the email you registered with and we&apos;ll send you a reset link.
                </p>
              </div>

              {error && (
                <div role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                  <span className="mt-1 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-500" />
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="mb-1.5 block text-xs font-semibold text-neutral-700">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" strokeWidth={2} />
                    <input
                      id="email"
                      type="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      disabled={isLoading}
                      className="block w-full rounded-lg border border-neutral-300 bg-white py-2.5 pl-9 pr-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#E63946] focus:outline-none focus:ring-2 focus:ring-[#E63946]/20 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-black disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending link…
                    </>
                  ) : (
                    'Send reset link'
                  )}
                </button>
              </form>

              <div className="mt-5 flex justify-center">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.5} />
                  Back to sign in
                </Link>
              </div>
            </>
          ) : (
            // ─── Success state ───────────────────────────────────────────
            <div className="text-center">
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-500">
                <CheckCircle className="h-8 w-8" strokeWidth={1.75} />
              </span>
              <h1 className="mt-5 text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
                Check your inbox
              </h1>
              <p className="mt-2 text-sm text-neutral-600">
                We sent a password reset link to{' '}
                <strong className="font-semibold text-neutral-900 break-all">{email}</strong>.
                It expires in 1 hour.
              </p>

              <div className="mt-6 rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-left">
                <p className="text-xs font-semibold text-neutral-700">Didn&apos;t receive it?</p>
                <ul className="mt-2 space-y-1.5 text-xs text-neutral-600">
                  <li>• Check your spam or junk folder</li>
                  <li>• Make sure you entered the correct email</li>
                  <li>
                    •{' '}
                    <button
                      type="button"
                      onClick={() => { setSent(false); setEmail(''); }}
                      className="font-medium text-[#E63946] hover:text-[#CC2E3B] transition-colors"
                    >
                      Try a different email
                    </button>
                  </li>
                </ul>
              </div>

              <Link
                href="/login"
                className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.5} />
                Back to sign in
              </Link>
            </div>
          )}

          {/* Trust footer inside the card */}
          <div className="mt-6 flex items-center justify-center gap-2 border-t border-neutral-200 pt-5 text-xs text-neutral-500">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            Reset links expire in 1 hour for your security
          </div>
        </div>

        {/* Tiny secondary footer below */}
        <p className="mt-6 text-xs text-neutral-500">
          Need help?{' '}
          <a href="mailto:support@autodm.pro" className="font-medium text-neutral-700 hover:text-neutral-900 transition-colors">
            support@autodm.pro
          </a>
        </p>
      </div>
    </div>
  );
}
