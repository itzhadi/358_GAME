import type { Metadata, Viewport } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: '3-5-8 משחק קלפים',
  description: 'משחק קלפים 3-5-8 לשלושה שחקנים',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: '3-5-8',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0d0f17',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" sizes="192x192" href="/icons/icon-192.svg" />
        <link rel="icon" type="image/svg+xml" href="/icons/icon-192.svg" />
      </head>
      <body className="safe-top safe-bottom antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
