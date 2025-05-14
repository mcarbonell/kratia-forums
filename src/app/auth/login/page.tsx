"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, ShieldCheck } from "lucide-react";
import { useMockAuth } from "@/hooks/use-mock-auth"; // Assuming this hook provides login
import { useState, type FormEvent } from "react";
import { useRouter } from 'next/navigation';


export default function LoginPage() {
  const { login, switchToUser } = useMockAuth(); // Using mock login
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      // In a real app, you'd call your backend API here
      // For mock, we'll just simulate login
      console.log("Attempting login with:", email, password);
      // For demonstration, let's log in as 'normal_user' if email contains 'bob'
      // or 'admin' if email contains 'admin', otherwise 'user'
      let roleToLoginAs: 'guest' | 'user' | 'normal_user' | 'admin' | 'founder' = 'guest';
      if (email.toLowerCase().includes('bob')) {
        roleToLoginAs = 'normal_user';
      } else if (email.toLowerCase().includes('admin')) {
        roleToLoginAs = 'admin';
      } else if (email.toLowerCase().includes('alice')) {
        roleToLoginAs = 'user';
      } else if (email.toLowerCase().includes('founder')) {
        roleToLoginAs = 'founder';
      }
      
      switchToUser(roleToLoginAs); // Using switchToUser from mock auth for demo
      router.push('/'); // Redirect to home page after login
    } catch (err) {
      setError("Failed to login. Please check your credentials.");
      console.error(err);
    }
  };

  return (
    <div className="flex items-center justify-center py-12">
      <Card className="mx-auto max-w-sm w-full shadow-xl">
        <CardHeader className="text-center">
          <div className="inline-block mx-auto mb-4">
            <ShieldCheck className="h-16 w-16 text-primary" />
          </div>
          <CardTitle className="text-3xl font-bold">Welcome Back!</CardTitle>
          <CardDescription>Enter your credentials to access your Kratia account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email or Username</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="m@example.com" 
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
            {error && <p className="text-sm text-destructive">{error}</p>}
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
      </Card>
    </div>
  );
}