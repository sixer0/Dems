// The live camera previews of one Core (decisions D51 / D53): the bounds, the linger, the yield to a
// recording and its order, the restart bound, the stop at a refused credential, and the mpjpeg frame
// parser across split chunks. No process, no socket, no clock: timers and the opener are doubles.
import { describe, expect, it } from 'vitest';
import type { CaptureTimers } from '../../../types';
import { CameraOpenError, CameraOpenRefusal } from '../onvif-relay';
import {
  PREVIEW_LIMITS,
  PREVIEW_LINGER_MS,
  PREVIEW_PAUSE_MAX_MS,
  PREVIEW_RESTART_DELAY_MS,
  PREVIEW_RESTART_MAX,
  PREVIEW_RESTART_WINDOW_MS,
  PreviewEndReason,
  PreviewState,
  createMpjpegParser,
  createPreviewManager,
  type PreviewSink,
} from '../preview-manager';
import type { PreviewPipeline, PreviewPipelineEnd } from '../preview-pipeline';

// ── Doubles ──────────────────────────────────────────────────────────────────────────────────────

function manualTimers(): CaptureTimers & { now(): number; advance(ms: number): Promise<void>; pending(): number } {
  let at = 0;
  let next = 1;
  const due = new Map<number, { at: number; callback: () => void }>();
  return {
    after(delayMs, callback) {
      const id = next++;
      due.set(id, { at: at + delayMs, callback });
      return () => {
        due.delete(id);
      };
    },
    now: () => at,
    async advance(ms) {
      const end = at + ms;
      for (;;) {
        const first = [...due.entries()].sort((a, b) => a[1].at - b[1].at)[0];
        if (first === undefined || first[1].at > end) break;
        due.delete(first[0]);
        at = first[1].at;
        first[1].callback();
        await settle();
      }
      at = end;
      await settle();
    },
    pending: () => due.size,
  };
}

const settle = async (): Promise<void> => {
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
};

const JPEG = (n: number): Buffer => Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.from(`picture-${String(n)}`), Buffer.from([0xff, 0xd9])]);
const partOf = (jpeg: Buffer, boundary = 'ffmpeg'): Buffer =>
  Buffer.concat([Buffer.from(`--${boundary}\r\nContent-type: image/jpeg\r\nContent-length: ${String(jpeg.length)}\r\n\r\n`), jpeg, Buffer.from('\r\n')]);

interface FakePipeline {
  readonly deviceId: string;
  readonly operatorId: string;
  push(bytes: Buffer): void;
  /** The pipeline ends by itself. */
  die(code: string, reason?: string): void;
  stops: number;
  stopped: boolean;
}

function fakeOpener() {
  const opened: FakePipeline[] = [];
  const events: string[] = [];
  let refuseNext: Error | null = null;
  let holdOpen: (() => void) | null = null;
  const open = async (deviceId: string, operatorId: string, onChunk: (bytes: Buffer) => void, signal: AbortSignal): Promise<PreviewPipeline> => {
    events.push(`open ${deviceId}`);
    if (refuseNext !== null) {
      const error = refuseNext;
      refuseNext = null;
      throw error;
    }
    if (holdOpen === null) {
      // resolves at once
    }
    let resolveEnd: (end: PreviewPipelineEnd) => void = () => {};
    const ended = new Promise<PreviewPipelineEnd>((resolve) => {
      resolveEnd = resolve;
    });
    const fake: FakePipeline = {
      deviceId,
      operatorId,
      push: (bytes) => onChunk(bytes),
      die: (code, reason = 'CAMERA_LOST') => resolveEnd({ stopped: false, code: code as PreviewPipelineEnd['code'], reason }),
      stops: 0,
      stopped: false,
    };
    if (signal.aborted) throw new Error('aborted');
    opened.push(fake);
    return {
      deviceId,
      ended,
      async stop() {
        fake.stops += 1;
        events.push(`stop ${deviceId}`);
        await Promise.resolve();
        fake.stopped = true;
        events.push(`reaped ${deviceId}`);
        resolveEnd({ stopped: true, code: CameraOpenRefusal.RELAY_STOPPED, reason: 'STOPPED' });
      },
    };
  };
  return {
    open,
    opened,
    events,
    refuse(error: Error) {
      refuseNext = error;
    },
    hold(release: () => void) {
      holdOpen = release;
    },
  };
}

