'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Mail, Lock, Loader2, ArrowRight, Check, User, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';

// Official Google "G" mark — 4-color SVG. Inline so we don't pull a 5MB
// brand asset library for one icon.
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

const PASSWORD_MIN_LENGTH = 8;

function getPasswordStrength(pw) {
  if (!pw) return { level: 0, label: '', color: 'bg-neutral-300' };
  if (pw.length < PASSWORD_MIN_LENGTH) return { level: 1, label: 'Too short', color: 'bg-red-400' };
  let score = 0;
  if (pw.length >= 8)          score++;
  if (/[A-Z]/.test(pw))        score++;
  if (/[0-9]/.test(pw))        score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { level: 1, label: 'Weak',   color: 'bg-red-400' };
  if (score === 2) return { level: 2, label: 'Fair',   color: 'bg-amber-400' };
  if (score === 3) return { level: 3, label: 'Good',   color: 'bg-emerald-400' };
  return              { level: 4, label: 'Strong', color: 'bg-emerald-500' };
}

const STRENGTH_TEXT = {
  1: 'text-red-500',
  2: 'text-amber-500',
  3: 'text-emerald-500',
  4: 'text-emerald-600',
};

export default function SignupPage() {
  const [email, setEmail]                 = useState('');
  const [password, setPassword]           = useState('');
  const [fullName, setFullName]           = useState('');
  const [error, setError]                 = useState('');
  const [isLoading, setIsLoading]         = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const router   = useRouter();
  const supabase = createClient();

  const strength = useMemo(() => getPasswordStrength(password), [password]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!fullName || !email || !password)      { setError('Please fill in all fields.');                         return; }
    if (password.length < PASSWORD_MIN_LENGTH) { setError('Password must be at least 8 characters.');           return; }
    if (!termsAccepted)                        { setError('Please accept the Terms & Privacy Policy.');          return; }

    const trimmedName = fullName.trim();

    setIsLoading(true);
    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email, password,
        options: {
          data: { full_name: trimmedName },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (authError) {
        setError(authError.message);
      } else if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        // Supabase's email-enumeration protection returns success with an
        // empty identities array (and sends no email) when the address is
        // already registered. Tell the user to sign in instead of parking
        // them on /verify to wait for an email that will never arrive.
        setError('This email is already registered. Please sign in instead.');
      } else {
        // No separate welcome email — Supabase Auth already sends the
        // verification email at signup, and we send the trial-started
        // email once the user connects their first IG/FB account. Two
        // emails ~minutes apart felt redundant. Forward the address so
        // /verify can offer a resend.
        router.push(`/verify?email=${encodeURIComponent(email)}`);
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
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
      {/* Soft crimson tint behind the card — creates a brand bridge from the
          landing without competing for attention with the form itself. */}
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
              Create your account
            </h1>
            <p className="mt-2 text-sm text-neutral-600">
              Already have an account?{' '}
              <Link href="/login" className="font-medium text-[#E63946] hover:text-[#CC2E3B] transition-colors">
                Sign in
              </Link>
            </p>
          </div>

          {error && (
            <div role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
              <span className="mt-1 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-500" />
              {error}
            </div>
          )}

          {/* Google sign-up */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          {/* Sign-in-wrap consent — by clicking the OAuth button above the
              user accepts Terms + Privacy. Standard pattern (Stripe, Vercel,
              Linear, etc.). Keeps Google flow frictionless while still
              capturing explicit-enough consent. The email/password form
              below has its own checkbox for stronger clickwrap. */}
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
            {/* Full name */}
            <div>
              <label htmlFor="fullName" className="mb-1.5 block text-xs font-semibold text-neutral-700">
                Full name
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" strokeWidth={2} />
                <input
                  id="fullName"
                  type="text"
                  placeholder="Jane Smith"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                  disabled={isLoading}
                  className="block w-full rounded-lg border border-neutral-300 bg-white py-2.5 pl-9 pr-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#E63946] focus:outline-none focus:ring-2 focus:ring-[#E63946]/20 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
                />
              </div>
            </div>

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

            {/* Password + strength */}
            <div>
              <label htmlFor="password" className="mb-1.5 block text-xs font-semibold text-neutral-700">
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" strokeWidth={2} />
                <input
                  id="password"
                  type="password"
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={isLoading}
                  className="block w-full rounded-lg border border-neutral-300 bg-white py-2.5 pl-9 pr-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#E63946] focus:outline-none focus:ring-2 focus:ring-[#E63946]/20 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
                />
              </div>
              {password && (
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex flex-1 gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={[
                          'h-1 flex-1 rounded-full transition-colors',
                          i <= strength.level ? strength.color : 'bg-neutral-200',
                        ].join(' ')}
                      />
                    ))}
                  </div>
                  <span className={['text-xs font-medium', STRENGTH_TEXT[strength.level] || 'text-neutral-500'].join(' ')}>
                    {strength.label}
                  </span>
                </div>
              )}
            </div>

            {/* Terms */}
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="peer sr-only"
              />
              <span
                className={[
                  'mt-0.5 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors',
                  termsAccepted
                    ? 'border-[#E63946] bg-[#E63946] text-white'
                    : 'border-neutral-300 bg-white',
                ].join(' ')}
              >
                {termsAccepted && <Check className="h-3 w-3" strokeWidth={3.5} />}
              </span>
              <span className="text-xs leading-relaxed text-neutral-600">
                I agree to the{' '}
                <Link href="/terms" target="_blank" className="font-medium text-neutral-900 underline-offset-2 hover:underline">Terms of Service</Link>
                {' '}and{' '}
                <Link href="/privacy" target="_blank" className="font-medium text-neutral-900 underline-offset-2 hover:underline">Privacy Policy</Link>
              </span>
            </label>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-black disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating account…
                </>
              ) : (
                <>
                  Get started free
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Trust footer inside the card */}
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-neutral-500">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            Official Meta Business Partner · Free forever, no card required
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
