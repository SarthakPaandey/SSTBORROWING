'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { ShieldCheck, Lock, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function AdminLoginPage() {
  const searchParams = useSearchParams();
  const accessKeyFromUrl = useMemo(() => searchParams.get('ak') || '', [searchParams]);
  const errorParam = useMemo(() => searchParams.get('error') || '', [searchParams]);

  const [accessKey, setAccessKey] = useState(accessKeyFromUrl);
  const [validating, setValidating] = useState(false);
  const [validated, setValidated] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const validateKey = async (keyToValidate: string) => {
    setValidating(true);
    setError('');
    setValidated(false);

    try {
      const res = await fetch('/api/auth/validate-admin-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessKey: keyToValidate }),
      });

      const data = await res.json();

      if (data.valid) {
        setValidated(true);
      } else {
        setError('Invalid or expired admin link. Please use the secure URL.');
      }
    } catch (err) {
      console.error('Failed to validate admin key', err);
      setError('Unable to validate key right now. Please try again.');
    } finally {
      setValidating(false);
    }
  };

  useEffect(() => {
    if (accessKeyFromUrl) {
      setAccessKey(accessKeyFromUrl);
      validateKey(accessKeyFromUrl);
    }
  }, [accessKeyFromUrl]);

  useEffect(() => {
    if (errorParam === 'admin_link_required') {
      setValidated(false);
      setError('Admin access must start from the secure link. Please use your admin link and try again.');
    }
  }, [errorParam]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessKey) {
      setError('Enter the admin access key from your secure link.');
      return;
    }
    await validateKey(accessKey);
  };

  const handleAdminSignIn = async () => {
    setLoading(true);
    await signIn('google', { callbackUrl: '/admin/dashboard' });
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-gradient-to-br from-[#0a1628] via-[#0d1b2a] to-[#05060b] overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 h-72 w-72 rounded-full bg-accent-purple-1/20 blur-3xl animate-pulse" />
        <div className="absolute -bottom-32 -left-32 h-72 w-72 rounded-full bg-accent-blue/20 blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[400px] w-[400px] rounded-full bg-gradient-to-r from-accent-blue/10 to-accent-purple-1/10 blur-3xl animate-spin-slow" style={{ animationDuration: '18s' }} />
      </div>

      <Card className="relative w-full max-w-lg">
        <div className="absolute -inset-[1px] bg-gradient-to-r from-accent-purple-1 via-accent-blue to-accent-purple-1 rounded-2xl opacity-20 blur-sm animate-gradient-shift" style={{ backgroundSize: '200% 200%' }} />

        <div className="relative bg-bg-dark rounded-2xl overflow-hidden">
          <CardHeader className="space-y-3 text-center pt-8">
            <div className="flex justify-center">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-primary text-sm font-semibold border border-primary/20">
                <ShieldCheck className="h-4 w-4" />
                Secure Admin Access
              </div>
            </div>
            <CardTitle className="text-3xl font-bold">
              <span className="bg-gradient-to-r from-accent-blue via-accent-purple-1 to-accent-blue bg-clip-text text-transparent animate-gradient-shift" style={{ backgroundSize: '200% 200%' }}>
                Admin Sign In
              </span>
            </CardTitle>
            <CardDescription className="text-base text-text-muted flex items-center justify-center gap-2">
              <Sparkles className="h-4 w-4 text-accent-blue" />
              Use the secure link shared with admins to proceed.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 pb-8">
            <form onSubmit={handleSubmit} className="space-y-3">
              <label className="text-sm font-medium text-text-main flex items-center gap-2">
                <Lock className="h-4 w-4 text-accent-blue" />
                Access Key
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <Input
                  type="text"
                  value={accessKey}
                  onChange={(e) => setAccessKey(e.target.value)}
                  placeholder="Paste the key from your admin link"
                  disabled={validating}
                  className="flex-1"
                  required
                />
                <Button
                  type="submit"
                  variant="secondary"
                  disabled={validating}
                  loading={validating}
                  className="whitespace-nowrap"
                >
                  Validate Key
                </Button>
              </div>
            </form>

            {error && (
              <div className="rounded-xl bg-danger/10 border border-danger/30 p-4 text-sm text-danger flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            {validated && !error && (
              <div className="rounded-xl bg-success/10 border border-success/30 p-3 text-sm text-success flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Key verified. Continue with Google to access the admin dashboard.
              </div>
            )}

            <Button
              onClick={handleAdminSignIn}
              disabled={!validated || loading || validating}
              loading={loading}
              variant="gradient"
              className="w-full btn-ripple"
              size="lg"
            >
              Continue with Google
            </Button>
          </CardContent>
        </div>
      </Card>
    </div>
  );
}

