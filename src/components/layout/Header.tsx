
"use client";

import Link from 'next/link';
import { Home, Users, Vote, MessageSquare as MessageSquareIcon, Settings, LogIn, LogOut, UserPlus, ShieldCheck, Menu, BadgeAlert, Bell, Languages, Mail } from 'lucide-react'; // Added Mail icon
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import UserAvatar from '@/components/user/UserAvatar';
import { useMockAuth, type MockUser, preparedMockAuthUsers } from '@/hooks/use-mock-auth';
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';

export default function Header() {
  const { user, loading, logout, switchToUser } = useMockAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const { t, i18n } = useTranslation('common');

  useEffect(() => {
    let unsubscribe: Unsubscribe | undefined;
    if (user && user.id !== 'visitor0' && user.id !== 'guest1') {
      const notificationsQuery = query(
        collection(db, "notifications"),
        where("recipientId", "==", user.id),
        where("isRead", "==", false)
      );
      unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
        setUnreadNotificationsCount(snapshot.size);
      }, (error) => {
        console.error("Error fetching unread notifications:", error);
        setUnreadNotificationsCount(0);
      });
    } else {
      setUnreadNotificationsCount(0);
    }
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user]);

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    if (typeof window !== 'undefined') {
      localStorage.setItem('i18nextLng', lng);
    }
    if (isMobile()) {
      setMobileMenuOpen(false);
    }
  };

  const navLinks = [
    { href: '/', labelKey: 'navHome', icon: <Home /> },
    { href: '/forums', labelKey: 'navForums', icon: <MessageSquareIcon /> }, // Renamed to avoid conflict
    { href: '/agora', labelKey: 'navAgora', icon: <Vote /> },
  ];

  const UserRoleSwitcher = () => (
    <div className="mt-4 p-2 border-t">
      <p className="text-sm font-semibold mb-2">{t('switchRoleDev')}</p>
      {preparedMockAuthUsers && Object.keys(preparedMockAuthUsers).map(userKey => {
        const userObject = preparedMockAuthUsers[userKey];
        if (!userObject) return null;
        const displayName = userObject.username || userKey;
        return (
            <Button key={userKey} variant="ghost" size="sm" className="w-full justify-start mb-1 text-xs h-7" onClick={() => { switchToUser(userKey); if(isMobile()) setMobileMenuOpen(false); }}>
             Switch to {displayName} ({userKey})
            </Button>
        );
    })}
    </div>
  );

  const isMobile = () => mobileMenuOpen;

  const renderNavLinks = (isMobileLink: boolean = false) => navLinks.map((link) => (
    <Button key={link.labelKey} variant="ghost" asChild className={isMobileLink ? "justify-start w-full text-base py-3" : ""}>
      <Link href={link.href} onClick={() => isMobileLink && setMobileMenuOpen(false)}>
        {link.icon}
        <span className={isMobileLink ? "ml-2" : "ml-1"}>{t(link.labelKey)}</span>
      </Link>
    </Button>
  ));

  const showDevTools = process.env.NODE_ENV === 'development';

  return (
    <header className="bg-card border-b sticky top-0 z-50">
      <div className="container mx-auto px-4 flex items-center justify-between h-16">
        <Link href="/" className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors">
          <ShieldCheck className="h-8 w-8" />
          <span className="text-2xl font-bold">{t('kratiaForumsTitle')}</span>
        </Link>

        <nav className="hidden md:flex items-center space-x-1">
          {renderNavLinks()}
        </nav>

        <div className="flex items-center space-x-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={t('languageSelectorLabel')}>
                <Languages className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t('languageSelectorLabel')}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => changeLanguage('en')} disabled={i18n.language === 'en'}>
                English
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => changeLanguage('es')} disabled={i18n.language === 'es'}>
                Español
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="hidden md:flex items-center space-x-1">
            {loading ? (
              <div className="h-8 w-24 bg-muted rounded animate-pulse"></div>
            ) : user && user.role !== 'visitor' ? (
              <>
                <Button variant="ghost" size="icon" asChild className="relative">
                  <Link href="/messages">
                    <Mail /> {/* Icon for messages */}
                    {/* TODO: Add unread messages count badge later */}
                    <span className="sr-only">{t('navMessages')}</span>
                  </Link>
                </Button>
                <Button variant="ghost" size="icon" asChild className="relative">
                  <Link href="/notifications">
                    <Bell />
                    {unreadNotificationsCount > 0 && (
                      <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                        {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                      </Badge>
                    )}
                    <span className="sr-only">{t('notifications')}</span>
                  </Link>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="p-1.5 rounded-full">
                      <UserAvatar user={user} size="md" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>{user.username} ({user.role})</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href={`/profile/${user.id}`}>{t('navMyProfile')}</Link>
                    </DropdownMenuItem>
                     <DropdownMenuItem asChild>
                      <Link href="/messages">
                        <Mail className="mr-2 h-4 w-4" />{t('navMessages')}
                        {/* TODO: Add unread messages count badge here too */}
                      </Link>
                     </DropdownMenuItem>
                     <DropdownMenuItem asChild>
                      <Link href="/notifications">
                        <Bell className="mr-2 h-4 w-4" />
                        {t('navNotifications')}
                        {unreadNotificationsCount > 0 && (
                          <Badge variant="destructive" className="ml-auto">{unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}</Badge>
                        )}
                      </Link>
                     </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/profile/edit"><Settings className="mr-2 h-4 w-4" />{t('navSettings')}</Link>
                    </DropdownMenuItem>
                    {(user.role === 'admin' || user.role === 'founder') && (
                      <DropdownMenuItem asChild>
                        <Link href="/admin"><BadgeAlert className="mr-2 h-4 w-4 text-primary"/>{t('navAdminPanel')}</Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={logout}>
                      <LogOut className="mr-2 h-4 w-4" />
                      {t('navLogout')}
                    </DropdownMenuItem>
                    {showDevTools && (
                      <>
                        <DropdownMenuSeparator />
                          {preparedMockAuthUsers && Object.keys(preparedMockAuthUsers).length > 0 && (
                              <div className="p-2">
                                  <p className="text-xs text-muted-foreground mb-1">{t('switchRoleDev')}</p>
                                  {Object.keys(preparedMockAuthUsers).map(userKey => {
                                      const userObject = preparedMockAuthUsers[userKey];
                                      if (!userObject) return null;
                                      const displayName = userObject.username || userKey;
                                      return (
                                          <Button key={userKey} variant="ghost" size="sm" className="w-full justify-start text-xs h-7" onClick={() => switchToUser(userKey)}>
                                          Switch to {displayName} ({userKey})
                                          </Button>
                                      );
                                  })}
                              </div>
                          )}
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link href="/auth/login">
                    <LogIn className="mr-2 h-4 w-4" /> {t('navLogin')}
                  </Link>
                </Button>
                <Button asChild>
                  <Link href="/auth/signup">
                    <UserPlus className="mr-2 h-4 w-4" /> {t('navSignUp')}
                  </Link>
                </Button>
              </>
            )}
          </div>

          <div className="md:hidden"> {/* Mobile menu trigger and language switcher */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu />
                  <span className="sr-only">Open menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-full max-w-xs p-0 flex flex-col">
                <div className="p-4 border-b">
                  <Link href="/" className="flex items-center gap-2 text-primary" onClick={() => setMobileMenuOpen(false)}>
                    <ShieldCheck className="h-7 w-7" />
                    <span className="text-xl font-bold">{t('kratiaForumsTitle')}</span>
                  </Link>
                </div>
                <nav className="flex flex-col p-4 space-y-1">
                  {renderNavLinks(true)}
                   {user && user.role !== 'visitor' && user.role !== 'guest' && (
                     <>
                      <Button variant="ghost" asChild className="justify-start w-full text-base py-3 relative">
                        <Link href="/messages" onClick={() => setMobileMenuOpen(false)}>
                          <Mail />
                          <span className="ml-2">{t('navMessages')}</span>
                          {/* TODO: Add unread messages count badge */}
                        </Link>
                      </Button>
                      <Button variant="ghost" asChild className="justify-start w-full text-base py-3 relative">
                        <Link href="/notifications" onClick={() => setMobileMenuOpen(false)}>
                          <Bell />
                          <span className="ml-2">{t('navNotifications')}</span>
                          {unreadNotificationsCount > 0 && (
                            <Badge variant="destructive" className="absolute left-8 top-1.5 h-5 w-5 p-0 flex items-center justify-center text-xs">
                              {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                            </Badge>
                          )}
                        </Link>
                      </Button>
                     </>
                   )}
                  <div className="pt-2">
                    <p className="px-2 text-sm font-semibold text-muted-foreground">{t('languageSelectorLabel')}</p>
                    <Button variant="ghost" onClick={() => changeLanguage('en')} disabled={i18n.language === 'en'} className="w-full justify-start text-base py-3">
                      English
                    </Button>
                    <Button variant="ghost" onClick={() => changeLanguage('es')} disabled={i18n.language === 'es'} className="w-full justify-start text-base py-3">
                      Español
                    </Button>
                  </div>
                </nav>

                <div className="p-4 mt-auto border-t">
                  {loading ? (
                    <div className="h-10 bg-muted rounded animate-pulse w-full"></div>
                  ) : user && user.role !== 'visitor' ? (
                    <div className="flex flex-col space-y-2">
                       <div className="flex items-center space-x-2 mb-2">
                          <UserAvatar user={user} size="md" />
                          <span>{user.username} ({user.role})</span>
                        </div>
                      <Button variant="outline" asChild className="w-full" onClick={() => setMobileMenuOpen(false)}>
                        <Link href={`/profile/${user.id}`}>{t('navMyProfile')}</Link>
                      </Button>
                       <Button variant="outline" asChild className="w-full" onClick={() => setMobileMenuOpen(false)}>
                          <Link href="/messages"> <Mail className="mr-2 h-4 w-4" />{t('navMessages')}</Link>
                       </Button>
                       <Button variant="outline" asChild className="w-full" onClick={() => setMobileMenuOpen(false)}>
                          <Link href="/notifications">
                            <Bell className="mr-2 h-4 w-4" />
                            {t('navNotifications')}
                            {unreadNotificationsCount > 0 && (
                              <Badge variant="destructive" className="ml-auto">{unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}</Badge>
                            )}
                          </Link>
                       </Button>
                      <Button variant="outline" asChild className="w-full" onClick={() => setMobileMenuOpen(false)}>
                        <Link href="/profile/edit"><Settings className="mr-2 h-4 w-4" />{t('navSettings')}</Link>
                      </Button>
                       {(user.role === 'admin' || user.role === 'founder') && (
                          <Button variant="outline" asChild className="w-full" onClick={() => setMobileMenuOpen(false)}>
                              <Link href="/admin"><BadgeAlert className="mr-2 h-4 w-4 text-primary"/>{t('navAdminPanel')}</Link>
                          </Button>
                      )}
                      <Button variant="destructive" onClick={() => { logout(); setMobileMenuOpen(false); }} className="w-full">
                        <LogOut className="mr-2 h-4 w-4" /> {t('navLogout')}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col space-y-2">
                      <Button variant="outline" asChild className="w-full" onClick={() => setMobileMenuOpen(false)}>
                        <Link href="/auth/login">
                          <LogIn className="mr-2 h-4 w-4" /> {t('navLogin')}
                        </Link>
                      </Button>
                      <Button asChild className="w-full" onClick={() => setMobileMenuOpen(false)}>
                        <Link href="/auth/signup">
                          <UserPlus className="mr-2 h-4 w-4" /> {t('navSignUp')}
                        </Link>
                      </Button>
                    </div>
                  )}
                </div>
                {showDevTools && (
                  <div className="overflow-y-auto">
                    <UserRoleSwitcher />
                  </div>
                )}
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}

    