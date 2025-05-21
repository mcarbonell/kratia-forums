
"use client";

import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { UserPlus, LogIn, Loader2 } from 'lucide-react';
import { useMockAuth } from '@/hooks/use-mock-auth';
import { useTranslation } from 'react-i18next'; // Using from react-i18next

export default function HomePage() {
  const { user, loading: authLoading } = useMockAuth();
  const { t } = useTranslation('common'); // Use default namespace 'common'

  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-20rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      <h1>{t('welcomeTitle', { forumName: "Kratia Forums" })}</h1>
      <p>{t('welcomeMessage')}</p>

      {!authLoading && (!user || user.role === 'visitor') && (
         <div className="mt-6 flex flex-col sm:flex-row justify-center items-center gap-3">
            <Button size="md" asChild>
              <Link href="/auth/signup">
                <UserPlus className="mr-2 h-4 w-4" /> {t('joinCommunityButton')}
              </Link>
            </Button>
            <Button size="md" variant="outline" asChild>
              <Link href="/auth/login">
                <LogIn className="mr-2 h-4 w-4" /> {t('memberLoginButton')}
              </Link>
            </Button>
          </div>
      )}
      
      {/* This section is to confirm rendering without complex logic */}
      <div className="bg-sky-100 p-4 rounded-md border border-sky-300 mt-8">
        <h2 className="text-xl font-semibold text-sky-700">Homepage Content Test Area</h2>
        <p className="text-sky-600">If you see this text, the HomePage component itself is rendering.</p>
        <p className="text-sky-600">Current translated welcome title (should be above): "{t('welcomeTitle', { forumName: "Kratia Forums" })}"</p>
        <p className="text-amber-600">Current user: {user ? user.username : 'Visitor'}</p>
      </div>

      {/* {process.env.NODE_ENV === 'development' && (
        <div className="mt-8 p-4 border border-dashed border-red-500 bg-red-50">
            <h2 className="text-lg font-semibold text-red-700">{t('devToolsTitle')}</h2>
            <Button onClick={handleSeedDatabase} disabled={isSeeding || seedCompleted}>
                {isSeeding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {seedCompleted ? t('seedCompletedButton') : t('seedDatabaseButton')}
            </Button>
            {isSeeding && <p className="text-sm text-red-600 mt-2">{t('seedInProgress')}</p>}
            {seedCompleted && !isSeeding && <p className="text-sm text-green-600 mt-2">{t('seedSuccessDescRefresh')}</p>}
        </div>
      )} */}
    </div>
  );
}
