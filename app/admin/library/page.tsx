import { redirect } from 'next/navigation';

export default function AdminLibraryRedirect() {
  // Library module deferred; redirect admins to the dashboard.
  redirect('/admin/dashboard');
}
