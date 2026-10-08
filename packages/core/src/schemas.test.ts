import { describe, expect, it } from "vitest";
import { slugSchema, submitFeedbackSchema, voteFromWidgetSchema } from "./schemas";

describe("slugSchema", () => {
  it("accepts lowercase letters, digits and hyphens", () => {
    expect(slugSchema.safeParse("cardwhisper").success).toBe(true);
    expect(slugSchema.safeParse("card-whisper").success).toBe(true);
  });

  it("rejects uppercase, spaces and underscores", () => {
    expect(slugSchema.safeParse("CardWhisper").success).toBe(false);
    expect(slugSchema.safeParse("card whisper").success).toBe(false);
    expect(slugSchema.safeParse("card_whisper").success).toBe(false);
  });
});

describe("submitFeedbackSchema", () => {
  const base = {
    productSlug: "cardwhisper",
    title: "Support dark mode",
    submitterEmail: "user@example.com",
    turnstileToken: "token",
  };

  it("accepts minimal valid input", () => {
    expect(submitFeedbackSchema.safeParse(base).success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = submitFeedbackSchema.safeParse({ ...base, submitterEmail: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects an overlong title", () => {
    const result = submitFeedbackSchema.safeParse({ ...base, title: "a".repeat(121) });
    expect(result.success).toBe(false);
  });
});

describe("voteFromWidgetSchema", () => {
  it("requires productSlug", () => {
    const result = voteFromWidgetSchema.safeParse({
      voterEmail: "user@example.com",
      turnstileToken: "token",
    });
    expect(result.success).toBe(false);
  });
});
