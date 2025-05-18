
"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMockAuth } from '@/hooks/use-mock-auth';
import type { User as KratiaUser, Forum, ForumCategory } from '@/lib/types';
import { db } from '@/lib/firebase';
import { collection, getDocs, orderBy, query, deleteDoc, doc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from '@/components/ui/button';
import { Loader2, ShieldAlert, Users, LayoutList, ExternalLink, BadgeAlert, PlusCircle, FolderKanban, Trash2 } from 'lucide-react';
import UserAvatar from '@/components/user/UserAvatar';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

export default function AdminPage() {
  const { user: loggedInUser, loading: authLoading } = useMockAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<KratiaUser[]>([]);
  const [forums, setForums] = useState<Forum[]>([]);
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forumToDelete, setForumToDelete] = useState<Forum | null>(null);

  const isAdminOrFounder = loggedInUser?.role === 'admin' || loggedInUser?.role === 'founder';

  const fetchData = async () => {
    if (!isAdminOrFounder) {
      setIsLoadingData(false);
      return;
    }
    setIsLoadingData(true);
    setError(null);
    try {
      const usersQuery = query(collection(db, "users"), orderBy("username", "asc"));
      const usersSnapshot = await getDocs(usersQuery);
      setUsers(usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as KratiaUser)));

      const forumsQuery = query(collection(db, "forums"), orderBy("name", "asc"));
      const forumsSnapshot = await getDocs(forumsQuery);
      setForums(forumsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Forum)));
      
      const categoriesQuery = query(collection(db, "categories"), orderBy("name", "asc"));
      const categoriesSnapshot = await getDocs(categoriesQuery);
      setCategories(categoriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ForumCategory)));
    } catch (err) {
      console.error("Error fetching admin data:", err);
      setError("Failed to load admin data. Please try again.");
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [loggedInUser, isAdminOrFounder]); // Removed authLoading from deps to prevent double fetch on initial load

  const handleDeleteForum = async () => {
    if (!forumToDelete) return;
    try {
      await deleteDoc(doc(db, "forums", forumToDelete.id));
      toast({
        title: "Forum Deleted",
        description: `Forum "${forumToDelete.name}" has been successfully deleted.`,
      });
      setForums(forums.filter(forum => forum.id !== forumToDelete.id)); // Update local state
      setForumToDelete(null); // Close dialog
    } catch (err) {
      console.error("Error deleting forum:", err);
      toast({
        title: "Error Deleting Forum",
        description: "Could not delete the forum. Please try again.",
        variant: "destructive",
      });
      setForumToDelete(null);
    }
  };

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
  
  if (isLoadingData && users.length === 0 && forums.length === 0 && categories.length === 0) { // Show main loader only if truly nothing is loaded
     return (
      <div className="flex justify-center items-center min-h-[calc(100vh-20rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">Loading users, forums, and categories...</p>
      </div>
    );
  }

  if (error && users.length === 0 && forums.length === 0 && categories.length === 0) {
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
        <CardDescription>Manage users, forums, categories, and other settings for Kratia Forums.</CardDescription>
      </CardHeader>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-xl">
            <Users className="mr-2 h-6 w-6" /> User Management ({users.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingData && users.length === 0 ? (
             <div className="flex justify-center items-center py-10"> <Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : users.length > 0 ? (
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
            <FolderKanban className="mr-2 h-6 w-6" /> Category Management ({categories.length})
          </CardTitle>
          <Button asChild>
            <Link href="/admin/categories/create">
              <PlusCircle className="mr-2 h-5 w-5" /> Create New Category
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
         {isLoadingData && categories.length === 0 ? (
             <div className="flex justify-center items-center py-10"> <Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : categories.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="max-w-md truncate">Description</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell className="font-medium">{category.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-md truncate" title={category.description}>{category.description || 'N/A'}</TableCell>
                    <TableCell className="text-center">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/admin/categories/edit/${category.id}`}>Edit</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground">No categories found. You can create one to start organizing forums.</p>
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
          {isLoadingData && forums.length === 0 ? (
             <div className="flex justify-center items-center py-10"> <Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : forums.length > 0 ? (
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
                    <TableCell className="text-center space-x-2">
                        <Button asChild variant="outline" size="sm">
                            <Link href={`/admin/forums/edit/${forum.id}`}>Edit</Link>
                        </Button>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm" onClick={() => setForumToDelete(forum)}>
                            <Trash2 className="h-4 w-4"/>
                          </Button>
                        </AlertDialogTrigger>
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
      
      <AlertDialog open={!!forumToDelete} onOpenChange={(open) => !open && setForumToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the forum
              <span className="font-semibold"> "{forumToDelete?.name}"</span>.
              Associated threads and posts will <span className="font-bold text-destructive">NOT</span> be deleted and will become orphaned.
              Consider archiving or re-categorizing threads first if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setForumToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteForum} className="bg-destructive hover:bg-destructive/90">
              Yes, delete forum
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
