/**
 * Protected route layout
 * Ensures user is authenticated and creates user/user_profile if needed
 */

import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import {
  ensureUserExists,
  ensureUserProfileExists,
} from '@/lib/services/user-service';

export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): Promise<React.ReactElement> {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  // Get user info from Clerk
  const user = await currentUser();

  if (!user || !user.emailAddresses[0]?.emailAddress) {
    redirect('/sign-in');
  }

  // Ensure user and user_profile exist in database
  try {
    await ensureUserExists(userId, user.emailAddresses[0].emailAddress);
    await ensureUserProfileExists(userId);
  } catch (error) {
    console.error('Error ensuring user exists:', error);
    // Continue anyway - the error will be handled by the onboarding flow
  }

  return <>{children}</>;
}

