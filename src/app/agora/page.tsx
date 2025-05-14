
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Vote } from "lucide-react";

export default function AgoraPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center">
          <Vote className="mr-3 h-8 w-8 text-primary" />
          The Agora - Community Votations
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Welcome to the Agora</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            This is the Agora, where binding community decisions are made. 
            Propose initiatives, debate, and cast your vote to shape the future of Kratia.
          </p>
          <p className="mt-4 text-lg font-semibold">
            This page is currently under construction. Check back soon for full functionality!
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