function sink(options: { full?: boolean } = {}) {
  const frames: string[] = [];
  const states: PreviewState[] = [];
  const ends: string[] = [];
  let full = options.full ?? false;
  const value: PreviewSink = {
    frame(jpeg) {
      frames.push(jpeg.subarray(2, -2).toString());
      return !full;
    },
    state: (state) => states.push(state),
    end: (reason) => ends.push(reason),
  };
  return {
    value,
    frames,
    states,
    ends,
    setFull(next: boolean) {
      full = next;
    },
  };
}

function rig() {
  const timers = manualTimers();
  const opener = fakeOpener();
  const reports: { code: string; deviceId: string; reason: string | null }[] = [];
  const manager = createPreviewManager({ timers, now: () => timers.now(), open: opener.open, report: (entry) => reports.push(entry) });
  return { timers, opener, manager, reports };
}

const joined = (result: ReturnType<ReturnType<typeof createPreviewManager>['join']>) => {
  if (!result.joined) throw new Error(`refused: ${result.reason}`);
  return result.viewer;
};

// ── The parser ───────────────────────────────────────────────────────────────────────────────────

describe('the mpjpeg parser: pictures by their Content-length', () => {
  it('cuts whole parts, parts split at every byte, and several parts in one chunk', () => {
    const frames: string[] = [];
    const parser = createMpjpegParser((jpeg) => frames.push(jpeg.subarray(2, -2).toString()));
    const stream = Buffer.concat([partOf(JPEG(1)), partOf(JPEG(2)), partOf(JPEG(3))]);
    for (let index = 0; index < stream.length; index += 1) parser.push(stream.subarray(index, index + 1));
    expect(frames).toEqual(['picture-1', 'picture-2', 'picture-3']);
    parser.push(Buffer.concat([partOf(JPEG(4)), partOf(JPEG(5))]));
    expect(frames.slice(3)).toEqual(['picture-4', 'picture-5']);
    expect(parser.dropped()).toBe(0);
  });

  it('a body that holds the boundary text and a CRLF is taken by its length, not cut there', () => {
    const frames: Buffer[] = [];
    const parser = createMpjpegParser((jpeg) => frames.push(jpeg));
    const tricky = Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.from('\r\n--ffmpeg\r\nContent-length: 3\r\n\r\n'), Buffer.from([0xff, 0xd9])]);
    parser.push(Buffer.concat([partOf(tricky), partOf(JPEG(7))]));
    expect(frames.map((frame) => frame.length)).toEqual([tricky.length, JPEG(7).length]);
    expect(frames[0]?.equals(tricky)).toBe(true);
  });

  it('noise, a part without a length, one over the bound and a body that is no JPEG are dropped; the stream gets back in step', () => {
    const frames: string[] = [];
    const parser = createMpjpegParser((jpeg) => frames.push(jpeg.subarray(2, -2).toString()), 64);
    parser.push(Buffer.from('garbage before any boundary'));
    parser.push(Buffer.from('--ffmpeg\r\nContent-type: image/jpeg\r\n\r\nno length here'));
    parser.push(Buffer.from(`--ffmpeg\r\nContent-length: 999\r\n\r\n${'x'.repeat(10)}`));
    parser.push(partOf(Buffer.from('not a jpeg at all')));
    parser.push(partOf(JPEG(8)));
    expect(frames).toEqual(['picture-8']);
    expect(parser.dropped()).toBeGreaterThan(0);
    // Control: the same picture alone is taken with nothing dropped.
    const clean = createMpjpegParser(() => {}, 64);
    clean.push(partOf(JPEG(8)));
    expect(clean.dropped()).toBe(0);
  });
});

// ── The bounds ───────────────────────────────────────────────────────────────────────────────────

