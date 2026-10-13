/**
 * MICROPHONE LOSS of the production microphone adapter (task 4 row 68, WP-07a; specification S3,
 * H-22 "hot-plug detection"; README "Recording": a silent or disconnected microphone raises a
 * warning ONLY).
 *
 * REGISTERED NOWHERE, as the production microphone adapter beside it: the composition of the
 * production registry (row 85) makes one watch, hands it the adapter's enumerator, stored-row
 * reader, match and `openSources`, and gives `sourceLost` to the adapter as its `onSourceLost`.
 *
 * WHAT IT WATCHES. Two things make a registered microphone "lost":
 *
 *   1. HOT-PLUG: the registered sound card is no longer in a FRESH card listing. The card is
 *      looked for by its stored identity (`identifyRegisteredCard`: USB id, then the kernel name;
 *      never a card index), so a card that came back at another index IS back, and another card
 *      at the old index is not taken for it. One listing per pass serves every microphone.
 *   2. THE HELPER ENDED: the adapter tells it once per handle (`onSourceLost`: the helper ended
 *      during a session, or delivered no sample in time).
 *
 * WHAT IT DOES. It raises ONE fault per episode through the sink handed in, and clears it when the
 * episode is over. The fault is the EXISTING one of a microphone that stopped delivering:
 * `CAPTURE_FAULT` with the reason `MIC_DISCONNECTED` about the microphone's registry id - the key
 * the capture worker uses for a microphone that delivers no sample. Because the key of a fault is
 * (kind, reason, device), the worker's word and this watch's word about one microphone are ONE
 * fault, one alert and one audit entry (`FAULT_RAISED`), never two. The audit entry is written by
 * the engine action behind the sink (`raiseCaptureWarning`); this file writes no row itself and
 * imports no engine.
 *
 * WHAT IT NEVER DOES. It switches no audio source, closes no handle, restarts no helper and
 * reopens no card: it has no reference to anything that could. A returned card does NOT bring a
 * session's microphone back - the adapter starts a handle once (record of row 67, section 7).
 *
 * WHEN A FAULT ENDS.
 *   - a card that was absent: when a later listing shows the registered card again;
 *   - a helper that ended: when the microphone is no longer held open (its handle was closed) AND
 *     the card is not absent. While the handle is held the microphone still delivers nothing, so
 *     a card that returns in mid session does not clear the fault (DRIVER DECISION DD-1 of the
 *     record). During a session the worker's own `CLEARED` is the word that a microphone delivers
 *     again; the watch never says so.
 *
 * WHAT IS NOT A LOSS. A listing that could not be made, a stored row that could not be read, two
 * cards that carry the stored identity, a stored identity that is the fixed word: none of them
 * says the card is gone, so none raises and none clears; each is reported by its code.
 *
 * It does not log (the capture folder logs in one place): what went wrong is told to `report`,
 * every change of state to `onChange`. No card name, USB id or path is in either.
 *
 * NOT PROVEN ON THIS HOST (no Linux, no sound card): what a real unplug does to the listing and
 * how long the kernel takes to drop the card. Hardware check `9A/H-07`.
 */
import { CaptureWarningCode, CaptureWarningReason } from '@dems/capture-protocol';
import type { CaptureTimers } from '../../types';
import type { CardEnumerator, CardListing } from './card-listing';

/**
 * THE MATCH IS HANDED IN. This file does not import the adapter beside it: no production source
 * may name a built production adapter before the lift (static rule A-9 of the adapter layer). The
 * composition hands in the adapter's own two functions, `identifyRegisteredCard` and
 * `isRegisteredAudioInput`, and its stored-row reader; the shapes below are what they have.
 */
export interface MicLossStoredRow {
  /** The registry id of the microphone (`MIC-NN`). */
  readonly deviceId: string;
}

/** The answer of the match: found, or the adapter's refusal word. */
export type MicCardMatch = { readonly ok: true } | { readonly ok: false; readonly refusal: string };

