import { getServerSession } from 'next-auth/next';
import { authOptions } from './config';
import { UserRole, User } from '@/models/User';
import { AuthenticationError, AuthorizationError } from '@/lib/errors';
import { connectDB } from '@/lib/db';

export async function requireAuth(allowedRoles?: UserRole[]) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    throw new AuthenticationError();
  }

  // FIX EC-18: Stale session check
  // JWTs are stateless and can contain outdated role/suspension info
  // We must verify against the database to prevent banned/demoted users from accessing resources
  await connectDB();

  // FIX: session.user.id is the ObjectId, not email
  const dbUser = await User.findById(session.user.id).select('role suspendedUntil penaltyPoints blocked');

  if (!dbUser) {
    throw new AuthenticationError('User not found');
  }

  // Check if user is permanently blocked (takes precedence over suspension)
  if (dbUser.blocked) {
    throw new AuthorizationError('Your account has been permanently blocked due to repeated policy violations. Please contact support.');
  }

  // Check if user is temporarily suspended (compare with UTC timestamps)
  if (dbUser.suspendedUntil && dbUser.suspendedUntil > new Date()) {
    const suspendedUntil = new Date(dbUser.suspendedUntil).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
    throw new AuthorizationError(`Your account is suspended until ${suspendedUntil} as you have reached the penalty point threshold.`);
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
