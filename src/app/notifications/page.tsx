
"use client";

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useMockAuth } from '@/hooks/use-mock-auth';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs, writeBatch, doc, Timestamp } from 'firebase/firestore';
import type { Notification as NotificationType, User as KratiaUser } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, BellRing, MailWarning, CheckCheck, Inbox } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface NotificationWithId extends NotificationType {
  id: string;
}

export default function NotificationsPage() {
  const { user, loading: authLoading } = useMockAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<NotificationWithId[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMarkingRead, setIsMarkingRead] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user || authLoading) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const notificationsQuery = query(
        collection(db, "notifications"),
        where("recipientId", "==", user.id),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getDocs(notificationsQuery);
      const fetchedNotifications = querySnapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      } as NotificationWithId));
      setNotifications(fetchedNotifications);
    } catch (err) {
      console.error("Error fetching notifications:", err);
      setError("Failed to load notifications. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [user, authLoading]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAllAsRead = async () => {
    if (!user) return;
    const unreadNotifications = notifications.filter(n => !n.isRead);
    if (unreadNotifications.length === 0) {
      toast({ title: "No unread notifications", description: "All your notifications are already marked as read." });
      return;
    }

    setIsMarkingRead(true);
    const batch = writeBatch(db);
    unreadNotifications.forEach(notification => {
      const notificationRef = doc(db, "notifications", notification.id);
      batch.update(notificationRef, { isRead: true });
    });

    try {
      await batch.commit();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      toast({
        title: "Success",
        description: "All notifications marked as read.",
        action: <CheckCheck className="text-green-500" />
      });
      // Optionally, re-sync the notification count in the header.
      // This usually happens automatically if the header's onSnapshot listener is active.
    } catch (err) {
      console.error("Error marking notifications as read:", err);
      toast({
        title: "Error",
        description: "Could not mark notifications as read. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsMarkingRead(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-20rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">Loading notifications...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <Alert variant="destructive" className="max-w-lg mx-auto">
        <MailWarning className="h-5 w-5" />
        <AlertTitle>Access Denied</AlertTitle>
        <AlertDescription>
          You must be logged in to view your notifications.
          <Button asChild className="mt-4 block w-fit">
            <Link href="/auth/login">Login</Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <MailWarning className="h-5 w-5" />
        <AlertTitle>Error Loading Notifications</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const timeAgo = (dateString?: string) => {
    if (!dateString) return 'some time ago';
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  };

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold flex items-center">
          <BellRing className="mr-3 h-8 w-8 text-primary" />
          Your Notifications
        </h1>
        {notifications.some(n => !n.isRead) && (
          <Button onClick={handleMarkAllAsRead} disabled={isMarkingRead}>
            {isMarkingRead ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CheckCheck className="mr-2 h-5 w-5" />}
            Mark all as read
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <Inbox className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-xl font-semibold text-muted-foreground">No notifications yet.</p>
            <p className="text-muted-foreground">
              We'll let you know when there's something new for you.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {notifications.map((notification) => (
            <Card key={notification.id} className={`shadow-md transition-all ${!notification.isRead ? 'bg-primary/5 border-primary/30 hover:shadow-lg' : 'bg-muted/30 hover:bg-muted/50'}`}>
              <CardContent className="p-4 flex items-start space-x-4">
                <Link href={`/profile/${notification.actor.id}`} className="flex-shrink-0">
                  <Avatar className="h-10 w-10 border">
                    <AvatarImage src={notification.actor.avatarUrl} alt={notification.actor.username} data-ai-hint="user avatar" />
                    <AvatarFallback>{notification.actor.username?.substring(0, 2).toUpperCase() || 'U'}</AvatarFallback>
                  </Avatar>
                </Link>
                <div className="flex-grow">
                  <p className="text-sm">
                    <Link href={`/profile/${notification.actor.id}`} className="font-semibold text-primary hover:underline">
                      {notification.actor.username}
                    </Link>
                    {' '}{notification.message}
                  </p>
                  <Link href={notification.link} className="text-xs text-muted-foreground hover:underline block mt-0.5">
                    {timeAgo(notification.createdAt)}
                  </Link>
                </div>
                {!notification.isRead && (
                  <div className="h-2.5 w-2.5 bg-accent rounded-full self-center flex-shrink-0" title="Unread"></div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
