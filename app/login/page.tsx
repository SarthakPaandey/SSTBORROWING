'use client';

import { signIn } from 'next-auth/react';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Sparkles, Shield, ArrowLeft, User, Lock, LogIn } from 'lucide-react';

// Floating particles component
const FloatingParticle = ({ delay, size, left, duration }: { delay: number; size: number; left: string; duration: number }) => (
  <div 
    className="absolute rounded-full bg-accent-blue/30 animate-float"
    style={{
      width: size,
      height: size,
      left: left,
      bottom: '-20px',
      animationDelay: `${delay}s`,
      animationDuration: `${duration}s`,
    }}
  />
);

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isGuardLogin, setIsGuardLogin] = useState(false);
  const [guardAccessValid, setGuardAccessValid] = useState(false);
  const [validatingKey, setValidatingKey] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Extract the specific parameter value to avoid dependency on entire searchParams object
  const accessKey = searchParams.get('gk');

  // Separate effect for guard access key validation
  // Uses AbortController to prevent race conditions from concurrent requests
  useEffect(() => {
    // Reset state when key is removed from URL
    if (!accessKey) {
      setGuardAccessValid(false);
      setIsGuardLogin(false);
      return;
    }

    // Create abort controller to cancel stale requests
    const abortController = new AbortController();
    let isCancelled = false;

    // Validate the key server-side before revealing guard login
    const validateKey = async () => {
      setValidatingKey(true);
      try {
        const res = await fetch('/api/auth/validate-guard-key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessKey }),
          signal: abortController.signal,
        });
        
        // Don't update state if request was cancelled
        if (isCancelled) return;
        
        const data = await res.json();
        
        if (data.valid) {
          setGuardAccessValid(true);
          setIsGuardLogin(true);
        } else {
          // Invalid key - don't show guard login
          setGuardAccessValid(false);
          setIsGuardLogin(false);
        }
      } catch (err) {
        // Don't update state if request was aborted
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        // On error, don't reveal guard login
        if (!isCancelled) {
          setGuardAccessValid(false);
          setIsGuardLogin(false);
        }
      } finally {
        if (!isCancelled) {
          setValidatingKey(false);
        }
      }
    };

    validateKey();

    // Cleanup: cancel pending request if accessKey changes or component unmounts
    return () => {
      isCancelled = true;
      abortController.abort();
    };
  }, [accessKey]); // Depend on the specific value, not the entire searchParams object

  const handleGoogleSignIn = async () => {
    setLoading(true);
    await signIn('google', { callbackUrl: '/' });
  };

  const handleGuardLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const accessKey = searchParams.get('gk');
    
    const result = await signIn('guard-credentials', {
      username,
      password,
      accessKey: accessKey || '',
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError('Invalid credentials or access denied');
    } else {
      router.push('/guard/scanner');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-gradient-to-br from-[#0a1628] via-[#0d1b2a] to-[#05060b] overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Gradient orbs */}
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-accent-blue/20 blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-accent-purple-1/20 blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-gradient-to-r from-accent-blue/10 to-accent-purple-1/10 blur-3xl animate-spin-slow" style={{ animationDuration: '20s' }} />
        
        {/* Grid pattern */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '50px 50px',
          }}
        />

        {/* Floating particles */}
        {mounted && (
          <>
            <FloatingParticle delay={0} size={6} left="10%" duration={8} />
            <FloatingParticle delay={2} size={4} left="20%" duration={10} />
            <FloatingParticle delay={4} size={8} left="35%" duration={7} />
            <FloatingParticle delay={1} size={5} left="50%" duration={9} />
            <FloatingParticle delay={3} size={6} left="65%" duration={11} />
            <FloatingParticle delay={5} size={4} left="80%" duration={8} />
            <FloatingParticle delay={2} size={7} left="90%" duration={10} />
          </>
        )}
      </div>

      {/* Login Card */}
      <Card className={`relative w-full max-w-md transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        {/* Animated border glow */}
        <div className="absolute -inset-[1px] bg-gradient-to-r from-accent-blue via-accent-purple-1 to-accent-blue rounded-2xl opacity-20 blur-sm animate-gradient-shift" style={{ backgroundSize: '200% 200%' }} />
        
        {/* Show loading spinner while validating guard key */}
        {validatingKey && (
          <div className="absolute inset-0 z-50 bg-bg-dark/80 backdrop-blur-sm rounded-2xl flex items-center justify-center">
            <div className="animate-spin h-8 w-8 border-2 border-accent-blue border-t-transparent rounded-full" />
          </div>
        )}
        
        <div className="relative bg-bg-dark rounded-2xl overflow-hidden">
          <CardHeader className="text-center space-y-6 pt-8">
            {/* Logo with animation */}
            <div className="mx-auto flex items-center justify-center animate-fade-in-down">
              <div className="relative">
                <Image
                  src="/sst-logo.png"
                  alt="SST Logo"
                  width={200}
                  height={60}
                  className="object-contain transition-transform duration-300 hover:scale-105"
                  priority
                />
                <Sparkles className="absolute -top-2 -right-2 h-5 w-5 text-accent-blue animate-pulse" />
              </div>
            </div>
            
            {/* Title with gradient */}
            <div className="space-y-2 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              <CardTitle className="text-3xl font-bold">
                <span className="bg-gradient-to-r from-accent-blue via-accent-cyan to-accent-blue bg-clip-text text-transparent animate-gradient-shift" style={{ backgroundSize: '200% 200%' }}>
                  Booking System
                </span>
              </CardTitle>
              <CardDescription className="text-base text-text-muted flex items-center justify-center gap-2">
                {isGuardLogin ? (
                  <>
                    <Shield className="h-4 w-4 text-accent-purple-1" />
                    Guard Portal
                  </>
                ) : (
                  <>
                    <User className="h-4 w-4 text-accent-blue" />
                    Student & Admin Portal
                  </>
                )}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="pb-8">
            {!isGuardLogin ? (
              <div className="space-y-5 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
                {/* Google Sign In Button */}
                <Button
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  loading={loading}
                  variant="gradient"
                  className="w-full btn-ripple group"
                  size="lg"
                >
                  <svg className="mr-2 h-5 w-5 group-hover:animate-wiggle" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Sign in with Google
                </Button>

                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border/50" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-bg-dark px-4 text-text-muted">Allowed domains</span>
                  </div>
                </div>

                {/* Domain info */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-accent-blue/5 border border-accent-blue/20 text-center transition-all hover:bg-accent-blue/10 hover:border-accent-blue/30">
                    <p className="text-sm font-medium text-accent-blue">🎓 Students</p>
                    <p className="text-xs text-text-muted mt-1">@sst.scaler.com</p>
                  </div>
                  <div className="p-3 rounded-xl bg-accent-purple-1/5 border border-accent-purple-1/20 text-center transition-all hover:bg-accent-purple-1/10 hover:border-accent-purple-1/30">
                    <p className="text-sm font-medium text-accent-purple-1">👑 Admins</p>
                    <p className="text-xs text-text-muted mt-1">@scaler.com</p>
                  </div>
                </div>

                {/* Guard login link - only shown when accessed with valid key */}
                {guardAccessValid && (
                  <Button
                    variant="ghost"
                    onClick={() => setIsGuardLogin(true)}
                    className="w-full text-text-muted hover:text-accent-blue group"
                  >
                    <Shield className="mr-2 h-4 w-4 group-hover:animate-wiggle" />
                    Guard Login
                  </Button>
                )}
              </div>
            ) : (
              <form onSubmit={handleGuardLogin} className="space-y-5 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
                {/* Error message */}
                {error && (
                  <div className="rounded-xl bg-danger/10 border border-danger/30 p-4 text-sm text-danger flex items-center gap-2 animate-shake">
                    <span className="text-lg">❌</span>
                    {error}
                  </div>
                )}

                {/* Username field */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-text-main">
                    <User className="h-4 w-4 text-accent-blue" />
                    Username
                  </label>
                  <div className="relative">
                    <Input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="guard-1"
                      required
                      className="pl-10 transition-all focus:ring-2 focus:ring-accent-blue/50"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">🛡️</span>
                  </div>
                </div>

                {/* Password field */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-text-main">
                    <Lock className="h-4 w-4 text-accent-blue" />
                    Password
                  </label>
                  <div className="relative">
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      required
                      className="pl-10 transition-all focus:ring-2 focus:ring-accent-blue/50"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">🔑</span>
                  </div>
                </div>

                {/* Login button */}
                <Button 
                  type="submit" 
                  disabled={loading} 
                  loading={loading}
                  variant="gradient" 
                  className="w-full btn-ripple"
                  size="lg"
                >
                  <LogIn className="mr-2 h-5 w-5" />
                  Login
                </Button>

                {/* Back button - show whenever user is on guard form */}
                {isGuardLogin && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setIsGuardLogin(false);
                      setError('');
                    }}
                    className="w-full text-text-muted hover:text-accent-blue group"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                    Back to Student/Admin Login
                  </Button>
                )}
              </form>
            )}
          </CardContent>
        </div>
      </Card>

      {/* Footer */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-center">
        <p className="text-xs text-text-muted/50">
          SST Borrowing System
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#0a1628] via-[#0d1b2a] to-[#05060b]">
        <div className="animate-spin h-8 w-8 border-2 border-accent-blue border-t-transparent rounded-full" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
