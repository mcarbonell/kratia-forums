
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, ShieldCheck, UserX } from "lucide-react";
import { useMockAuth, type LoginResult } from "@/hooks/use-mock-auth"; 
import { useState, type FormEvent } from "react";
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';


export default function LoginPage() {
  const { login } = useMockAuth(); 
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [sanctionError, setSanctionError] = useState<{username?: string; endDate?: string} | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setSanctionError(null);

    const result: LoginResult = login(email, password);

    if (result.success) {
      router.push('/'); // Redirect to home page after successful login
    } else {
      if (result.reason === 'sanctioned') {
        setSanctionError({username: result.username, endDate: result.sanctionEndDate});
        setError(`User ${result.username} is sanctioned. Access denied.`);
      } else if (result.reason === 'not_found') {
        setError("User not found or credentials invalid. Please check your email/password.");
      }
      else {
        setError("Failed to login. Please check your credentials.");
      }
      console.error("Login failed:", result.reason);
    }
  };

  return (
    <div className="flex items-center justify-center py-12">
      <Card className="mx-auto max-w-sm w-full shadow-xl">
        <CardHeader className="text-center">
          <div className="inline-block mx-auto mb-4">
            {sanctionError ? <UserX className="h-16 w-16 text-destructive" /> : <ShieldCheck className="h-16 w-16 text-primary" />}
          </div>
          <CardTitle className="text-3xl font-bold">
            {sanctionError ? "Access Denied" : "Welcome Back!"}
          </CardTitle>
          <CardDescription>
            {sanctionError 
              ? `User ${sanctionError.username} is currently sanctioned.` 
              : "Enter your credentials to access your Kratia account."}
             {sanctionError?.endDate && (
                <span className="block mt-1 text-sm text-destructive">
                  Sanction ends: {format(new Date(sanctionError.endDate), "PPPp")}
                </span>
              )}
          </CardDescription>
        </CardHeader>
        {!sanctionError && (
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email">Email or Username</Label>
                <Input 
                  id="email" 
                  type="text" // Changed to text to allow usernames like 'sam'
                  placeholder="m@example.com or username" 
                  required 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Password</Label>
                  <Link href="#" className="ml-auto inline-block text-sm underline text-muted-foreground hover:text-primary">
                    Forgot your password?
                  </Link>
                </div>
                <Input 
                  id="password" 
                  type="password" 
                  required 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && !sanctionError && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full">
                <LogIn className="mr-2 h-5 w-5" /> Login
              </Button>
            </form>
            <div className="mt-6 text-center text-sm">
              Don&apos;t have an account?{" "}
              <Link href="/auth/signup" className="underline font-medium text-primary hover:text-primary/80">
                Sign up
              </Link>
            </div>
          </CardContent>
        )}
        {sanctionError && (
            <CardContent className="text-center">
                 <Button asChild className="mt-4">
                    <Link href="/">Continue as Visitor</Link>
                </Button>
            </CardContent>
        )}
      </Card>
    </div>
  );
}
