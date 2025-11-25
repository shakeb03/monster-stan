/**
 * Component for error state
 * Shows error screen with option to retry URL submission
 */

'use client';

import React from 'react';

interface OnboardingErrorProps {
  onRetry: () => void;
}

export function OnboardingError({ onRetry }: OnboardingErrorProps): React.ReactElement {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg dark:bg-zinc-900">
        <div className="mb-4 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
            <svg
              className="h-6 w-6 text-red-600 dark:text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h1 className="mb-2 text-2xl font-semibold text-black dark:text-zinc-50">
            Something went wrong
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            We encountered an error while processing your LinkedIn profile. Please try again.
          </p>
        </div>
        <button
          onClick={onRetry}
          className="w-full rounded-md bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

