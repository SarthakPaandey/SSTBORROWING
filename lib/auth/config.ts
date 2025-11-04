import { AuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { connectDB } from '@/lib/db';
import { User } from '@/models/User';
import bcrypt from 'bcryptjs';

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
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
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
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        const email = user.email!;
        const studentDomain = process.env.ALLOWED_STUDENT_DOMAIN || 'sst.scaler.com';
        const adminDomain = process.env.ALLOWED_ADMIN_DOMAIN || 'scaler.com';

        if (!email.endsWith(`@${studentDomain}`) && !email.endsWith(`@${adminDomain}`)) {
          return false; // Reject sign-in
        }

        await connectDB();

        let dbUser = await User.findOne({ email });

        if (!dbUser) {
          // Create new user with role based on domain
          const role = email.endsWith(`@${adminDomain}`) ? 'ADMIN' : 'STUDENT';

          dbUser = await User.create({
            name: user.name || email.split('@')[0],
            email,
            role,
            image: user.image,
            penaltyPoints: 0,
          });
        }

        user.id = dbUser._id.toString();
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
