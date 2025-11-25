/**
 * Chat route layout
 * Ensures user has completed onboarding (status = "ready")
 */

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getUserProfile } from '@/lib/services/user-service';

export default async function ChatLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): Promise<React.ReactElement> {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  // Check onboarding status
  const profile = await getUserProfile(userId);
  if (!profile || profile.onboarding_status !== 'ready') {
    redirect('/onboarding');
  }

  return <>{children}</>;
}

