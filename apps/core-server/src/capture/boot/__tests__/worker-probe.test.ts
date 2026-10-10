// The worker's handshake at boot (blueprint row 61; pair-58 F-10): started once, first frame read,
// ended. Scripted channel and manual timers: nothing waits in real time and no process is started.
import { CAPTURE_IPC_DEFAULTS, CAPTURE_PROTOCOL_VERSION, FrameViolation, WorkerMessageType, type WorkerMessage } from '@dems/capture-protocol';
import { describe, expect, it } from 'vitest';
import { manualCaptureTimers } from '../../../../test/support/capture';
import { WorkerDownCode, WorkerLaunchError, type WorkerChannelHandlers, type WorkerLaunch, type WorkerLauncher } from '../../types';
import { HandshakeFailure } from '../checks';
import { BOOT_PROBE_SESSION, probeWorkerHandshake } from '../worker-probe';

interface Scripted {
  readonly launcher: WorkerLauncher;
  readonly launches: WorkerLaunch[];
  readonly did: string[];
  handlers(): WorkerChannelHandlers;
}
function scripted(options: { readonly exitOnInputEnd?: boolean } = {}): Scripted {
  const launches: WorkerLaunch[] = [];
  const did: string[] = [];
  let held: WorkerChannelHandlers | null = null;
  return {
    launches,
    did,
    handlers: () => {
      if (held === null) throw new Error('no worker was started');
      return held;
    },
    launcher: (launch, handlers) => {
      launches.push(launch);
      held = handlers;
      return {
        pid: 4242,
        send: async () => void did.push('send'),
        closeInput: () => {
          did.push('closeInput');
          if (options.exitOnInputEnd !== false) queueMicrotask(() => handlers.exit({ exitCode: 0, signal: null, spawnFailed: false }));
        },
        kill: (signal) => {
          did.push(signal);
          queueMicrotask(() => handlers.exit({ exitCode: null, signal, spawnFailed: false }));
        },
      };
    },
  };
}
const hello = (workerVersion: string, protocolVersion = CAPTURE_PROTOCOL_VERSION): WorkerMessage => ({ v: CAPTURE_PROTOCOL_VERSION, type: WorkerMessageType.HELLO, protocolVersion, workerVersion });
const turn = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

describe('probeWorkerHandshake', () => {
  it('hands on what the worker said, ends its input, and sends it no command', async () => {
    const manual = manualCaptureTimers();
    const worker = scripted();
    const probe = probeWorkerHandshake({ launcher: worker.launcher, timers: manual.timers });
    expect(worker.launches).toEqual([{ sessionId: BOOT_PROBE_SESSION, correlationId: BOOT_PROBE_SESSION, attempt: 1 }]);
    worker.handlers().message(hello('capture-worker/0.3.0-PROOF'));
    await expect(probe).resolves.toEqual({ outcome: 'HELLO', protocolVersion: CAPTURE_PROTOCOL_VERSION, workerVersion: 'capture-worker/0.3.0-PROOF' });
    await turn();
    // No START, no STOP: the worker opened nothing. It exited on the end of its input, so nothing is killed later.
    expect(worker.did).toEqual(['closeInput']);
    manual.advance(60_000);
    expect(worker.did).toEqual(['closeInput']);
    expect(manual.armed()).toEqual([]);
  });

  it('a worker that stays after its input ended is killed after the grace, not before', async () => {
    const manual = manualCaptureTimers();
    const worker = scripted({ exitOnInputEnd: false });
    const probe = probeWorkerHandshake({ launcher: worker.launcher, timers: manual.timers, exitGraceMs: 2_000 });
    worker.handlers().message(hello('capture-worker/0.3.0'));
    await probe;
    manual.advance(1_999);
    expect(worker.did).toEqual(['closeInput']);
    manual.advance(1);
    expect(worker.did).toEqual(['closeInput', 'SIGKILL']);
  });

  it('no frame within the limit: TIMEOUT at the protocol\'s limit, and the worker is ended', async () => {
    const manual = manualCaptureTimers();
    const worker = scripted();
    const probe = probeWorkerHandshake({ launcher: worker.launcher, timers: manual.timers });
    let settled = false;
    void probe.then(() => (settled = true));
    manual.advance(CAPTURE_IPC_DEFAULTS.helloTimeoutMs - 1);
    await turn();
    expect(settled).toBe(false);
    manual.advance(1);
    await expect(probe).resolves.toEqual({ outcome: 'NONE', failure: HandshakeFailure.TIMEOUT });
    expect(worker.did).toEqual(['closeInput']);
  });

  it('a first frame that is not HELLO, a line that is no frame, an early exit, a failed start', async () => {
    const cases: Array<[(handlers: WorkerChannelHandlers) => void, HandshakeFailure]> = [
      [(handlers) => handlers.message({ v: CAPTURE_PROTOCOL_VERSION, type: WorkerMessageType.HEARTBEAT, counter: 1 }), HandshakeFailure.HELLO_EXPECTED],
      [(handlers) => handlers.violation(FrameViolation.TOO_LONG), HandshakeFailure.VIOLATION],
      [(handlers) => handlers.exit({ exitCode: 64, signal: null, spawnFailed: false }), HandshakeFailure.EXITED],
      [(handlers) => handlers.exit({ exitCode: null, signal: null, spawnFailed: true }), HandshakeFailure.SPAWN_FAILED],
    ];
    for (const [act, failure] of cases) {
      const manual = manualCaptureTimers();
      const worker = scripted();
      const probe = probeWorkerHandshake({ launcher: worker.launcher, timers: manual.timers });
      act(worker.handlers());
      await expect(probe, failure).resolves.toEqual({ outcome: 'NONE', failure });
      // The answer is the FIRST thing the worker did: a HELLO after it changes nothing.
      worker.handlers().message(hello('capture-worker/0.3.0'));
      await expect(probe).resolves.toEqual({ outcome: 'NONE', failure });
    }
  });

  it('a launcher that cannot start anything: SPAWN_FAILED, no timer left armed', async () => {
    const manual = manualCaptureTimers();
    const launcher: WorkerLauncher = () => {
      throw new WorkerLaunchError(WorkerDownCode.SPAWN_FAILED, 'the capture worker process could not be started', true);
    };
    await expect(probeWorkerHandshake({ launcher, timers: manual.timers })).resolves.toEqual({ outcome: 'NONE', failure: HandshakeFailure.SPAWN_FAILED });
    expect(manual.armed()).toEqual([]);
  });
});
