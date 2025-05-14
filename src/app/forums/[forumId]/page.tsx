
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquareText } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface ForumPageProps {
  params: {
    forumId: string;
  };
}

export default function ForumPage({ params }: ForumPageProps) {
  const { forumId } = params;

  // In a real app, you would fetch forum details based on forumId
  // For now, we'll just display the ID

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center">
          <MessageSquareText className="mr-3 h-8 w-8 text-primary" />
          Forum: {forumId}
        </h1>
        <Button asChild>
          <Link href="/">Back to Forums List</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Welcome to Forum {forumId}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            You are currently viewing forum with ID: <strong>{forumId}</strong>.
          </p>
          <p className="mt-4 text-lg font-semibold">
            The content for this forum, including threads and posts, is currently under construction. 
            Please check back soon!
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
