
"use client";

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm, type SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

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
import { collection, addDoc, getDocs, query, orderBy } from 'firebase/firestore';
import { Loader2, ShieldAlert, PlusCircle, CornerUpLeft, Frown } from 'lucide-react';

const forumSchema = z.object({
  name: z.string().min(3, "Forum name must be at least 3 characters.").max(100, "Forum name cannot exceed 100 characters."),
  description: z.string().min(10, "Description must be at least 10 characters.").max(500, "Description cannot exceed 500 characters."),
  categoryId: z.string().min(1, "You must select a category."),
  isPublic: z.boolean().default(true),
  isAgora: z.boolean().default(false), // Usually disabled for manual creation
});

type ForumFormData = z.infer<typeof forumSchema>;

export default function CreateForumPage() {
  const { user: loggedInUser, loading: authLoading } = useMockAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors }, control, reset } = useForm<ForumFormData>({
    resolver: zodResolver(forumSchema),
    defaultValues: {
      isPublic: true,
      isAgora: false,
    },
  });

  const isAdminOrFounder = loggedInUser?.role === 'admin' || loggedInUser?.role === 'founder';

  useEffect(() => {
    if (!isAdminOrFounder) {
      setIsLoadingCategories(false);
      return;
    }
    const fetchCategories = async () => {
      setIsLoadingCategories(true);
      try {
        const categoriesQuery = query(collection(db, "categories"), orderBy("name"));
        const categoriesSnapshot = await getDocs(categoriesQuery);
        const fetchedCategories = categoriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ForumCategory));
        setCategories(fetchedCategories);
        if (fetchedCategories.length === 0) {
            setPageError("No categories found. Please create a category before creating a forum.");
        }
      } catch (err) {
        console.error("Error fetching categories:", err);
        setPageError("Failed to load categories. Please try again.");
      } finally {
        setIsLoadingCategories(false);
      }
    };
    fetchCategories();
  }, [isAdminOrFounder]);

  if (authLoading || (isAdminOrFounder && isLoadingCategories)) {
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
        <AlertDescription>You do not have permission to create forums.</AlertDescription>
        <Button asChild className="mt-4"><Link href="/admin">Back to Admin Panel</Link></Button>
      </Alert>
    );
  }
  
  if (pageError) {
     return (
      <Alert variant="destructive" className="max-w-lg mx-auto">
        <Frown className="h-5 w-5" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{pageError}</AlertDescription>
         <Button asChild className="mt-4"><Link href="/admin">Back to Admin Panel</Link></Button>
      </Alert>
    );
  }

  const onSubmit: SubmitHandler<ForumFormData> = async (data) => {
    setIsSubmitting(true);
    try {
      const newForumData: Omit<Forum, 'id' | 'subForums'> = {
        name: data.name,
        description: data.description,
        categoryId: data.categoryId,
        isPublic: data.isPublic,
        isAgora: false, // Forcing to false, as 'agora' is special
        threadCount: 0,
        postCount: 0,
      };
      await addDoc(collection(db, "forums"), newForumData);
      toast({
        title: "Forum Created!",
        description: `Forum "${data.name}" has been successfully created.`,
      });
      router.push('/admin');
    } catch (error) {
      console.error("Error creating forum:", error);
      toast({
        title: "Error Creating Forum",
        description: "Could not create the forum. Please try again.",
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
            Create New Forum
          </CardTitle>
          <CardDescription>
            Fill in the details below to add a new forum to Kratia.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Forum Name</Label>
              <Input
                id="name"
                {...register("name")}
                className={errors.name ? "border-destructive" : ""}
                disabled={isSubmitting}
                placeholder="e.g., Introductions, Tech Talk"
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                {...register("description")}
                rows={4}
                className={errors.description ? "border-destructive" : ""}
                disabled={isSubmitting}
                placeholder="A brief description of what this forum is about."
              />
              {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="categoryId">Category</Label>
              <Controller
                name="categoryId"
                control={control}
                render={({ field }) => (
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={isSubmitting || categories.length === 0}
                  >
                    <SelectTrigger className={errors.categoryId ? "border-destructive" : ""}>
                      <SelectValue placeholder="Select a category" />
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
                Publicly visible (guests can view threads and posts)
              </Label>
            </div>

            <div className="flex items-center space-x-2 opacity-50 cursor-not-allowed" title="The 'Agora' forum is special and cannot be created or modified through this form.">
              <Checkbox id="isAgora" checked={false} disabled={true} />
              <Label htmlFor="isAgora" className="font-normal text-muted-foreground">
                Is Agora Forum (Special Votation Forum - Disabled)
              </Label>
            </div>


            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => router.push('/admin')} disabled={isSubmitting}>
                <CornerUpLeft className="mr-2 h-4 w-4" /> Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || categories.length === 0} className="min-w-[150px]">
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                Create Forum
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
