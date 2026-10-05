/**
 * The sockets of upgrade requests, from the moment Node hands them over until the socket route
 * takes them (plan row W42; review finding CPS1-4; findings F-1, F-2 and F-4 of the row).
 *
 * WHY THIS EXISTS. Node hands the socket of an upgrade request to whoever listens for `upgrade`
 * and manages it no longer: no parser, no keep-alive time-out, no `error` listener. From then on
 * a socket that nobody takes care of stays open for as long as the peer likes. Three things can
 * happen to an upgrade request, and each must end with the socket in somebody's hands or gone:
 *
 *   the socket route takes it        `taken`: it is the socket library's, with its own listeners,
 *                                    and the hub's caps count it from here on;
 *   it is answered over HTTP         `answered`: a refusal by a request stage (503, 403, 401,
 *                                    429), the 404 of an upgrade outside `/ws`, a failure. The
 *                                    unit's `onResponse` hook reports it and the socket is
 *                                    destroyed;
 *   nobody reports anything          an upgrade on a path the router cannot decode is answered
 *                                    where no hook runs; a request can also hang in a stage.
 *                                    `sweep` destroys what was neither taken nor answered
 *                                    within `handshakeTimeoutMs`.
 *
 * Until one of the three, the guard holds an `error` and an `end` listener on the socket: a peer
 * that resets the connection must not become an unhandled `error` event (it would end the
 * process), and a peer that ends must not leave the socket half open.
 *
 * BOUNDED IN NUMBER TOO. A waiting socket is outside the request throttle when no hook runs for
 * it, so their number has a cap of its own, `maxPendingHandshakes`. At the cap the OLDEST
 * waiting socket is destroyed and the new one waits in its place: a flood of upgrades that never
 * complete cannot keep a new upgrade out, and cannot hold more descriptors than the cap. A real
 * handshake waits for milliseconds, so it is the flood's own sockets that are displaced. The cap
 * is apart from the hub's 16 connections on purpose: counted there, sockets that nobody
 * authenticated could take the places of operators and devices.
 *
 * Time is the server clock's; the sweep is called at the channel's pace step. Nothing here reads
 * a URL, a header or a byte of the request: a socket is known by its request object only.
 */
import type { Duplex } from 'node:stream';
import type { Clock } from '../core';

export interface HandshakeLimits {
  readonly handshakeTimeoutMs: number;
  readonly maxPendingHandshakes: number;
}

export interface HandshakeStats {
  /** Sockets handed over and neither taken, answered nor destroyed yet. */
  readonly pending: number;
  /** Destroyed by the sweep: not taken within the bound. */
  readonly expired: number;
  /** Destroyed because the cap of waiting sockets was reached and a newer one arrived. */
  readonly displaced: number;
}

export interface HandshakeGuard {
  /** Node handed `socket` over for the upgrade request `request`. */
  begin(request: object, socket: Duplex): void;
  /** The socket route took the socket: the guard's listeners are removed and it is forgotten. */
  taken(request: object): void;
  /** The request was answered over HTTP: its socket is destroyed. A request the guard does not know changes nothing. */
  answered(request: object): void;
  /** Destroys every waiting socket whose time is up. Returns how many. */
  sweep(): number;
  /** Destroys every waiting socket (the stop). */
  clear(): void;
  stats(): HandshakeStats;
}

interface Waiting {
  readonly socket: Duplex;
  /** The server clock's time at which the sweep destroys the socket. */
  readonly deadline: number;
  /** Takes the guard's two listeners off the socket. */
  release(): void;
}

export function createHandshakeGuard(clock: Clock, limits: HandshakeLimits): HandshakeGuard {
  /** In the order of arrival, so the first entry is the oldest and has the earliest deadline. */
  const waiting = new Map<object, Waiting>();
  let expired = 0;
  let displaced = 0;

  /**
   * Destroys a socket the guard gives up. Its `error` listener stays: an answer that is written
   * to the destroyed socket afterwards must not surface as an unhandled event either.
   */
  function destroy(request: object, entry: Waiting): void {
    waiting.delete(request);
    entry.socket.destroy();
  }

  return {
    begin(request, socket) {
      const drop = (): void => {
        const entry = waiting.get(request);
        if (entry !== undefined) destroy(request, entry);
      };
      socket.on('error', drop);
      socket.once('end', drop);

      if (waiting.size >= limits.maxPendingHandshakes) {
        const oldest = waiting.entries().next().value;
        if (oldest !== undefined) {
          displaced += 1;
          destroy(oldest[0], oldest[1]);
        }
      }
      waiting.set(request, {
        socket,
        deadline: clock.now() + limits.handshakeTimeoutMs,
        release() {
          socket.removeListener('error', drop);
          socket.removeListener('end', drop);
        },
      });
    },

    taken(request) {
      const entry = waiting.get(request);
      if (entry === undefined) return;
      waiting.delete(request);
      entry.release();
    },

    answered(request) {
      const entry = waiting.get(request);
      if (entry !== undefined) destroy(request, entry);
    },

    sweep() {
      const now = clock.now();
      let destroyed = 0;
      for (const [request, entry] of waiting) {
        // In the order of arrival: the first one whose time is not up ends the sweep.
        if (entry.deadline > now) break;
        destroy(request, entry);
        destroyed += 1;
      }
      expired += destroyed;
      return destroyed;
    },

    clear() {
      for (const [request, entry] of waiting) destroy(request, entry);
    },

    stats: () => ({ pending: waiting.size, expired, displaced }),
  };
}
