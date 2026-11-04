/**
 * Four-channel audio level generator (masterplan/01_specs.md §14.7 `audio.ts`; AC-53; D61 of
 * 2026-11-04: the microphone plane mirrors the video plane — FOUR simultaneous channels).
 *
 * - 20 Hz (`AUDIO_FRAME_MS` 50 = `motion.ambient.meterFrameMs`). One frame per channel per
 *   50 ms slot, stamped at the slot boundary, so frame times are deterministic.
 * - Noise floor −52 ± 2 dBFS. While people are in the room (CREATE … STOPPING) the MICs of the
 *   assigned channels take alternating speaker turns of 3-12 s at −24 to −12 dBFS with a 4-6 Hz
 *   syllabic modulation, separated by 0.3-1.2 s pauses. AUDIO-01 is the interviewer, AUDIO-02 the subject.
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
import { AUDIO_TRACK_IDS, SessionState, type AudioTrackId, type MicInputId, type MicRole } from '../domain';
import { PRIMARY_MIC_CHANNEL, SECOND_MIC_CHANNEL, type MicChannel } from './vocabulary'; // D61 (2026-11-04): the four microphone channels
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

// D61 (2026-11-04): the four meter channels derive from the widened audio-track domain.
export const AUDIO_CHANNELS = AUDIO_TRACK_IDS;

/**
 * The pairing of the meter channels with the BUILT-IN microphone inputs: what
 * `meterInputOfChannel` gives for the seeded selector (`MIC-01`..`MIC-04`; D61 widened the pair to
 * the four channels). A table of the seeded set only - no lookup answers from it where a line is
 * missing (task 4 row 172, C18 (2)).
 */
export const DEFAULT_MIC_INPUT_OF_CHANNEL: Readonly<Record<AudioTrackId, string>> = {
  'AUDIO-01': 'MIC-01',
  'AUDIO-02': 'MIC-02',
  'AUDIO-03': 'MIC-03', // D61
  'AUDIO-04': 'MIC-04', // D61
};

/**
 * The selector CHANNEL of a meter track and back (D61 of 2026-11-04: channel `MIC-0N` feeds track
 * `AUDIO-0N`; the numbering is the one rule of the four-channel plane).
 */
export function micChannelOfTrack(trackId: AudioTrackId): MicChannel {
  return `MIC-${trackId.slice(-2)}` as MicChannel;
}
export function audioTrackOfMicChannel(channel: MicChannel): AudioTrackId {
  return `AUDIO-${channel.slice(-2)}` as AudioTrackId;
}
/** The worker protocol's two transcription roles as channels (capture-protocol v4; D61 mapping). */
export function channelOfWorkerMicRole(role: MicRole): MicChannel {
  return role === 'PRIMARY' ? PRIMARY_MIC_CHANNEL : SECOND_MIC_CHANNEL;
}

/**
 * One microphone line, as far as the lookups BY CHANNEL read it: the input and the channel it
 * holds (task 4 WP-13a, names register N6; D61 of 2026-11-04: the role became the numbered
 * channel). A list of lines without a channel does not type-check here.
 */
export type ChannelMicLine = Pick<CaptureConfigMic, 'inputId' | 'channel'>;
/** @deprecated Renamed to `ChannelMicLine` by D61 (2026-11-04); the shape is the same read by channel. */
export type RoleMicLine = ChannelMicLine;

/**
 * The microphone lines the meters and the session read: the snapshot of the OPEN session when it
 * has one (OD-10: the capture was started with it), else the selector. In input order (D106 (1)).
 * A SEALED session is closed: its snapshot names nothing any more (`selector-in-force.ts`, G70c-01).
 */
export function captureMicLines(state: Pick<SimState, 'session' | 'captureConfig'>): readonly CaptureConfigMic[] {
  return micLinesInForce(state);
}

/**
 * Which microphone input holds a CHANNEL (task 4 WP-13a, names register N4; decisions C18 (2),
 * AD-04; D61 of 2026-11-04: the role lookup became the channel lookup): the input of the one line
 * whose channel is the channel asked. `null` when no line holds it - no other line stands in, by
 * position or otherwise, and no built-in input is answered.
 */
export function micInputOfChannel(mics: readonly ChannelMicLine[], channel: MicChannel): CaptureMicInputId | null {
  return mics.find((line) => line.channel === channel)?.inputId ?? null;
}
/** @deprecated Renamed to `micInputOfChannel` by D61 (2026-11-04): the roles became the numbered channels. */
export function micInputOfRole(mics: readonly ChannelMicLine[], role: MicRole): CaptureMicInputId | null {
  return micInputOfChannel(mics, channelOfWorkerMicRole(role));
}

/**
 * Which microphone input a meter channel is, or `null` (names register N5, section 3.2; RULING D137
 * generalized by D61 of 2026-11-04; register SH-17). Each of the FOUR simultaneous channels has an
 * input exactly when a line NAMES that channel: `AUDIO-0N` is the input of the line whose channel
 * is `MIC-0N` - never a line by its place, never the built-in table. The meters slice is keyed by
 * input; the demo controls, the CLIP fault target and the timeline still name a channel, so this
 * function is the single place the two vocabularies meet. A channel without its line has no input.
 */
