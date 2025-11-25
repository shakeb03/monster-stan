/**
 * Types for Apify API responses
 * No any types - all must be explicitly typed
 */

export type ApifyRunStatus = 'READY' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'ABORTED' | 'TIMED-OUT';

export interface ApifyRun {
  data: {
    id: string;
    status: ApifyRunStatus;
    defaultDatasetId: string | null;
    defaultKeyValueStoreId: string | null;
    defaultRequestQueueId: string | null;
    startedAt: string | null;
    finishedAt: string | null;
    stats: {
      requestsFinished: number;
      requestsFailed: number;
      retries: number;
      runTimeMillis: number;
    } | null;
  };
}

/**
 * Profile actor response structure
 */
export interface ApifyLinkedinProfileLocation {
  country?: string;
  city?: string;
  full?: string;
  country_code?: string;
}

export interface ApifyLinkedinProfileBasicInfo {
  fullname?: string;
  first_name?: string;
  last_name?: string;
  headline?: string;
  public_identifier?: string;
  profile_url?: string;
  about?: string;
  location?: ApifyLinkedinProfileLocation;
  creator_hashtags?: string[];
  follower_count?: number;
  connection_count?: number;
  current_company?: string;
  current_company_url?: string;
  [key: string]: unknown;
}

export interface ApifyLinkedinProfile {
  basic_info: ApifyLinkedinProfileBasicInfo;
  experience?: unknown[];
  education?: unknown[];
  projects?: unknown[];
  certifications?: unknown[];
  languages?: unknown[];
  skills?: unknown[];
  [key: string]: unknown;
}

export type ApifyLinkedinProfileResponse = ApifyLinkedinProfile[];

/**
 * Posts actor response structure
 */
export interface ApifyLinkedinPost {
  type?: 'text' | 'article' | 'linkedinVideo' | string;
  urn?: string;
  url?: string;
  text?: string;
  numLikes?: number;
  numComments?: number;
  numShares?: number;
  postedAtISO?: string;
  inputUrl?: string;
  [key: string]: unknown;
}

export type ApifyLinkedinPostsResponse = ApifyLinkedinPost[];

