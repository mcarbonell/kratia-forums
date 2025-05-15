
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useMockAuth } from '@/hooks/use-mock-auth';
import type { User as KratiaUser } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Save, UserCog, ShieldAlert, Frown, CornerUpLeft } from 'lucide-react';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

const profileFormSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters.").max(50, "Username cannot exceed 50 characters."),
  location: z.string().max(100, "Location cannot exceed 100 characters.").optional().or(z.literal('')),
  aboutMe: z.string().max(500, "About me cannot exceed 500 characters.").optional().or(z.literal('')),
  avatarUrl: z.string().url("Please enter a valid URL for your avatar.").or(z.literal('')).optional(),
});

type ProfileFormData = z.infer<typeof profileFormSchema>;

export default function EditProfilePage() {
  const router = useRouter();
  const { user: loggedInUser, loading: authLoading } = useMockAuth();
  const { toast } = useToast();
  
  const [profileUser, setProfileUser] = useState<KratiaUser | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
  });

  useEffect(() => {
    if (authLoading) return;
    if (!loggedInUser || loggedInUser.role === 'visitor') {
      setIsLoadingUser(false);
      setError("You must be logged in to edit your profile.");
      // router.push('/auth/login'); // Or show an access denied message
      return;
    }

    const fetchUserProfile = async () => {
      setIsLoadingUser(true);
      setError(null);
      try {
        const userRef = doc(db, "users", loggedInUser.id);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data() as KratiaUser;
          setProfileUser(userData);
          // Pre-fill form
          setValue("username", userData.username);
          setValue("location", userData.location || "");
          setValue("aboutMe", userData.aboutMe || "");
          setValue("avatarUrl", userData.avatarUrl || "");
        } else {
          setError("User profile not found. This should not happen if you are logged in.");
        }
      } catch (err) {
        console.error("Error fetching user profile for edit:", err);
        setError("Failed to load your profile data. Please try again.");
      } finally {
        setIsLoadingUser(false);
      }
    };

    fetchUserProfile();
  }, [loggedInUser, authLoading, router, setValue]);

  const onSubmit: SubmitHandler<ProfileFormData> = async (data) => {
    if (!profileUser || !loggedInUser) {
      toast({ title: "Error", description: "User not found.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const userRef = doc(db, "users", loggedInUser.id);
      await updateDoc(userRef, {
        username: data.username,
        location: data.location || null, // Store null if empty
        aboutMe: data.aboutMe || null,   // Store null if empty
        avatarUrl: data.avatarUrl || null, // Store null if empty
      });

      // IMPORTANT: If username or avatarUrl are changed,
      // denormalized instances in posts/threads are NOT updated by this simple update.
      // A more complex solution (e.g., Cloud Functions) would be needed for that.
      // For now, we will accept this limitation.

      toast({
        title: "Profile Updated!",
        description: "Your profile has been successfully updated.",
      });
      router.push(`/profile/${loggedInUser.id}`);
    } catch (err) {
      console.error("Error updating profile:", err);
      toast({
        title: "Update Failed",
        description: "Could not update your profile. Please try again.",
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
        <p className="ml-4 text-muted-foreground">Loading profile editor...</p>
      </div>
    );
  }

  if (error || !profileUser) {
    return (
      <Alert variant="destructive" className="max-w-lg mx-auto">
        <Frown className="h-5 w-5" />
        <AlertTitle>{error ? "Error" : "Cannot Edit Profile"}</AlertTitle>
        <AlertDescription>
          {error || "You might not have permission or your profile data could not be loaded."}
        </AlertDescription>
        <Button asChild className="mt-4">
          <Link href={loggedInUser ? `/profile/${loggedInUser.id}` : "/"}>
            <CornerUpLeft className="mr-2 h-4 w-4" />
            Back to {loggedInUser ? 'Profile' : 'Homepage'}
          </Link>
        </Button>
      </Alert>
    );
  }
  
  if (!loggedInUser || loggedInUser.role === 'visitor') {
     return (
      <Alert variant="destructive" className="max-w-lg mx-auto">
        <ShieldAlert className="h-5 w-5" />
        <AlertTitle>Access Denied</AlertTitle>
        <AlertDescription>
          You must be logged in to edit your profile.
        </AlertDescription>
        <Button asChild className="mt-4">
          <Link href="/auth/login">Login</Link>
        </Button>
      </Alert>
    );
  }


  return (
    <div className="max-w-2xl mx-auto">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl md:text-3xl font-bold flex items-center">
            <UserCog className="mr-3 h-7 w-7 text-primary" />
            Edit Your Profile
          </CardTitle>
          <CardDescription>
            Update your personal information. This information will be visible to other users.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Your new username"
                {...register("username")}
                className={errors.username ? "border-destructive" : ""}
                disabled={isSubmitting}
              />
              {errors.username && <p className="text-sm text-destructive">{errors.username.message}</p>}
              <p className="text-xs text-muted-foreground">Changing your username might not update it in old posts immediately.</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email (read-only)</Label>
              <Input
                id="email"
                type="email"
                value={profileUser.email}
                readOnly
                disabled
                className="bg-muted/50"
              />
               <p className="text-xs text-muted-foreground">Email address cannot be changed here.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="avatarUrl">Avatar URL</Label>
              <Input
                id="avatarUrl"
                type="url"
                placeholder="https://example.com/your-avatar.png"
                {...register("avatarUrl")}
                className={errors.avatarUrl ? "border-destructive" : ""}
                disabled={isSubmitting}
              />
              {errors.avatarUrl && <p className="text-sm text-destructive">{errors.avatarUrl.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                type="text"
                placeholder="City, Country"
                {...register("location")}
                className={errors.location ? "border-destructive" : ""}
                disabled={isSubmitting}
              />
              {errors.location && <p className="text-sm text-destructive">{errors.location.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="aboutMe">About Me</Label>
              <Textarea
                id="aboutMe"
                placeholder="Tell us a little about yourself..."
                rows={5}
                {...register("aboutMe")}
                className={errors.aboutMe ? "border-destructive" : ""}
                disabled={isSubmitting}
              />
              {errors.aboutMe && <p className="text-sm text-destructive">{errors.aboutMe.message}</p>}
            </div>
            
            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => router.push(`/profile/${loggedInUser.id}`)} disabled={isSubmitting}>
                    Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="min-w-[120px]">
                {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                    <Save className="mr-2 h-4 w-4" />
                )}
                Save Changes
                </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
