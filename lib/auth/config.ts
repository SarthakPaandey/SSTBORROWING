import { AuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { connectDB } from '@/lib/db';
import { User } from '@/models/User';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { cookies } from 'next/headers';

/**
 * Timing-safe string comparison that doesn't leak length information.
 * Uses HMAC comparison to ensure constant-time execution.
 */
function timingSafeCompare(a: string, b: string): boolean {
  const key = 'timing-safe-auth-comparison';
  const hashA = crypto.createHmac('sha256', key).update(a).digest();
  const hashB = crypto.createHmac('sha256', key).update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

// Check for required environment variables
if (!process.env.NEXTAUTH_SECRET) {
  console.error('[Auth Config] CRITICAL: NEXTAUTH_SECRET is not set!');
}

export const authOptions: AuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      id: 'guard-credentials',
      name: 'Guard Login',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
        accessKey: { label: 'Access Key', type: 'text' },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.username || !credentials?.password) {
            return null;
          }

          // Validate the guard access key for security using timing-safe comparison
          const guardAccessKey = process.env.GUARD_ACCESS_KEY;
          if (!guardAccessKey) {
            console.error('[Auth] GUARD_ACCESS_KEY is not configured!');
            // Perform dummy comparison to maintain consistent timing
            timingSafeCompare(credentials.accessKey || '', 'dummy-key');
            return null;
          }

          // Use timing-safe comparison to prevent timing attacks
          if (!timingSafeCompare(credentials.accessKey || '', guardAccessKey)) {
            console.log('[Auth] Invalid guard access key attempted');
            return null;
          }

          await connectDB();

          const user = await User.findOne({
            email: `${credentials.username}@local`,
            role: 'GUARD',
          });

          if (!user || !user.password) {
            return null;
          }

          const isValid = await bcrypt.compare(credentials.password, user.password);

          if (!isValid) {
            return null;
          }

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
          };
        } catch (error) {
          console.error('Auth error:', error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        const email = user.email!;
        const studentDomain = process.env.ALLOWED_STUDENT_DOMAIN || 'sst.scaler.com';
        const adminDomain = process.env.ALLOWED_ADMIN_DOMAIN || 'scaler.com';
        const isStudentDomain = email.endsWith(`@${studentDomain}`);
        const isAdminDomain = email.endsWith(`@${adminDomain}`);

        if (!isStudentDomain && !isAdminDomain) {
          return false; // Reject sign-in
        }

        const adminLinkVerified = cookies().get('admin-login')?.value === 'true';

        if (isAdminDomain && !adminLinkVerified) {
          console.warn('[Auth] Admin login denied: missing admin access link proof');
          return '/admin/login?error=admin_link_required';
        }

        await connectDB();

        let dbUser = await User.findOne({ email });

        if (!dbUser) {
          const role = isAdminDomain ? 'ADMIN' : 'STUDENT';

          dbUser = await User.create({
            name: user.name || email.split('@')[0],
            email,
            role,
            image: user.image,
            penaltyPoints: 0,
          });
        }

        if (dbUser.role === 'ADMIN' && !adminLinkVerified) {
          console.warn('[Auth] Existing admin blocked: missing admin access link proof');
          return '/admin/login?error=admin_link_required';
        }

        // Check if user is blocked
        if (dbUser.blocked) {
          return '/blocked'; // Redirect to blocked page
        }

        user.id = dbUser.id;
        user.role = dbUser.role;

        return true;
      }

      return true; // Allow credentials provider
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
};
