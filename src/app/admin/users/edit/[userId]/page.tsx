
"use client";

import { useState, useEffect, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm, type SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, parseISO } from 'date-fns';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useMockAuth, type UserRole } from '@/hooks/use-mock-auth';
import { useToast } from '@/hooks/use-toast';
import type { User as KratiaUser } from '@/lib/types';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Loader2, UserCog, ShieldAlert, Save, CornerUpLeft, Frown, Info } from 'lucide-react';
import UserAvatar from '@/components/user/UserAvatar';

const userStatusSchema = z.enum(['active', 'under_sanction_process', 'sanctioned', 'pending_admission', 'pending_email_verification']);
const userRoleSchema = z.enum(['guest', 'user', 'normal_user', 'admin']); 

const adminEditUserSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters.").max(50),
  email: z.string().email("Invalid email address.").min(5),
  role: userRoleSchema,
  avatarUrl: z.string().url("Must be a valid URL for avatar.").or(z.literal('')).optional(),
  location: z.string().max(100).optional().or(z.literal('')),
  aboutMe: z.string().max(500).optional().or(z.literal('')),
  karma: z.coerce.number().int().min(0, "Karma cannot be negative."),
  status: userStatusSchema,
  sanctionEndDate: z.string().optional().nullable(),
  canVote: z.boolean().default(false),
  isQuarantined: z.boolean().default(false),
}).superRefine((data, ctx) => {
  if (data.status === 'sanctioned' && (!data.sanctionEndDate || data.sanctionEndDate.trim() === '')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Sanction end date is required if status is 'sanctioned'.",
      path: ["sanctionEndDate"],
    });
  }
});

type AdminEditUserFormData = z.infer<typeof adminEditUserSchema>;

