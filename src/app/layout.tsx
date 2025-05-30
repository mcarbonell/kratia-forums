
"use client"; // RootLayout is a Client Component for i18n initialization

import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import SanctionCheckWrapper from '@/components/layout/SanctionCheckWrapper';

import i18n from 'i18next';
import { initReactI18next, I18nextProvider, useTranslation } from 'react-i18next';
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

function LayoutContent({ children }: { children: React.ReactNode }) {
  const { t, i18n: i18nInstance } = useTranslation();

  useEffect(() => {
    const detectedLng = typeof window !== 'undefined' 
      ? (localStorage.getItem('i18nextLng') || navigator.language.split('-')[0]) 
      : 'en';

    if (i18nInstance.isInitialized) {
      const currentLang = i18nInstance.language.split('-')[0];
      const targetLang = detectedLng.split('-')[0];

      if (currentLang !== targetLang && i18nInstance.languages.includes(targetLang)) {
        i18nInstance.changeLanguage(targetLang).catch(err => console.error("Error changing language:", err));
      } else if (!i18nInstance.languages.includes(targetLang) && currentLang !== 'en') {
        i18nInstance.changeLanguage('en').catch(err => console.error("Error changing language to fallback:", err));
      }
    }
  }, [i18nInstance]);

  return (
    <html lang={i18nInstance.language}>
      <head>
        <title>{t('layout.title')}</title>
        <meta name="description" content={t('layout.description')} />
        <link rel="icon" href="/favicon.ico" type="image/x-icon" sizes="16x16"/>
        {/* PWA Manifest Link */}
        <link rel="manifest" href="/manifest.json" />
        {/* Theme color for browser UI */}
        <meta name="theme-color" content="#3498db" />
        {/* Apple-specific PWA settings */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content={t('layout.title')} />
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
  );
}


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (!i18n.isInitialized) {
    // This can happen during server-side rendering pass or if init fails
    // You might want to return a basic loader or minimal HTML structure
    return (
      <html lang="en">
        <head>
            <title>Kratia Forums</title>
            <meta name="description" content="Forums with direct democracy for self-regulated communities." />
            <link rel="icon" href="/favicon.ico" type="image/x-icon" sizes="16x16"/>
        </head>
        <body className={`${GeistSans.variable} ${GeistMono.variable} antialiased flex flex-col min-h-screen`}>
          <div>Loading localization...</div>
        </body>
      </html>
    );
  }

  return (
    <I18nextProvider i18n={i18n}>
      <LayoutContent>{children}</LayoutContent>
    </I18nextProvider>
  );
}
