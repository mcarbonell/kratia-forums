
"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMockAuth } from '@/hooks/use-mock-auth';
import type { User as KratiaUser, Forum } from '@/lib/types';
import { db } from '@/lib/firebase';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Loader2, ShieldAlert, Users, LayoutList, ExternalLink, BadgeAlert, PlusCircle } from 'lucide-react';
import UserAvatar from '@/components/user/UserAvatar';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';

export default function AdminPage() {
  const { user: loggedInUser, loading: authLoading } = useMockAuth();
  const [users, setUsers] = useState<KratiaUser[]>([]);
  const [forums, setForums] = useState<Forum[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdminOrFounder = loggedInUser?.role === 'admin' || loggedInUser?.role === 'founder';

  useEffect(() => {
    if (authLoading || !isAdminOrFounder) {
      setIsLoadingData(false);
      return;
    }

    const fetchData = async () => {
      setIsLoadingData(true);
      setError(null);
      try {
        // Fetch users
        const usersQuery = query(collection(db, "users"), orderBy("username", "asc"));
        const usersSnapshot = await getDocs(usersQuery);
        const fetchedUsers = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as KratiaUser));
        setUsers(fetchedUsers);

        // Fetch forums
        const forumsQuery = query(collection(db, "forums"), orderBy("name", "asc"));
        const forumsSnapshot = await getDocs(forumsQuery);
        const fetchedForums = forumsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Forum));
        setForums(fetchedForums);

      } catch (err) {
        console.error("Error fetching admin data:", err);
        setError("Failed to load admin data. Please try again.");
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchData();
  }, [loggedInUser, authLoading, isAdminOrFounder]);

  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-20rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">Loading admin panel...</p>
      </div>
    );
  }

  if (!isAdminOrFounder) {
    return (
      <Alert variant="destructive" className="max-w-lg mx-auto">
        <ShieldAlert className="h-5 w-5" />
        <AlertTitle>Access Denied</AlertTitle>
        <AlertDescription>
          You do not have permission to view the admin panel. This area is restricted to administrators and founders.
        </AlertDescription>
        <Button asChild className="mt-4">
          <Link href="/">Go to Homepage</Link>
        </Button>
      </Alert>
    );
  }
  
  if (isLoadingData) {
     return (
      <div className="flex justify-center items-center min-h-[calc(100vh-20rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">Loading users and forums...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <BadgeAlert className="h-5 w-5" />
        <AlertTitle>Error Loading Data</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const formatRegistrationDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  };


  return (
    <div className="space-y-8">
      <CardHeader className="px-0">
        <CardTitle className="text-3xl font-bold flex items-center">
          <ShieldAlert className="mr-3 h-8 w-8 text-primary" />
          Admin Panel
        </CardTitle>
        <CardDescription>Manage users, forums, and other settings for Kratia Forums.</CardDescription>
      </CardHeader>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-xl">
            <Users className="mr-2 h-6 w-6" /> User Management ({users.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {users.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Avatar</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Karma</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <UserAvatar user={user} size="sm" />
                    </TableCell>
                    <TableCell className="font-medium">
                        <Link href={`/profile/${user.id}`} className="hover:underline text-primary">
                            {user.username} <ExternalLink className="inline-block h-3 w-3 ml-1"/>
                        </Link>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell><Badge variant={user.role === 'admin' || user.role === 'founder' ? 'default' : 'secondary'}>{user.role}</Badge></TableCell>
                    <TableCell className="text-right">{user.karma || 0}</TableCell>
                    <TableCell>{formatRegistrationDate(user.registrationDate)}</TableCell>
                    <TableCell className="text-center">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/admin/users/edit/${user.id}`}>Edit</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground">No users found.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center text-xl">
            <LayoutList className="mr-2 h-6 w-6" /> Forum Management ({forums.length})
          </CardTitle>
          <Button asChild>
            <Link href="/admin/forums/create">
              <PlusCircle className="mr-2 h-5 w-5" /> Create New Forum
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {forums.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="max-w-xs truncate">Description</TableHead>
                  <TableHead>Category ID</TableHead>
                  <TableHead className="text-right">Threads</TableHead>
                  <TableHead className="text-right">Posts</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {forums.map((forum) => (
                  <TableRow key={forum.id}>
                    <TableCell className="font-medium">
                         <Link href={`/forums/${forum.id}`} className="hover:underline text-primary">
                            {forum.name} <ExternalLink className="inline-block h-3 w-3 ml-1"/>
                         </Link>
                         {forum.isAgora && <Badge variant="outline" className="ml-2 border-blue-500 text-blue-600">Agora</Badge>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate" title={forum.description}>{forum.description}</TableCell>
                    <TableCell>{forum.categoryId || 'N/A'}</TableCell>
                    <TableCell className="text-right">{forum.threadCount || 0}</TableCell>
                    <TableCell className="text-right">{forum.postCount || 0}</TableCell>
                    <TableCell className="text-center">
                        <Button asChild variant="outline" size="sm">
                            <Link href={`/admin/forums/edit/${forum.id}`}>Edit</Link>
                        </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground">No forums found.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
