/**
 * When the Live source's store holds what a RESYNCED signal is about (decision D169; finding F-2 of
 * row W72). Used by `SessionRouteSync` for its heartbeat resync in LIVE mode.
 *
 * The socket client reports RESYNCED as soon as it has handed the snapshot to the Live source. On a
 * reconnect after an outage the Live source does not apply that snapshot yet: a new OPERATOR socket
 * makes it confirm the session first (CPC1-35, `revalidateSession` in
 * `packages/shared/src/live/source/live-sim.ts`), and it holds every state message until the Core
 * answered. Then `adoptSession` applies the held snapshot to the store and, after that, notifies its
 * listeners (`onLiveChange`) with a NEW `session` object. So at the signal the store can still hold the
 * state from before the outage, and a resync then opens a screen the Core has already left behind (the
 * reproduction of W72: the summary of a session the Core had acknowledged meanwhile).
 *
 * | Since the link was lost | At the signal | `run` |
 * |---|---|---|
 * | nothing (no outage seen), or the link came back on the same socket | the store is current | at once |
 * | the Live source replaced its `session` (it confirmed it, or it ended) | the store is current | at once |
 * | a new socket and the session not yet confirmed | the snapshot is held | at the confirmation: the first `onLiveChange` with another `session` object (the store holds the snapshot by then) |
 *
 * Only public members of the Live source are read: `link`, `session`, `socketStatus().connection`,
 * `onLiveChange`. No clock, no timer: the Live source's own notification is the moment.
 */
import { LiveLinkState } from '@dems/shared/live';

/** The members of the Live source this watch reads. */
export interface LiveResyncSource {
  readonly link: LiveLinkState;
  readonly session: unknown;
  socketStatus(): { readonly connection: number };
  onLiveChange(listener: () => void): () => void;
}

export interface LiveResyncWatch {
  /** Runs `run` once the store holds the state the last RESYNCED is about: now, or at the confirmation. A newer call replaces an owed one. */
  whenSynced(run: () => void): void;
  /** Stops listening; an owed `run` is dropped. */
  dispose(): void;
}

export function watchLiveResync(live: LiveResyncSource): LiveResyncWatch {
  /** The session object and the socket at the moment the link was lost; null while nothing is pending. */
  let lost: { readonly session: unknown; readonly connection: number } | null = null;
  let owed: (() => void) | null = null;
  let online = live.link === LiveLinkState.ONLINE;

  const unsubscribe = live.onLiveChange(() => {
    const nowOnline = live.link === LiveLinkState.ONLINE;
    if (online && !nowOnline && lost === null) lost = { session: live.session, connection: live.socketStatus().connection };
    online = nowOnline;
    if (lost === null) return;
    const confirmed = live.session !== lost.session;
    const sameSocketBack = nowOnline && live.socketStatus().connection === lost.connection;
    if (!confirmed && !sameSocketBack) return;
    lost = null;
    const run = owed;
    owed = null;
    run?.();
  });

  return {
    whenSynced(run) {
      if (lost === null) run();
      else owed = run;
    },
    dispose() {
      owed = null;
      unsubscribe();
    },
  };
}
