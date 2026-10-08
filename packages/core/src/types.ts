/**
 * Domain type definitions.
 *
 * This file doesn't depend on any Node.js-only API, because it is imported by both apps/web (Next.js)
 * and supabase/functions (Deno Edge Functions); see docs/decisions/0002-tech-stack.md.
 */

export const FEEDBACK_STATUSES = [
  "open",
  "planned",
  "in_progress",
  "done",
  "declined",
] as const;

export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export interface Product {
  id: string;
  slug: string;
  name: string;
  brandColor: string | null;
  createdAt: string;
}

export interface Feedback {
  id: string;
  productId: string;
  title: string;
  body: string | null;
  status: FeedbackStatus;
  submitterEmail: string;
  duplicateOf: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Vote {
  id: string;
  feedbackId: string;
  voterEmail: string;
  createdAt: string;
}

export interface Reply {
  id: string;
  feedbackId: string;
  body: string;
  isAdmin: boolean;
  createdAt: string;
}
