/**
 * Protected root page
 * Redirects to onboarding or chat based on onboarding status
 */

import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { getUserProfile } from '@/lib/services/user-service';

export default async function ProtectedPage(): Promise<never> {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const profile = await getUserProfile(userId);

  if (!profile) {
    redirect('/onboarding');
  }

  // Route based on onboarding status
  if (profile.onboarding_status === 'ready') {
    redirect('/chat');
  } else {
    redirect('/onboarding');
  }
}

