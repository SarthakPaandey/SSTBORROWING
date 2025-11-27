'use client';

import { signOut } from 'next-auth/react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Ban, Mail } from 'lucide-react';

export default function BlockedPage() {
    return (
        <div className="flex min-h-screen items-center justify-center p-4 bg-gradient-to-br from-[#0a1628] via-[#0d1b2a] to-[#05060b]">
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-red-500/20 blur-3xl" />
                <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-red-500/20 blur-3xl" />
            </div>

            <Card className="relative w-full max-w-lg">
                <CardHeader className="text-center space-y-4">
                    <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-500/10">
                        <Ban className="h-8 w-8 text-red-500" />
                    </div>
                    <CardTitle className="text-2xl text-red-500">
                        Account Blocked
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="text-center space-y-2">
                        <p className="text-text-main">
                            Your account has been blocked by an administrator.
                        </p>
                        <p className="text-text-muted text-sm">
                            You no longer have access to the booking system. If you believe this is a mistake, please contact support.
                        </p>
                    </div>

                    <div className="bg-accent-blue/10 border border-accent-blue/30 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                            <Mail className="h-5 w-5 text-accent-blue mt-0.5 flex-shrink-0" />
                            <div className="text-sm">
                                <p className="font-medium text-text-main mb-1">Contact Support</p>
                                <p className="text-text-muted">
                                    Email: <a href="mailto:support@sst.scaler.com" className="text-accent-blue hover:underline">support@sst.scaler.com</a>
                                </p>
                                <p className="text-text-muted mt-1">
                                    Please include your email address and explain why you think your account was blocked incorrectly.
                                </p>
                            </div>
                        </div>
                    </div>

                    <Button
                        onClick={() => signOut({ callbackUrl: '/login' })}
                        variant="outline"
                        className="w-full"
                    >
                        Back to Login
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
