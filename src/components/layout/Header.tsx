
"use client";

import Link from 'next/link';
import { Home, Users, Vote, MessageSquare, Settings, LogIn, LogOut, UserPlus, ShieldCheck, Menu, BadgeAlert, Bell } from 'lucide-react'; // Added Bell
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import UserAvatar from '@/components/user/UserAvatar';
import { useMockAuth, type MockUser } from '@/hooks/use-mock-auth'; 
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState, useEffect } from 'react'; // Added useEffect
import { db } from '@/lib/firebase'; // Added db
import { collection, query, where, onSnapshot, type Unsubscribe } from 'firebase/firestore'; // Added Firestore imports
import { Badge } from '@/components/ui/badge'; // Added Badge

export default function Header() {
  const { user, loading, logout, switchToUser, mockAuthUsers } = useMockAuth(); 
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

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


  const navLinks = [
    { href: '/', label: 'Home', icon: <Home /> },
    { href: '/forums', label: 'Forums', icon: <MessageSquare /> },
    { href: '/agora', label: 'Agora', icon: <Vote /> },
  ];

  const UserRoleSwitcher = () => (
    <div className="mt-4 p-2 border-t">
      <p className="text-sm font-semibold mb-2">Switch User Role (Dev):</p>
      {mockAuthUsers && Object.keys(mockAuthUsers).map(userKey => {
        const userObject = mockAuthUsers[userKey as keyof typeof mockAuthUsers] as MockUser | undefined;
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
    <Button key={link.label} variant="ghost" asChild className={isMobileLink ? "justify-start w-full text-base py-3" : ""}>
      <Link href={link.href} onClick={() => isMobileLink && setMobileMenuOpen(false)}>
        {link.icon}
        <span className={isMobileLink ? "ml-2" : "ml-1"}>{link.label}</span>
      </Link>
    </Button>
  ));

  return (
    <header className="bg-card border-b sticky top-0 z-50">
      <div className="container mx-auto px-4 flex items-center justify-between h-16">
        <Link href="/" className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors">
          <ShieldCheck className="h-8 w-8" />
          <span className="text-2xl font-bold">Kratia</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-2">
          {renderNavLinks()}
        </nav>

        <div className="hidden md:flex items-center space-x-2">
          {loading ? (
            <div className="h-8 w-24 bg-muted rounded animate-pulse"></div>
          ) : user && user.role !== 'visitor' ? (
            <>
              <Button variant="ghost" size="icon" asChild className="relative">
                 {/* TODO: Link to notifications page later */}
                <Link href="/notifications">
                  <Bell />
                  {unreadNotificationsCount > 0 && (
                    <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                      {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                    </Badge>
                  )}
                  <span className="sr-only">Notifications</span>
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
                    <Link href={`/profile/${user.id}`}>My Profile</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/profile/edit">Settings</Link>
                  </DropdownMenuItem>
                  {(user.role === 'admin' || user.role === 'founder') && (
                    <DropdownMenuItem asChild>
                      <Link href="/admin"><BadgeAlert className="mr-2 h-4 w-4 text-primary"/>Admin Panel</Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                   <div className="p-2"> 
                      <p className="text-xs text-muted-foreground mb-1">Switch Role (Dev):</p>
                      {mockAuthUsers && Object.keys(mockAuthUsers).map(userKey => {
                          const userObject = mockAuthUsers[userKey as keyof typeof mockAuthUsers] as MockUser | undefined;
                          if (!userObject) return null; 
                          const displayName = userObject.username || userKey;
                          return (
                              <Button key={userKey} variant="ghost" size="sm" className="w-full justify-start text-xs h-7" onClick={() => switchToUser(userKey)}>
                               {displayName} ({userKey})
                              </Button>
                          );
                      })}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link href="/auth/login">
                  <LogIn className="mr-2 h-4 w-4" /> Login
                </Link>
              </Button>
              <Button asChild>
                <Link href="/auth/signup">
                  <UserPlus className="mr-2 h-4 w-4" /> Sign Up
                </Link>
              </Button>
            </>
          )}
        </div>

        {/* Mobile Navigation Trigger */}
        <div className="md:hidden">
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
                  <span className="text-xl font-bold">Kratia</span>
                </Link>
              </div>
              <nav className="flex flex-col p-4 space-y-2">
                {renderNavLinks(true)}
                 {user && user.role !== 'visitor' && (
                   <Button variant="ghost" asChild className="justify-start w-full text-base py-3 relative">
                     {/* TODO: Link to notifications page later */}
                    <Link href="/notifications" onClick={() => setMobileMenuOpen(false)}>
                      <Bell />
                      <span className="ml-2">Notifications</span>
                      {unreadNotificationsCount > 0 && (
                        <Badge variant="destructive" className="absolute left-8 top-1.5 h-5 w-5 p-0 flex items-center justify-center text-xs">
                           {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                        </Badge>
                      )}
                    </Link>
                  </Button>
                )}
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
                      <Link href={`/profile/${user.id}`}>My Profile</Link>
                    </Button>
                    <Button variant="outline" asChild className="w-full" onClick={() => setMobileMenuOpen(false)}>
                      <Link href="/profile/edit">Settings</Link>
                    </Button>
                     {(user.role === 'admin' || user.role === 'founder') && (
                        <Button variant="outline" asChild className="w-full" onClick={() => setMobileMenuOpen(false)}>
                            <Link href="/admin"><BadgeAlert className="mr-2 h-4 w-4 text-primary"/>Admin Panel</Link>
                        </Button>
                    )}
                    <Button variant="destructive" onClick={() => { logout(); setMobileMenuOpen(false); }} className="w-full">
                      <LogOut className="mr-2 h-4 w-4" /> Logout
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col space-y-2">
                    <Button variant="outline" asChild className="w-full" onClick={() => setMobileMenuOpen(false)}>
                      <Link href="/auth/login">
                        <LogIn className="mr-2 h-4 w-4" /> Login
                      </Link>
                    </Button>
                    <Button asChild className="w-full" onClick={() => setMobileMenuOpen(false)}>
                      <Link href="/auth/signup">
                        <UserPlus className="mr-2 h-4 w-4" /> Sign Up
                      </Link>
                    </Button>
                  </div>
                )}
              </div>
              <div className="overflow-y-auto"> 
                <UserRoleSwitcher />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
