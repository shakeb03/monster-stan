/**
 * Text cleaning utilities for LinkedIn posts
 * Removes tracking URLs, normalizes whitespace, preserves meaning
 */

/**
 * Removes tracking URLs from text
 * LinkedIn often adds tracking parameters like ?utm_source, etc.
 */
function removeTrackingUrls(text: string): string {
  // Remove URLs with tracking parameters
  // Pattern: http(s)://... followed by ? or & with tracking params
  return text.replace(
    /https?:\/\/[^\s]+[?&](?:utm_|ref=|source=|medium=)[^\s]*/gi,
    ''
  );
}

/**
 * Normalizes whitespace in text
 * Converts multiple spaces/tabs/newlines to single spaces
 */
function normalizeWhitespace(text: string): string {
  return text
    .replace(/\s+/g, ' ') // Multiple whitespace to single space
    .replace(/^\s+|\s+$/g, ''); // Trim
}

/**
 * Cleans LinkedIn post text
 * - Removes tracking URLs
 * - Normalizes whitespace
 * - Preserves meaning and content
 * - Suitable for embeddings and LLM consumption
 */
export function cleanLinkedInPostText(rawText: string): string {
  if (!rawText || typeof rawText !== 'string') {
    return '';
  }

  let cleaned = rawText;

  // Remove tracking URLs
  cleaned = removeTrackingUrls(cleaned);

  // Normalize whitespace
  cleaned = normalizeWhitespace(cleaned);

  return cleaned;
}