export default function AdminEditUserPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useTranslation('common');
  const targetUserId = params.userId as string;

  const { user: loggedInUser, loading: authLoading } = useMockAuth();
  const { toast } = useToast();

  const [userToEdit, setUserToEdit] = useState<KratiaUser | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors }, control, reset, setValue, watch } = useForm<AdminEditUserFormData>({
    resolver: zodResolver(adminEditUserSchema),
  });

  const watchedStatus = watch("status");
  const isAdminOrFounder = loggedInUser?.role === 'admin' || loggedInUser?.role === 'founder';

  useEffect(() => {
    if (!targetUserId || !isAdminOrFounder) {
      setIsLoadingData(false);
      if (!targetUserId) setPageError(t('adminEditUser.error.missingId'));
      return;
    }

    const fetchData = async () => {
      setIsLoadingData(true);
      setPageError(null);
      try {
        const userRef = doc(db, "users", targetUserId);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const userData = { id: userSnap.id, ...userSnap.data() } as KratiaUser;
          setUserToEdit(userData);
          reset({
            username: userData.username,
            email: userData.email,
            role: (userData.role === 'founder' || userData.role === 'visitor') ? 'user' : userData.role as z.infer<typeof userRoleSchema> ,
            avatarUrl: userData.avatarUrl || "",
            location: userData.location || "",
            aboutMe: userData.aboutMe || "",
            karma: userData.karma || 0,
            status: userData.status || 'active',
            sanctionEndDate: userData.sanctionEndDate ? format(parseISO(userData.sanctionEndDate), "yyyy-MM-dd'T'HH:mm") : null,
            canVote: userData.canVote || false,
            isQuarantined: userData.isQuarantined || false,
          });
        } else {
          setPageError(t('adminEditUser.error.notFound'));
          setUserToEdit(null);
        }
      } catch (err) {
        console.error("Error fetching user data for admin edit:", err);
        setPageError(t('adminEditUser.error.loadFail'));
      } finally {
        setIsLoadingData(false);
      }
    };
    fetchData();
  }, [targetUserId, isAdminOrFounder, reset, t]);


  if (authLoading || isLoadingData) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-20rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdminOrFounder) {
    return (
      <Alert variant="destructive" className="max-w-lg mx-auto">
        <ShieldAlert className="h-5 w-5" />
        <AlertTitle>{t('adminEditUser.accessDeniedTitle')}</AlertTitle>
        <AlertDescription>{t('adminEditUser.accessDeniedDesc')}</AlertDescription>
        <Button asChild className="mt-4"><Link href="/admin">{t('adminEditUser.backToAdminButton')}</Link></Button>
      </Alert>
    );
  }

  if (pageError || !userToEdit) {
    return (
     <Alert variant="destructive" className="max-w-lg mx-auto">
       <Frown className="h-5 w-5" />
       <AlertTitle>{pageError ? t('adminEditUser.errorTitle') : t('adminEditUser.notFoundTitle')}</AlertTitle>
       <AlertDescription>{pageError || t('adminEditUser.error.genericNotFound')}</AlertDescription>
        <Button asChild className="mt-4"><Link href="/admin">{t('adminEditUser.backToAdminButton')}</Link></Button>
     </Alert>
   );
 }

  const onSubmit: SubmitHandler<AdminEditUserFormData> = async (data) => {
    if (!userToEdit) return;

    if (userToEdit.role === 'founder' && data.role !== 'founder') {
        toast({title: t('adminEditUser.toast.founderRoleImmutableTitle'), description: t('adminEditUser.toast.founderRoleImmutableDesc'), variant: "destructive"});
        return;
    }
    if (loggedInUser?.id === userToEdit.id && userToEdit.role === 'founder' && data.role !== 'founder') {
         toast({title: t('adminEditUser.toast.founderCannotChangeOwnRoleTitle'), description: t('adminEditUser.toast.founderCannotChangeOwnRoleDesc'), variant: "destructive"});
        return;
    }

    setIsSubmitting(true);
    try {
      const userRef = doc(db, "users", userToEdit.id);
      const dataToUpdate: Partial<KratiaUser> = {
        username: data.username,
        email: data.email,
        role: data.role as UserRole, 
        avatarUrl: data.avatarUrl || null,
        location: data.location || null,
        aboutMe: data.aboutMe || null,
        karma: data.karma,
        status: data.status,
        sanctionEndDate: data.status === 'sanctioned' && data.sanctionEndDate ? new Date(data.sanctionEndDate).toISOString() : null,
        canVote: data.canVote,
        isQuarantined: data.isQuarantined,
      };

      await updateDoc(userRef, dataToUpdate);
      toast({
        title: t('adminEditUser.toast.successTitle'),
        description: t('adminEditUser.toast.successDesc', { username: data.username }),
      });
      router.push('/admin');
    } catch (error) {
      console.error("Error updating user:", error);
      toast({
        title: t('adminEditUser.toast.errorTitle'),
        description: t('adminEditUser.toast.errorDesc'),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const registrationDateFormatted = userToEdit.registrationDate 
    ? format(parseISO(userToEdit.registrationDate), "PPPp")
    : t('adminEditUser.notAvailable');

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="shadow-xl">
        <CardHeader>
            <div className="flex items-start justify-between">
                <div>
                    <CardTitle className="text-2xl md:text-3xl font-bold flex items-center">
                        <UserCog className="mr-3 h-7 w-7 text-primary" />
                        {t('adminEditUser.title', { username: userToEdit.username })}
                    </CardTitle>
                    <CardDescription>
                        {t('adminEditUser.description')}
                    </CardDescription>
                </div>
                <UserAvatar user={userToEdit} size="lg" />
            </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <Label htmlFor="userId">{t('adminEditUser.userIdLabel')}</Label>
                    <Input id="userId" value={userToEdit.id} readOnly disabled className="bg-muted/30" />
                </div>
                <div>
                    <Label htmlFor="registrationDate">{t('adminEditUser.registeredLabel')}</Label>
                    <Input id="registrationDate" value={registrationDateFormatted} readOnly disabled className="bg-muted/30" />
                </div>

                <div>
                    <Label htmlFor="username">{t('adminEditUser.usernameLabel')}</Label>
                    <Input id="username" {...register("username")} className={errors.username ? "border-destructive" : ""} disabled={isSubmitting} />
                    {errors.username && <p className="text-sm text-destructive">{errors.username.message}</p>}
                </div>
                <div>
                    <Label htmlFor="email">{t('adminEditUser.emailLabel')}</Label>
                    <Input id="email" type="email" {...register("email")} className={errors.email ? "border-destructive" : ""} disabled={isSubmitting} />
                    {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
                    <p className="text-xs text-muted-foreground mt-1">{t('adminEditUser.emailChangeNote')}</p>
                </div>
                <div>
                    <Label htmlFor="role">{t('adminEditUser.roleLabel')}</Label>
                    <Controller
                        name="role"
                        control={control}
                        render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting || userToEdit.role === 'founder'}>
                            <SelectTrigger className={errors.role ? "border-destructive" : ""}>
                            <SelectValue placeholder={t('adminEditUser.rolePlaceholder')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="guest">{t('roles.guest')}</SelectItem>
                                <SelectItem value="user">{t('roles.user')}</SelectItem>
                                <SelectItem value="normal_user">{t('roles.normal_user')}</SelectItem>
                                <SelectItem value="admin">{t('roles.admin')}</SelectItem>
                                {userToEdit.role === 'founder' && <SelectItem value="founder" disabled>{t('roles.founder')} ({t('adminEditUser.roleFounderImmutable')})</SelectItem>}
                            </SelectContent>
                        </Select>
                        )}
                    />
                    {errors.role && <p className="text-sm text-destructive">{errors.role.message}</p>}
                </div>
                 <div>
                    <Label htmlFor="karma">{t('adminEditUser.karmaLabel')}</Label>
                    <Input id="karma" type="number" {...register("karma")} className={errors.karma ? "border-destructive" : ""} disabled={isSubmitting} />
                    {errors.karma && <p className="text-sm text-destructive">{errors.karma.message}</p>}
                </div>

                <div>
                    <Label htmlFor="status">{t('adminEditUser.statusLabel')}</Label>
                     <Controller
                        name="status"
                        control={control}
                        render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting}>
                            <SelectTrigger className={errors.status ? "border-destructive" : ""}>
                            <SelectValue placeholder={t('adminEditUser.statusPlaceholder')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="active">{t('userStatus.active')}</SelectItem>
                                <SelectItem value="under_sanction_process">{t('userStatus.under_sanction_process')}</SelectItem>
                                <SelectItem value="sanctioned">{t('userStatus.sanctioned')}</SelectItem>
                                <SelectItem value="pending_admission">{t('userStatus.pending_admission')}</SelectItem>
                                <SelectItem value="pending_email_verification">{t('userStatus.pending_email_verification')}</SelectItem>
                            </SelectContent>
                        </Select>
                        )}
                    />
                    {errors.status && <p className="text-sm text-destructive">{errors.status.message}</p>}
                </div>

               {watchedStatus === 'sanctioned' && (
                 <div>
                    <Label htmlFor="sanctionEndDate">{t('adminEditUser.sanctionEndDateLabel')}</Label>
                    <Input 
                        id="sanctionEndDate" 
                        type="datetime-local" 
                        {...register("sanctionEndDate")} 
                        className={errors.sanctionEndDate ? "border-destructive" : ""} 
                        disabled={isSubmitting} 
                    />
                    {errors.sanctionEndDate && <p className="text-sm text-destructive">{errors.sanctionEndDate.message}</p>}
                 </div>
               )}
            </div>

            <div className="space-y-2">
                <Label htmlFor="avatarUrl">{t('adminEditUser.avatarUrlLabel')}</Label>
                <Input id="avatarUrl" {...register("avatarUrl")} className={errors.avatarUrl ? "border-destructive" : ""} disabled={isSubmitting} placeholder="https://example.com/avatar.png"/>
                {errors.avatarUrl && <p className="text-sm text-destructive">{errors.avatarUrl.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">{t('adminEditUser.locationLabel')}</Label>
              <Input id="location" {...register("location")} className={errors.location ? "border-destructive" : ""} disabled={isSubmitting} placeholder={t('adminEditUser.locationPlaceholder')}/>
              {errors.location && <p className="text-sm text-destructive">{errors.location.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="aboutMe">{t('adminEditUser.aboutMeLabel')}</Label>
              <Textarea id="aboutMe" {...register("aboutMe")} rows={3} className={errors.aboutMe ? "border-destructive" : ""} disabled={isSubmitting} placeholder={t('adminEditUser.aboutMePlaceholder')}/>
              {errors.aboutMe && <p className="text-sm text-destructive">{errors.aboutMe.message}</p>}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="flex items-center space-x-2">
                    <Controller name="canVote" control={control} render={({ field }) => (<Checkbox id="canVote" checked={field.value} onCheckedChange={field.onChange} disabled={isSubmitting} ref={field.ref}/> )}/>
                    <Label htmlFor="canVote" className="font-normal">{t('adminEditUser.canVoteLabel')}</Label>
                </div>
                <div className="flex items-center space-x-2">
                     <Controller name="isQuarantined" control={control} render={({ field }) => (<Checkbox id="isQuarantined" checked={field.value} onCheckedChange={field.onChange} disabled={isSubmitting} ref={field.ref}/> )}/>
                    <Label htmlFor="isQuarantined" className="font-normal">{t('adminEditUser.isQuarantinedLabel')}</Label>
                </div>
            </div>

            <Alert variant="default">
                <Info className="h-4 w-4" />
                <AlertTitle>{t('adminEditUser.adminActionAlertTitle')}</AlertTitle>
                <AlertDescription>
                    {t('adminEditUser.adminActionAlertDesc')}
                </AlertDescription>
            </Alert>

            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => router.push('/admin')} disabled={isSubmitting}>
                 <CornerUpLeft className="mr-2 h-4 w-4" /> {t('adminEditUser.cancelButton')}
              </Button>
              <Button type="submit" disabled={isSubmitting} className="min-w-[150px]">
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {isSubmitting ? t('adminEditUser.savingButton') : t('adminEditUser.saveButton')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