describe('the bounds: one pipeline per camera, four in all (the D60 tracks); four viewers per camera, sixteen in all', () => {
  it('viewers of one camera share ONE pipeline; the fifth viewer of a camera is refused PREVIEW_LIMIT', async () => {
    const { manager, opener } = rig();
    expect(PREVIEW_LIMITS).toEqual({ pipelinesPerCamera: 1, pipelines: 4, viewersPerCamera: 4, viewers: 16 });
    for (let index = 0; index < 4; index += 1) joined(manager.join('CAM-03', 'OPR-001', sink().value));
    await settle();
    expect(opener.opened).toHaveLength(1);
    expect(manager.join('CAM-03', 'OPR-001', sink().value)).toEqual({ joined: false, reason: PreviewEndReason.LIMIT });
    expect(manager.wouldRefuse('CAM-03')).toBe(PreviewEndReason.LIMIT);
    expect(manager.counts()).toEqual({ pipelines: 1, viewers: 4 });
  });

  it('a fifth camera is refused while four pipelines have viewers; sixteen viewers in all is the bound (widened 2026-11-05: the preview is a MUST, every video track of D60 gets its pipeline)', async () => {
    const { manager } = rig();
    for (const camera of ['CAM-03', 'CAM-04', 'CAM-05', 'CAM-06']) {
      for (let index = 0; index < 4; index += 1) joined(manager.join(camera, 'OPR-001', sink().value));
    }
    await settle();
    expect(manager.join('CAM-07', 'OPR-001', sink().value)).toEqual({ joined: false, reason: PreviewEndReason.LIMIT });
    expect(manager.counts()).toEqual({ pipelines: 4, viewers: 16 });
  });

  it('a lingering pipeline gives its place to a camera over the bound: stopped and reaped first, then the new one opens', async () => {
    const { manager, opener, timers } = rig();
    for (const camera of ['CAM-03', 'CAM-04', 'CAM-05']) joined(manager.join(camera, 'OPR-001', sink().value));
    joined(manager.join('CAM-06', 'OPR-001', sink().value)).leave();
    await settle();
    expect(manager.wouldRefuse('CAM-07')).toBeNull();
    joined(manager.join('CAM-07', 'OPR-001', sink().value));
    await timers.advance(0);
    expect(opener.events).toEqual(['open CAM-03', 'open CAM-04', 'open CAM-05', 'open CAM-06', 'stop CAM-06', 'reaped CAM-06', 'open CAM-07']);
  });
});

// ── Frames and slow viewers ──────────────────────────────────────────────────────────────────────

describe('frames: only the latest picture is kept; a slow viewer skips, a fast one does not wait', () => {
  it('LIVE on the first picture; a full viewer is skipped until drained and then gets the NEWEST picture', async () => {
    const { manager, opener } = rig();
    const fast = sink();
    const slow = sink();
    joined(manager.join('CAM-03', 'OPR-001', fast.value));
    const slowPlace = joined(manager.join('CAM-03', 'OPR-001', slow.value));
    await settle();
    const pipeline = opener.opened[0]!;
    expect(manager.states()).toEqual({ 'CAM-03': PreviewState.CONNECTING });
    slow.setFull(true);
    pipeline.push(partOf(JPEG(1)));
    expect(manager.states()).toEqual({ 'CAM-03': PreviewState.LIVE });
    pipeline.push(partOf(JPEG(2)));
    pipeline.push(partOf(JPEG(3)));
    expect(fast.frames).toEqual(['picture-1', 'picture-2', 'picture-3']);
    // The slow one took picture 1 and said it was full: 2 and 3 were skipped for it.
    expect(slow.frames).toEqual(['picture-1']);
    slow.setFull(false);
    slowPlace.drained();
    expect(slow.frames).toEqual(['picture-1', 'picture-3']);
    // Drained again with nothing new: nothing is sent twice.
    slowPlace.drained();
    expect(slow.frames).toEqual(['picture-1', 'picture-3']);
    expect(fast.states).toContain(PreviewState.LIVE);
  });

  it('a viewer that joins a running pipeline gets the latest picture at once', async () => {
    const { manager, opener } = rig();
    joined(manager.join('CAM-03', 'OPR-001', sink().value));
    await settle();
    opener.opened[0]!.push(partOf(JPEG(5)));
    const late = sink();
    const result = manager.join('CAM-03', 'OPR-002', late.value);
    expect(result.joined && result.state).toBe(PreviewState.LIVE);
    expect(late.frames).toEqual(['picture-5']);
  });
});

