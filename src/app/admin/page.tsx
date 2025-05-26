
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from '@/components/ui/button';
import { Loader2, ShieldAlert, Users, LayoutList, ExternalLink, BadgeAlert, PlusCircle, FolderKanban, Trash2 } from 'lucide-react';
import UserAvatar from '@/components/user/UserAvatar';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

export default function AdminPage() {
  const { user: loggedInUser, loading: authLoading } = useMockAuth();
  const { toast } = useToast();
  const { t } = useTranslation('common');
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
      setError(t('adminPanel.error.fetchData'));
    } finally {
      setIsLoadingData(false);
    }
  };
  
  useEffect(() => {
    if (isAdminOrFounder) {
        fetchData();
    } else if (!authLoading) {
        setIsLoadingData(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedInUser, isAdminOrFounder, t]);

  const handleDeleteForum = async () => {
    if (!forumToDelete) return;
    try {
      await deleteDoc(doc(db, "forums", forumToDelete.id));
      toast({
        title: t('adminPanel.toast.forumDeletedTitle'),
        description: t('adminPanel.toast.forumDeletedDesc', { forumName: forumToDelete.name }),
      });
      setForums(forums.filter(forum => forum.id !== forumToDelete.id)); 
      setForumToDelete(null); 
    } catch (err) {
      console.error("Error deleting forum:", err);
      toast({
        title: t('adminPanel.toast.errorDeletingForumTitle'),
        description: t('adminPanel.toast.errorDeletingForumDesc'),
        variant: "destructive",
      });
      setForumToDelete(null);
    }
  };

  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-20rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">{t('adminPanel.loadingAdminPanel')}</p>
      </div>
    );
  }

  if (!isAdminOrFounder) {
    return (
      <Alert variant="destructive" className="max-w-lg mx-auto">
        <ShieldAlert className="h-5 w-5" />
        <AlertTitle>{t('adminPanel.accessDeniedTitle')}</AlertTitle>
        <AlertDescription>{t('adminPanel.accessDeniedDesc')}</AlertDescription>
        <Button asChild className="mt-4">
          <Link href="/">{t('adminPanel.goToHomepageButton')}</Link>
        </Button>
      </Alert>
    );
  }
  
  if (isLoadingData && users.length === 0 && forums.length === 0 && categories.length === 0) {
     return (
      <div className="flex justify-center items-center min-h-[calc(100vh-20rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">{t('adminPanel.loadingData')}</p>
      </div>
    );
  }

  if (error && users.length === 0 && forums.length === 0 && categories.length === 0) {
    return (
      <Alert variant="destructive">
        <BadgeAlert className="h-5 w-5" />
        <AlertTitle>{t('adminPanel.errorLoadingDataTitle')}</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const formatRegistrationDate = (dateString?: string) => {
    if (!dateString) return t('adminPanel.notAvailable');
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  };


  return (
    <div className="space-y-8">
      <CardHeader className="px-0">
        <CardTitle className="text-3xl font-bold flex items-center">
          <ShieldAlert className="mr-3 h-8 w-8 text-primary" />
          {t('adminPanel.title')}
        </CardTitle>
        <CardDescription>{t('adminPanel.description')}</CardDescription>
      </CardHeader>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-xl">
            <Users className="mr-2 h-6 w-6" /> {t('adminPanel.userManagement.title')} ({users.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingData && users.length === 0 ? (
             <div className="flex justify-center items-center py-10"> <Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : users.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">{t('adminPanel.userManagement.table.avatar')}</TableHead>
                  <TableHead>{t('adminPanel.userManagement.table.username')}</TableHead>
                  <TableHead>{t('adminPanel.userManagement.table.email')}</TableHead>
                  <TableHead>{t('adminPanel.userManagement.table.role')}</TableHead>
                  <TableHead className="text-right">{t('adminPanel.userManagement.table.karma')}</TableHead>
                  <TableHead>{t('adminPanel.userManagement.table.registered')}</TableHead>
                  <TableHead className="text-center">{t('adminPanel.userManagement.table.actions')}</TableHead>
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
                        <Link href={`/admin/users/edit/${user.id}`}>{t('adminPanel.userManagement.editButton')}</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground">{t('adminPanel.userManagement.noUsersFound')}</p>
          )}
        </CardContent>
      </Card>

       <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center text-xl">
            <FolderKanban className="mr-2 h-6 w-6" /> {t('adminPanel.categoryManagement.title')} ({categories.length})
          </CardTitle>
          <Button asChild>
            <Link href="/admin/categories/create">
              <PlusCircle className="mr-2 h-5 w-5" /> {t('adminPanel.categoryManagement.createButton')}
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
                  <TableHead>{t('adminPanel.categoryManagement.table.name')}</TableHead>
                  <TableHead className="max-w-md truncate">{t('adminPanel.categoryManagement.table.description')}</TableHead>
                  <TableHead className="text-center">{t('adminPanel.categoryManagement.table.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell className="font-medium">{category.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-md truncate" title={category.description}>{category.description || t('adminPanel.notAvailable')}</TableCell>
                    <TableCell className="text-center">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/admin/categories/edit/${category.id}`}>{t('adminPanel.categoryManagement.editButton')}</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground">{t('adminPanel.categoryManagement.noCategoriesFound')}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center text-xl">
            <LayoutList className="mr-2 h-6 w-6" /> {t('adminPanel.forumManagement.title')} ({forums.length})
          </CardTitle>
          <Button asChild>
            <Link href="/admin/forums/create">
              <PlusCircle className="mr-2 h-5 w-5" /> {t('adminPanel.forumManagement.createButton')}
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
                  <TableHead>{t('adminPanel.forumManagement.table.name')}</TableHead>
                  <TableHead className="max-w-xs truncate">{t('adminPanel.forumManagement.table.description')}</TableHead>
                  <TableHead>{t('adminPanel.forumManagement.table.category')}</TableHead>
                  <TableHead className="text-right">{t('adminPanel.forumManagement.table.threads')}</TableHead>
                  <TableHead className="text-right">{t('adminPanel.forumManagement.table.posts')}</TableHead>
                  <TableHead className="text-center">{t('adminPanel.forumManagement.table.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {forums.map((forum) => (
                  <TableRow key={forum.id}>
                    <TableCell className="font-medium">
                         <Link href={`/forums/${forum.id}`} className="hover:underline text-primary">
                            {forum.name} <ExternalLink className="inline-block h-3 w-3 ml-1"/>
                         </Link>
                         {forum.isAgora && <Badge variant="outline" className="ml-2 border-blue-500 text-blue-600">{t('adminPanel.forumManagement.agoraBadge')}</Badge>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate" title={forum.description}>{forum.description}</TableCell>
                    <TableCell>{categories.find(c => c.id === forum.categoryId)?.name || forum.categoryId || t('adminPanel.notAvailable')}</TableCell>
                    <TableCell className="text-right">{forum.threadCount || 0}</TableCell>
                    <TableCell className="text-right">{forum.postCount || 0}</TableCell>
                    <TableCell className="text-center space-x-2">
                        <Button asChild variant="outline" size="sm">
                            <Link href={`/admin/forums/edit/${forum.id}`}>{t('adminPanel.forumManagement.editButton')}</Link>
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => setForumToDelete(forum)} title={t('adminPanel.forumManagement.deleteButtonTooltip')}>
                           <Trash2 className="h-4 w-4"/>
                        </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground">{t('adminPanel.forumManagement.noForumsFound')}</p>
          )}
        </CardContent>
      </Card>
      
      <AlertDialog open={!!forumToDelete} onOpenChange={(open) => !open && setForumToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('adminPanel.deleteForumDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('adminPanel.deleteForumDialog.descriptionLine1', { forumName: forumToDelete?.name || "" })}
              <br />
              {t('adminPanel.deleteForumDialog.descriptionLine2')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setForumToDelete(null)}>{t('adminPanel.deleteForumDialog.cancelButton')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteForum} className="bg-destructive hover:bg-destructive/90">
              {t('adminPanel.deleteForumDialog.confirmButton')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
    
