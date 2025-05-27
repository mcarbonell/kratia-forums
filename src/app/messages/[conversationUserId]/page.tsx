
"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter }_next_writer_EOF_split_marker
import Link from 'next/link';
import { useMockAuth } from '@/hooks/use-mock-auth';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs, doc, writeBatch, Timestamp, onSnapshot, Unsubscribe } from 'firebase/firestore';
import type { PrivateMessage, User as KratiaUser } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, ChevronLeft, Send, MessageSquare, UserCircle, Frown, MailWarning } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { es as esLocale } from 'date-fns/locale/es';
import { enUS as enUSLocale } from 'date-fns/locale/en-US';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

interface OtherUser extends Pick<KratiaUser, 'id' | 'username' | 'avatarUrl'> {}

const messageFormSchema = z.object({
  replyContent: z.string().min(1, "Message cannot be empty.").max(2000, "Message cannot exceed 2000 characters."),
});
type MessageFormData = z.infer<typeof messageFormSchema>;

export default function ConversationPage() {
  const params = useParams();
  const router = useRouter();
  const { user: loggedInUser, loading: authLoading } = useMockAuth();
  const { t, i18n } = useTranslation('common');
  const { toast } = useToast();
  const conversationUserId = params.conversationUserId as string;

  const [messages, setMessages] = useState<PrivateMessage[]>([]);
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const { register, handleSubmit, formState: { errors }, reset } = useForm<MessageFormData>({
    resolver: zodResolver(messageFormSchema),
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  useEffect(() => {
    if (authLoading || !loggedInUser || !conversationUserId || loggedInUser.id === 'visitor0' || loggedInUser.id === 'guest1') {
      if (!authLoading && (!loggedInUser || loggedInUser.id === 'visitor0' || loggedInUser.id === 'guest1')) {
        setError(t('messagesPage.accessDenied.title'));
        setIsLoading(false);
      }
      return;
    }

    setIsLoading(true);
    setError(null);

    const fetchOtherUserDetails = async () => {
      try {
        const userDocRef = doc(db, "users", conversationUserId);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data() as KratiaUser;
          setOtherUser({
            id: userDocSnap.id,
            username: userData.username,
            avatarUrl: userData.avatarUrl,
          });
        } else {
          setError(t('conversationPage.error.otherUserNotFound'));
          setOtherUser(null);
        }
      } catch (err) {
        console.error("Error fetching other user details:", err);
        setError(t('conversationPage.error.loadOtherUserFail'));
        setOtherUser(null);
      }
    };

    fetchOtherUserDetails();

    const q1 = query(
      collection(db, "private_messages"),
      where("senderId", "==", loggedInUser.id),
      where("recipientId", "==", conversationUserId)
    );
    const q2 = query(
      collection(db, "private_messages"),
      where("senderId", "==", conversationUserId),
      where("recipientId", "==", loggedInUser.id)
    );

    const unsubscribes: Unsubscribe[] = [];

    const processSnapshot = (querySnapshot: any, isInitialLoad: boolean = false) => {
      const fetchedMessages: PrivateMessage[] = [];
      querySnapshot.forEach((docSnap: any) => {
        fetchedMessages.push({ id: docSnap.id, ...docSnap.data() } as PrivateMessage);
      });

      setMessages(prevMessages => {
        const messageMap = new Map<string, PrivateMessage>();
        [...prevMessages, ...fetchedMessages].forEach(msg => messageMap.set(msg.id, msg));
        const combined = Array.from(messageMap.values());
        combined.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        
        if (isInitialLoad && loggedInUser) {
            const batch = writeBatch(db);
            let markedAnyAsRead = false;
            combined.forEach(msg => {
                if (msg.recipientId === loggedInUser.id && !msg.isRead) {
                    batch.update(doc(db, "private_messages", msg.id), { isRead: true });
                    markedAnyAsRead = true;
                }
            });
            if (markedAnyAsRead) {
                batch.commit().catch(err => console.error("Error marking messages as read:", err));
            }
        }
        return combined;
      });
      if (isInitialLoad) setIsLoading(false);
    };
    
    const fetchInitialMessages = async () => {
        try {
            const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
            const initialMessages: PrivateMessage[] = [];
            snap1.forEach(docSnap => initialMessages.push({ id: docSnap.id, ...docSnap.data() } as PrivateMessage));
            snap2.forEach(docSnap => initialMessages.push({ id: docSnap.id, ...docSnap.data() } as PrivateMessage));
            
            initialMessages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            setMessages(initialMessages);

            if (loggedInUser) {
                 const batch = writeBatch(db);
                 let markedAnyAsRead = false;
                 initialMessages.forEach(msg => {
                    if (msg.recipientId === loggedInUser.id && !msg.isRead) {
                        batch.update(doc(db, "private_messages", msg.id), { isRead: true });
                        markedAnyAsRead = true;
                    }
                });
                if (markedAnyAsRead) {
                    await batch.commit();
                    // Refresh unread count in header if needed (complex, requires global state or event)
                }
            }

        } catch (err) {
            console.error("Error fetching initial messages:", err);
            setError(t('conversationPage.error.loadMessagesFail'));
        } finally {
            setIsLoading(false);
        }
    };

    fetchInitialMessages().then(() => {
        // Setup listeners after initial fetch
        const unsubscribe1 = onSnapshot(q1, (snapshot) => {
            const newMsgs: PrivateMessage[] = [];
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                     newMsgs.push({ id: change.doc.id, ...change.doc.data() } as PrivateMessage);
                }
            });
            if (newMsgs.length > 0) processSnapshot(newMsgs.map(m => ({id: m.id, data: () => m, exists: true}))); // adapt for processSnapshot
        }, (err) => { console.error("Listener error on q1:", err); setError(t('conversationPage.error.listenerFail'));});
        
        const unsubscribe2 = onSnapshot(q2, (snapshot) => {
             const newMsgs: PrivateMessage[] = [];
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                     newMsgs.push({ id: change.doc.id, ...change.doc.data() } as PrivateMessage);
                }
            });
            if (newMsgs.length > 0) processSnapshot(newMsgs.map(m => ({id: m.id, data: () => m, exists: true}))); // adapt for processSnapshot
        }, (err) => { console.error("Listener error on q2:", err); setError(t('conversationPage.error.listenerFail'));});

        unsubscribes.push(unsubscribe1, unsubscribe2);
    });


    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [loggedInUser, conversationUserId, authLoading, t]);

  const formatMessageTimestamp = (dateString: string) => {
    const date = new Date(dateString);
    const locale = i18n.language.startsWith('es') ? esLocale : enUSLocale;
    if (isToday(date)) {
      return format(date, 'p', { locale });
    }
    if (isYesterday(date)) {
      return t('common.time.yesterday') + ' ' + format(date, 'p', { locale });
    }
    return format(date, 'PPp', { locale });
  };

  const handleReplySubmit: SubmitHandler<MessageFormData> = async (data) => {
    if (!loggedInUser || !otherUser || !conversationUserId || isSending) return;
    setIsSending(true);
    try {
      const newMessageData: Omit<PrivateMessage, 'id' | 'createdAt'> = {
        senderId: loggedInUser.id,
        senderUsername: loggedInUser.username,
        senderAvatarUrl: loggedInUser.avatarUrl,
        recipientId: otherUser.id,
        recipientUsername: otherUser.username,
        recipientAvatarUrl: otherUser.avatarUrl,
        content: data.replyContent,
        createdAt: Timestamp.now().toDate().toISOString(), // Client-side timestamp for immediate display
        isRead: false,
      };
      await addDoc(collection(db, "private_messages"), newMessageData);
      reset();
      // Notification logic can be added here if not handled by a backend trigger
    } catch (err) {
      console.error("Error sending reply:", err);
      toast({
        title: t('common.error'),
        description: t('conversationPage.error.sendReplyFail'),
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-12rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">{t('conversationPage.loading')}</p>
      </div>
    );
  }
  
  if (!loggedInUser || loggedInUser.id === 'visitor0' || loggedInUser.id === 'guest1') {
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
      <Alert variant="destructive" className="max-w-lg mx-auto">
        <Frown className="h-5 w-5" />
        <AlertTitle>{t('common.error')}</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
        <Button asChild variant="outline" className="mt-4">
            <Link href="/messages"><ChevronLeft className="mr-2 h-4 w-4" /> {t('conversationPage.backToMessages')}</Link>
        </Button>
      </Alert>
    );
  }

  if (!otherUser) {
    return (
      <Alert variant="destructive" className="max-w-lg mx-auto">
        <UserCircle className="h-5 w-5" />
        <AlertTitle>{t('conversationPage.error.otherUserNotFoundTitle')}</AlertTitle>
        <AlertDescription>{t('conversationPage.error.otherUserNotFoundDesc')}</AlertDescription>
         <Button asChild variant="outline" className="mt-4">
            <Link href="/messages"><ChevronLeft className="mr-2 h-4 w-4" /> {t('conversationPage.backToMessages')}</Link>
        </Button>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-3xl mx-auto"> {/* Adjust height as needed */}
      <CardHeader className="border-b p-4 sticky top-0 bg-card z-10">
        <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" asChild className="-ml-2">
                <Link href="/messages">
                    <ChevronLeft className="h-5 w-5 mr-1" />
                    {t('conversationPage.backToMessages')}
                </Link>
            </Button>
            <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                    <AvatarImage src={otherUser.avatarUrl || undefined} alt={otherUser.username} data-ai-hint="user avatar" />
                    <AvatarFallback>{otherUser.username.substring(0,1).toUpperCase()}</AvatarFallback>
                </Avatar>
                <CardTitle className="text-xl">{otherUser.username}</CardTitle>
            </div>
            <div className="w-[calc(theme(space.8)_+_theme(spacing.2))]"> {/* Placeholder for balance */} </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex-grow overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-10">
                 <MessageSquare className="h-12 w-12 mx-auto mb-2"/>
                <p>{t('conversationPage.noMessagesYet')}</p>
            </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex items-end gap-2 max-w-[85%]",
              msg.senderId === loggedInUser.id ? "ml-auto flex-row-reverse" : "mr-auto"
            )}
          >
            {msg.senderId !== loggedInUser.id && (
              <Avatar className="h-7 w-7 self-start">
                <AvatarImage src={msg.senderAvatarUrl || undefined} alt={msg.senderUsername} data-ai-hint="user avatar"/>
                <AvatarFallback>{msg.senderUsername.substring(0,1).toUpperCase()}</AvatarFallback>
              </Avatar>
            )}
            <div
              className={cn(
                "rounded-xl px-3 py-2 text-sm shadow-md",
                msg.senderId === loggedInUser.id
                  ? "bg-primary text-primary-foreground rounded-br-none"
                  : "bg-muted text-muted-foreground rounded-bl-none"
              )}
            >
              <p className="whitespace-pre-line break-words">{msg.content}</p>
              <p className={cn(
                  "text-xs mt-1",
                   msg.senderId === loggedInUser.id ? "text-primary-foreground/70 text-right" : "text-muted-foreground/70 text-left"
                )}>
                {formatMessageTimestamp(msg.createdAt)}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </CardContent>
      
      <CardFooter className="p-4 border-t sticky bottom-0 bg-card z-10">
        <form onSubmit={handleSubmit(handleReplySubmit)} className="flex w-full items-start gap-2">
          <div className="flex-grow space-y-1">
            <Label htmlFor="replyContent" className="sr-only">{t('conversationPage.replyPlaceholder')}</Label>
            <Textarea
              id="replyContent"
              placeholder={t('conversationPage.replyPlaceholder')}
              rows={2}
              {...register("replyContent")}
              className={cn("resize-none", errors.replyContent ? "border-destructive" : "")}
              disabled={isSending}
            />
            {errors.replyContent && <p className="text-xs text-destructive">{errors.replyContent.message}</p>}
          </div>
          <Button type="submit" size="icon" disabled={isSending} className="h-auto aspect-square p-2 mt-0.5"> 
            {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            <span className="sr-only">{t('conversationPage.sendButton')}</span>
          </Button>
        </form>
      </CardFooter>
    </div>
  );
}


    