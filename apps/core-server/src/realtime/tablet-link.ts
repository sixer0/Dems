/**
 * The tablet link, driven by real device connections (plan row W42; spec §6.8, §8.6; decision
 * D93 DN-6).
 *
 * The engine's `tabletLink` slice is CONNECTED while at least one PAIRED device has an open
 * authenticated socket, and OFFLINE otherwise. "A socket of a device" is a DEVICE socket (the
 * device credential) or an OPERATOR socket whose session is bound to a device (a bearer
 * session): both prove a paired device is there. With several devices the slice stays one flag
 * (GS-16).
 *
 * The channel only says what the link should be; the engine writes it: `engine.setTabletLink`
 * is the hosted action with no actor, one unit of work, and it writes `TABLET_LINK_CHANGED` and
 * the event when the state changes.
 *
 *   the first device socket opens         CONNECTED, at once
 *   the last device socket closes         OFFLINE after `tabletLinkDebounceMs`, unless a device
 *                                         socket opened meanwhile (a reconnect within 5 s does
 *                                         not toggle the link)
 *   a device was revoked or unpaired      OFFLINE at once when no other device socket is open:
 *                                         that device cannot come back
 *   the engine started (boot, reset)      the next step compares again: after a process start
 *                                         the link is OFFLINE until a device connects (§8.6);
 *                                         sockets that stayed open across a reset set it back
 *   the server stops                      nothing: the engine has stopped before the sockets
 *                                         close, and the next start writes the truthful row
 *
 * What is wanted is compared with what the engine holds at every pace step, so a call that was
 * not committed is tried again (not before `tabletLinkRetryMs`), and nothing is queued.
 */
import { TabletLinkState } from '@dems/shared/sim';
import type { FastifyBaseLogger } from 'fastify';
import type { Clock } from '../core';
import type { EngineHost } from '../engine';
import { describeError, type ErrorLog } from '../plugins/logger';
import type { RealtimeLimits } from './limits';

export type TabletLinkEngine = Pick<EngineHost, 'running' | 'slice' | 'setTabletLink'>;

export interface TabletLinkDependencies {
  readonly clock: Clock;
  /** Read through the seam at each use. */
  readonly engine: () => TabletLinkEngine;
  readonly log: FastifyBaseLogger;
  readonly errorLog: ErrorLog;
  readonly limits: Pick<RealtimeLimits, 'tabletLinkDebounceMs' | 'tabletLinkRetryMs'>;
}

export interface TabletLink {
  /** An authenticated socket of a paired device opened. */
  deviceOpened(): void;
  /** One of them closed. Called once for each `deviceOpened`, never without one. */
  deviceClosed(): void;
  /** A device was revoked or unpaired and its sockets were closed: no debounce for it. */
  deviceRetired(): void;
  /** Compares what is wanted with what the engine holds; called at every pace step. */
  step(): void;
  /** Device sockets that are open now. */
  readonly open: number;
  /** Resolves when no `setTabletLink` call is in flight (tests). */
  settled(): Promise<void>;
}

const LINK_NOT_SET = 'the tablet link could not be set; it is tried again';

export function createTabletLink(dependencies: TabletLinkDependencies): TabletLink {
  const { clock, log, errorLog, limits } = dependencies;
  let open = 0;
  /** Read only while no device socket is open: from when OFFLINE is wanted. Null: none has closed yet. */
  let offlineFrom: number | null = null;
  let inFlight: Promise<void> | null = null;
  let retryFrom = Number.NEGATIVE_INFINITY;
  /** True from the first failed call until one is committed: one report per run of failures. */
  let failing = false;

  /** What the link should be now; null while a reconnect is still awaited. */
  function wanted(now: number): TabletLinkState | null {
    if (open > 0) return TabletLinkState.CONNECTED;
    if (offlineFrom !== null && now < offlineFrom) return null;
    return TabletLinkState.OFFLINE;
  }

  function step(): void {
    if (inFlight !== null) return;
    const now = clock.now();
    if (now < retryFrom) return;
    const engine = dependencies.engine();
    if (!engine.running) return;
    const want = wanted(now);
    if (want === null || engine.slice('tabletLink').state === want) return;
    inFlight = engine
      .setTabletLink(want)
      .then(
        () => {
          failing = false;
        },
        (error: unknown) => {
          // The engine stopped, or the unit was not committed. A later step asks again.
          retryFrom = clock.now() + limits.tabletLinkRetryMs;
          if (failing) return;
          failing = true;
          log.warn({ err: error, link: want }, LINK_NOT_SET);
          errorLog.append({ level: 'warn', source: 'realtime.tabletLink', message: LINK_NOT_SET, ...describeError(error), context: { link: want } });
        },
      )
      .finally(() => {
        inFlight = null;
      });
  }

  return {
    deviceOpened() {
      open += 1;
      step();
    },
    deviceClosed() {
      open -= 1;
      if (open === 0) offlineFrom = clock.now() + limits.tabletLinkDebounceMs;
    },
    deviceRetired() {
      // Only read while no device socket is open; the close of the last one sets it afresh.
      offlineFrom = clock.now();
      step();
    },
    step,
    get open() {
      return open;
    },
    async settled() {
      while (inFlight !== null) await inFlight;
    },
  };
}
