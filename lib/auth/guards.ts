import { getServerSession } from 'next-auth/next';
import { authOptions } from './config';
import { UserRole } from '@/models/User';

export async function requireAuth(allowedRoles?: UserRole[]) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  if (allowedRoles && !allowedRoles.includes(session.user.role as UserRole)) {
    throw new Error('Forbidden');
  }

  return session.user;
}

export async function getSession() {
  return await getServerSession(authOptions);
}
