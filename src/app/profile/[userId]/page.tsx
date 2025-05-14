
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User } from "lucide-react";
import UserAvatar from "@/components/user/UserAvatar"; // Assuming UserAvatar can handle null user for placeholder
import { mockUsers } from "@/lib/mockData"; // For placeholder data, if needed

interface UserProfilePageProps {
  params: {
    userId: string;
  };
}

export default function UserProfilePage({ params }: UserProfilePageProps) {
  const { userId } = params;

  // In a real app, fetch user details based on userId.
  // For this placeholder, we can try to find a mock user or just display the ID.
  const user = mockUsers.find(u => u.id === userId);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center">
          <User className="mr-3 h-8 w-8 text-primary" />
          User Profile: {user ? user.username : userId}
        </h1>
      </div>

      <Card className="shadow-xl">
        <CardHeader className="items-center text-center">
            <UserAvatar user={user} size="lg" className="mb-4" />
          <CardTitle className="text-2xl">{user ? user.username : `User ${userId}`}</CardTitle>
          {user?.location && <p className="text-muted-foreground">{user.location}</p>}
        </CardHeader>
        <CardContent>
          {user?.aboutMe && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">About Me</h3>
              <p className="text-muted-foreground p-4 bg-muted/50 rounded-md">{user.aboutMe}</p>
            </div>
          )}
           <p className="mt-4 text-lg font-semibold text-center">
            Full profile details and activity are currently under construction. 
            Please check back soon!
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
