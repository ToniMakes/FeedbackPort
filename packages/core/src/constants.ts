/**
 * Rate-limit constants; see the three-layer anti-abuse design in docs/ARCHITECTURE.md.
 * Read by the API Routes in apps/web so that writing to and reading from Redis uses a single set of thresholds,
 * instead of the frontend/backend or different endpoints each defining their own and drifting apart.
 */
export const RATE_LIMITS = {
  /** Submitting feedback: stricter limit */
  submitFeedback: {
    windowSeconds: 60 * 10,
    maxRequests: 3,
  },
  /** Voting: looser limit, but still enough to curb scripted ballot stuffing */
  vote: {
    windowSeconds: 60,
    maxRequests: 10,
  },
} as const;