/** The two refusal words of the match that say THE REGISTERED CARD IS NOT THERE (`UsbAudioRefusal`; held equal by the test). */
export const MIC_CARD_ABSENT = 'AUDIO_CARD_ABSENT';
export const MIC_CARD_CHANGED = 'AUDIO_CARD_CHANGED';

/** The fault of a lost microphone: the existing key of a microphone that stopped delivering. */
export interface MicLossFault {
  readonly code: typeof CaptureWarningCode.CAPTURE_FAULT;
  /** The registry id of the microphone (`MIC-NN`). */
  readonly subject: string;
  readonly reason: typeof CaptureWarningReason.MIC_DISCONNECTED;
}

/**
 * Where a fault goes. The composition hands in the engine's two internal actions
 * (`raiseCaptureWarning`, `clearCaptureWarning`): each raise is one alert and one `FAULT_RAISED`
 * audit entry, each clear one `FAULT_CLEARED`. A sink that throws is asked again at the next pass.
 *
 * DECISION C60 (2) (task 4 row 85c): the watch raises its fault and clears ONLY the fault it raised
 * itself, when it observes the source back. Here that is `Episode.raised`: `clear` is called for an
 * episode whose `raise` at this sink succeeded, and for no other. That the fault under that key was
 * not raised by ANOTHER part first (the capture worker says the same key) is held by the sink the
 * composition hands in (`watchFaultSinkOf` of the fence), which does not own - and never clears -
 * a fault that was active before the watch's raise.
 */
export interface MicFaultSink {
  raise(fault: MicLossFault): Promise<void> | void;
  clear(fault: MicLossFault): Promise<void> | void;
}

/** Why a microphone is lost. A fixed word, never a value of a card. */
export const MicLossCause = {
  /** The registered card is not in the listing. */
  CARD_ABSENT: 'CARD_ABSENT',
  /** Another card sits under the registered card's name. */
  CARD_CHANGED: 'CARD_CHANGED',
  /** The helper of a started microphone ended, or delivered no sample in time. */
  HELPER_ENDED: 'HELPER_ENDED',
} as const;
export type MicLossCause = (typeof MicLossCause)[keyof typeof MicLossCause];

export const MicLossState = { LOST: 'LOST', RETURNED: 'RETURNED' } as const;
export type MicLossState = (typeof MicLossState)[keyof typeof MicLossState];

/** THE LOSS CALLBACK: told once when a microphone becomes lost and once when that is over. */
export interface MicLossChange {
  readonly deviceId: string;
  readonly state: MicLossState;
  /** The cause that opened the episode. */
  readonly cause: MicLossCause;
}

export const MicLossReportCode = {
  /** The cards could not be listed: nothing is concluded from that pass. */
  LISTING_FAILED: 'MIC_LOSS_LISTING_FAILED',
  /** The stored row of a microphone could not be read or is not of its shape. */
  ROW_UNREADABLE: 'MIC_LOSS_ROW_UNREADABLE',
  /** The listing cannot tell whether the registered card is there (two cards, or no identity). */
  CARD_UNDECIDED: 'MIC_LOSS_CARD_UNDECIDED',
  /** The sink refused a raise or a clear: asked again at the next pass. */
  SINK_FAILED: 'MIC_LOSS_SINK_FAILED',
  /** The loss callback threw. */
  OBSERVER_FAILED: 'MIC_LOSS_OBSERVER_FAILED',
  /** A scheduled pass ended by something no rule above names. The next pass still runs. */
  PASS_FAILED: 'MIC_LOSS_PASS_FAILED',
  /** The adapter's word was about a handle of a SUPERSEDED capture attempt: dropped, nothing raised (row 85c; decision C60 (2)). */
  REPORT_SUPERSEDED: 'MIC_LOSS_REPORT_SUPERSEDED',
  /** Whether the attempt is superseded could not be asked: the adapter's word COUNTS (a loss is told rather than hidden). */
  ATTEMPT_UNREADABLE: 'MIC_LOSS_ATTEMPT_UNREADABLE',
} as const;
export type MicLossReportCode = (typeof MicLossReportCode)[keyof typeof MicLossReportCode];

