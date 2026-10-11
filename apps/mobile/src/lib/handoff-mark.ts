/**
 * The "one slot" mark of a hand-off between two screens of one session (review finding W93-18, backlog
 * B8, blueprint row 97): the three copies in `session-live/monitor-handoff.ts`,
 * `session-finalizing/handover.ts` and `session-summary/summary-handoff.ts` are this one rule.
 *
 * The outgoing screen marks the session right before the incoming screen replaces it; the incoming
 * screen reads the mark at mount and draws in place, without its enter motion. A mark only ever
 * matches the one session that was handed off, and a session without an id is never marked and never
 * matches. One slot, no timer, never cleared in the app: a session passes each hand-off once, and
 * entering the same session's screen again without its rise is harmless.
 */
export interface HandoffMark {
  /** Marks the session as handed off. No id: nothing is marked. */
  mark(sessionId: string | null | undefined): void;
  /** True only for the session that was marked last. */
  is(sessionId: string | null | undefined): boolean;
  /** Empties the slot. For tests: the app never clears a mark. */
  resetForTests(): void;
}

export function createHandoffMark(): HandoffMark {
  let handedOff: string | null = null;
  return {
    mark(sessionId) {
      if (sessionId) handedOff = sessionId;
    },
    is(sessionId) {
      return Boolean(sessionId) && handedOff === sessionId;
    },
    resetForTests() {
      handedOff = null;
    },
  };
}
