
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useMockAuth } from '@/hooks/use-mock-auth';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { Loader2, ShieldAlert, PlusCircle, CornerUpLeft, Frown } from 'lucide-react';

const categorySchema = z.object({
  name: z.string().min(3, "Category name must be at least 3 characters.").max(100, "Category name cannot exceed 100 characters."),
  description: z.string().max(500, "Description cannot exceed 500 characters.").optional().or(z.literal('')),
});

type CategoryFormData = z.infer<typeof categorySchema>;

export default function CreateCategoryPage() {
  const { user: loggedInUser, loading: authLoading } = useMockAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useTranslation('common');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors }, reset } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
        name: '',
        description: ''
    }
  });

  const isAdminOrFounder = loggedInUser?.role === 'admin' || loggedInUser?.role === 'founder';

  if (authLoading) {
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
        <AlertTitle>{t('adminCreateCategory.accessDeniedTitle')}</AlertTitle>
        <AlertDescription>{t('adminCreateCategory.accessDeniedDesc')}</AlertDescription>
        <Button asChild className="mt-4"><Link href="/admin">{t('adminCreateCategory.backToAdminButton')}</Link></Button>
      </Alert>
    );
  }
  
  if (pageError) {
     return (
      <Alert variant="destructive" className="max-w-lg mx-auto">
        <Frown className="h-5 w-5" />
        <AlertTitle>{t('adminCreateCategory.errorTitle')}</AlertTitle>
        <AlertDescription>{pageError}</AlertDescription>
         <Button asChild className="mt-4"><Link href="/admin">{t('adminCreateCategory.backToAdminButton')}</Link></Button>
      </Alert>
    );
  }

  const onSubmit: SubmitHandler<CategoryFormData> = async (data) => {
    setIsSubmitting(true);
    try {
      const newCategoryData = {
        name: data.name,
        description: data.description || "",
      };
      await addDoc(collection(db, "categories"), newCategoryData);
      toast({
        title: t('adminCreateCategory.toast.successTitle'),
        description: t('adminCreateCategory.toast.successDesc', { categoryName: data.name }),
      });
      router.push('/admin');
    } catch (error) {
      console.error("Error creating category:", error);
      toast({
        title: t('adminCreateCategory.toast.errorTitle'),
        description: t('adminCreateCategory.toast.errorDesc'),
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
            <PlusCircle className="mr-3 h-7 w-7 text-primary" />
            {t('adminCreateCategory.title')}
          </CardTitle>
          <CardDescription>
            {t('adminCreateCategory.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">{t('adminCreateCategory.nameLabel')}</Label>
              <Input
                id="name"
                {...register("name")}
                className={errors.name ? "border-destructive" : ""}
                disabled={isSubmitting}
                placeholder={t('adminCreateCategory.namePlaceholder')}
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t('adminCreateCategory.descriptionLabel')}</Label>
              <Textarea
                id="description"
                {...register("description")}
                rows={4}
                className={errors.description ? "border-destructive" : ""}
                disabled={isSubmitting}
                placeholder={t('adminCreateCategory.descriptionPlaceholder')}
              />
              {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => router.push('/admin')} disabled={isSubmitting}>
                <CornerUpLeft className="mr-2 h-4 w-4" /> {t('adminCreateCategory.cancelButton')}
              </Button>
              <Button type="submit" disabled={isSubmitting} className="min-w-[150px]">
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                {isSubmitting ? t('adminCreateCategory.creatingButton') : t('adminCreateCategory.createButton')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
    
