import { z } from "zod";
import { FEEDBACK_STATUSES } from "./types";

/** Lowercase letters, digits and hyphens; matches the products.slug constraint */
export const slugSchema = z
  .string()
  .min(1)
  .max(63)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)+$|^[a-z0-9]+$/, "slug may only contain lowercase letters, digits and hyphens");

const emailSchema = z.string().email().max(320);

/** Widget feedback submission: POST /api/feedback, called cross-origin, so productSlug must be sent explicitly (see docs/API.md) */
export const submitFeedbackSchema = z.object({
  productSlug: slugSchema,
  title: z.string().min(1).max(120),
  body: z.string().max(2000).optional(),
  submitterEmail: emailSchema,
  turnstileToken: z.string().min(1),
  honeypot: z.string().optional(),
});

export type SubmitFeedbackInput = z.infer<typeof submitFeedbackSchema>;

/** Board vote: same-origin, the tenant is already determined by x-tenant */
export const voteFromBoardSchema = z.object({
  voterEmail: emailSchema,
  turnstileToken: z.string().min(1),
});

/** Widget vote: cross-origin, so productSlug must be sent explicitly */
export const voteFromWidgetSchema = voteFromBoardSchema.extend({
  productSlug: slugSchema,
});

export type VoteInput = z.infer<typeof voteFromWidgetSchema>;

/** Admin status change / duplicate-target assignment; at least one field is required */
export const adminUpdateFeedbackSchema = z
  .object({
    status: z.enum(FEEDBACK_STATUSES).optional(),
    duplicateOf: z.string().uuid().optional(),
  })
  .refine((v) => v.status !== undefined || v.duplicateOf !== undefined, {
    message: "at least one of status and duplicateOf is required",
  });

export type AdminUpdateFeedbackInput = z.infer<typeof adminUpdateFeedbackSchema>;

/** Admin reply */
export const adminReplySchema = z.object({
  body: z.string().min(1).max(4000),
});

export type AdminReplyInput = z.infer<typeof adminReplySchema>;

/** Create a product (the admin console's "new product" form; see docs/ROADMAP.md Phase 0) */
export const createProductSchema = z.object({
  slug: slugSchema,
  name: z.string().min(1).max(80),
  brandColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "brandColor must be in #rrggbb format")
    .optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