export function meterInputOfChannel(mics: readonly ChannelMicLine[], channel: AudioTrackId): CaptureMicInputId | null {
  return micInputOfChannel(mics, micChannelOfTrack(channel));
}

/**
 * The inverse of `meterInputOfChannel`: the meter channel of an input of these lines; null for an
 * input that has none. The lines STATE their channel (names register E20, N6; D61): a list without
 * channels does not type-check here.
 */
export function channelOfMicLine(mics: readonly ChannelMicLine[], inputId: string): AudioTrackId | null {
  const line = mics.find((entry) => entry.inputId === inputId);
  if (line === undefined) return null;
  // D61 (2026-11-04): whatever reaches this untyped: a line that states no channel has NO channel -
  // the answer is null, never a channel by place and never a crash on the missing statement.
  const stated = line.channel as MicChannel | undefined;
  return stated === undefined ? null : audioTrackOfMicChannel(stated);
}

/**
 * The meter channel of the input that feeds the session track now; channel 1 when that input has no
 * channel or when no input is active. The `'AUDIO-01'` is a channel LABEL, never an input (names
 * register E21): with no line behind it `meterInputOfChannel` answers null and the caller has no frame.
 */
export function activeMeterChannel(state: Pick<SimState, 'session' | 'captureConfig' | 'audio'>): AudioTrackId {
  const active = state.audio.activeInputId;
  if (active === null) return 'AUDIO-01';
  return channelOfMicLine(captureMicLines(state), active) ?? 'AUDIO-01';
}

/** The frame of an input that has delivered none yet: NO SIGNAL at the floor. */
export function noInputFrame(at: EpochMs): AudioFrame {
  return { seq: 0, at, dbfs: AUDIO_FLOOR_DBFS, peak: AUDIO_FLOOR_DBFS, clip: false, noSignal: true };
}

/** @deprecated The inverse of the built-in pair's table; `channelOfMicLine` reads the capture configuration (ruling D137). */
export const CHANNEL_OF_MIC_INPUT: Readonly<Record<string, AudioTrackId>> = {
  'MIC-01': 'AUDIO-01',
  'MIC-02': 'AUDIO-02',
  'MIC-03': 'AUDIO-03', // D61 (2026-11-04): the built-in set is the four channels
  'MIC-04': 'AUDIO-04', // D61
};

/**
 * The built-in input a selector input is, or null for a `MIC-NN` beyond the built-in four (D61).
 * @deprecated It says nothing about meters any more: every input of the capture configuration has
 * a meter channel (`channelOfMicLine`, ruling D137). Kept for `session-machine.ts`.
 */
export function builtInMicInputOf(inputId: string): MicInputId | null {
  return Object.hasOwn(CHANNEL_OF_MIC_INPUT, inputId) ? (inputId as MicInputId) : null;
}

/** @deprecated The channel of an input of the BUILT-IN pair only; `channelOfMicLine` reads the capture configuration (ruling D137). */
export function channelOfMicInput(inputId: string): AudioTrackId | null {
  const builtIn = builtInMicInputOf(inputId);
  return builtIn === null ? null : (CHANNEL_OF_MIC_INPUT[builtIn] ?? null); // D61: the table holds the four built-ins
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
  /** 0 = pause, else the index of the speaking channel + 1 (D61: one of the FOUR channels). */
  speaker: 0 | 1 | 2 | 3 | 4;
  lastSpeaker: 1 | 2 | 3 | 4;
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
  // D61 (2026-11-04): four channels take the turns. 80% of the turns alternate to another channel,
  // drawn over the three it is not; 20% let the last speaker hold the floor.
  const alternate = rng.chance(0.8);
  const others: readonly (1 | 2 | 3 | 4)[] = ([1, 2, 3, 4] as const).filter((channel) => channel !== conversation.lastSpeaker);
  const speaker: 1 | 2 | 3 | 4 = alternate ? (others[rng.int(0, others.length - 1)] ?? conversation.lastSpeaker) : conversation.lastSpeaker;
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
      // D61: the peak lands on the speaking channel of the four.
      const peakChannel: AudioTrackId = conversation.speaker === 0 ? 'AUDIO-01' : (`AUDIO-0${String(conversation.speaker)}` as AudioTrackId);

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
        // A channel without an input (no line names it; D61: per-channel, not a pair rule) has no
        // frame: none is generated under a built-in input's name (task 4 WP-13a, site C16).
        const input = meterInputOfChannel(lines, channel);
        if (input === null) continue;
        const rng = engine.rng.get(`audio:${channel}`); // D61: one stream per simultaneous channel
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
        const index = Number(channel.slice(-1)); // D61: the speaking channel of the four
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
      // The active input stays what it was while it is one of the assigned channels; a selector
      // that no longer holds it (a state put in place otherwise) reads its channel-1 line as the
      // active one, by CHANNEL (D61 of 2026-11-04): `null` when no line holds channel 1, never the
      // line of a position (site C16).
      const held: CaptureMicInputId | null = state.audio.activeInputId;
      const active = held !== null && Object.hasOwn(frames, held) ? held : micInputOfChannel(lines, PRIMARY_MIC_CHANNEL);
      next = {
        ...next,
        audio: {
          inputs: frames,
          // Without a channel-1 line the state holds NO active input (task 4 row 149; D61): `null`,
          // never the input it held before and never a line by its place.
          activeInputId: active,
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
