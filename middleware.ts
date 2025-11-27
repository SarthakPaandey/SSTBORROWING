import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  const path = request.nextUrl.pathname;

  // Public routes
  // Note: /api/approve uses email token auth, /api/cron and /api/group-bookings/expire use Bearer token auth
  // All should be accessible without NextAuth session
  if (
    path === '/login' ||
    path === '/blocked' ||
    path.startsWith('/api/auth') ||
    path.startsWith('/api/approve') ||
    path === '/api/cron' ||
    path === '/api/group-bookings/expire' // Uses CRON_SECRET for auth
  ) {
    return NextResponse.next();
  }

  // Protect all routes except login
  if (!token && path !== '/') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Role-based route protection
  if (token) {
    const role = token.role as string;

    // Guard routes
    if (path.startsWith('/guard') && role !== 'GUARD') {
      return NextResponse.redirect(new URL('/', request.url));
    }

    // Admin routes
    if (path.startsWith('/admin') && role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/', request.url));
    }

    // User routes
    if (path.startsWith('/user') && role !== 'STUDENT' && role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.svg$).*)',
  ],
};