// ── Linger ───────────────────────────────────────────────────────────────────────────────────────

describe('linger: 5 s after the last viewer', () => {
  it('stays for 5 s without viewers, is taken back by a viewer that returns, and stops after 5 s without one', async () => {
    const { manager, opener, timers } = rig();
    joined(manager.join('CAM-03', 'OPR-001', sink().value)).leave();
    await timers.advance(PREVIEW_LINGER_MS - 1);
    expect(opener.opened[0]!.stops).toBe(0);
    const back = joined(manager.join('CAM-03', 'OPR-001', sink().value));
    await timers.advance(PREVIEW_LINGER_MS * 2);
    expect(opener.opened).toHaveLength(1);
    expect(opener.opened[0]!.stops).toBe(0);
    back.leave();
    back.leave();
    await timers.advance(PREVIEW_LINGER_MS);
    expect(opener.opened[0]!.stops).toBe(1);
    expect(manager.counts()).toEqual({ pipelines: 0, viewers: 0 });
    expect(manager.states()).toEqual({});
  });
});

// ── Recording has priority ───────────────────────────────────────────────────────────────────────

describe('recording has priority: yield, then resume after the push stands', () => {
  it('yieldForRecording resolves only after the preview is stopped AND reaped; nothing starts while paused; resume starts it again', async () => {
    const { manager, opener, timers } = rig();
    const viewer = sink();
    joined(manager.join('CAM-03', 'OPR-001', viewer.value));
    await settle();
    let yielded = false;
    const yielding = manager.yieldForRecording('CAM-03').then(() => {
      yielded = true;
      opener.events.push('yielded');
    });
    expect(yielded).toBe(false);
    await yielding;
    expect(opener.events).toEqual(['open CAM-03', 'stop CAM-03', 'reaped CAM-03', 'yielded']);
    expect(manager.states()).toEqual({ 'CAM-03': PreviewState.PAUSED_FOR_RECORDING });
    expect(viewer.states).toContain(PreviewState.PAUSED_FOR_RECORDING);
    // A viewer that joins while paused waits; no pipeline opens.
    joined(manager.join('CAM-03', 'OPR-002', sink().value));
    await timers.advance(10_000);
    expect(opener.opened).toHaveLength(1);
    manager.resumeAfterRecording('CAM-03');
    await settle();
    expect(opener.opened).toHaveLength(2);
    expect(manager.states()).toEqual({ 'CAM-03': PreviewState.CONNECTING });
    expect(viewer.ends).toEqual([]);
  });

  it('a yield for a camera without a preview resolves at once and still holds a viewer that comes later; resumeAll ends every pause', async () => {
    const { manager, opener } = rig();
    await manager.yieldForRecording('CAM-04');
    joined(manager.join('CAM-04', 'OPR-001', sink().value));
    await settle();
    expect(opener.opened).toHaveLength(0);
    expect(manager.states()).toEqual({ 'CAM-04': PreviewState.PAUSED_FOR_RECORDING });
    manager.resumeAll();
    await settle();
    expect(opener.opened).toHaveLength(1);
  });

  it('a yield during an open aborts it and waits for it; a pause nobody ends ends by itself after 60 s', async () => {
    const { manager, opener, timers } = rig();
    joined(manager.join('CAM-03', 'OPR-001', sink().value));
    await manager.yieldForRecording('CAM-03');
    // The open resolved in the same turn as the yield began: its pipeline was stopped, never handed on.
    expect(opener.opened.every((pipeline) => pipeline.stops === 1)).toBe(true);
    await timers.advance(PREVIEW_PAUSE_MAX_MS - 1);
    expect(manager.states()['CAM-03']).toBe(PreviewState.PAUSED_FOR_RECORDING);
    await timers.advance(1);
    expect(manager.states()['CAM-03']).toBe(PreviewState.CONNECTING);
    expect(opener.opened.length).toBeGreaterThanOrEqual(2);
  });
});

// ── Loss and the restart bound ───────────────────────────────────────────────────────────────────

