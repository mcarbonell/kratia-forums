
"use client"; 

import Link from 'next/link';
import { FileText } from 'lucide-react';
import { useTranslation } from 'next-i18next';

export default function Footer() {
  const { t } = useTranslation('common');

  return (
    <footer className="bg-muted/50 border-t">
      <div className="container mx-auto px-4 py-8 text-center text-muted-foreground">
        <p className="text-sm">
          &copy; {new Date().getFullYear()} {t('kratiaForumsTitle')}. {t('footerRights')}
        </p>
        <div className="mt-2">
          <Link href="/constitution" className="text-sm text-primary hover:text-primary/80 transition-colors inline-flex items-center">
            <FileText className="mr-1 h-4 w-4" />
            {t('footerConstitutionLink')}
          </Link>
        </div>
      </div>
    </footer>
  );
}
