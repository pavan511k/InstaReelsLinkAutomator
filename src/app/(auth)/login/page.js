'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Mail, Lock, Loader2, ArrowRight, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';

// Official Google "G" mark — 4-color SVG.
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 flex-shrink-0" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

export default function LoginPage() {
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [error, setError]         = useState('');
  const [showResetCta, setShowResetCta] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router   = useRouter();
  const supabase = createClient();

  // Failed email links (password reset / verification) and OAuth errors bounce
  // back to /login with details in the query string or URL hash. Supabase emits
  // access_denied / otp_expired ("Email link is invalid or has expired"); our
  // own /auth/callback emits error=auth_failed. Surface a friendly message
  // instead of a blank form on a scary URL, then clean the address bar.
  useEffect(() => {
    const fromHash  = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const fromQuery = new URLSearchParams(window.location.search);
    const pick = (key) => fromQuery.get(key) || fromHash.get(key) || '';
    const errName = pick('error');
    const errCode = pick('error_code');
    const errDesc = pick('error_description');
    if (!errName && !errCode && !errDesc) return;

    const desc = errDesc ? decodeURIComponent(errDesc.replace(/\+/g, ' ')) : '';
    const isLinkProblem =
      errCode === 'otp_expired' ||
      errName === 'auth_failed' ||
      /expired|invalid/i.test(desc);
    // A provider cancel (e.g. dismissing Google consent) comes back as
    // access_denied without an expired/invalid link — not a reset situation,
    // so don't offer the "request a new link" CTA.
    const isOAuthCancel = !isLinkProblem && errName === 'access_denied';

    if (isLinkProblem) {
      setError('This link is invalid or has expired. Please request a new one.');
      setShowResetCta(true);
    } else if (isOAuthCancel) {
      setError('Sign-in was cancelled. Please try again.');
    } else {
      setError(desc || 'We couldn’t sign you in. Please try again.');
    }

    // Strip the params so a refresh doesn't re-show the error and the URL is clean.
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setShowResetCta(false);
    if (!email || !password) { setError('Please fill in all fields.'); return; }

    setIsLoading(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) {
        setError(authError.message.includes('Email not confirmed')
          ? 'Please verify your email first. Check your inbox.'
          : authError.message);
      } else {
        router.push('/dashboard');
        router.refresh();
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setShowResetCta(false);
    setIsLoading(true);
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (oauthError) {
        setError(oauthError.message);
        setIsLoading(false);
      }
      // On success the browser navigates to Google — no manual redirect needed.
    } catch {
      setError('Something went wrong with Google sign-in.');
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-white">
      {/* Soft crimson tint behind the card — same brand-bridge gradient as signup. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(142,27,38,0.10) 0%, transparent 70%), radial-gradient(ellipse 60% 60% at 50% 100%, rgba(230,57,70,0.06) 0%, transparent 70%)',
        }}
      />

      <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12 sm:px-6">
        {/* Logo + brand mark — sits above the card */}
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
          <div className="mb-6 text-center sm:text-left">
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
              Welcome back
            </h1>
            <p className="mt-2 text-sm text-neutral-600">
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="font-medium text-[#E63946] hover:text-[#CC2E3B] transition-colors">
                Sign up
              </Link>
            </p>
          </div>

          {error && (
            <div role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
              <span className="mt-1 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-500" />
              <div className="space-y-1">
                <p>{error}</p>
                {showResetCta && (
                  <Link
                    href="/forgot-password"
                    className="inline-block font-semibold text-red-800 underline underline-offset-2 hover:text-red-900"
                  >
                    Request a new link
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Google sign-in */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          {/* Sign-in-wrap consent — required even on login because OAuth's
              first-time flow IS a signup. A user who lands here without an
              existing account and clicks Google auto-creates one in
              Supabase, so they need the same Terms-acceptance moment as
              /signup. Same pattern Linear / Vercel / Stripe use. */}
          <p className="mt-2.5 text-center text-[11px] leading-relaxed text-neutral-500">
            By continuing, you agree to our{' '}
            <Link href="/terms" target="_blank" className="font-medium text-neutral-700 underline-offset-2 hover:underline hover:text-neutral-900">Terms</Link>
            {' '}and{' '}
            <Link href="/privacy" target="_blank" className="font-medium text-neutral-700 underline-offset-2 hover:underline hover:text-neutral-900">Privacy Policy</Link>.
          </p>

          {/* Divider */}
          <div className="my-5 flex items-center gap-3 text-xs text-neutral-500">
            <span className="h-px flex-1 bg-neutral-200" />
            <span>Or continue with email</span>
            <span className="h-px flex-1 bg-neutral-200" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label htmlFor="email" className="mb-1.5 block text-xs font-semibold text-neutral-700">
                Work email
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

            {/* Password */}
            <div>
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <label htmlFor="password" className="block text-xs font-semibold text-neutral-700">
                  Password
                </label>
                <Link href="/forgot-password" className="text-xs font-medium text-[#E63946] hover:text-[#CC2E3B] transition-colors">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" strokeWidth={2} />
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
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
                  Signing in…
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Trust footer inside the card */}
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-neutral-500">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            Official Meta Business Partner · Secure by design
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
