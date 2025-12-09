import { redirect } from 'next/navigation';

export default function GuardLibraryReturnsRedirect() {
  // Library returns are deferred; send guards to the main returns flow.
  redirect('/guard/returns');
}