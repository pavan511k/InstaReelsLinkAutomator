import './globals.css';
import ThemeProviderClient from '@/components/ThemeProviderClient';
import CookieConsent from '@/components/CookieConsent/CookieConsent';
import { Toaster } from '@/components/ui/sonner';
import { readThemeCookie } from '@/lib/theme-cookie';

/**
 * metadataBase — required for Next.js to resolve relative `og:image` URLs
 * to absolute ones. Search engines and social platforms (Bing, Google,
 * Facebook, LinkedIn, X) need absolute URLs to preview the icon.
 */
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://autodm.pro';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'AutoDM — Reply to Instagram Comments with a DM, Instantly!',
    template: '%s — AutoDM',
  },
  description: 'The #1 AutoDM platform for Instagram creators. Automatically reply to comments with DMs. Free to use, no credit card required. Trusted by thousands of creators, brands, and agencies.',
  keywords: 'Instagram, DM automation, auto reply, Instagram comments, DM bot, Instagram marketing',
  applicationName: 'AutoDM',
  authors: [{ name: 'AutoDM' }],
  creator: 'AutoDM',
  publisher: 'AutoDM',
  /* Icons: Next.js App Router auto-detects the icon.png / apple-icon.png
     / opengraph-image.png files we put in app/, so technically we don't
     need an explicit `icons` block. But declaring it explicitly is
     useful documentation + makes search-engine indexing more reliable. */
  icons: {
    icon: [
      { url: '/icon.png', type: 'image/png' },
    ],
    shortcut: '/icon.png',
    apple: '/apple-icon.png',
  },
  openGraph: {
    title: 'AutoDM — Reply to Instagram Comments with a DM, Instantly!',
    description: 'The #1 AutoDM platform for Instagram creators. Auto-reply to comments with DMs instantly.',
    url: SITE_URL,
    siteName: 'AutoDM',
    type: 'website',
    locale: 'en_US',
    /* opengraph-image.png in app/ is auto-picked up; no explicit url here. */
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AutoDM — Reply to Instagram Comments with a DM, Instantly!',
    description: 'Auto-reply to every Instagram comment with a personal DM.',
    /* twitter-image.png in app/ is auto-picked up. */
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default async function RootLayout({ children }) {
  const initialTheme = await readThemeCookie();

  return (
    // suppressHydrationWarning: next-themes' inline script may further
    // mutate <html> attrs (style="color-scheme:..."). data-theme itself
    // is now set server-side from the cookie, so SSR & client agree.
    <html lang="en" data-theme={initialTheme} suppressHydrationWarning>
      <body>
        <ThemeProviderClient initialTheme={initialTheme}>
          {children}
          <CookieConsent />
          <Toaster position="top-right" richColors closeButton />
        </ThemeProviderClient>
      </body>
    </html>
  );
}
