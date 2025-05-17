
"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useMockAuth } from '@/hooks/use-mock-auth';
import { useToast } from '@/hooks/use-toast';
import type { ForumCategory } from '@/lib/types';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Loader2, ShieldAlert, Edit3, CornerUpLeft, Save, Frown } from 'lucide-react';

const categorySchema = z.object({
  name: z.string().min(3, "Category name must be at least 3 characters.").max(100, "Category name cannot exceed 100 characters."),
  description: z.string().max(500, "Description cannot exceed 500 characters.").optional().or(z.literal('')),
});

type CategoryFormData = z.infer<typeof categorySchema>;

export default function EditCategoryPage() {
  const params = useParams();
  const router = useRouter();
  const categoryId = params.categoryId as string;

  const { user: loggedInUser, loading: authLoading } = useMockAuth();
  const { toast } = useToast();

  const [currentCategory, setCurrentCategory] = useState<ForumCategory | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors }, reset } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
  });

  const isAdminOrFounder = loggedInUser?.role === 'admin' || loggedInUser?.role === 'founder';

  useEffect(() => {
    if (!categoryId || !isAdminOrFounder) {
      setIsLoadingData(false);
      if (!categoryId) setPageError("Category ID is missing.");
      return;
    }

    const fetchData = async () => {
      setIsLoadingData(true);
      setPageError(null);
      try {
        const categoryRef = doc(db, "categories", categoryId);
        const categorySnap = await getDoc(categoryRef);

        if (categorySnap.exists()) {
          const categoryData = { id: categorySnap.id, ...categorySnap.data() } as ForumCategory;
          setCurrentCategory(categoryData);
          reset({ // Pre-fill form
            name: categoryData.name,
            description: categoryData.description || "",
          });
        } else {
          setPageError("Category not found.");
          setCurrentCategory(null);
        }
      } catch (err) {
        console.error("Error fetching category for edit page:", err);
        setPageError("Failed to load category data. Please try again.");
      } finally {
        setIsLoadingData(false);
      }
    };
    fetchData();
  }, [categoryId, isAdminOrFounder, reset]);


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
        <AlertTitle>Access Denied</AlertTitle>
        <AlertDescription>You do not have permission to edit categories.</AlertDescription>
        <Button asChild className="mt-4"><Link href="/admin">Back to Admin Panel</Link></Button>
      </Alert>
    );
  }

  if (pageError || !currentCategory) {
    return (
     <Alert variant="destructive" className="max-w-lg mx-auto">
       <Frown className="h-5 w-5" />
       <AlertTitle>{pageError ? "Error" : "Category Not Found"}</AlertTitle>
       <AlertDescription>{pageError || "The category you are trying to edit could not be found."}</AlertDescription>
        <Button asChild className="mt-4"><Link href="/admin">Back to Admin Panel</Link></Button>
     </Alert>
   );
 }

  const onSubmit: SubmitHandler<CategoryFormData> = async (data) => {
    if (!currentCategory) return;
    setIsSubmitting(true);
    try {
      const categoryRef = doc(db, "categories", currentCategory.id);
      const dataToUpdate = {
        name: data.name,
        description: data.description || "",
      };

      await updateDoc(categoryRef, dataToUpdate);
      toast({
        title: "Category Updated!",
        description: `Category "${data.name}" has been successfully updated.`,
      });
      router.push('/admin');
    } catch (error) {
      console.error("Error updating category:", error);
      toast({
        title: "Error Updating Category",
        description: "Could not update the category. Please try again.",
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
            Edit Category: {currentCategory.name}
          </CardTitle>
          <CardDescription>
            Modify the details of this category.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Category Name</Label>
              <Input
                id="name"
                {...register("name")}
                className={errors.name ? "border-destructive" : ""}
                disabled={isSubmitting}
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                {...register("description")}
                rows={4}
                className={errors.description ? "border-destructive" : ""}
                disabled={isSubmitting}
              />
              {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => router.push('/admin')} disabled={isSubmitting}>
                 <CornerUpLeft className="mr-2 h-4 w-4" /> Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="min-w-[150px]">
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

    