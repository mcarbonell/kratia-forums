"use client";

import Link from 'next/link';
import { Home, Users, Vote, MessageSquare, Settings, LogIn, LogOut, UserPlus, ShieldCheck, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import UserAvatar from '@/components/user/UserAvatar';
import { useMockAuth, UserRole } from '@/hooks/use-mock-auth'; // Updated import
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from 'react';

export default function Header() {
  const { user, loading, logout, switchToUser } = useMockAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: '/', label: 'Home', icon: <Home /> },
    { href: '/forums', label: 'Forums', icon: <MessageSquare /> },
    { href: '/agora', label: 'Agora', icon: <Vote /> },
  ];

  const UserRoleSwitcher = () => (
    <div className="mt-4 p-2 border-t">
      <p className="text-sm font-semibold mb-2">Switch User Role (Dev):</p>
      {(['visitor', 'guest', 'user', 'normal_user', 'admin', 'founder'] as UserRole[]).map(role => (
         <Button key={role} variant="ghost" size="sm" className="w-full justify-start mb-1" onClick={() => { switchToUser(role); setMobileMenuOpen(false); }}>
          Switch to {role.replace('_', ' ')}
        </Button>
      ))}
    </div>
  );

  const renderNavLinks = (isMobile: boolean = false) => navLinks.map((link) => (
    <Button key={link.label} variant="ghost" asChild className={isMobile ? "justify-start w-full text-base py-3" : ""}>
      <Link href={link.href} onClick={() => isMobile && setMobileMenuOpen(false)}>
        {link.icon}
        <span className={isMobile ? "ml-2" : "ml-1"}>{link.label}</span>
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="p-1.5 rounded-full">
                  <UserAvatar user={user} size="md" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{user.username}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={`/profile/${user.id}`}>My Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/profile/edit">Settings</Link>
                </DropdownMenuItem>
                {user.role === 'admin' || user.role === 'founder' ? (
                  <DropdownMenuItem asChild>
                    <Link href="/admin">Admin Panel</Link>
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                 <div className="p-2">
                    <p className="text-xs text-muted-foreground mb-1">Switch Role (Dev):</p>
                    {(['visitor', 'guest', 'user', 'normal_user', 'admin', 'founder'] as UserRole[]).map(role => (
                        <Button key={role} variant="ghost" size="sm" className="w-full justify-start text-xs h-7" onClick={() => switchToUser(role)}>
                         {role.replace('_', ' ')}
                        </Button>
                    ))}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
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
            <SheetContent side="left" className="w-full max-w-xs p-0">
              <div className="p-4 border-b">
                <Link href="/" className="flex items-center gap-2 text-primary" onClick={() => setMobileMenuOpen(false)}>
                  <ShieldCheck className="h-7 w-7" />
                  <span className="text-xl font-bold">Kratia</span>
                </Link>
              </div>
              <nav className="flex flex-col p-4 space-y-2">
                {renderNavLinks(true)}
              </nav>
              <div className="p-4 mt-auto border-t">
                {loading ? (
                  <div className="h-10 bg-muted rounded animate-pulse w-full"></div>
                ) : user && user.role !== 'visitor' ? (
                  <div className="flex flex-col space-y-2">
                     <div className="flex items-center space-x-2 mb-2">
                        <UserAvatar user={user} size="md" />
                        <span>{user.username}</span>
                      </div>
                    <Button variant="outline" asChild className="w-full" onClick={() => setMobileMenuOpen(false)}>
                      <Link href={`/profile/${user.id}`}>My Profile</Link>
                    </Button>
                    <Button variant="outline" asChild className="w-full" onClick={() => setMobileMenuOpen(false)}>
                      <Link href="/profile/edit">Settings</Link>
                    </Button>
                     {(user.role === 'admin' || user.role === 'founder') && (
                        <Button variant="outline" asChild className="w-full" onClick={() => setMobileMenuOpen(false)}>
                            <Link href="/admin">Admin Panel</Link>
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
              <UserRoleSwitcher />
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}