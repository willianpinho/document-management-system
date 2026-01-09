import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

import { Providers } from './providers';
import '@dms/ui/styles';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Document Management System',
  description: 'Cloud-based Document Management System with AI-powered processing',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
