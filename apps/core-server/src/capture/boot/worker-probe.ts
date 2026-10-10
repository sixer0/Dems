/**
 * THE WORKER'S HANDSHAKE AT BOOT (blueprint row 61 / M3-W5; register CS-22 "worker binary";
 * pair-58 finding F-10; capture spec §B.2).
 *
 * Starts the worker ONCE through the launcher it is handed (the process channel of `ipc.ts`: this
 * file names no process and no file, static rule G-R8), reads its FIRST frame and ends it. No
 * `START` is ever sent: the worker opens no device, no listener and no file of evidence. A worker
 * that keeps the protocol exits when its input ends; one that does not is killed after the grace.
 *
 * The answer is what the worker said, or why there is none. What the Core makes of a version is
 * `workerVersionRefusalOf` (`checks.ts`).
 */
import { CAPTURE_IPC_DEFAULTS, WorkerMessageType } from '@dems/capture-protocol';
import type { CaptureTimers, WorkerChannel, WorkerLauncher } from '../types';
import { HandshakeFailure, type WorkerHandshake } from './checks';

/** The session a boot probe names to the launcher. No session of the product can have this ID. */
export const BOOT_PROBE_SESSION = 'BOOT-PROBE';

export interface WorkerProbeOptions {
  readonly launcher: WorkerLauncher;
  readonly timers: CaptureTimers;
  /** Default: the protocol's limit for `HELLO`. */
  readonly helloTimeoutMs?: number;
  /** How long a worker whose input ended may take to exit before it is killed. Default: the protocol's stop grace. */
  readonly exitGraceMs?: number;
}

/** Starts the worker, resolves with its first frame, and ends it. Never rejects. */
export function probeWorkerHandshake(options: WorkerProbeOptions): Promise<WorkerHandshake> {
  const helloTimeoutMs = options.helloTimeoutMs ?? CAPTURE_IPC_DEFAULTS.helloTimeoutMs;
  const exitGraceMs = options.exitGraceMs ?? CAPTURE_IPC_DEFAULTS.stopGraceMs;

  return new Promise<WorkerHandshake>((resolve) => {
    let answered = false;
    let exited = false;
    let channel: WorkerChannel | null = null;
    let cancelTimeout: (() => void) | null = null;
    let cancelKill: (() => void) | null = null;

    /** Ends the worker: its input first, the signal only when it stays. */
    const end = (): void => {
      if (channel === null || exited) return;
      channel.closeInput();
      const open = channel;
      cancelKill = options.timers.after(exitGraceMs, () => {
        if (!exited) open.kill('SIGKILL');
      });
    };
    const answer = (handshake: WorkerHandshake): void => {
      if (answered) return;
      answered = true;
      cancelTimeout?.();
      end();
      resolve(handshake);
    };

    try {
      channel = options.launcher(
        { sessionId: BOOT_PROBE_SESSION, correlationId: BOOT_PROBE_SESSION, attempt: 1 },
        {
          message(message) {
            if (message.type === WorkerMessageType.HELLO) answer({ outcome: 'HELLO', protocolVersion: message.protocolVersion, workerVersion: message.workerVersion });
            else answer({ outcome: 'NONE', failure: HandshakeFailure.HELLO_EXPECTED });
          },
          violation() {
            answer({ outcome: 'NONE', failure: HandshakeFailure.VIOLATION });
          },
          exit(exit) {
            exited = true;
            cancelKill?.();
            answer({ outcome: 'NONE', failure: exit.spawnFailed ? HandshakeFailure.SPAWN_FAILED : HandshakeFailure.EXITED });
          },
        },
      );
    } catch {
      // A launcher that cannot start anything says so by throwing; nothing is left to end.
      exited = true;
      answer({ outcome: 'NONE', failure: HandshakeFailure.SPAWN_FAILED });
      return;
    }
    // The handlers are called on a later turn (the channel's contract). A channel that answered from
    // inside the launcher is ended here, now that it is known.
    if (answered) end();
    else cancelTimeout = options.timers.after(helloTimeoutMs, () => answer({ outcome: 'NONE', failure: HandshakeFailure.TIMEOUT }));
  });
}
