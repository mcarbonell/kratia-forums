
import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import SanctionCheckWrapper from '@/components/layout/SanctionCheckWrapper';
// No necesitamos appWithTranslation para el App Router de esta manera.
// La inicialización de i18next se manejará en los componentes cliente que usan useTranslation.

export const metadata: Metadata = {
  title: 'Kratia Forums',
  description: 'Forums with direct democracy for self-regulated communities.',
};

export default function RootLayout({
  children,
  params, // Next.js App Router pasará params.locale si la ruta está configurada para ello
}: Readonly<{
  children: React.ReactNode;
  params?: { locale?: string }; // Opcional por ahora, ya que no estamos usando [locale] en la ruta
}>) {
  // Aquí podríamos pasar params.locale a un ContextProvider si fuera necesario
  // o si la configuración de next-i18next lo requiriera para Server Components.
  // Por ahora, nos apoyaremos en la detección del lado del cliente de next-i18next.

  return (
    <html lang={params?.locale || 'en'}>
      <body className={`${GeistSans.variable} ${GeistMono.variable} antialiased flex flex-col min-h-screen`}>
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
