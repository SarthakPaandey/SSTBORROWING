import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/config';

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  const role = session.user.role;

  if (role === 'GUARD') {
    redirect('/guard/scanner');
  } else if (role === 'ADMIN') {
    redirect('/admin/dashboard');
  } else {
    redirect('/user/dashboard');
  }
}
