
import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import SanctionCheckWrapper from '@/components/layout/SanctionCheckWrapper'; // Import the wrapper

export const metadata: Metadata = {
  title: 'Kratia Forums',
  description: 'Forums with direct democracy for self-regulated communities.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${GeistSans.variable} ${GeistMono.variable} antialiased flex flex-col min-h-screen`}>
        <Header />
        <main className="flex-grow container mx-auto px-4 py-8">
          <SanctionCheckWrapper> {/* Wrap children with SanctionCheckWrapper */}
            {children}
          </SanctionCheckWrapper>
        </main>
        <Footer />
        <Toaster />
      </body>
    </html>
  );
}
