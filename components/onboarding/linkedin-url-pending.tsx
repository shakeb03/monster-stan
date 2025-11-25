/**
 * Component for linkedin_url_pending state
 * Prompts user for LinkedIn profile URL
 */

'use client';

import React, { useState, FormEvent } from 'react';

interface LinkedInUrlPendingProps {
  onSubmit: (url: string) => Promise<void>;
}

export function LinkedInUrlPending({ onSubmit }: LinkedInUrlPendingProps): React.ReactElement {
  const [url, setUrl] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await onSubmit(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit LinkedIn URL');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg dark:bg-zinc-900">
        <h1 className="mb-4 text-2xl font-semibold text-black dark:text-zinc-50">
          Welcome to Monster Stan
        </h1>
        <p className="mb-6 text-zinc-600 dark:text-zinc-400">
          To get started, please provide your LinkedIn profile URL.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="linkedin-url"
              className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              LinkedIn Profile URL
            </label>
            <input
              id="linkedin-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.linkedin.com/in/your-profile"
              required
              className="w-full rounded-md border border-zinc-300 px-4 py-2 text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
              disabled={isSubmitting}
            />
          </div>
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={isSubmitting || !url.trim()}
            className="w-full rounded-md bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? 'Submitting...' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}

