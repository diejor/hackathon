import type { Metadata, Viewport } from 'next';
import SiteHeader from './_components/SiteHeader';
import './globals.css';

export const metadata: Metadata = {
  title: 'SafeSense',
  description: 'Find the scam that would get you, practise against it safely on your own phone, and keep a coach that knows your weak spots.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#ffffff',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
