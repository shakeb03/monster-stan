/**
 * API endpoint for submitting LinkedIn URL
 * Updates user_profile with the LinkedIn URL, sets status to scraping_in_progress,
 * and triggers background ingestion
 */

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import {
  ensureUserProfileExists,
  updateLinkedInUrl,
  updateOnboardingStatus,
} from '@/lib/services/user-service';
import { ingestLinkedInData } from '@/lib/services/linkedin-ingestion';
import type { OnboardingStatus } from '@/lib/types';

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { linkedinUrl } = body as { linkedinUrl: string };

    if (!linkedinUrl || typeof linkedinUrl !== 'string') {
      return NextResponse.json(
        { error: 'LinkedIn URL is required' },
        { status: 400 }
      );
    }

    // Validate LinkedIn URL format (basic validation)
    const linkedinUrlPattern = /^https?:\/\/(www\.)?linkedin\.com\/in\/[\w-]+\/?$/;
    if (!linkedinUrlPattern.test(linkedinUrl)) {
      return NextResponse.json(
        { error: 'Invalid LinkedIn URL format' },
        { status: 400 }
      );
    }

    // Ensure user profile exists
    await ensureUserProfileExists(userId);

    // Update LinkedIn URL
    await updateLinkedInUrl(userId, linkedinUrl);

    // Set status to scraping_in_progress
    const scrapingStatus: OnboardingStatus = 'scraping_in_progress';
    await updateOnboardingStatus(userId, scrapingStatus);

    // Trigger ingestion in background (don't await - let it run asynchronously)
    // The ingestion service will update the status when complete
    ingestLinkedInData(userId, linkedinUrl).catch((error) => {
      console.error('Error in background ingestion:', error);
      // Error handling is done inside ingestLinkedInData
    });

    return NextResponse.json({
      success: true,
      onboarding_status: scrapingStatus,
    });
  } catch (error) {
    console.error('Error submitting LinkedIn URL:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

