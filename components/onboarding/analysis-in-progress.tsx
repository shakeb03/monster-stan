/**
 * Component for analysis_in_progress state
 * Shows "Analyzing your posts and building your voice..." loading screen
 */

'use client';

import React from 'react';

export function AnalysisInProgress(): React.ReactElement {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="text-center">
        <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
        <h1 className="mb-2 text-2xl font-semibold text-black dark:text-zinc-50">
          Analyzing your posts and building your voice...
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          This may take a few minutes. Please don't close this page.
        </p>
      </div>
    </div>
  );
}

