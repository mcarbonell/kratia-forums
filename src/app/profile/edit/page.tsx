
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, type SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useMockAuth } from '@/hooks/use-mock-auth';
import type { User as KratiaUser, UserNotificationPreferences } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Save, UserCog, ShieldAlert, Frown, CornerUpLeft, UploadCloud, Settings } from 'lucide-react';
import Link from 'next/link';
import { db, storage } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import UserAvatar from '@/components/user/UserAvatar';
import { useTranslation } from 'react-i18next';

const profileFormSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters.").max(50, "Username cannot exceed 50 characters."),
  location: z.string().max(100, "Location cannot exceed 100 characters.").optional().or(z.literal('')),
  aboutMe: z.string().max(500, "About me cannot exceed 500 characters.").optional().or(z.literal('')),
  prefs_newReplyToMyThread_web: z.boolean().optional(),
  prefs_votationConcludedProposer_web: z.boolean().optional(),
  prefs_postReaction_web: z.boolean().optional(),
  prefs_votationConcludedParticipant_web: z.boolean().optional(),
  prefs_newPrivateMessage_web: z.boolean().optional(), // New
});

type ProfileFormData = z.infer<typeof profileFormSchema>;

export default function EditProfilePage() {
  const router = useRouter();
  const { user: loggedInUser, loading: authLoading, syncUserWithFirestore } = useMockAuth();
  const { toast } = useToast();
  const { t } = useTranslation('common');
  
  const [profileUser, setProfileUser] = useState<KratiaUser | null>(null);
  const [currentAvatarDisplayUrl, setCurrentAvatarDisplayUrl] = useState<string | undefined>(undefined);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors }, control, reset, setValue } = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: { 
      prefs_newReplyToMyThread_web: true,
      prefs_votationConcludedProposer_web: true,
      prefs_postReaction_web: true,
      prefs_votationConcludedParticipant_web: true,
      prefs_newPrivateMessage_web: true, // New default
    }
  });

  useEffect(() => {
    if (authLoading) return;
    if (!loggedInUser || loggedInUser.role === 'visitor') {
      setIsLoadingUser(false);
      setError(t('profileEdit.error.mustBeLoggedIn'));
      return;
    }

    const fetchUserProfile = async () => {
      setIsLoadingUser(true);
      setError(null);
      try {
        const userRef = doc(db, "users", loggedInUser.id);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = {id: userSnap.id, ...userSnap.data()} as KratiaUser;
          setProfileUser(userData);
          setCurrentAvatarDisplayUrl(userData.avatarUrl || undefined);
          setValue("username", userData.username);
          setValue("location", userData.location || "");
          setValue("aboutMe", userData.aboutMe || "");
          setValue("prefs_newReplyToMyThread_web", userData.notificationPreferences?.newReplyToMyThread?.web ?? true);
          setValue("prefs_votationConcludedProposer_web", userData.notificationPreferences?.votationConcludedProposer?.web ?? true);
          setValue("prefs_postReaction_web", userData.notificationPreferences?.postReaction?.web ?? true);
          setValue("prefs_votationConcludedParticipant_web", userData.notificationPreferences?.votationConcludedParticipant?.web ?? true);
          setValue("prefs_newPrivateMessage_web", userData.notificationPreferences?.newPrivateMessage?.web ?? true); // New
        } else {
          setError(t('profileEdit.error.profileNotFound'));
        }
      } catch (err) {
        console.error("Error fetching user profile for edit:", err);
        setError(t('profileEdit.error.loadFail'));
      } finally {
        setIsLoadingUser(false);
      }
    };

    fetchUserProfile();
  }, [loggedInUser, authLoading, setValue, t]);

  useEffect(() => {
    return () => {
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview);
      setAvatarPreview(null);
    }
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { 
        toast({ title: t('profileEdit.toast.avatar.tooLargeTitle'), description: t('profileEdit.toast.avatar.tooLargeDesc'), variant: "destructive" });
        event.target.value = ""; 
        setAvatarFile(null);
        return;
      }
      if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
        toast({ title: t('profileEdit.toast.avatar.invalidTypeTitle'), description: t('profileEdit.toast.avatar.invalidTypeDesc'), variant: "destructive" });
        event.target.value = ""; 
        setAvatarFile(null);
        return;
      }
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    } else {
      setAvatarFile(null);
    }
  };

  const onSubmit: SubmitHandler<ProfileFormData> = async (data) => {
    if (!profileUser || !loggedInUser) {
      toast({ title: t('profileEdit.toast.errorTitle'), description: t('profileEdit.error.userNotFoundOnSubmit'), variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    let newAvatarUrl = profileUser.avatarUrl; 

    const notificationPreferences: UserNotificationPreferences = {
      newReplyToMyThread: { web: data.prefs_newReplyToMyThread_web ?? true },
      votationConcludedProposer: { web: data.prefs_votationConcludedProposer_web ?? true },
      postReaction: { web: data.prefs_postReaction_web ?? true },
      votationConcludedParticipant: { web: data.prefs_votationConcludedParticipant_web ?? true },
      newPrivateMessage: { web: data.prefs_newPrivateMessage_web ?? true }, // New
    };

    try {
      if (avatarFile) {
        toast({ title: t('profileEdit.toast.avatar.uploadingTitle'), description: t('profileEdit.toast.avatar.uploadingDesc')});
        const storageRef = ref(storage, `avatars/${loggedInUser.id}/profileImage`); 
        await uploadBytes(storageRef, avatarFile);
        newAvatarUrl = await getDownloadURL(storageRef);
        toast({ title: t('profileEdit.toast.avatar.successTitle'), description: t('profileEdit.toast.avatar.successDesc')});
      }

      const userRef = doc(db, "users", loggedInUser.id);
      await updateDoc(userRef, {
        username: data.username,
        location: data.location || null,
        aboutMe: data.aboutMe || null,
        avatarUrl: newAvatarUrl || null, 
        notificationPreferences: notificationPreferences,
      });
      
      if (newAvatarUrl !== currentAvatarDisplayUrl) {
        setCurrentAvatarDisplayUrl(newAvatarUrl || undefined);
      }
      
      if (syncUserWithFirestore && loggedInUser) {
         await syncUserWithFirestore(loggedInUser); 
      }

      toast({
        title: t('profileEdit.toast.profileUpdateSuccessTitle'),
        description: t('profileEdit.toast.profileUpdateSuccessDesc'),
      });
      router.push(`/profile/${loggedInUser.id}`);
    } catch (error: any) {
      console.error("Error updating profile:", error);
      let description = t('profileEdit.toast.profileUpdateErrorDesc');
      if (error.code) { 
        switch (error.code) {
          case 'storage/unauthorized':
            description = t('profileEdit.error.storageUnauthorized');
            break;
          case 'storage/object-not-found':
            description = t('profileEdit.error.storageObjectNotFound');
            break;
          case 'storage/canceled':
            description = t('profileEdit.error.storageCanceled');
            break;
          case 'permission-denied': 
            description = t('profileEdit.error.permissionDenied');
            break;
          default:
            description = t('profileEdit.error.default', { message: error.message || 'Unknown error' });
        }
      }
      toast({
        title: t('profileEdit.toast.profileUpdateErrorTitle'),
        description: description,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || isLoadingUser) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-20rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">{t('profileEdit.loadingEditor')}</p>
      </div>
    );
  }

  if (error || !profileUser) {
    return (
      <Alert variant="destructive" className="max-w-lg mx-auto">
        <Frown className="h-5 w-5" />
        <AlertTitle>{error ? t('profileEdit.error.errorTitle') : t('profileEdit.error.cannotEditTitle')}</AlertTitle>
        <AlertDescription>
          {error || t('profileEdit.error.cannotEditDesc')}
        </AlertDescription>
        <Button asChild className="mt-4">
          <Link href={loggedInUser ? `/profile/${loggedInUser.id}` : "/"}>
            <CornerUpLeft className="mr-2 h-4 w-4" />
            {t(loggedInUser ? 'profileEdit.backToProfileButton' : 'profileEdit.backToHomepageButton')}
          </Link>
        </Button>
      </Alert>
    );
  }
  
  if (!loggedInUser || loggedInUser.role === 'visitor') {
     return (
      <Alert variant="destructive" className="max-w-lg mx-auto">
        <ShieldAlert className="h-5 w-5" />
        <AlertTitle>{t('profileEdit.accessDeniedTitle')}</AlertTitle>
        <AlertDescription>
          {t('profileEdit.error.mustBeLoggedIn')}
        </AlertDescription>
        <Button asChild className="mt-4">
          <Link href="/auth/login">{t('login.loginButton')}</Link>
        </Button>
      </Alert>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <form onSubmit={handleSubmit(onSubmit)}>
        <Card className="shadow-xl mb-8">
          <CardHeader>
            <CardTitle className="text-2xl md:text-3xl font-bold flex items-center">
              <UserCog className="mr-3 h-7 w-7 text-primary" />
              {t('profileEdit.title')}
            </CardTitle>
            <CardDescription>
              {t('profileEdit.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>{t('profileEdit.currentAvatarLabel')}</Label>
              <div className="flex items-center gap-4">
                <UserAvatar user={{username: profileUser.username, avatarUrl: avatarPreview || currentAvatarDisplayUrl}} size="lg" />
                <div>
                  <Label htmlFor="avatarFile" className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
                    <UploadCloud className="mr-2 h-4 w-4" /> {t('profileEdit.changeAvatarButton')}
                  </Label>
                  <Input
                    id="avatarFile"
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    onChange={handleFileChange}
                    className="hidden" 
                    disabled={isSubmitting}
                  />
                  <p className="text-xs text-muted-foreground mt-1">{t('profileEdit.avatarHelpText')}</p>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="username">{t('profileEdit.usernameLabel')}</Label>
              <Input
                id="username"
                type="text"
                placeholder={t('profileEdit.usernamePlaceholder')}
                {...register("username")}
                className={errors.username ? "border-destructive" : ""}
                disabled={isSubmitting}
              />
              {errors.username && <p className="text-sm text-destructive">{errors.username.message}</p>}
              <p className="text-xs text-muted-foreground">{t('profileEdit.usernameHelpText')}</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">{t('profileEdit.emailLabel')}</Label>
              <Input
                id="email"
                type="email"
                value={profileUser.email}
                readOnly
                disabled
                className="bg-muted/50"
              />
               <p className="text-xs text-muted-foreground">{t('profileEdit.emailHelpText')}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">{t('profileEdit.locationLabel')}</Label>
              <Input
                id="location"
                type="text"
                placeholder={t('profileEdit.locationPlaceholder')}
                {...register("location")}
                className={errors.location ? "border-destructive" : ""}
                disabled={isSubmitting}
              />
              {errors.location && <p className="text-sm text-destructive">{errors.location.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="aboutMe">{t('profileEdit.aboutMeLabel')}</Label>
              <Textarea
                id="aboutMe"
                placeholder={t('profileEdit.aboutMePlaceholder')}
                rows={5}
                {...register("aboutMe")}
                className={errors.aboutMe ? "border-destructive" : ""}
                disabled={isSubmitting}
              />
              {errors.aboutMe && <p className="text-sm text-destructive">{errors.aboutMe.message}</p>}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-xl md:text-2xl font-bold flex items-center">
              <Settings className="mr-3 h-6 w-6 text-primary" />
              {t('profileEdit.notificationPrefs.title')}
            </CardTitle>
            <CardDescription>
              {t('profileEdit.notificationPrefs.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2 p-3 border rounded-md">
              <Controller
                name="prefs_newReplyToMyThread_web"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    id="prefs_newReplyToMyThread_web"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isSubmitting}
                    ref={field.ref}
                  />
                )}
              />
              <div className="grid gap-1.5 leading-none">
                <Label htmlFor="prefs_newReplyToMyThread_web" className="font-medium">
                  {t('profileEdit.notificationPrefs.newReplyToMyThread.label')}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t('profileEdit.notificationPrefs.newReplyToMyThread.desc')}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 p-3 border rounded-md">
              <Controller
                name="prefs_votationConcludedProposer_web"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    id="prefs_votationConcludedProposer_web"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isSubmitting}
                    ref={field.ref}
                  />
                )}
              />
              <div className="grid gap-1.5 leading-none">
                <Label htmlFor="prefs_votationConcludedProposer_web" className="font-medium">
                  {t('profileEdit.notificationPrefs.votationConcludedProposer.label')}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t('profileEdit.notificationPrefs.votationConcludedProposer.desc')}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 p-3 border rounded-md">
              <Controller
                name="prefs_postReaction_web"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    id="prefs_postReaction_web"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isSubmitting}
                    ref={field.ref}
                  />
                )}
              />
              <div className="grid gap-1.5 leading-none">
                <Label htmlFor="prefs_postReaction_web" className="font-medium">
                  {t('profileEdit.notificationPrefs.postReaction.label')}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t('profileEdit.notificationPrefs.postReaction.desc')}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 p-3 border rounded-md">
              <Controller
                name="prefs_votationConcludedParticipant_web"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    id="prefs_votationConcludedParticipant_web"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isSubmitting}
                    ref={field.ref}
                  />
                )}
              />
              <div className="grid gap-1.5 leading-none">
                <Label htmlFor="prefs_votationConcludedParticipant_web" className="font-medium">
                  {t('profileEdit.notificationPrefs.votationConcludedParticipant.label')}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t('profileEdit.notificationPrefs.votationConcludedParticipant.desc')}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 p-3 border rounded-md">
              <Controller
                name="prefs_newPrivateMessage_web"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    id="prefs_newPrivateMessage_web"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isSubmitting}
                    ref={field.ref}
                  />
                )}
              />
              <div className="grid gap-1.5 leading-none">
                <Label htmlFor="prefs_newPrivateMessage_web" className="font-medium">
                  {t('profileEdit.notificationPrefs.newPrivateMessage.label')}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t('profileEdit.notificationPrefs.newPrivateMessage.desc')}
                </p>
              </div>
            </div>

          </CardContent>
           <CardFooter className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t">
              <Button type="button" variant="outline" onClick={() => loggedInUser && router.push(`/profile/${loggedInUser.id}`)} disabled={isSubmitting}>
                  {t('profileEdit.cancelButton')}
              </Button>
              <Button type="submit" disabled={isSubmitting} className="min-w-[120px]">
              {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                  <Save className="mr-2 h-4 w-4" />
              )}
              {t('profileEdit.saveButton')}
              </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}

    