export interface MicLossReport {
  readonly source: 'capture.adapters.audio.mic-loss';
  readonly code: MicLossReportCode;
  /** The microphone the report is about, or null for a pass as a whole. */
  readonly deviceId: string | null;
  /** The short code the failure carried (`EACCES`, a refusal code), or `NONE`. Never a message. */
  readonly detail: string;
}

/** The pause between two listings. Every listing starts the listing program once on a Linux host. */
export const MIC_LOSS_INTERVAL_MS = 5_000;
/** No interval below this is accepted: the watch must not become a load on the host. */
export const MIC_LOSS_MIN_INTERVAL_MS = 1_000;

export interface MicLossWatchOptions<Row extends MicLossStoredRow = MicLossStoredRow> {
  /** The registry ids of the registered microphones to watch, read at every pass. */
  readonly devices: () => readonly string[];
  /** The stored row of a microphone (the reader the adapter is given). */
  readonly registered: (deviceId: string) => Promise<Row | null>;
  /** The adapter's match of a stored row to a card of one listing (`identifyRegisteredCard`). */
  readonly identify: (listing: CardListing, stored: Row) => MicCardMatch;
  /** The adapter's shape rule of a stored row (`isRegisteredAudioInput`). A row that fails it is matched against nothing. */
  readonly isRow: (row: Row | null | undefined) => boolean;
  /** The card listing. Every pass reads the host once. */
  readonly cards: CardEnumerator;
  /** The microphones whose handle is open now (`UsbAudioProductionAdapter.openSources`). */
  readonly held: () => readonly string[];
  readonly faults: MicFaultSink;
  /**
   * ATTEMPT-AWARENESS OF `sourceLost` (task 4 row 85c; decision C60 (2); the measurement of row 191).
   * Since row 191 a session closes every microphone handle of an attempt when its worker is replaced
   * and opens new ones. A helper of the EARLIER attempt may end by itself before that close reaches
   * it (measured: the helper 33 to 46 ms after the worker, the session's close 12 to 19 ms after):
   * the adapter then says `onSourceLost` about a handle that feeds no worker any more.
   *
   * True: the capture attempt that microphone's handle was opened for is SUPERSEDED - its worker is
   * gone and the session is replacing it. Asked ONCE, in the turn `sourceLost` is called (not later:
   * the answer is about that moment). An episode of a superseded attempt RAISES NOTHING: the word is
   * dropped and reported (`REPORT_SUPERSEDED`), as a report of a superseded attempt is dropped
   * everywhere else (decision C37). A card that is really gone is still told by the listing pass,
   * and a microphone that cannot be opened again by the session.
   *
   * Absent: every word of the adapter counts, as before. A function that throws: the word counts
   * (`ATTEMPT_UNREADABLE` is reported) - a loss is never hidden by a question that failed.
   */
  readonly superseded?: (deviceId: string) => boolean;
  readonly timers: CaptureTimers;
  /** Default `MIC_LOSS_INTERVAL_MS`; a smaller value than the minimum is the minimum. */
  readonly intervalMs?: number;
  readonly onChange?: (change: MicLossChange) => void;
  readonly report?: (report: MicLossReport) => void;
}

export interface MicLossWatch {
  /** Begins the passes: one now, then one per interval. Twice is once. */
  start(): void;
  /** Ends the passes. Raises and clears nothing: a fault that is active stays what it is. */
  stop(): void;
  /** One pass now: one listing, every watched microphone. Resolves when its raises and clears are done. */
  check(): Promise<void>;
  /** The adapter's `onSourceLost`: the helper of a started microphone ended. */
  sourceLost(deviceId: string, error?: unknown): void;
  /** The microphones whose fault this watch holds raised, in id order. */
  lost(): readonly string[];
  /** Resolves when everything asked for so far is done (a test waits on it). */
  settled(): Promise<void>;
}

