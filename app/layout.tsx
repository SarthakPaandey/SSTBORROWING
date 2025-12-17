import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';
import { Toaster } from '@/components/ui/Toaster';
import TwemojiScript from '@/components/providers/TwemojiScript';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SST Booking System',
  description: 'Unified booking system for SST facilities, rooms, and equipment',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <TwemojiScript />
        <AuthProvider>{children}</AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
