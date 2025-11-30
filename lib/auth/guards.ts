import { getServerSession } from 'next-auth/next';
import { authOptions } from './config';
import { UserRole, User } from '@/models/User';
import { AuthenticationError, AuthorizationError } from '@/lib/errors';
import { connectDB } from '@/lib/db';
import { getNow } from '@/lib/timezone';

export async function requireAuth(allowedRoles?: UserRole[]) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    throw new AuthenticationError();
  }

  // FIX EC-18: Stale session check
  // JWTs are stateless and can contain outdated role/suspension info
  // We must verify against the database to prevent banned/demoted users from accessing resources
  await connectDB();

  // FIX: session.user.id contains email, not ObjectId
  const dbUser = await User.findOne({ email: session.user.id }).select('role suspendedUntil penaltyPoints blocked');

  if (!dbUser) {
    throw new AuthenticationError('User not found');
  }

  // Check if user is permanently blocked (takes precedence over suspension)
  if (dbUser.blocked) {
    throw new AuthorizationError('Your account has been blocked by an administrator. Please contact support.');
  }

  // Check if user is temporarily suspended (using IST timezone)
  if (dbUser.suspendedUntil && dbUser.suspendedUntil > getNow()) {
    throw new AuthorizationError('Your account is suspended');
  }

  // Verify role hasn't changed since token was issued
  if (dbUser.role !== session.user.role) {
    throw new AuthorizationError('Your account permissions have changed. Please log in again.');
  }

  if (allowedRoles && !allowedRoles.includes(dbUser.role)) {
    throw new AuthorizationError();
  }

  // Return the user object with fresh DB data
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: dbUser.role,
    penaltyPoints: dbUser.penaltyPoints,
    suspendedUntil: dbUser.suspendedUntil,
  };
}

export async function getSession() {
  return await getServerSession(authOptions);
}
