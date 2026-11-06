/**
 * The fake microphone adapter (blueprint row 65; check M4-FAKE-1; capture spec §A.7 "Test hook",
 * §A.7.1). Adapter kind `FAKE`: one instance is one microphone with a level of its own, so that
 * two of them are told apart by ear and by meter (S2 used a 0.3 gain on the standby - D61,
 * 2026-11-04: the standby is the legacy name of channel 2; every numbered channel records).
 *
 * `open` hands out the transport the worker reads — the row-58 pipe kind — as a NAME only: the
 * fake creates no pipe and writes no sample. Whoever needs sound behind it (the worker harness of
 * row 60, the development helper of row 135) writes the pipe at that path. The plan builder takes
 * a microphone's `input` from the handle, never from a path of its own (D72(e)).
 */
import { CaptureMicInputKind } from '@dems/capture-protocol';
import { CaptureAdapterError, CaptureAdapterRefusal } from '../errors';
import { CaptureAdapterKind } from '../kinds';
import { micPipePath, micTransportOf } from '../mic-transport';
import type { AudioInputAdapter, AudioInputDescriptor, AudioInputErrorCode, AudioOpenTarget, AudioStreamHandle } from '../types';

export interface FakeAudioOptions {
  readonly id: string;
  readonly label?: string;
  /** The absolute directory the pipe names are built under (`<runDir>/<sessionId>/<deviceId>.pcm`). */
  readonly runDir: string;
  /** The level the fake reads, in dBFS. */
  readonly dbfs?: number;
}

export interface FakeAudioInputAdapter extends AudioInputAdapter {
  readonly calls: { enumerate: number; opened: string[]; closed: string[] };
  openInputs(): readonly string[];
  /** The input's level, or null for an input that delivers nothing (NO SIGNAL). */
  setLevel(dbfs: number | null): void;
  /** Unplugs the input (with the named cause a rescan reports), or plugs it back in. */
  setPresent(present: boolean, errorCode?: AudioInputErrorCode): void;
}

/** The levels of the two built-in fakes: 10.5 dB apart (a 0.3 gain). */
export const FAKE_MIC_PRIMARY_DBFS = -20;
export const FAKE_MIC_STANDBY_DBFS = -30.5;

export function createFakeAudioInputAdapter(options: FakeAudioOptions): FakeAudioInputAdapter {
  const calls: FakeAudioInputAdapter['calls'] = { enumerate: 0, opened: [], closed: [] };
  const open = new Set<string>();
  let level: number | null = options.dbfs ?? FAKE_MIC_PRIMARY_DBFS;
  let present = true;
  let errorCode: AudioInputErrorCode | null = null;

  const served = (inputId: string): void => {
    if (inputId !== options.id) throw new CaptureAdapterError(CaptureAdapterRefusal.DEVICE_UNKNOWN);
  };

  return {
    seam: 'AUDIO',
    kind: CaptureAdapterKind.FAKE,
    devices: Object.freeze([Object.freeze({ id: options.id, deviceClass: 'MIC' as const, label: options.label ?? options.id, capabilities: Object.freeze(['AUDIO'] as const), profiles: Object.freeze([]) })]),
    hasOpener: true,
    calls,

    async enumerate(): Promise<AudioInputDescriptor[]> {
      calls.enumerate += 1;
      return [{ inputId: options.id, present, errorCode: present ? null : errorCode }];
    },

    async open(inputId: string, target: AudioOpenTarget): Promise<AudioStreamHandle> {
      served(inputId);
      if (target.signal.aborted) throw new CaptureAdapterError(CaptureAdapterRefusal.ABORTED, inputId);
      // A missing input is a named refusal: nothing stands in for it (rule RG-5).
      if (!present || open.has(inputId)) throw new CaptureAdapterError(CaptureAdapterRefusal.SOURCE_KIND_NOT_RECORDABLE, inputId);
      const path = micPipePath(options.runDir, target.sessionId, inputId);
      open.add(inputId);
      calls.opened.push(inputId);
      let closed = false;
      return Object.freeze({
        deviceId: inputId,
        input: Object.freeze({ kind: CaptureMicInputKind.PCM_FIFO, path }),
        transport: micTransportOf(CaptureMicInputKind.PCM_FIFO),
        async close(): Promise<void> {
          if (closed) return;
          closed = true;
          open.delete(inputId);
          calls.closed.push(inputId);
        },
      });
    },

    async level(inputId: string): Promise<number | null> {
      served(inputId);
      return present ? level : null;
    },

    openInputs: () => [...open],
    setLevel(dbfs) {
      level = dbfs;
    },
    setPresent(next, code) {
      present = next;
      errorCode = next ? null : (code ?? 'DEVICE_NOT_FOUND');
    },
  };
}
