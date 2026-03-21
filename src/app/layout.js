import './globals.css';
import { ThemeProvider } from 'next-themes';
import CookieConsent from '@/components/CookieConsent/CookieConsent';

export const metadata = {
  title: 'AutoDM — Reply to Instagram Comments with a DM, Instantly!',
  description: 'The #1 AutoDM platform for Instagram creators. Automatically reply to comments with DMs. Free to use, no credit card required. Trusted by thousands of creators, brands, and agencies.',
  keywords: 'Instagram, DM automation, auto reply, Instagram comments, DM bot, Instagram marketing',
  openGraph: {
    title: 'AutoDM — Reply to Instagram Comments with a DM, Instantly!',
    description: 'The #1 AutoDM platform for Instagram creators. Auto-reply to comments with DMs instantly.',
    type: 'website',
  },
};

export default function RootLayout({ children }) {
  return (
    // suppressHydrationWarning: next-themes modifies <html> attributes
    // (data-theme, style="color-scheme:...") via an inline script before
    // React hydrates. This mismatch is expected and safe to suppress.
    <html lang="en" suppressHydrationWarning>
      <body>
        {/*
          attribute="data-theme" → sets data-theme="dark/light" on <html>,
          NOT class="dark". Using class="dark" triggers Chrome's dark-mode
          autofill heuristic on auth page inputs — data-theme does not.
          
          ThemeProvider must be in ROOT layout so its blocking <script>
          runs before React hydrates, preventing the dark→light flash.
        */}
        <ThemeProvider attribute="data-theme" defaultTheme="dark" enableSystem={false}>
          {children}
          <CookieConsent />
        </ThemeProvider>
      </body>
    </html>
  );
}
