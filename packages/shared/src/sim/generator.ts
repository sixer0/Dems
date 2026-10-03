/**
 * Event and audit generator (masterplan/01_specs.md §14.7 "Rates"; the hash chain itself is
 * in `events.ts`).
 *
 * - While RECORDING: a Poisson process with a mean of 1 arrival per 8 s writes the recording
 *   integrity stream as audit rows (FRAME_HASH, WRITE_VERIFIED, TIMESTAMP_CONFIRMED) and feeds
 *   the session timeline: AUTOSAVE (plus an event) at most once a minute, CHECK every 2 min,
 *   HEALTH every 5 min.
 * - Otherwise: one operational event per 60 s (health check, time sync, storage integrity).
 * - Every arrival is stamped at its own scheduled time, so two runs with one seed produce the
 *   same rows (AC-51). A catch-up after a hidden period writes at most 120 rows.
 */
import { SessionState } from '../domain';
import {
  GENERATOR_CATCH_UP_MAX,
  IDLE_EVENT_INTERVAL_MS,
  RECORDING_EVENT_MEAN_MS,
  TIMELINE_AUTOSAVE_MS,
  TIMELINE_CHECK_MS,
  TIMELINE_HEALTH_MS,
} from './constants';
import { recordingBytes } from './dataset';
import type { EngineContext } from './engine';
import { recordActivity } from './events';
import { TRACK_ORDER, TRACK_SEGMENT_MS } from './evidence';
import { RngStream, type Rng } from './rng';
import { addTimelineItem, lastTimelineAt } from './session-machine';
import type { EpochMs, SimState, SimSubsystem } from './types';

function segmentAt(startedAt: EpochMs, at: EpochMs): number {
  return Math.floor(Math.max(0, at - startedAt) / TRACK_SEGMENT_MS) + 1;
}

/** One arrival of the recording integrity stream at time `at`. */
export function recordingActivity(state: SimState, at: EpochMs, rng: Rng): SimState {
  const session = state.session;
  if (!session || session.state !== SessionState.RECORDING || session.startedAt === null) return state;
  const startedAt = session.startedAt;
  const roll = rng.next();
  let next = state;

  if (roll < 0.45) {
    const trackId = rng.pick(TRACK_ORDER);
    const segment = segmentAt(startedAt, at);
    next = {
      ...next,
      ...recordActivity(next, at, {
        audit: {
          type: 'FRAME_HASH',
          message: `Frame hash recorded · ${trackId}`,
          sessionId: session.id,
          details: { trackId, segment, sha256: rng.hex(64) },
        },
      }),
    };
  } else if (roll < 0.8) {
    const bytesWritten = recordingBytes(at - startedAt);
    next = {
      ...next,
      storage: { ...next.storage, lastWriteVerifiedAt: at },
      ...recordActivity(next, at, {
        audit: {
          type: 'WRITE_VERIFIED',
          message: 'Storage write verified',
          sessionId: session.id,
          deviceId: 'HDD-EVIDENCE',
          details: { bytesWritten, volume: 'HDD-EVIDENCE' },
        },
      }),
    };
    const current = next.session;
    const lastAutosave = current ? lastTimelineAt(current, 'AUTOSAVE') : null;
    if (current && (lastAutosave === null || at - lastAutosave >= TIMELINE_AUTOSAVE_MS)) {
      const segment = segmentAt(startedAt, at);
      next = addTimelineItem(next, {
        at,
        kind: 'AUTOSAVE',
        label: `Autosave · segment ${segment}`,
        detail: null,
        channel: null,
        params: { segment, bytesWritten },
      });
      next = {
        ...next,
        ...recordActivity(next, at, {
          event: {
            type: 'AUTOSAVE',
            message: `Autosave · segment ${segment}`,
            sessionId: session.id,
            params: { segment, bytesWritten },
          },
        }),
      };
    }
  } else {
    next = {
      ...next,
      ...recordActivity(next, at, {
        audit: {
          type: 'TIMESTAMP_CONFIRMED',
          message: `Secure timestamp confirmed · ${next.time.source}`,
          sessionId: session.id,
          details: { source: next.time.source, offsetMs: next.time.offsetMs },
        },
      }),
    };
    const current = next.session;
    const lastCheck = current ? lastTimelineAt(current, 'CHECK') : null;
    if (current && (lastCheck === null || at - lastCheck >= TIMELINE_CHECK_MS)) {
      next = addTimelineItem(next, {
        at,
        kind: 'CHECK',
        label: 'Integrity check passed',
        detail: `Hash chain · ${next.time.source}`,
        channel: null,
        params: { source: next.time.source },
      });
    }
  }

  const current = next.session;
  const lastHealth = current ? (lastTimelineAt(current, 'HEALTH') ?? startedAt) : null;
  if (current && lastHealth !== null && at - lastHealth >= TIMELINE_HEALTH_MS) {
    next = addTimelineItem(next, { at, kind: 'HEALTH', label: 'Health check OK', detail: null, channel: null, params: {} });
  }
  return next;
}

