
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, ShieldCheck, UserX, Home, Clock } from "lucide-react";
import { useMockAuth, type LoginResult } from "@/hooks/use-mock-auth"; 
import { useState, type FormEvent } from "react";
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';


export default function LoginPage() {
  const { login, logout } = useMockAuth(); 
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [authError, setAuthError] = useState<{type: 'sanctioned' | 'pending_admission', username?: string; endDate?: string} | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setAuthError(null);

    const result: LoginResult = await login(email, password);

    if (result.success) {
      router.push('/'); 
    } else {
      if (result.reason === 'sanctioned') {
        setAuthError({type: 'sanctioned', username: result.username, endDate: result.sanctionEndDate});
        setError(`User ${result.username} is sanctioned. Access denied.`);
      } else if (result.reason === 'pending_admission') {
        setAuthError({type: 'pending_admission', username: result.username});
        setError(`User ${result.username}'s application is pending community review.`);
      } else if (result.reason === 'not_found') {
        setError("User not found or credentials invalid. Please check your email/password.");
      }
      else {
        setError("Failed to login. Please check your credentials.");
      }
      console.error("Login failed:", result.reason);
    }
  };

  const handleContinueAsVisitor = () => {
    logout(); 
    router.push('/');
  };

  return (
    <div className="flex items-center justify-center py-12">
      <Card className="mx-auto max-w-sm w-full shadow-xl">
        <CardHeader className="text-center">
          <div className="inline-block mx-auto mb-4">
            {authError?.type === 'sanctioned' ? <UserX className="h-16 w-16 text-destructive" /> 
             : authError?.type === 'pending_admission' ? <Clock className="h-16 w-16 text-amber-500" />
             : <ShieldCheck className="h-16 w-16 text-primary" />}
          </div>
          <CardTitle className="text-3xl font-bold">
            {authError?.type === 'sanctioned' ? "Access Denied" 
             : authError?.type === 'pending_admission' ? "Application Pending"
             : "Welcome Back!"}
          </CardTitle>
          <CardDescription>
            {authError?.type === 'sanctioned' 
              ? `User ${authError.username} is currently sanctioned.` 
              : authError?.type === 'pending_admission'
              ? `The admission application for ${authError.username} is currently under review by the community. You will be notified of the outcome.`
              : "Enter your credentials to access your Kratia account."}
             {authError?.type === 'sanctioned' && authError?.endDate && (
                <span className="block mt-1 text-sm text-destructive">
                  Sanction ends: {format(new Date(authError.endDate), "PPPp")}
                </span>
              )}
          </CardDescription>
        </CardHeader>
        {!authError && (
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email">Email or Username</Label>
                <Input 
                  id="email" 
                  type="text" 
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
              {error && !authError && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full">
                <LogIn className="mr-2 h-5 w-5" /> Login
              </Button>
            </form>
            <div className="mt-6 text-center text-sm">
              Don&apos;t have an account?{" "}
              <Link href="/auth/signup" className="underline font-medium text-primary hover:text-primary/80">
                Apply to Join
              </Link>
            </div>
          </CardContent>
        )}
        {authError && (
            <CardContent className="text-center">
                 <Button onClick={handleContinueAsVisitor} variant="outline" className="mt-4 w-full">
                    <Home className="mr-2 h-5 w-5" /> Continue as Visitor
                </Button>
            </CardContent>
        )}
      </Card>
    </div>
  );
}
