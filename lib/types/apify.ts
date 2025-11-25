/**
 * Types for Apify API responses
 * No any types - all must be explicitly typed
 */

export type ApifyRunStatus = 'READY' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'ABORTED' | 'TIMED-OUT';

export interface ApifyRun {
  id: string;
  status: ApifyRunStatus;
  defaultDatasetId: string | null;
  defaultKeyValueStoreId: string | null;
  defaultRequestQueueId: string | null;
  startedAt: Date | string | null;
  finishedAt: Date | string | null;
  stats: {
    requestsFinished: number;
    requestsFailed: number;
    retries: number;
    runTimeMillis: number;
  } | null;
}

export interface ApifyDatasetItem {
  [key: string]: unknown;
}

export interface ApifyProfileOutput {
  [key: string]: unknown;
  // Structure depends on Apify actor output
  // We store the full output in raw_json
}

export interface ApifyPostOutput {
  [key: string]: unknown;
  // Structure depends on Apify actor output
  // Common fields might include: text, postedAt, likes, comments, etc.
  // We store the full output in raw_json
}

