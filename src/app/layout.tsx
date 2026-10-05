import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { CartProvider } from '@/lib/cart-context';
import { BrandHeader } from '@/components/brand-header';
import { BrandFooter } from '@/components/brand-footer';
import { CartDrawer } from '@/components/cart-drawer';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: '1968 Clothing — Filipino Streetwear & Heritage Drops',
  description:
    'Wear the legacy. Move the culture. Premium heavyweight limited-run garments shaped by community, heritage, and the streets of Manila.',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${inter.variable}`}>
      <body className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans antialiased selection:bg-amber-500 selection:text-black">
        <CartProvider>
          <BrandHeader />
          <main className="flex-1">{children}</main>
          <CartDrawer />
          <BrandFooter />
        </CartProvider>
      </body>
    </html>
  );
}
