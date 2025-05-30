
"use client";

import { useState, useEffect, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm, type SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useMockAuth } from '@/hooks/use-mock-auth';
import { useToast } from '@/hooks/use-toast';
import type { ForumCategory, Forum } from '@/lib/types';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { Loader2, ShieldAlert, Edit3, CornerUpLeft, Save, Frown } from 'lucide-react';

const forumSchema = z.object({
  name: z.string().min(3, "Forum name must be at least 3 characters.").max(100, "Forum name cannot exceed 100 characters."),
  description: z.string().min(10, "Description must be at least 10 characters.").max(500, "Description cannot exceed 500 characters."),
  categoryId: z.string().min(1, "You must select a category."),
  isPublic: z.boolean().default(true),
  isAgora: z.boolean().default(false), 
});

type ForumFormData = z.infer<typeof forumSchema>;

export default function EditForumPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useTranslation('common');
  const forumId = params.forumId as string;

  const { user: loggedInUser, loading: authLoading } = useMockAuth();
  const { toast } = useToast();

  const [currentForum, setCurrentForum] = useState<Forum | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors }, control, reset, setValue } = useForm<ForumFormData>({
    resolver: zodResolver(forumSchema),
  });

  const isAdminOrFounder = loggedInUser?.role === 'admin' || loggedInUser?.role === 'founder';

  useEffect(() => {
    if (!forumId || !isAdminOrFounder) {
      setIsLoadingData(false);
      if (!forumId) setPageError(t('adminEditForum.error.missingId'));
      return;
    }

    const fetchData = async () => {
      setIsLoadingData(true);
      setPageError(null);
      try {
        const categoriesQuery = query(collection(db, "categories"), orderBy("name"));
        const categoriesSnapshot = await getDocs(categoriesQuery);
        const fetchedCategories = categoriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ForumCategory));
        setCategories(fetchedCategories);

        if (fetchedCategories.length === 0) {
             setPageError(t('adminEditForum.error.noCategories'));
        }

        const forumRef = doc(db, "forums", forumId);
        const forumSnap = await getDoc(forumRef);

        if (forumSnap.exists()) {
          const forumData = { id: forumSnap.id, ...forumSnap.data() } as Forum;
          setCurrentForum(forumData);
          reset({ 
            name: forumData.name,
            description: forumData.description,
            categoryId: forumData.categoryId || "",
            isPublic: forumData.isPublic === undefined ? true : forumData.isPublic,
            isAgora: forumData.isAgora || false,
          });
        } else {
          setPageError(t('adminEditForum.error.notFound'));
          setCurrentForum(null);
        }
      } catch (err) {
        console.error("Error fetching data for edit forum page:", err);
        setPageError(t('adminEditForum.error.loadFail'));
      } finally {
        setIsLoadingData(false);
      }
    };
    fetchData();
  }, [forumId, isAdminOrFounder, reset, t]);


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
        <AlertTitle>{t('adminEditForum.accessDeniedTitle')}</AlertTitle>
        <AlertDescription>{t('adminEditForum.accessDeniedDesc')}</AlertDescription>
        <Button asChild className="mt-4"><Link href="/admin">{t('adminEditForum.backToAdminButton')}</Link></Button>
      </Alert>
    );
  }

  if (pageError || !currentForum) {
    return (
     <Alert variant="destructive" className="max-w-lg mx-auto">
       <Frown className="h-5 w-5" />
       <AlertTitle>{pageError ? t('adminEditForum.errorTitle') : t('adminEditForum.notFoundTitle')}</AlertTitle>
       <AlertDescription>{pageError || t('adminEditForum.error.genericNotFound')}</AlertDescription>
        <Button asChild className="mt-4"><Link href="/admin">{t('adminEditForum.backToAdminButton')}</Link></Button>
     </Alert>
   );
 }

  const onSubmit: SubmitHandler<ForumFormData> = async (data) => {
    if (!currentForum) return;
    setIsSubmitting(true);
    try {
      const forumRef = doc(db, "forums", currentForum.id);
      const dataToUpdate: Partial<Forum> = {
        name: data.name,
        description: data.description,
        categoryId: data.categoryId,
        isPublic: data.isPublic,
      };

      await updateDoc(forumRef, dataToUpdate);
      toast({
        title: t('adminEditForum.toast.successTitle'),
        description: t('adminEditForum.toast.successDesc', { forumName: data.name }),
      });
      router.push('/admin');
    } catch (error) {
      console.error("Error updating forum:", error);
      toast({
        title: t('adminEditForum.toast.errorTitle'),
        description: t('adminEditForum.toast.errorDesc'),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl md:text-3xl font-bold flex items-center">
            <Edit3 className="mr-3 h-7 w-7 text-primary" />
            {t('adminEditForum.title', { forumName: currentForum.name })}
          </CardTitle>
          <CardDescription>
            {t('adminEditForum.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">{t('adminEditForum.nameLabel')}</Label>
              <Input
                id="name"
                {...register("name")}
                className={errors.name ? "border-destructive" : ""}
                disabled={isSubmitting}
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t('adminEditForum.descriptionLabel')}</Label>
              <Textarea
                id="description"
                {...register("description")}
                rows={4}
                className={errors.description ? "border-destructive" : ""}
                disabled={isSubmitting}
              />
              {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="categoryId">{t('adminEditForum.categoryLabel')}</Label>
              <Controller
                name="categoryId"
                control={control}
                render={({ field }) => (
                  <Select
                    onValueChange={field.onChange}
                    value={field.value} 
                    disabled={isSubmitting || categories.length === 0}
                  >
                    <SelectTrigger className={errors.categoryId ? "border-destructive" : ""}>
                      <SelectValue placeholder={t('adminEditForum.categoryPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.categoryId && <p className="text-sm text-destructive">{errors.categoryId.message}</p>}
            </div>
            
            <div className="flex items-center space-x-2">
              <Controller
                name="isPublic"
                control={control}
                render={({ field }) => (
                    <Checkbox
                        id="isPublic"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={isSubmitting}
                        ref={field.ref}
                    />
                )}
               />
              <Label htmlFor="isPublic" className="font-normal">
                {t('adminEditForum.isPublicLabel')}
              </Label>
            </div>

            <div className="flex items-center space-x-2 opacity-50 cursor-not-allowed" title={t('adminEditForum.isAgoraTooltip')}>
               <Controller
                name="isAgora"
                control={control}
                render={({ field }) => (
                     <Checkbox id="isAgora" checked={field.value} disabled={true} />
                )}
                />
              <Label htmlFor="isAgora" className="font-normal text-muted-foreground">
                {t('adminEditForum.isAgoraLabel')}
              </Label>
            </div>


            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => router.push('/admin')} disabled={isSubmitting}>
                 <CornerUpLeft className="mr-2 h-4 w-4" /> {t('adminEditForum.cancelButton')}
              </Button>
              <Button type="submit" disabled={isSubmitting || categories.length === 0} className="min-w-[150px]">
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {t('adminEditForum.saveButton')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

