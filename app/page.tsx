/**
 * Root page - redirects authenticated users to protected routes
 * Unauthenticated users will be handled by Clerk middleware
 */

import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';

export default async function Home(): Promise<never> {
  const { userId } = await auth();

  if (userId) {
    redirect('/onboarding');
  } else {
    redirect('/sign-in');
  }
}
