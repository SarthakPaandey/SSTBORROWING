import { redirect } from 'next/navigation';

export default function GuardLoginPage() {
  redirect('/login');
}