describe('loss: at most 3 restarts in 5 minutes; a refused credential stops at once', () => {
  it('restarts after a loss, three times; the fourth loss in the window makes the camera UNAVAILABLE and ends its viewers', async () => {
    const { manager, opener, timers, reports } = rig();
    const viewer = sink();
    joined(manager.join('CAM-03', 'OPR-001', viewer.value));
    await settle();
    for (let loss = 1; loss <= PREVIEW_RESTART_MAX; loss += 1) {
      opener.opened.at(-1)!.die(CameraOpenRefusal.STREAM_LOST);
      await settle();
      expect(manager.states()['CAM-03']).toBe(PreviewState.CONNECTING);
      await timers.advance(PREVIEW_RESTART_DELAY_MS);
      expect(opener.opened).toHaveLength(loss + 1);
    }
    opener.opened.at(-1)!.die(CameraOpenRefusal.STREAM_LOST);
    await settle();
    expect(viewer.ends).toEqual([PreviewEndReason.UNAVAILABLE]);
    expect(viewer.states.at(-1)).toBe(PreviewState.UNAVAILABLE);
    expect(opener.opened).toHaveLength(PREVIEW_RESTART_MAX + 1);
    expect(reports.map((entry) => entry.code)).toContain('PREVIEW_UNAVAILABLE');
    // A new viewer inside the window does not reset the bound: the next loss ends it at once.
    joined(manager.join('CAM-03', 'OPR-001', sink().value));
    await settle();
    opener.opened.at(-1)!.die(CameraOpenRefusal.STREAM_LOST);
    await settle();
    await timers.advance(PREVIEW_RESTART_DELAY_MS);
    expect(opener.opened).toHaveLength(PREVIEW_RESTART_MAX + 2);
    // After the window the bound is free again.
    await timers.advance(PREVIEW_RESTART_WINDOW_MS);
    const again = sink();
    joined(manager.join('CAM-03', 'OPR-001', again.value));
    await settle();
    opener.opened.at(-1)!.die(CameraOpenRefusal.STREAM_LOST);
    await settle();
    await timers.advance(PREVIEW_RESTART_DELAY_MS);
    expect(again.ends).toEqual([]);
  });

  it('AUTH_REFUSED at the open: UNAVAILABLE at once, no second try, and a new viewer inside the window is refused before any open', async () => {
    const { manager, opener, timers } = rig();
    opener.refuse(new CameraOpenError(CameraOpenRefusal.AUTHENTICATION_REFUSED, 'CAM-03', 'AUTH_REFUSED'));
    const viewer = sink();
    joined(manager.join('CAM-03', 'OPR-001', viewer.value));
    await settle();
    await timers.advance(PREVIEW_RESTART_DELAY_MS * 3);
    expect(viewer.ends).toEqual([PreviewEndReason.AUTH_REFUSED]);
    expect(opener.events).toEqual(['open CAM-03']);
    expect(manager.join('CAM-03', 'OPR-001', sink().value)).toEqual({ joined: false, reason: PreviewEndReason.AUTH_REFUSED });
    expect(manager.wouldRefuse('CAM-03')).toBe(PreviewEndReason.AUTH_REFUSED);
    // Control: another camera is not touched.
    expect(manager.wouldRefuse('CAM-04')).toBeNull();
  });

  it('AUTH_REFUSED as the end of a running pipeline stops at once too', async () => {
    const { manager, opener, timers } = rig();
    const viewer = sink();
    joined(manager.join('CAM-03', 'OPR-001', viewer.value));
    await settle();
    opener.opened[0]!.die(CameraOpenRefusal.AUTHENTICATION_REFUSED, 'AUTH_REFUSED');
    await settle();
    await timers.advance(PREVIEW_RESTART_DELAY_MS * 3);
    expect(viewer.ends).toEqual([PreviewEndReason.AUTH_REFUSED]);
    expect(opener.opened).toHaveLength(1);
  });

  it('close ends every viewer and stops every pipeline; nothing joins after it', async () => {
    const { manager, opener } = rig();
    const viewer = sink();
    joined(manager.join('CAM-03', 'OPR-001', viewer.value));
    await settle();
    await manager.close();
    expect(viewer.ends).toEqual([PreviewEndReason.CLOSED]);
    expect(opener.opened[0]!.stops).toBe(1);
    expect(manager.join('CAM-03', 'OPR-001', sink().value).joined).toBe(false);
  });
});
