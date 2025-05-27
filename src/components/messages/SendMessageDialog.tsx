
"use client";

import { useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, Timestamp, doc, getDoc } from 'firebase/firestore'; // Added doc, getDoc
import type { PrivateMessage, User, Notification } from '@/lib/types';
import { Loader2, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { KRATIA_CONFIG } from '@/lib/config';

const messageSchema = z.object({
  content: z.string().min(1, "Message cannot be empty.").max(2000, "Message cannot exceed 2000 characters."),
});

type MessageFormData = z.infer<typeof messageSchema>;

interface SendMessageDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  recipient: Pick<User, 'id' | 'username' | 'avatarUrl'>;
  sender: Pick<User, 'id' | 'username' | 'avatarUrl'>;
}

export default function SendMessageDialog({ isOpen, onOpenChange, recipient, sender }: SendMessageDialogProps) {
  const { toast } = useToast();
  const { t } = useTranslation('common');
  const [isSending, setIsSending] = useState(false);

  const { register, handleSubmit, formState: { errors }, reset } = useForm<MessageFormData>({
    resolver: zodResolver(messageSchema),
  });

  const onSubmit: SubmitHandler<MessageFormData> = async (data) => {
    setIsSending(true);
    try {
      const newMessageData: Omit<PrivateMessage, 'id' | 'createdAt'> = { // Renamed to newMessageData for clarity
        senderId: sender.id,
        senderUsername: sender.username,
        senderAvatarUrl: sender.avatarUrl,
        recipientId: recipient.id,
        recipientUsername: recipient.username,
        recipientAvatarUrl: recipient.avatarUrl,
        content: data.content,
        isRead: false,
      };
      
      const messageRef = await addDoc(collection(db, "private_messages"), {
        ...newMessageData,
        createdAt: Timestamp.now().toDate().toISOString(),
      });

      // Create notification for the recipient
      const recipientUserRef = doc(db, "users", recipient.id);
      const recipientSnap = await getDoc(recipientUserRef);
      if (recipientSnap.exists()) {
        const recipientData = recipientSnap.data() as User;
        const prefs = recipientData.notificationPreferences;
        const shouldNotifyWeb = prefs?.newPrivateMessage?.web ?? true;

        if (shouldNotifyWeb) {
          const notificationData: Omit<Notification, 'id'> = {
            recipientId: recipient.id,
            actor: { id: sender.id, username: sender.username, avatarUrl: sender.avatarUrl || "" },
            type: 'new_private_message',
            message: t('notifications.newPrivateMessage', { senderName: sender.username }),
            link: `/messages?conversationWith=${sender.id}`, // Placeholder link
            createdAt: new Date().toISOString(),
            isRead: false,
            privateMessageId: messageRef.id,
          };
          await addDoc(collection(db, "notifications"), notificationData);
        }
      }

      toast({
        title: t('sendMessageDialog.toast.successTitle'),
        description: t('sendMessageDialog.toast.successDesc', { recipientName: recipient.username }),
      });
      reset();
      onOpenChange(false);
    } catch (error) {
      console.error("Error sending private message:", error);
      toast({
        title: t('common.error'),
        description: t('sendMessageDialog.toast.errorDesc'),
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null; // Don't render if not open

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('sendMessageDialog.title', { recipientName: recipient.username })}</DialogTitle>
          <DialogDescription>
            {t('sendMessageDialog.description')}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div className="grid gap-2">
            <Label htmlFor={`pm-content-${recipient.id}`} className="sr-only">
              {t('sendMessageDialog.messageLabel')}
            </Label>
            <Textarea
              id={`pm-content-${recipient.id}`}
              placeholder={t('sendMessageDialog.messagePlaceholder')}
              rows={5}
              {...register("content")}
              className={errors.content ? "border-destructive" : ""}
              disabled={isSending}
            />
            {errors.content && <p className="text-sm text-destructive">{errors.content.message}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { reset(); onOpenChange(false); }} disabled={isSending}>
              {t('common.cancelButton')}
            </Button>
            <Button type="submit" disabled={isSending}>
              {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              {t('sendMessageDialog.sendButton')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

    