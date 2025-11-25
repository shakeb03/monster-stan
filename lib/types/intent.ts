/**
 * Intent types matching DOC 07 exactly
 */

export type Intent = 'WRITE_POST' | 'ANALYZE_PROFILE' | 'STRATEGY' | 'OTHER';

export interface IntentClassification {
  intent: Intent;
  needs_clarification: boolean;
  missing_fields: string[];
  requires_rag: boolean;
  proposed_follow_ups: string[];
}

