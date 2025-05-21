
"use client"; // Convert to Client Component

import type { Metadata } from 'next'; // Metadata is not used in client component layouts
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import SanctionCheckWrapper from '@/components/layout/SanctionCheckWrapper';

import i18n from 'i18next';
import { initReactI18next, I18nextProvider } from 'react-i18next';
import { useEffect } from 'react';

// Import JSON files directly
import enCommonTranslations from '../../public/locales/en/common.json';
import esCommonTranslations from '../../public/locales/es/common.json';

// Initialize i18next directly - run once
if (!i18n.isInitialized) {
  i18n
    .use(initReactI18next) // passes i18n down to react-i18next
    .init({
      resources: {
        en: {
          common: enCommonTranslations
        },
        es: {
          common: esCommonTranslations
        }
      },
      lng: 'en', // Default language
      fallbackLng: 'en', // Fallback language
      supportedLngs: ['en', 'es'], // Supported languages
      defaultNS: 'common',
      fallbackNS: 'common',
      interpolation: {
        escapeValue: false, // react already safes from xss
      },
      react: {
        useSuspense: false,
      },
    });
}

// Metadata should be in a <Head /> component or page.tsx for App Router
// For a client RootLayout, dynamic metadata is tricky. Static metadata is better.
// export const metadata: Metadata = {
//   title: 'Kratia Forums',
//   description: 'Forums with direct democracy for self-regulated communities.',
// };

export default function RootLayout({
  children,
  params, // params might not be directly useful here for i18n without path-based routing
}: Readonly<{
  children: React.ReactNode;
  params?: { locale?: string }; // This locale isn't used by i18next directly here
}>) {

  useEffect(() => {
    // For App Router, language detection often relies on browser settings or a language switcher
    // The params?.locale might not be automatically populated unless you have [locale] in your path
    const detectedLng = typeof window !== 'undefined' ? (localStorage.getItem('i18nextLng') || navigator.language.split('-')[0]) : 'en';
    if (i18n.isInitialized && i18n.language !== detectedLng && i18n.languages.includes(detectedLng)) {
      i18n.changeLanguage(detectedLng);
    } else if (i18n.isInitialized && !i18n.languages.includes(detectedLng) && i18n.language !== 'en') {
      // Fallback to 'en' if detectedLng is not supported
      i18n.changeLanguage('en');
    }
  }, []); // Run once on mount

  // Ensure i18n is initialized before rendering
  if (!i18n.isInitialized) {
    // You could render a loading state here, or null
    return null;
  }

  return (
    <I18nextProvider i18n={i18n}>
      <html lang={i18n.language}>
        <head>
            <title>Kratia Forums</title>
            <meta name="description" content="Forums with direct democracy for self-regulated communities." />
            <link rel="icon" href="/favicon.ico" type="image/x-icon" sizes="16x16"/>
        </head>
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
    </I18nextProvider>
  );
}
