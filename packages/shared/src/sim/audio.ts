/**
 * Dual-channel audio level generator (masterplan/01_specs.md §14.7 `audio.ts`; AC-53).
 *
 * - 20 Hz (`AUDIO_FRAME_MS` 50 = `motion.ambient.meterFrameMs`). One frame per channel per
 *   50 ms slot, stamped at the slot boundary, so frame times are deterministic.
 * - Noise floor −52 ± 2 dBFS. While people are in the room (CREATE … STOPPING) the two MICs
 *   take alternating speaker turns of 3-12 s at −24 to −12 dBFS with a 4-6 Hz syllabic
 *   modulation, separated by 0.3-1.2 s pauses. AUDIO-01 is the interviewer, AUDIO-02 the subject.
 * - One peak near −3.1 dBFS every 90-180 s on the speaking channel (an AUDIO_PEAK timeline
 *   item while recording).
 * - Ballistics: instant attack, 20 dB/s release. Peak hold 1.5 s, then 20 dB/s decay.
 * - CLIP (≥ −0.5 dBFS) only through the MIC_CLIP fault: bursts to −0.2 dBFS every 0.4-1.2 s;
 *   the first clipping frame latches `clipLatched` until `resetClip`.
 * - NO SIGNAL: a flat −90 with `noSignal: true`.
 * - Frames hold plain numbers and booleans only (SCR-01).
 *
 * The generator keeps its speaker-turn and ballistic state in a closure (not persisted); a
 * reload restarts the conversation, which only changes what the meters show.
 */
import { SessionState, type AudioTrackId, type MicInputId } from '../domain';
import { micLinesInForce } from './selector-in-force';
import {
  AUDIO_CLIP_BURST_DBFS,
  AUDIO_CLIP_DBFS,
  AUDIO_FLOOR_DBFS,
  AUDIO_FRAME_MS,
  AUDIO_NOISE_FLOOR_DBFS,
  AUDIO_NOISE_FLOOR_SPREAD_DB,
  AUDIO_PEAK_DBFS,
  AUDIO_PEAK_DECAY_DB_PER_S,
  AUDIO_PEAK_HOLD_MS,
  AUDIO_PEAK_MAX_INTERVAL_MS,
  AUDIO_PEAK_MIN_INTERVAL_MS,
  AUDIO_RELEASE_DB_PER_S,
  AUDIO_SPEECH_MAX_DBFS,
  AUDIO_SPEECH_MIN_DBFS,
  AUDIO_TEST_TONE_DBFS,
  CAPTURE_LEVEL_HOLD_MS,
} from './constants';
import type { EngineContext } from './engine';
import { isFaultActive } from './derive';
import type { Rng } from './rng';
import { addTimelineItem, SPEECH_STATES } from './session-machine';
import type { AudioFrame, CaptureConfigMic, CaptureLevelSource, CaptureMicInputId, EpochMs, SimState, SimSubsystem } from './types';
import { FaultKind } from './vocabulary';

export const AUDIO_CHANNELS = ['AUDIO-01', 'AUDIO-02'] as const satisfies readonly AudioTrackId[];

/**
 * The pairing of the two meter channels with the BUILT-IN microphone inputs: what the rule below
 * gives for the seeded selector (`MIC-01`, `MIC-02`), and its answer where no microphone line exists.
 */
export const DEFAULT_MIC_INPUT_OF_CHANNEL: Readonly<Record<AudioTrackId, MicInputId>> = {
  'AUDIO-01': 'MIC-01',
  'AUDIO-02': 'MIC-02',
};

/** One microphone line, as far as the channel rule reads it. */
type MicLine = Pick<CaptureConfigMic, 'inputId'>;

/**
 * The microphone lines the meters and the session read: the snapshot of the OPEN session when it
 * has one (OD-10: the capture was started with it), else the selector. In input order (D106 (1)).
 * A SEALED session is closed: its snapshot names nothing any more (`selector-in-force.ts`, G70c-01).
 */
export function captureMicLines(state: Pick<SimState, 'session' | 'captureConfig'>): readonly CaptureConfigMic[] {
  return micLinesInForce(state);
}

