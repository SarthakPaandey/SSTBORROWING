'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

export default function LoginPage() {
  const router = useRouter();
  const [isGuardLogin, setIsGuardLogin] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    await signIn('google', { callbackUrl: '/' });
  };

  const handleGuardLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await signIn('guard-credentials', {
      username,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError('Invalid credentials');
    } else {
      router.push('/guard/scanner');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <Card className="relative w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20">
            <span className="text-3xl font-bold text-primary">S</span>
          </div>
          <div>
            <CardTitle className="text-3xl text-foreground">Scaler School of Technology</CardTitle>
            <CardDescription className="mt-2 text-base">
              {isGuardLogin ? 'Guard Portal' : 'Student & Admin Portal'}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {!isGuardLogin ? (
            <div className="space-y-4">
              <Button
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full"
                size="lg"
              >
                {loading ? 'Signing in...' : 'Sign in with Google'}
              </Button>
              <div className="text-center text-sm text-gray-600">
                Students: @sst.scaler.com
                <br />
                Admins: @scaler.com
              </div>
              <Button
                variant="ghost"
                onClick={() => setIsGuardLogin(true)}
                className="w-full"
              >
                Guard Login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleGuardLogin} className="space-y-4">
              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
              <div>
                <label className="mb-2 block text-sm font-medium">Username</label>
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="guard-1"
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Password</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Logging in...' : 'Login'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsGuardLogin(false)}
                className="w-full"
              >
                Back to Student/Admin Login
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
