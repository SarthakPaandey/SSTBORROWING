import { redirect } from 'next/navigation';

export default function GuardLoginPage() {
  // Don't reveal guard routes - redirect to home
  redirect('/');
}
