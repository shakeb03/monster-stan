/**
 * Component for scraping_in_progress state
 * Shows "Fetching your profile..." loading screen
 */

'use client';

import React from 'react';

export function ScrapingInProgress(): React.ReactElement {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="text-center">
        <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
        <h1 className="mb-2 text-2xl font-semibold text-black dark:text-zinc-50">
          Fetching your profile...
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Please wait while we retrieve your LinkedIn data.
        </p>
      </div>
    </div>
  );
}

