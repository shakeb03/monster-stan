/**
 * Simple placeholder page confirming the app runs
 * No business logic - just a confirmation page
 */

import React from 'react';

export default function Home(): React.ReactElement {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-center py-32 px-16 bg-white dark:bg-black">
        <div className="flex flex-col items-center gap-6 text-center">
          <h1 className="text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            Monster Stan
          </h1>
          <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Application initialized successfully.
          </p>
        </div>
      </main>
    </div>
  );
}
