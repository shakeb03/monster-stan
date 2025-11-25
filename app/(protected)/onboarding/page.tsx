/**
 * Onboarding page that routes based on onboarding_status
 * Handles all onboarding states and polling
 */

'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { LinkedInUrlPending } from '@/components/onboarding/linkedin-url-pending';
import { ScrapingInProgress } from '@/components/onboarding/scraping-in-progress';
import { AnalysisInProgress } from '@/components/onboarding/analysis-in-progress';
import { OnboardingError } from '@/components/onboarding/onboarding-error';
import type { OnboardingStatus } from '@/lib/types';

interface OnboardingStatusResponse {
  onboarding_status: OnboardingStatus;
}

export default function OnboardingPage(): React.ReactElement {
  const router = useRouter();
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchStatus = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch('/api/onboarding-status');
      if (!response.ok) {
        throw new Error('Failed to fetch onboarding status');
      }
      const data = (await response.json()) as OnboardingStatusResponse;
      setStatus(data.onboarding_status);
      setIsLoading(false);

      // If ready, redirect to chat
      if (data.onboarding_status === 'ready') {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        router.push('/chat');
        return;
      }

      // If in progress states, ensure polling is active
      if (
        data.onboarding_status === 'scraping_in_progress' ||
        data.onboarding_status === 'analysis_in_progress'
      ) {
        // Only start polling if not already polling
        if (!pollingIntervalRef.current) {
          pollingIntervalRef.current = setInterval(() => {
            fetchStatus();
          }, 3000);
        }
      } else {
        // Clear interval for non-progress states
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      }
    } catch (error) {
      console.error('Error fetching onboarding status:', error);
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchStatus();

    // Cleanup interval on unmount
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [fetchStatus]);

  const handleLinkedInSubmit = async (url: string): Promise<void> => {
    try {
      const response = await fetch('/api/linkedin-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ linkedinUrl: url }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to submit LinkedIn URL');
      }

      // Update status and start polling
      setStatus('scraping_in_progress');
      if (!pollingIntervalRef.current) {
        pollingIntervalRef.current = setInterval(() => {
          fetchStatus();
        }, 3000);
      }
    } catch (error) {
      throw error;
    }
  };

  const handleRetry = (): void => {
    setStatus('linkedin_url_pending');
  };

  if (isLoading || status === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="text-center">
          <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="text-zinc-600 dark:text-zinc-400">Loading...</p>
        </div>
      </div>
    );
  }

  switch (status) {
    case 'linkedin_url_pending':
      return <LinkedInUrlPending onSubmit={handleLinkedInSubmit} />;
    case 'scraping_in_progress':
      return <ScrapingInProgress />;
    case 'analysis_in_progress':
      return <AnalysisInProgress />;
    case 'error':
      return <OnboardingError onRetry={handleRetry} />;
    case 'ready':
      // This should redirect, but show loading just in case
      return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
          <p className="text-zinc-600 dark:text-zinc-400">Redirecting...</p>
        </div>
      );
    default:
      return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
          <p className="text-zinc-600 dark:text-zinc-400">Unknown status</p>
        </div>
      );
  }
}

