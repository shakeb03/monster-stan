/**
 * API endpoint for polling onboarding status
 * Returns the current onboarding_status for the authenticated user
 */

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getUserProfile } from '@/lib/services/user-service';

export async function GET(): Promise<NextResponse> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const profile = await getUserProfile(userId);

    if (!profile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      onboarding_status: profile.onboarding_status,
    });
  } catch (error) {
    console.error('Error fetching onboarding status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

