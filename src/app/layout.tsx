
import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import SanctionCheckWrapper from '@/components/layout/SanctionCheckWrapper';
import { useMockAuth } from '@/hooks/use-mock-auth'; // Import useMockAuth

// This component is needed to use the hook inside the Server Component RootLayout
// and pass the key to Header.
function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = useMockAuth(); // Get user from the hook

  return (
    <>
      <Header key={user?.id || 'logged-out'} /> {/* Add key here */}
      <main className="flex-grow container mx-auto px-4 py-8">
        <SanctionCheckWrapper>
          {children}
        </SanctionCheckWrapper>
      </main>
      <Footer />
      <Toaster />
    </>
  );
}

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
        {/* We need a client component wrapper to use useMockAuth for the Header key */}
        {/* However, useMockAuth uses localStorage which is client-side only. */}
        {/* RootLayout is a Server Component. We cannot directly use client-side hooks here. */}
        {/* Let's rethink the Header update strategy if this direct keying doesn't work as expected */}
        {/* Forcing a key on Header like this might not be feasible if useMockAuth can't be called here directly. */}
        
        {/* A simpler approach for the Header to re-render is to ensure its internal state or props change. */}
        {/* The Header already calls useMockAuth() internally, so it should re-render. */}
        {/* The issue might be more subtle. Let's try a direct approach. */}

        {/* The key strategy on the Header will be problematic because RootLayout is a Server Component. */}
        {/* Let's revert to the original structure here and investigate useMockAuth directly. */}
        <Header />
        <main className="flex-grow container mx-auto px-4 py-8">
          <SanctionCheckWrapper>
            {children}
          </SanctionCheckWrapper>
        </main>
        <Footer />
        <Toaster />
      </body>
    </html>
  );
}
