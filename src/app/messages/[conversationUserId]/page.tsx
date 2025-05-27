
"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMockAuth } from '@/hooks/use-mock-auth';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs, doc, writeBatch, Timestamp, onSnapshot, Unsubscribe, addDoc, getDoc } from 'firebase/firestore'; // Added getDoc
import type { PrivateMessage, User as KratiaUser, Notification } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, ChevronLeft, MessageSquare, UserCircle, Frown, MailWarning, Send } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { es as esLocale } from 'date-fns/locale/es';
import { enUS as enUSLocale } from 'date-fns/locale/en-US';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';


interface OtherUser extends Pick<KratiaUser, 'id' | 'username' | 'avatarUrl'> {}

const messageFormSchema = z.object({
  content: z.string().min(1, "Message cannot be empty.").max(2000, "Message cannot exceed 2000 characters."),
});

type MessageFormData = z.infer<typeof messageFormSchema>;


export default function ConversationPage() {
  const params = useParams();
  const router = useRouter();
  const { user: loggedInUser, loading: authLoading } = useMockAuth();
  const { t, i18n } = useTranslation('common');
  const conversationUserId = params.conversationUserId as string;
  const { toast } = useToast();

  const [messages, setMessages] = useState<PrivateMessage[]>([]);
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const { register, handleSubmit, formState: { errors: formErrors }, reset } = useForm<MessageFormData>({
    resolver: zodResolver(messageFormSchema),
  });

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

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
      where("recipientId", "==", conversationUserId),
      orderBy("createdAt", "asc")
    );
    const q2 = query(
      collection(db, "private_messages"),
      where("senderId", "==", conversationUserId),
      where("recipientId", "==", loggedInUser.id),
      orderBy("createdAt", "asc")
    );
    
    const unsubscribes: Unsubscribe[] = [];
    let initialMessagesFetched = false;

    const processSnapshotData = (newFetchedMessages: PrivateMessage[]) => {
        setMessages(prevMessages => {
            const messageMap = new Map<string, PrivateMessage>();
            const combinedMessages = [...prevMessages, ...newFetchedMessages];
            combinedMessages.forEach(msg => messageMap.set(msg.id, msg));
            
            const allUniqueMessages = Array.from(messageMap.values());
            allUniqueMessages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    
            if (loggedInUser && allUniqueMessages.some(msg => msg.recipientId === loggedInUser.id && !msg.isRead)) {
                const batch = writeBatch(db);
                let markedAnyAsRead = false;
                allUniqueMessages.forEach(msg => {
                    if (msg.recipientId === loggedInUser.id && !msg.isRead) {
                        batch.update(doc(db, "private_messages", msg.id), { isRead: true });
                        markedAnyAsRead = true;
                    }
                });
                if (markedAnyAsRead) {
                    batch.commit().catch(err => console.error("Error marking messages as read:", err));
                }
            }
            return allUniqueMessages;
        });
    };

    const setupListeners = () => {
        const unsubscribe1 = onSnapshot(q1, (snapshot) => {
            const newMsgs: PrivateMessage[] = [];
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added" || (change.type === "modified" && initialMessagesFetched) ) {
                     newMsgs.push({ id: change.doc.id, ...change.doc.data() } as PrivateMessage);
                }
            });
            if (newMsgs.length > 0) processSnapshotData(newMsgs);
        }, (err) => { console.error("Listener error on q1:", err); setError(t('conversationPage.error.listenerFail'));});
        
        const unsubscribe2 = onSnapshot(q2, (snapshot) => {
             const newMsgs: PrivateMessage[] = [];
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added" || (change.type === "modified" && initialMessagesFetched) ) {
                     newMsgs.push({ id: change.doc.id, ...change.doc.data() } as PrivateMessage);
                }
            });
            if (newMsgs.length > 0) processSnapshotData(newMsgs);
        }, (err) => { console.error("Listener error on q2:", err); setError(t('conversationPage.error.listenerFail'));});
        unsubscribes.push(unsubscribe1, unsubscribe2);
    };
    
    const fetchInitialMessages = async () => {
        try {
            const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
            const initialMessages: PrivateMessage[] = [];
            snap1.forEach(docSnap => initialMessages.push({ id: docSnap.id, ...docSnap.data() } as PrivateMessage));
            snap2.forEach(docSnap => initialMessages.push({ id: docSnap.id, ...docSnap.data() } as PrivateMessage));
            
            processSnapshotData(initialMessages); 
            initialMessagesFetched = true; 
            setupListeners(); 

        } catch (err) {
            console.error("Error fetching initial messages:", err);
            setError(t('conversationPage.error.loadMessagesFail'));
        } finally {
            setIsLoading(false);
        }
    };

    fetchInitialMessages();

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedInUser?.id, conversationUserId, authLoading, t]);

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

  const handleSendMessage: SubmitHandler<MessageFormData> = async (data) => {
    if (!loggedInUser || !otherUser) {
      toast({ title: t('common.error'), description: t('conversationPage.error.userOrRecipientMissing'), variant: "destructive" });
      return;
    }
    setIsSending(true);
    try {
      const newMessageData: Omit<PrivateMessage, 'id' | 'createdAt'> = {
        senderId: loggedInUser.id,
        senderUsername: loggedInUser.username,
        senderAvatarUrl: loggedInUser.avatarUrl,
        recipientId: otherUser.id,
        recipientUsername: otherUser.username,
        recipientAvatarUrl: otherUser.avatarUrl,
        content: data.content,
        isRead: false,
      };
      
      const messageRef = await addDoc(collection(db, "private_messages"), {
        ...newMessageData,
        createdAt: Timestamp.now().toDate().toISOString(),
      });

      reset(); 

      const recipientUserRef = doc(db, "users", otherUser.id);
      const recipientSnap = await getDoc(recipientUserRef);
      if (recipientSnap.exists()) {
        const recipientData = recipientSnap.data() as KratiaUser;
        const prefs = recipientData.notificationPreferences;
        const shouldNotifyWeb = prefs?.newPrivateMessage?.web ?? true;

        if (shouldNotifyWeb) {
          const sender = loggedInUser; 
          const notificationData: Omit<Notification, 'id'> = {
            recipientId: otherUser.id,
            actor: { id: sender.id, username: sender.username, avatarUrl: sender.avatarUrl || "" },
            type: 'new_private_message' as const,
            message: t('notifications.newPrivateMessage', { senderName: sender.username }),
            link: `/messages/${sender.id}`, 
            createdAt: new Date().toISOString(),
            isRead: false,
            privateMessageId: messageRef.id,
          };
          await addDoc(collection(db, "notifications"), notificationData);
        }
      }
    } catch (error) {
      console.error("Error sending private message:", error);
      toast({
        title: t('common.error'),
        description: t('conversationPage.error.sendFail'),
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };


  if (authLoading || (isLoading && !otherUser)) { 
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

  if (!otherUser && !isLoading) { 
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
    <Card className="flex flex-col h-[calc(100vh-8rem)] max-w-3xl mx-auto shadow-xl">
      <CardHeader className="border-b p-4 sticky top-0 bg-card z-10">
        <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" asChild className="-ml-2">
                <Link href="/messages">
                    <ChevronLeft className="h-5 w-5 mr-1" />
                    {t('conversationPage.backToMessages')}
                </Link>
            </Button>
            {otherUser && (
                 <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                        <AvatarImage src={otherUser.avatarUrl || undefined} alt={otherUser.username} data-ai-hint="user avatar" />
                        <AvatarFallback>{otherUser.username.substring(0,1).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <CardTitle className="text-xl">{otherUser.username}</CardTitle>
                </div>
            )}
            <div className="w-[calc(theme(space.8)_+_theme(spacing.2))]"> </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex-grow overflow-y-auto p-4 space-y-4">
        {isLoading && messages.length === 0 && ( 
             <div className="flex justify-center items-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-3 text-muted-foreground">{t('conversationPage.loadingMessages')}</p>
             </div>
        )}
        {!isLoading && messages.length === 0 && (
            <div className="text-center text-muted-foreground py-10">
                 <MessageSquare className="h-12 w-12 mx-auto mb-2"/>
                <p>{t('conversationPage.noMessagesYetWith', { username: otherUser?.username || t('common.thisUser') })}</p>
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
            {msg.senderId !== loggedInUser.id && otherUser && (
              <Link href={`/profile/${otherUser.id}`} className="flex-shrink-0">
                <Avatar className="h-7 w-7 self-start">
                    <AvatarImage src={msg.senderAvatarUrl || undefined} alt={msg.senderUsername} data-ai-hint="user avatar" />
                    <AvatarFallback>{msg.senderUsername.substring(0,1).toUpperCase()}</AvatarFallback>
                </Avatar>
              </Link>
            )}
             {msg.senderId === loggedInUser.id && ( 
              <Avatar className="h-7 w-7 self-start">
                <AvatarImage src={loggedInUser.avatarUrl || undefined} alt={loggedInUser.username} data-ai-hint="user avatar" />
                <AvatarFallback>{loggedInUser.username.substring(0,1).toUpperCase()}</AvatarFallback>
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
      
      <CardFooter className="p-4 border-t bg-card sticky bottom-0 z-10">
         {otherUser ? (
            <form onSubmit={handleSubmit(handleSendMessage)} className="w-full flex items-start gap-2">
                <div className="flex-grow">
                    <Label htmlFor="message-content" className="sr-only">{t('conversationPage.replyPlaceholder')}</Label>
                    <Textarea
                    id="message-content"
                    placeholder={t('conversationPage.replyPlaceholder')}
                    rows={2} 
                    {...register("content")}
                    className={cn("min-h-[40px] resize-none", formErrors.content ? "border-destructive" : "")}
                    disabled={isSending}
                    />
                    {formErrors.content && <p className="text-xs text-destructive mt-1">{formErrors.content.message}</p>}
                </div>
                <Button type="submit" disabled={isSending} size="icon" className="h-auto p-2 aspect-square self-end">
                    {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                    <span className="sr-only">{t('conversationPage.sendButton')}</span>
                </Button>
            </form>
         ) : (
            <p className="text-center text-muted-foreground text-sm w-full">{t('conversationPage.cannotReplyUserNotFound')}</p>
         )}
      </CardFooter>
    </Card>
  );
}
