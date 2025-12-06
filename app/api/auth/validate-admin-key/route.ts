import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * Validates the admin access key and issues a short-lived, httpOnly cookie
 * that the auth callback can trust. Prevents exposing the key to clients.
 */
export async function POST(req: NextRequest) {
  try {
    const { accessKey } = await req.json();

    if (!accessKey || typeof accessKey !== 'string') {
      // Dummy comparison to avoid revealing key absence through timing
      timingSafeCompare('', process.env.ADMIN_LOGIN_KEY || '');
      const res = NextResponse.json({ valid: false }, { status: 200 });
      res.cookies.delete('admin-login');
      return res;
    }

    const adminKey = process.env.ADMIN_LOGIN_KEY;

    if (!adminKey) {
      console.error('[Auth] ADMIN_LOGIN_KEY is not configured!');
      timingSafeCompare(accessKey, 'placeholder-key');
      const res = NextResponse.json({ valid: false }, { status: 200 });
      res.cookies.delete('admin-login');
      return res;
    }

    const isValid = timingSafeCompare(accessKey, adminKey);
    const response = NextResponse.json({ valid: isValid }, { status: 200 });

    if (isValid) {
      response.cookies.set({
        name: 'admin-login',
        value: 'true',
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 10 * 60, // 10 minutes
        path: '/',
      });
    } else {
      response.cookies.delete('admin-login');
    }

    return response;
  } catch (error) {
    console.error('[Auth] Error validating admin key:', error);
    const res = NextResponse.json({ valid: false }, { status: 200 });
    res.cookies.delete('admin-login');
    return res;
  }
}

/**
 * Timing-safe string comparison that doesn't leak length information.
 */
function timingSafeCompare(a: string, b: string): boolean {
  const key = 'timing-safe-admin-login';
  const hashA = crypto.createHmac('sha256', key).update(a).digest();
  const hashB = crypto.createHmac('sha256', key).update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

