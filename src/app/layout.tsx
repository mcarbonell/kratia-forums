
"use client"; // RootLayout is a Client Component for i18n initialization

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

const resources = {
  en: { common: enCommonTranslations },
  es: { common: esCommonTranslations },
};

// Initialize i18next directly - run once
if (!i18n.isInitialized) {
  i18n
    .use(initReactI18next) // passes i18n down to react-i18next
    .init({
      resources,
      lng: 'en', // Default language, will be changed by useEffect if needed
      fallbackLng: 'en', // Fallback language
      supportedLngs: ['en', 'es'], // Supported languages
      defaultNS: 'common',
      fallbackNS: 'common',
      interpolation: {
        escapeValue: false, // react already safes from xss
      },
      react: {
        useSuspense: false, // Recommended for App Router to avoid issues
      },
      debug: process.env.NODE_ENV === 'development',
    });
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  useEffect(() => {
    // Language detection and setting logic
    const detectedLng = typeof window !== 'undefined' 
      ? (localStorage.getItem('i18nextLng') || navigator.language.split('-')[0]) 
      : 'en';

    if (i18n.isInitialized) {
      if (i18n.language !== detectedLng && i18n.languages.includes(detectedLng)) {
        i18n.changeLanguage(detectedLng).catch(err => console.error("Error changing language:", err));
      } else if (!i18n.languages.includes(detectedLng) && i18n.language !== 'en') {
        i18n.changeLanguage('en').catch(err => console.error("Error changing language to fallback:", err));
      }
    }
  }, []);

  if (!i18n.isInitialized) {
    return null; 
  }

  return (
    <I18nextProvider i18n={i18n}>
      <html lang={i18n.language}>
        <head>
            <title>Kratia Forums</title>
            <meta name="description" content="Forums with direct democracy for self-regulated communities." />
            <link rel="icon" href="/favicon.ico" type="image/x-icon" sizes="16x16"/>
            {/* PWA Manifest Link */}
            <link rel="manifest" href="/manifest.json" />
            {/* Theme color for browser UI */}
            <meta name="theme-color" content="#3498db" />
            {/* Apple-specific PWA settings */}
            <meta name="apple-mobile-web-app-capable" content="yes" />
            <meta name="apple-mobile-web-app-status-bar-style" content="default" />
            <meta name="apple-mobile-web-app-title" content="Kratia Forums" />
            {/* You can add Apple touch icons here if needed */}
            {/* e.g., <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" /> */}
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