/**
 * Which microphone **input** a meter channel is (OD-01 T1; register SH-17; RULING D137): the
 * channel order is the order of the microphone lines of the capture configuration, which is
 * input order (D106 (1)) - channel 1 (`AUDIO-01`) is the first line, channel 2 (`AUDIO-02`) the
 * second, whatever their IDs. The meters slice is keyed by input; the demo controls, the CLIP
 * fault target and the timeline still name a channel, so this function is the single place the
 * two vocabularies meet. `audio.activeInputId` says which of the two feeds the session track now.
 */
export function micInputOfChannel(mics: readonly MicLine[], channel: AudioTrackId): CaptureMicInputId {
  return mics[AUDIO_CHANNELS.indexOf(channel)]?.inputId ?? DEFAULT_MIC_INPUT_OF_CHANNEL[channel];
}

/** The inverse: the meter channel of an input of these lines; null for an input that is neither line. */
export function channelOfMicLine(mics: readonly MicLine[], inputId: string): AudioTrackId | null {
  for (const channel of AUDIO_CHANNELS) if (micInputOfChannel(mics, channel) === inputId) return channel;
  return null;
}

/** The meter channel of the input that feeds the session track now; channel 1 when that input is neither line. */
export function activeMeterChannel(state: Pick<SimState, 'session' | 'captureConfig' | 'audio'>): AudioTrackId {
  return channelOfMicLine(captureMicLines(state), state.audio.activeInputId) ?? 'AUDIO-01';
}

/** The frame of an input that has delivered none yet: NO SIGNAL at the floor. */
export function noInputFrame(at: EpochMs): AudioFrame {
  return { seq: 0, at, dbfs: AUDIO_FLOOR_DBFS, peak: AUDIO_FLOOR_DBFS, clip: false, noSignal: true };
}

/** @deprecated The inverse of the built-in pair's table; `channelOfMicLine` reads the capture configuration (ruling D137). */
export const CHANNEL_OF_MIC_INPUT: Readonly<Record<MicInputId, AudioTrackId>> = {
  'MIC-01': 'AUDIO-01',
  'MIC-02': 'AUDIO-02',
};

/**
 * The built-in input a selector input is, or null for a `MIC-NN` beyond the built-in pair.
 * @deprecated It says nothing about meters any more: every input of the capture configuration has
 * a meter channel (`channelOfMicLine`, ruling D137). Kept for `session-machine.ts`.
 */
export function builtInMicInputOf(inputId: string): MicInputId | null {
  return Object.hasOwn(CHANNEL_OF_MIC_INPUT, inputId) ? (inputId as MicInputId) : null;
}

/** @deprecated The channel of an input of the BUILT-IN pair only; `channelOfMicLine` reads the capture configuration (ruling D137). */
export function channelOfMicInput(inputId: string): AudioTrackId | null {
  const builtIn = builtInMicInputOf(inputId);
  return builtIn === null ? null : CHANNEL_OF_MIC_INPUT[builtIn];
}

// ── Meter ballistics (pure; AC-53) ───────────────────────────────────────────────────────

export interface MeterState {
  /** Ballistic level. */
  dbfs: number;
  /** Peak-hold level. */
  peak: number;
  /** The held peak starts to decay after this time. */
  holdUntil: EpochMs;
  at: EpochMs;
}

export function clampDbfs(value: number): number {
  if (!Number.isFinite(value)) return AUDIO_FLOOR_DBFS;
  return Math.min(0, Math.max(AUDIO_FLOOR_DBFS, value));
}

export function meterAt(at: EpochMs, level: number = AUDIO_NOISE_FLOOR_DBFS): MeterState {
  return { dbfs: level, peak: level, holdUntil: at, at };
}

/**
 * One ballistic step towards `target` at time `at`:
 * instant attack, 20 dB/s release; the peak holds 1.5 s after it was set, then decays at
 * 20 dB/s (never below the level).
 */
