
"use client";

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useMockAuth } from '@/hooks/use-mock-auth';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs, limit, Unsubscribe, onSnapshot } from 'firebase/firestore';
import type { PrivateMessage, User as KratiaUser } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, MailWarning, Inbox, MessageSquare, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es as esLocale } from 'date-fns/locale/es';
import { enUS as enUSLocale } from 'date-fns/locale/en-US';
import { useTranslation } from 'react-i18next';

interface Conversation {
  otherUser: Pick<KratiaUser, 'id' | 'username' | 'avatarUrl'>;
  lastMessage: PrivateMessage;
  unreadCount: number;
}

export default function MessagesPage() {
  const { user, loading: authLoading } = useMockAuth();
  const { t, i18n } = useTranslation('common');

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) {
      setIsLoading(false);
      return;
    }
    if (!user || user.role === 'visitor' || user.role === 'guest') {
      setIsLoading(false);
      // No error message needed here, UI will handle non-logged-in state
      return;
    }

    setIsLoading(true);
    setError(null);

    const sentMessagesQuery = query(
      collection(db, "private_messages"),
      where("senderId", "==", user.id),
      orderBy("createdAt", "desc")
    );
    const receivedMessagesQuery = query(
      collection(db, "private_messages"),
      where("recipientId", "==", user.id),
      orderBy("createdAt", "desc")
    );

    let unsubSent: Unsubscribe | null = null;
    let unsubReceived: Unsubscribe | null = null;
    let allMessages: PrivateMessage[] = [];

    const processMessages = () => {
      if (!user) return;

      const groupedConversations: Record<string, Conversation> = {};

      allMessages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      allMessages.forEach(msg => {
        const otherUserId = msg.senderId === user.id ? msg.recipientId : msg.senderId;
        const otherUsername = msg.senderId === user.id ? msg.recipientUsername : msg.senderUsername;
        const otherAvatarUrl = msg.senderId === user.id ? msg.recipientAvatarUrl : msg.senderAvatarUrl;

        if (!groupedConversations[otherUserId]) {
          groupedConversations[otherUserId] = {
            otherUser: {
              id: otherUserId,
              username: otherUsername,
              avatarUrl: otherAvatarUrl,
            },
            lastMessage: msg,
            unreadCount: 0,
          };
        }
        // Update last message if current message is newer (already handled by initial sort)
        // if (new Date(msg.createdAt) > new Date(groupedConversations[otherUserId].lastMessage.createdAt)) {
        //   groupedConversations[otherUserId].lastMessage = msg;
        // }

        if (msg.recipientId === user.id && !msg.isRead) {
          groupedConversations[otherUserId].unreadCount += 1;
        }
      });
      
      const sortedConversations = Object.values(groupedConversations).sort((a, b) => 
        new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime()
      );
      setConversations(sortedConversations);
    };
    
    const fetchAndCombine = async () => {
        try {
            const [sentSnapshot, receivedSnapshot] = await Promise.all([
                getDocs(sentMessagesQuery),
                getDocs(receivedMessagesQuery)
            ]);
            
            const sentMessages = sentSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PrivateMessage));
            const receivedMessages = receivedSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PrivateMessage));
            
            // Combine and remove duplicates (though theoretically senderId/recipientId combo should be unique for a given timestamp if IDs are unique)
            const messageMap = new Map<string, PrivateMessage>();
            [...sentMessages, ...receivedMessages].forEach(msg => messageMap.set(msg.id, msg));
            allMessages = Array.from(messageMap.values());
            
            processMessages();

        } catch (err: any) {
            console.error("Error fetching messages:", err);
            setError(t('messagesPage.error.loadFail'));
        } finally {
            setIsLoading(false);
        }
    };

    fetchAndCombine();
    
    // Optional: Real-time updates (can be complex with combined queries)
    // For simplicity, we'll stick to a fetch on load.
    // Real-time would involve listening to both queries and re-processing.

    return () => {
      // Cleanup for real-time listeners if added
    };

  }, [user, authLoading, t, i18n.language]);


  const timeAgo = (dateString?: string) => {
    if (!dateString) return '';
    return formatDistanceToNow(new Date(dateString), { addSuffix: true, locale: i18n.language.startsWith('es') ? esLocale : enUSLocale });
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-20rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">{t('messagesPage.loading')}</p>
      </div>
    );
  }

  if (!user || user.role === 'visitor' || user.role === 'guest') {
    return (
      <Alert variant="destructive" className="max-w-lg mx-auto">
        <MailWarning className="h-5 w-5" />
        <AlertTitle>{t('messagesPage.accessDenied.title')}</AlertTitle>
        <AlertDescription>
          {t('messagesPage.accessDenied.description')}
          <Button asChild className="mt-4 block w-fit">
            <Link href="/auth/login">{t('login.loginButton')}</Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <MailWarning className="h-5 w-5" />
        <AlertTitle>{t('common.error')}</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold flex items-center">
          <MessageSquare className="mr-3 h-8 w-8 text-primary" />
          {t('messagesPage.title')}
        </h1>
        {/* Button for "New Message" could go here in the future */}
      </div>

      {conversations.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <Inbox className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-xl font-semibold text-muted-foreground">{t('messagesPage.noConversations.title')}</p>
            <p className="text-muted-foreground">
              {t('messagesPage.noConversations.description')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {conversations.map((convo) => (
            <Link 
              // TODO: Update this link when conversation view page is ready
              // href={`/messages/${convo.otherUser.id}`} // Example for future
              href={`/profile/${convo.otherUser.id}`} // Placeholder: links to user profile for now
              key={convo.otherUser.id} 
              className="block"
            >
              <Card className={`shadow-md transition-all hover:shadow-lg ${convo.unreadCount > 0 ? 'bg-primary/5 border-primary/30' : 'bg-card'}`}>
                <CardContent className="p-4 flex items-start space-x-4">
                  <Avatar className="h-12 w-12 border">
                    <AvatarImage src={convo.otherUser.avatarUrl || undefined} alt={convo.otherUser.username} data-ai-hint="user avatar" />
                    <AvatarFallback>{convo.otherUser.username.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-grow overflow-hidden">
                    <div className="flex justify-between items-center">
                      <p className="font-semibold text-primary truncate">{convo.otherUser.username}</p>
                      <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                        {timeAgo(convo.lastMessage.createdAt)}
                      </span>
                    </div>
                    <p className={`text-sm truncate ${convo.unreadCount > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                      {convo.lastMessage.senderId === user.id ? `${t('messagesPage.you')}: ` : ''}
                      {convo.lastMessage.content}
                    </p>
                  </div>
                  {convo.unreadCount > 0 && (
                    <div className="flex-shrink-0 ml-2 flex items-center justify-center h-6 w-6 rounded-full bg-accent text-accent-foreground text-xs font-bold">
                      {convo.unreadCount}
                    </div>
                  )}
                  <ChevronRight className="h-5 w-5 text-muted-foreground self-center flex-shrink-0" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

    