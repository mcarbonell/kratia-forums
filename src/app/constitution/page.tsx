
"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FileText, Loader2, AlertTriangle } from "lucide-react";
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { SiteSettings } from '@/lib/types';

export default function ConstitutionPage() {
  const [constitutionText, setConstitutionText] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    const fetchConstitution = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const constitutionRef = doc(db, "site_settings", "constitution"); // Changed "main_constitution" to "constitution"
        const docSnap = await getDoc(constitutionRef);

        if (docSnap.exists()) {
          const data = docSnap.data() as SiteSettings;
          setConstitutionText(data.constitutionText || "The constitution text is not available.");
          if (data.lastUpdated) {
            setLastUpdated(new Date(data.lastUpdated).toLocaleString());
          }
        } else {
          setError("Constitution document not found in the database. Please ensure it has been seeded.");
          setConstitutionText("The constitution is currently unavailable.");
        }
      } catch (err) {
        console.error("Error fetching constitution:", err);
        setError("Failed to load the constitution. Please try again later.");
        setConstitutionText("An error occurred while loading the constitution.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchConstitution();
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-20rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">Loading Constitution...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center">
          <FileText className="mr-3 h-8 w-8 text-primary" />
          Normas y Condiciones (Constitución)
        </h1>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-5 w-5" />
          <AlertTitle>Error Loading Constitution</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Constitución de Kratia Forums</CardTitle>
          {lastUpdated && <p className="text-xs text-muted-foreground">Last updated: {lastUpdated}</p>}
        </CardHeader>
        <CardContent>
          {constitutionText ? (
            <ScrollArea className="h-[calc(100vh-25rem)] p-4 border rounded-md bg-background/50">
              <div 
                className="prose prose-sm sm:prose lg:prose-lg xl:prose-xl max-w-none dark:prose-invert" 
                dangerouslySetInnerHTML={{ 
                  __html: constitutionText
                            .replace(/\n\n/g, '<br /><br />') // Preserve double newlines as paragraph breaks
                            .replace(/\n/g, '<br />')         // Single newlines as line breaks
                            .replace(/^## (.*?)(<br \/>|$)/gm, '<h2>$1</h2>') // Headlines
                            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
                            .replace(/\*(.*?)\*/g, '<em>$1</em>')         // Italics
                }} 
              />
            </ScrollArea>
          ) : (
            !error && <p>No constitution text available.</p> 
          )}
        </CardContent>
      </Card>
    </div>
  );
}