export function stepMeter(prev: MeterState, target: number, at: EpochMs): MeterState {
  const dtS = Math.max(0, at - prev.at) / 1_000;
  const released = prev.dbfs - AUDIO_RELEASE_DB_PER_S * dtS;
  const dbfs = clampDbfs(Math.max(clampDbfs(target), released));
  if (dbfs >= prev.peak) return { dbfs, peak: dbfs, holdUntil: at + AUDIO_PEAK_HOLD_MS, at };
  if (at <= prev.holdUntil) return { dbfs, peak: prev.peak, holdUntil: prev.holdUntil, at };
  const decayFrom = Math.max(prev.holdUntil, prev.at);
  const decayed = prev.peak - (AUDIO_PEAK_DECAY_DB_PER_S * (at - decayFrom)) / 1_000;
  return { dbfs, peak: clampDbfs(Math.max(dbfs, decayed)), holdUntil: prev.holdUntil, at };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// ── Conversation model ───────────────────────────────────────────────────────────────────

interface Conversation {
  /** 0 = pause, else the index of the speaking channel + 1. */
  speaker: 0 | 1 | 2;
  lastSpeaker: 1 | 2;
  until: EpochMs;
  /** The loudest syllable level of this turn. */
  level: number;
  syllableHz: number;
  phase: number;
}

const SYLLABLE_DEPTH_DB = AUDIO_SPEECH_MAX_DBFS - AUDIO_SPEECH_MIN_DBFS - 6;

function nextTurn(conversation: Conversation, at: EpochMs, rng: Rng): Conversation {
  if (conversation.speaker !== 0) {
    return { ...conversation, speaker: 0, until: at + rng.int(300, 1_200) };
  }
  const alternate = rng.chance(0.8);
  const speaker: 1 | 2 = alternate ? (conversation.lastSpeaker === 1 ? 2 : 1) : conversation.lastSpeaker;
  return {
    speaker,
    lastSpeaker: speaker,
    until: at + rng.int(3_000, 12_000),
    level: rng.float(AUDIO_SPEECH_MAX_DBFS - 6, AUDIO_SPEECH_MAX_DBFS),
    syllableHz: rng.float(4, 6),
    phase: rng.float(0, Math.PI * 2),
  };
}

/** Speech level of the speaking channel at `at` (−24 … −12 dBFS with syllabic modulation). */
function speechLevel(conversation: Conversation, at: EpochMs, rng: Rng): number {
  const cycle = (2 * Math.PI * conversation.syllableHz * at) / 1_000 + conversation.phase;
  const modulation = SYLLABLE_DEPTH_DB * (0.5 + 0.5 * Math.sin(cycle));
  const level = conversation.level - modulation + rng.gauss(0, 1);
  return Math.min(AUDIO_SPEECH_MAX_DBFS, Math.max(AUDIO_SPEECH_MIN_DBFS, level));
}

function noiseFloor(rng: Rng): number {
  const spread = AUDIO_NOISE_FLOOR_SPREAD_DB;
  return Math.min(AUDIO_NOISE_FLOOR_DBFS + spread, Math.max(AUDIO_NOISE_FLOOR_DBFS - spread, rng.gauss(AUDIO_NOISE_FLOOR_DBFS, spread / 2.5)));
}

// ── Subsystem ────────────────────────────────────────────────────────────────────────────

/** Shared transient engine state that actions may set (not persisted). */
export interface AudioRuntime {
  /** `deviceCommand(MIC-0x, 'TEST_SIGNAL')` plays a steady tone until this time. */
  testToneUntil: Partial<Record<AudioTrackId, EpochMs>>;
  /**
   * The newest level the capture worker measured per mic input (`applyCaptureTelemetry`, register
   * SH-18). While an entry is younger than `CAPTURE_LEVEL_HOLD_MS` the next frame of that input
   * shows it in place of the generated conversation. Transient like the test tone: never stored.
   */
  captureLevels: Partial<Record<CaptureMicInputId, CaptureLevelFeed>>;
  /**
   * `'external'` (`CreateSimOptions.capture`, register CS-04): a real worker measures the levels
   * and nothing is generated. An input without a fresh measured level reads NO SIGNAL.
   */
  levelSource: CaptureLevelSource;
}

/** One measured level: what the worker's TELEMETRY frame said, and when the Core took it. */
export interface CaptureLevelFeed {
  /** dBFS; `null` when the input delivers no samples. */
  dbfs: number | null;
  clipped: boolean;
  at: EpochMs;
}

export function createAudioRuntime(levelSource: CaptureLevelSource = 'simulated'): AudioRuntime {
  return { testToneUntil: {}, captureLevels: {}, levelSource };
}

/** The measured level of `input` that the frame at `at` shows, or null when none is fresh enough. */
export function captureLevelAt(runtime: AudioRuntime, input: CaptureMicInputId, at: EpochMs): CaptureLevelFeed | null {
  const fed = runtime.captureLevels[input];
  if (fed === undefined || at - fed.at > CAPTURE_LEVEL_HOLD_MS) return null;
  return fed;
}

interface ChannelState {
  meter: MeterState;
  nextClipAt: EpochMs;
}

/**
 * The 20 Hz audio subsystem. It writes `audio.channels` (plus the CLIP latch and AUDIO_PEAK
 * timeline items) in one `setState` per frame.
 */
export function createAudioSubsystem(engine: EngineContext, runtime: AudioRuntime): SimSubsystem {
  let lastSlot: number | null = null;
  let conversation: Conversation | null = null;
  let nextPeakAt: EpochMs | null = null;
  const channels = new Map<AudioTrackId, ChannelState>();

  return {
    name: 'audio',
    tick({ now }) {
      const slot = Math.floor(now / AUDIO_FRAME_MS);
      if (lastSlot !== null && slot <= lastSlot) return;
      lastSlot = slot;
      const at = slot * AUDIO_FRAME_MS;
      const turns = engine.rng.get('audio:turns');
      const state = engine.store.getState();
      const speaking = state.session !== null && SPEECH_STATES.includes(state.session.state);

      if (!conversation || at - conversation.until > 30_000) {
        conversation = nextTurn({ speaker: 0, lastSpeaker: 2, until: at, level: -18, syllableHz: 5, phase: 0 }, at, turns);
      }
      while (at >= conversation.until) conversation = nextTurn(conversation, conversation.until, turns);
      if (nextPeakAt === null || at - nextPeakAt > AUDIO_PEAK_MAX_INTERVAL_MS) {
        nextPeakAt = at + turns.int(AUDIO_PEAK_MIN_INTERVAL_MS, AUDIO_PEAK_MAX_INTERVAL_MS);
      }
      const peakNow = speaking && at >= nextPeakAt;
      if (peakNow) nextPeakAt = at + turns.int(AUDIO_PEAK_MIN_INTERVAL_MS, AUDIO_PEAK_MAX_INTERVAL_MS);
      const peakChannel: AudioTrackId = conversation.speaker === 2 ? 'AUDIO-02' : 'AUDIO-01';

      let next: SimState = state;
      // One frame per meter channel, keyed by the input that channel is NOW (ruling D137): the two
      // microphone lines of the capture configuration. A frame of an input that left the pair is dropped.
      const lines = captureMicLines(state);
      const frames: Record<CaptureMicInputId, AudioFrame> = {};
      let mics = state.mics;
      let peakFrame: { channel: AudioTrackId; level: number } | null = null;

      for (const channel of AUDIO_CHANNELS) {
        // The frame is stored under the mic input it comes from (SH-17), while the demo controls,
        // the CLIP latch and the timeline keep naming the channel.
        const input = micInputOfChannel(lines, channel);
        const rng = engine.rng.get(channel === 'AUDIO-01' ? 'audio:AUDIO-01' : 'audio:AUDIO-02');
        const previous = state.audio.inputs[input] ?? noInputFrame(at);
        const mic = mics.find((m) => m.id === channel);
        let current = channels.get(channel) ?? {
          meter: meterAt(previous.at, previous.noSignal ? AUDIO_NOISE_FLOOR_DBFS : previous.dbfs),
          nextClipAt: at,
        };

        if (mic?.state === 'NO_SIGNAL') {
          channels.set(channel, { meter: meterAt(at), nextClipAt: current.nextClipAt });
          frames[input] = {
            seq: previous.seq + 1,
            at,
            dbfs: AUDIO_FLOOR_DBFS,
            peak: AUDIO_FLOOR_DBFS,
            clip: mic.clipLatched,
            noSignal: true,
          };
          continue;
        }

        // A level the capture worker measured (register SH-18) is shown as it is: it takes the
        // place of everything generated below. No samples at all reads NO SIGNAL.
        // With an external source nothing is generated at all: no fresh level is NO SIGNAL too.
        const fed = captureLevelAt(runtime, input, at);
        if (fed === null ? runtime.levelSource === 'external' : fed.dbfs === null) {
          channels.set(channel, { meter: meterAt(at), nextClipAt: current.nextClipAt });
          // Fix wave J (JW-08): with an external source the Core MEASURES a level only while a capture is
          // open. At rest nothing is measured: that is "not measured", not the fault word NO SIGNAL (which
          // stood beside "READY - PASS" on every screen of a real-capture Core that was not recording).
          const measuring = runtime.levelSource !== 'external' || state.session?.state === SessionState.RECORDING;
          frames[input] = {
            seq: previous.seq + 1,
            at,
            dbfs: AUDIO_FLOOR_DBFS,
            peak: AUDIO_FLOOR_DBFS,
            clip: mic?.clipLatched ?? false,
            noSignal: measuring,
            ...(measuring ? {} : { notMeasured: true as const }),
          };
          continue;
        }

        let target = noiseFloor(rng);
        const index = channel === 'AUDIO-01' ? 1 : 2;
        if (speaking && conversation.speaker === index) target = speechLevel(conversation, at, rng);
        const toneUntil = runtime.testToneUntil[channel];
        if (toneUntil !== undefined && at < toneUntil) target = AUDIO_TEST_TONE_DBFS + rng.gauss(0, 0.2);
        if (peakNow && channel === peakChannel && fed === null) {
          target = Math.min(AUDIO_PEAK_DBFS + 0.4, AUDIO_PEAK_DBFS + rng.gauss(0, 0.15));
          peakFrame = { channel, level: round2(target) };
        }
        const clipping = isFaultActive(state.faults, FaultKind.MIC_CLIP, channel);
        if (clipping && at >= current.nextClipAt) {
          target = AUDIO_CLIP_BURST_DBFS;
          current = { ...current, nextClipAt: at + rng.int(400, 1_200) };
        }

        if (fed !== null && fed.dbfs !== null) target = fed.dbfs;

        const meter = stepMeter(current.meter, target, at);
        channels.set(channel, { ...current, meter });
        const clipped = meter.dbfs >= AUDIO_CLIP_DBFS || fed?.clipped === true;
        if (clipped && mic && !mic.clipLatched) {
          mics = mics.map((m) => (m.id === channel ? { ...m, clipLatched: true } : m));
        }
        frames[input] = {
          seq: previous.seq + 1,
          at,
          dbfs: round2(meter.dbfs),
          peak: round2(meter.peak),
          // The CLIP indicator shows the latch (set by the first clipping frame, cleared by resetClip).
          clip: mics.find((m) => m.id === channel)?.clipLatched ?? false,
          noSignal: false,
        } satisfies AudioFrame;
      }

      // The meters slice is keyed by mic input (SH-17); `activeInputId` is what op 81 moves.
      next = {
        ...next,
        // The active input stays what it was while it is one of the two; a pair that no longer
        // holds it (a state put in place otherwise) reads its PRIMARY line as the active one.
        audio: {
          inputs: frames,
          activeInputId: Object.hasOwn(frames, state.audio.activeInputId)
            ? state.audio.activeInputId
            : (lines.find((line) => line.role === 'PRIMARY')?.inputId ?? micInputOfChannel(lines, 'AUDIO-01')),
        },
        ...(mics !== state.mics ? { mics } : {}),
      };
      if (peakFrame && next.session?.state === SessionState.RECORDING) {
        const mic = next.mics.find((m) => m.id === peakFrame?.channel);
        next = addTimelineItem(next, {
          at,
          kind: 'AUDIO_PEAK',
          label: `Audio peak ${peakFrame.level.toFixed(1)} dBFS`,
          detail: mic?.name ?? peakFrame.channel,
          channel: peakFrame.channel,
          params: { dbfs: Math.round(peakFrame.level * 10) / 10, track: peakFrame.channel },
        });
      }
      engine.store.setState(next);
    },
  };
}