interface Episode {
  /** The card is not in the last listing that could tell. */
  absent: MicLossCause | null;
  /** The adapter told the helper ended, and the handle was still held at the last look. */
  helperEnded: boolean;
  /** The fault is raised at the sink. */
  raised: MicLossCause | null;
}

const MIC_ID = /^MIC-[0-9]{2,}$/;
const DETAIL_WORD = /^[A-Z][A-Z0-9_]{0,47}$/;
const NO_DETAIL = 'NONE';

function detailOf(error: unknown): string {
  const carried = error as { what?: unknown; reason?: unknown; code?: unknown } | null;
  for (const word of [carried?.what, carried?.reason, carried?.code]) if (typeof word === 'string' && DETAIL_WORD.test(word)) return word;
  return NO_DETAIL;
}

const faultOf = (deviceId: string): MicLossFault => Object.freeze({ code: CaptureWarningCode.CAPTURE_FAULT, subject: deviceId, reason: CaptureWarningReason.MIC_DISCONNECTED });

export function createMicLossWatch<Row extends MicLossStoredRow>(options: MicLossWatchOptions<Row>): MicLossWatch {
  const intervalMs = Math.max(typeof options.intervalMs === 'number' && Number.isFinite(options.intervalMs) ? options.intervalMs : MIC_LOSS_INTERVAL_MS, MIC_LOSS_MIN_INTERVAL_MS);
  const episodes = new Map<string, Episode>();
  let running = false;
  let cancel: (() => void) | null = null;
  /** One thing at a time: a pass and a word of the adapter never race for the same fault. */
  let queue: Promise<void> = Promise.resolve();

  const report = (code: MicLossReportCode, deviceId: string | null, detail: string = NO_DETAIL): void => {
    try {
      options.report?.(Object.freeze({ source: 'capture.adapters.audio.mic-loss', code, deviceId, detail }));
    } catch {
      // A reporter never changes what the watch does.
    }
  };

  const tell = (deviceId: string, state: MicLossState, cause: MicLossCause): void => {
    try {
      options.onChange?.(Object.freeze({ deviceId, state, cause }));
    } catch (error) {
      report(MicLossReportCode.OBSERVER_FAILED, deviceId, detailOf(error));
    }
  };

  const episodeOf = (deviceId: string): Episode => {
    let episode = episodes.get(deviceId);
    if (episode === undefined) {
      episode = { absent: null, helperEnded: false, raised: null };
      episodes.set(deviceId, episode);
    }
    return episode;
  };

  /** Brings the sink to what the episode says. One raise per episode, one clear at its end. */
  async function settle(deviceId: string, episode: Episode): Promise<void> {
    const cause: MicLossCause | null = episode.absent ?? (episode.helperEnded ? MicLossCause.HELPER_ENDED : null);
    if (cause !== null && episode.raised === null) {
      try {
        await options.faults.raise(faultOf(deviceId));
      } catch (error) {
        report(MicLossReportCode.SINK_FAILED, deviceId, detailOf(error));
        return;
      }
      episode.raised = cause;
      tell(deviceId, MicLossState.LOST, cause);
      return;
    }
    if (cause === null && episode.raised !== null) {
      try {
        await options.faults.clear(faultOf(deviceId));
      } catch (error) {
        report(MicLossReportCode.SINK_FAILED, deviceId, detailOf(error));
        return;
      }
      const opened = episode.raised;
      episode.raised = null;
      tell(deviceId, MicLossState.RETURNED, opened);
    }
  }

  /** What ONE listing says about one stored row: absent by a cause, present (`null`), or nothing (`undefined`). */
  function presenceOf(listing: CardListing, stored: Row): MicLossCause | null | undefined {
    const found = options.identify(listing, stored);
    if (found.ok) return null;
    if (found.refusal === MIC_CARD_ABSENT) return MicLossCause.CARD_ABSENT;
    if (found.refusal === MIC_CARD_CHANGED) return MicLossCause.CARD_CHANGED;
    report(MicLossReportCode.CARD_UNDECIDED, stored.deviceId, found.refusal);
    return undefined;
  }

  async function pass(): Promise<void> {
    const watched = [...new Set(options.devices())].filter((deviceId) => MIC_ID.test(deviceId)).sort();
    const held = new Set(options.held());
    // A helper that ended is over as a cause once its handle is closed: nothing claims to deliver any more.
    for (const [deviceId, episode] of episodes) if (episode.helperEnded && !held.has(deviceId)) episode.helperEnded = false;

    let listing: CardListing | null = null;
    try {
      listing = await options.cards.list();
    } catch (error) {
      report(MicLossReportCode.LISTING_FAILED, null, detailOf(error));
    }
    for (const deviceId of watched) {
      const episode = episodeOf(deviceId);
      if (listing !== null) {
        let stored: Row | null = null;
        try {
          stored = await options.registered(deviceId);
        } catch (error) {
          report(MicLossReportCode.ROW_UNREADABLE, deviceId, detailOf(error));
        }
        if (stored !== null && options.isRow(stored) && stored.deviceId === deviceId) {
          const presence = presenceOf(listing, stored);
          if (presence !== undefined) episode.absent = presence;
        } else if (stored !== null) {
          report(MicLossReportCode.ROW_UNREADABLE, deviceId);
        }
      }
      await settle(deviceId, episode);
    }
    // A microphone that is no longer watched (its registration ended): its episode is closed, its fault cleared.
    for (const [deviceId, episode] of episodes) {
      if (watched.includes(deviceId)) continue;
      episode.absent = null;
      episode.helperEnded = false;
      await settle(deviceId, episode);
      if (episode.raised === null) episodes.delete(deviceId);
    }
  }

  const enqueue = (work: () => Promise<void>): Promise<void> => {
    const run = queue.then(work);
    queue = run.catch(() => undefined);
    return run;
  };

  /** A pass of the schedule: what it throws is reported, and the next one is still planned. */
  const scheduledPass = (): void => {
    void enqueue(pass)
      .catch((error: unknown) => report(MicLossReportCode.PASS_FAILED, null, detailOf(error)))
      .then(schedule);
  };

  function schedule(): void {
    if (!running) return;
    cancel = options.timers.after(intervalMs, () => {
      cancel = null;
      scheduledPass();
    });
  }

  return {
    start() {
      if (running) return;
      running = true;
      scheduledPass();
    },

    stop() {
      running = false;
      cancel?.();
      cancel = null;
    },

    check: () => enqueue(pass),

    sourceLost(deviceId) {
      if (!MIC_ID.test(deviceId)) return;
      // Row 85c (C60 (2)): asked NOW, before anything is queued. A word about a handle of a superseded attempt opens no episode.
      if (options.superseded !== undefined) {
        let superseded = false;
        try {
          superseded = options.superseded(deviceId) === true;
        } catch (error) {
          report(MicLossReportCode.ATTEMPT_UNREADABLE, deviceId, detailOf(error));
        }
        if (superseded) {
          report(MicLossReportCode.REPORT_SUPERSEDED, deviceId);
          return;
        }
      }
      void enqueue(async () => {
        const episode = episodeOf(deviceId);
        episode.helperEnded = true;
        await settle(deviceId, episode);
      }).catch((error: unknown) => report(MicLossReportCode.PASS_FAILED, deviceId, detailOf(error)));
    },

    lost: () => [...episodes.entries()].filter(([, episode]) => episode.raised !== null).map(([deviceId]) => deviceId).sort(),
    settled: () => queue,
  };
}