/** One idle operational event at time `at`. */
export function idleActivity(state: SimState, at: EpochMs, rng: Rng): SimState {
  const choice = rng.int(0, 2);
  if (choice === 0) {
    return {
      ...state,
      ...recordActivity(state, at, {
        event: { type: 'HEALTH_CHECK_OK', message: 'System health check completed', severity: 'SUCCESS' },
      }),
    };
  }
  if (choice === 1) {
    const source = state.time.source;
    return {
      ...state,
      ...recordActivity(state, at, {
        event:
          source === 'RTC'
            ? { type: 'TIME_SYNC', message: 'Time held by the RTC — no reference', severity: 'WARNING', params: { source } }
            : { type: 'TIME_SYNC', message: `Time synchronized · ${source}`, severity: 'SUCCESS', params: { source } },
      }),
    };
  }
  return {
    ...state,
    ...recordActivity(state, at, {
      event: { type: 'STORAGE_WRITE_VERIFIED', message: 'Storage integrity check passed', severity: 'SUCCESS' },
    }),
  };
}

/** Replays the recording stream over `[from, to]` (the scenarios use it to fill 00:18:42). */
export function replayRecordingActivity(state: SimState, from: EpochMs, to: EpochMs, rng: Rng): SimState {
  let next = state;
  let at = from + rng.exponential(RECORDING_EVENT_MEAN_MS);
  while (at <= to) {
    next = recordingActivity(next, Math.floor(at), rng);
    at += rng.exponential(RECORDING_EVENT_MEAN_MS);
  }
  return next;
}

export function createGeneratorSubsystem(engine: EngineContext): SimSubsystem {
  let nextRecordingAt: number | null = null;
  let recordingSessionId: string | null = null;
  let nextIdleAt: number | null = null;

  return {
    name: 'generator',
    tick({ now }) {
      const state = engine.store.getState();
      const session = state.session;
      const rng = engine.rng.get(RngStream.EVENTS);
      let next = state;

      if (session && session.state === SessionState.RECORDING && session.startedAt !== null) {
        nextIdleAt = null;
        if (recordingSessionId !== session.id || nextRecordingAt === null) {
          recordingSessionId = session.id;
          nextRecordingAt = Math.max(now, session.startedAt) + rng.exponential(RECORDING_EVENT_MEAN_MS);
        }
        let count = 0;
        while (nextRecordingAt <= now) {
          if (count >= GENERATOR_CATCH_UP_MAX) {
            nextRecordingAt = now + rng.exponential(RECORDING_EVENT_MEAN_MS);
            break;
          }
          next = recordingActivity(next, Math.floor(nextRecordingAt), rng);
          nextRecordingAt += rng.exponential(RECORDING_EVENT_MEAN_MS);
          count += 1;
        }
      } else {
        recordingSessionId = null;
        nextRecordingAt = null;
        if (nextIdleAt === null) nextIdleAt = now + IDLE_EVENT_INTERVAL_MS;
        let count = 0;
        while (nextIdleAt <= now && count < 10) {
          next = idleActivity(next, nextIdleAt, rng);
          nextIdleAt += IDLE_EVENT_INTERVAL_MS;
          count += 1;
        }
        if (nextIdleAt <= now) nextIdleAt = now + IDLE_EVENT_INTERVAL_MS;
      }
      if (next !== state) engine.store.setState(next);
    },
  };
}
