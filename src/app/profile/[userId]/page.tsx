
"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { User as UserIcon, CalendarDays, Award, MapPin, FileText, Loader2, Frown, Edit, ShieldAlert } from "lucide-react";
import UserAvatar from "@/components/user/UserAvatar";
import type { User as KratiaUser } from '@/lib/types';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useMockAuth } from '@/hooks/use-mock-auth';
import { KRATIA_CONFIG } from '@/lib/config';


export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user: loggedInUser } = useMockAuth();
  const userId = params.userId as string;

  const [profileUser, setProfileUser] = useState<KratiaUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setError("User ID is missing from the URL.");
      setIsLoading(false);
      return;
    }

    const fetchUserProfile = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const userRef = doc(db, "users", userId);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          setProfileUser({ id: userSnap.id, ...userSnap.data(), status: userSnap.data().status || 'active' } as KratiaUser);
        } else {
          setError("User not found. This profile does not exist or could not be loaded.");
          setProfileUser(null);
        }
      } catch (err) {
        console.error("Error fetching user profile:", err);
        setError("Failed to load user profile. Please try again later.");
        setProfileUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserProfile();
  }, [userId]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-20rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">Loading profile...</p>
      </div>
    );
  }

  if (error || !profileUser) {
    return (
      <Alert variant="destructive" className="max-w-lg mx-auto">
        <Frown className="h-5 w-5" />
        <AlertTitle>{error ? "Error Loading Profile" : "Profile Not Found"}</AlertTitle>
        <AlertDescription>
          {error || "The user profile you are looking for could not be displayed."}
        </AlertDescription>
        <Button asChild className="mt-4">
          <Link href="/">Go to Homepage</Link>
        </Button>
      </Alert>
    );
  }
  
  const registrationDate = profileUser.registrationDate 
    ? formatDistanceToNow(new Date(profileUser.registrationDate), { addSuffix: true }) 
    : 'Unknown';

  const isOwnProfile = loggedInUser?.id === profileUser.id;
  const canProposeSanction = loggedInUser && 
                            loggedInUser.id !== profileUser.id &&
                            loggedInUser.canVote &&
                            loggedInUser.status === 'active' &&
                            profileUser.status !== 'sanctioned'; // Don't allow sanctioning an already sanctioned user via this button.

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <h1 className="text-3xl font-bold flex items-center">
          <UserIcon className="mr-3 h-8 w-8 text-primary" />
          {profileUser.username}'s Profile
        </h1>
        <div className="flex gap-2">
          {isOwnProfile && (
            <Button variant="outline" asChild>
              <Link href={`/profile/edit`}> 
                <Edit className="mr-2 h-4 w-4" /> Edit Profile
              </Link>
            </Button>
          )}
          {canProposeSanction && (
            <Button variant="destructive" asChild>
              <Link href={`/users/${profileUser.id}/propose-sanction`}>
                <ShieldAlert className="mr-2 h-4 w-4" /> Propose Sanction
              </Link>
            </Button>
          )}
        </div>
      </div>

      {profileUser.status === 'under_sanction_process' && (
        <Alert variant="destructive">
          <ShieldAlert className="h-5 w-5" />
          <AlertTitle>User Under Sanction Process</AlertTitle>
          <AlertDescription>
            This user is currently undergoing a community sanction votation process. Some actions might be restricted.
          </AlertDescription>
        </Alert>
      )}
       {profileUser.status === 'sanctioned' && (
        <Alert variant="default" className="border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 [&>svg]:text-amber-600">
          <ShieldAlert className="h-5 w-5" />
          <AlertTitle>User Sanctioned</AlertTitle>
          <AlertDescription>
            This user is currently sanctioned.
            {profileUser.sanctionEndDate && ` Sanction ends: ${new Date(profileUser.sanctionEndDate).toLocaleDateString()}`}
          </AlertDescription>
        </Alert>
      )}


      <Card className="shadow-xl overflow-hidden">
        <CardHeader className="bg-muted/30 p-6 flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
          <UserAvatar user={profileUser} size="lg" className="flex-shrink-0 border-2 border-primary shadow-md" />
          <div className="flex-grow">
            <CardTitle className="text-3xl font-semibold">{profileUser.username}</CardTitle>
            <CardDescription className="text-md mt-1">
              {profileUser.email}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-background/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <CalendarDays className="mr-2 h-5 w-5 text-primary" /> Member Since
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{registrationDate}</p>
              </CardContent>
            </Card>

            <Card className="bg-background/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <Award className="mr-2 h-5 w-5 text-primary" /> Karma
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-accent">{profileUser.karma || 0}</p>
              </CardContent>
            </Card>

            {profileUser.location && (
              <Card className="bg-background/50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <MapPin className="mr-2 h-5 w-5 text-primary" /> Location
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{profileUser.location}</p>
                </CardContent>
              </Card>
            )}
            
            {profileUser.aboutMe && (
              <Card className="md:col-span-2 bg-background/50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <FileText className="mr-2 h-5 w-5 text-primary" /> About Me
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground whitespace-pre-line">{profileUser.aboutMe}</p>
                </CardContent>
              </Card>
            )}
          </div>
          
          <div className="mt-8 border-t pt-6">
            <h3 className="text-xl font-semibold mb-4 text-center">User Activity</h3>
            <p className="text-muted-foreground text-center">
              User activity feed (recent posts, threads, etc.) is under construction. Check back soon!
            </p>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}
