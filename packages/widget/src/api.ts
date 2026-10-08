import type { SubmitFeedbackInput } from "@feedbackport/core";

export interface SubmitFeedbackResult {
  id: string;
  status: string;
}

/**
 * Calls POST /api/feedback (cross-origin; see docs/API.md).
 * The Turnstile token is obtained by ui.ts through the official Turnstile script while rendering the form;
 * this function only sends the token it already has along with the request.
 */
export async function submitFeedback(
  apiBase: string,
  payload: SubmitFeedbackInput,
): Promise<SubmitFeedbackResult> {
  const response = await fetch(`${apiBase}/api/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to submit feedback: HTTP ${response.status}`);
  }

  return (await response.json()) as SubmitFeedbackResult;
}
