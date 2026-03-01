import './globals.css';

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
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
