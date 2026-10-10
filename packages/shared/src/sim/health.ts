/**
 * Health, storage, time and network sources at 1 Hz (masterplan/01_specs.md §14.7 `health.ts`).
 *
 * Fault-driven fields (camera and MIC state, time tier, security posture, services, PoE and
 * ports) come from `derive.ts`. This subsystem moves the continuous values once per second:
 * - CPU, zone temperatures and fan speed (a stalled fan lets the temperatures climb), in a
 *   120-point series;
 * - evidence bytes while RECORDING at exactly 8.2 GB/h (`recordingBytes`), the write rate,
 *   the StorageState, and the hourly 24-point usage history;
 * - the time offset (GNSS ±4 ms, NTP ±12 ms, RTC drifting), "last sync" every 16 s while a
 *   disciplined source is active, and a 10 s offset history;
 * - bandwidth down/up (camera streams add to it while recording), in a 120-point series.
 *
 * A catch-up tick after a hidden period advances the byte counters exactly (they are derived
 * from the recording time) and appends one series point.
 */
import { SessionState } from '../domain';
import {
  HEALTH_TICK_MS,
  RECORDING_BYTES_PER_HOUR,
  SERIES_POINTS,
  STORAGE_HISTORY_POINTS,
} from './constants';
import { captureMicLines, micInputOfChannel } from './audio';
import { recordingBytes } from './dataset';
import type { EngineContext } from './engine';
import { pushRing } from './events';
import { timeNoise } from './initial-state';
import { RngStream, type Rng } from './rng';
import { storageStateFor } from './selectors';
import { ownCaptureCoreFactsTransition } from './core-facts';
import type { AudioFrame, CaptureLevelSource, EpochMs, HealthSlice, MicLevelPoint, SimState, SimSubsystem, StorageSlice, TimeSlice } from './types';

const HOUR_MS = 3_600_000;
/** "Last sync" refreshes this often while GNSS or NTP disciplines the clock. */
export const TIME_SYNC_INTERVAL_MS = 16_000;
/** One offset-history point per 10 s. */
export const TIME_HISTORY_INTERVAL_MS = 10_000;
/** The measured write rate varies by at most this share around the nominal 8.2 GB/h (step 54). */
export const WRITE_RATE_VARIANCE = 0.03;

/**
 * The measured evidence write rate at the whole second `at` (bytes/s; step 54, SIM-GAP-W44-1):
 * the nominal rate (`storage.writeBytesPerSec`, AC-54) with a deterministic ±3% per-second
 * variance derived from the time (no RNG stream is consumed, so AC-51 is unchanged).
 */
export function measuredWriteRate(nominalBytesPerSec: number, at: EpochMs): number {
  if (nominalBytesPerSec <= 0) return 0;
  return Math.round(nominalBytesPerSec * (1 + timeNoise('write', at) * WRITE_RATE_VARIANCE));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

/** Moves `value` towards `target` with a first-order lag of time constant `tauMs`. */
function approach(value: number, target: number, dtMs: number, tauMs: number): number {
  return value + (target - value) * Math.min(1, dtMs / tauMs);
}

function stepHealth(health: HealthSlice, at: EpochMs, dtMs: number, recording: boolean, rng: Rng): HealthSlice {
  const stalled = !health.fanOk;
  const cpuPercent = round1(clamp(rng.gauss(recording ? 34 : 18, 3), 5, 95));
  const fanRpm = stalled ? 0 : Math.round(clamp(rng.gauss(recording ? 2_650 : 2_400, 35), 1_800, 3_200));
  const cpuTempC = round1(approach(health.cpuTempC, stalled ? 84 : recording ? 58 : 52, dtMs, 45_000) + rng.gauss(0, 0.08));
  const storageTempC = round1(approach(health.storageTempC, stalled ? 55 : recording ? 41 : 38, dtMs, 90_000) + rng.gauss(0, 0.05));
  const ambientTempC = round1(approach(health.ambientTempC, 27, dtMs, 120_000) + rng.gauss(0, 0.03));
  return {
    ...health,
    cpuPercent,
    fanRpm,
    cpuTempC,
    storageTempC,
    ambientTempC,
    series: pushRing(health.series, [{ at, cpuPercent, cpuTempC, storageTempC, ambientTempC, fanRpm }], SERIES_POINTS),
  };
}

function stepStorage(state: SimState, at: EpochMs): { storage: StorageSlice; session: SimState['session'] } {
  const session = state.session;
  const recording = session?.state === SessionState.RECORDING && session.startedAt !== null;
  let { storage } = state;
  let nextSession = session;
  if (recording && session && session.startedAt !== null) {
    const bytesWritten = recordingBytes(Math.max(0, at - session.startedAt));
    const delta = bytesWritten - session.bytesWritten;
    if (delta > 0) {
      storage = {
        ...storage,
        volumes: storage.volumes.map((volume) =>
          volume.kind === 'EVIDENCE' ? { ...volume, usedBytes: Math.min(volume.totalBytes, volume.usedBytes + delta) } : volume,
        ),
      };
      nextSession = { ...session, bytesWritten };
    }
  }
  const evidence = storage.volumes.find((volume) => volume.kind === 'EVIDENCE');
  const usedBytes = evidence?.usedBytes ?? 0;
  // The 24 h chart records natural usage: a STORAGE_LOW / STORAGE_FULL demo fill is not data the
  // drive wrote, so it never becomes a fake multi-TB spike in the history (step 54, F-49-2).
  const naturalBytes = Math.max(0, usedBytes - (storage.simulatedFillBytes ?? 0));
  const history = storage.history.slice();
  const last = history[history.length - 1];
  if (!last || at - last.at >= HOUR_MS) history.push({ at, usedBytes: naturalBytes });
  else if (last.usedBytes !== naturalBytes) history[history.length - 1] = { ...last, usedBytes: naturalBytes };
  const writeBytesPerSec = recording ? Math.round(RECORDING_BYTES_PER_HOUR / 3_600) : 0;
  return {
    storage: {
      ...storage,
      state: evidence && evidence.totalBytes > 0 ? storageStateFor((usedBytes / evidence.totalBytes) * 100) : storage.state,
      writeBytesPerSec,
      history: history.length > STORAGE_HISTORY_POINTS ? history.slice(history.length - STORAGE_HISTORY_POINTS) : history,
      writeRateHistory: pushRing(storage.writeRateHistory ?? [], [{ at, bytesPerSec: measuredWriteRate(writeBytesPerSec, at) }], SERIES_POINTS),
    },
    session: nextSession,
  };
}

function stepTime(time: TimeSlice, at: EpochMs, dtMs: number, rng: Rng): TimeSlice {
  let offsetMs: number;
  if (time.source === 'GNSS') offsetMs = clamp(time.offsetMs * 0.6 + rng.gauss(1.2, 1.2), -4, 4);
  else if (time.source === 'NTP') offsetMs = clamp(time.offsetMs * 0.7 + rng.gauss(0, 4), -12, 12);
  // RTC: free-running, drifting about 0.4 ms per second (exaggerated so the demo shows it).
  else offsetMs = time.offsetMs + (0.4 * dtMs) / 1_000 + rng.gauss(0, 0.1);
  offsetMs = round1(offsetMs);
  const disciplined = time.source !== 'RTC';
  const lastSyncAt = disciplined && at - time.lastSyncAt >= TIME_SYNC_INTERVAL_MS ? at : time.lastSyncAt;
  const lastPoint = time.history[time.history.length - 1];
  const history =
    !lastPoint || at - lastPoint.at >= TIME_HISTORY_INTERVAL_MS
      ? pushRing(time.history, [{ at, offsetMs, source: time.source }], SERIES_POINTS)
      : time.history;
  let gnss = time.gnss;
  if (gnss.locked && at % 30_000 < HEALTH_TICK_MS) {
    const satellites = clamp(gnss.satellites + rng.int(-1, 1), 9, 13);
    if (satellites !== gnss.satellites) gnss = { ...gnss, satellites };
  }
  return { ...time, offsetMs, lastSyncAt, history, gnss };
}

function stepNetwork(network: SimState['network'], at: EpochMs, recording: boolean, rng: Rng): SimState['network'] {
  const downMbps = round1(Math.max(0, rng.gauss(recording ? 21.5 : 12.4, recording ? 1.1 : 0.7)));
  const upMbps = round1(Math.max(0, rng.gauss(recording ? 4.2 : 3.1, 0.3)));
  return {
    ...network,
    bandwidth: {
      downMbps,
      upMbps,
      history: pushRing(network.bandwidth.history, [{ at, downMbps, upMbps }], SERIES_POINTS),
    },
  };
}

/** The 1 Hz microphone peak sample (step 54, SIM-GAP-W48-4): the peak-hold level of each channel. */
function micLevelPoint(state: SimState, at: EpochMs): MicLevelPoint {
  // The sample keeps its v1 channel keys (the dashboard series and its i18n read them); the frames
  // themselves are keyed by mic input since schema v2 (SH-17).
  // An input without a frame yet reads the floor (the slice is keyed by the two inputs of the capture configuration).
  const level = (frame: AudioFrame | undefined) => (frame === undefined || frame.noSignal ? -90 : round1(Math.max(frame.dbfs, frame.peak)));
  const lines = captureMicLines(state);
  return { at, 'AUDIO-01': level(state.audio.inputs[micInputOfChannel(lines, 'AUDIO-01')]), 'AUDIO-02': level(state.audio.inputs[micInputOfChannel(lines, 'AUDIO-02')]) };
}

/** One 1 Hz health step at the whole second `at` (pure apart from the RNG draws). */
export function healthStep(state: SimState, at: EpochMs, dtMs: number, rng: Rng): SimState {
  const recording = state.session?.state === SessionState.RECORDING;
  const { storage, session } = stepStorage(state, at);
  const health = stepHealth(state.health, at, dtMs, recording, rng);
  return {
    ...state,
    session,
    storage,
    health: { ...health, micLevels: pushRing(state.health.micLevels ?? [], [micLevelPoint(state, at)], SERIES_POINTS) },
    // The host system clock (a Core in its own capture, wave H Z1) is not a time service: nothing is measured, nothing is stepped.
    time: state.time.hostClock === true ? state.time : stepTime(state.time, at, dtMs, rng),
    network: stepNetwork(state.network, at, recording, rng),
  };
}

/** The 1 Hz subsystem: one step at each new whole second of the sim clock. */
export function createHealthSubsystem(engine: EngineContext, capture: CaptureLevelSource = 'simulated'): SimSubsystem {
  let lastSecond: number | null = null;
  return {
    name: 'health',
    tick({ now }) {
      const second = Math.floor(now / HEALTH_TICK_MS);
      if (lastSecond !== null && second <= lastSecond) return;
      const at = second * HEALTH_TICK_MS;
      const dtMs = lastSecond === null ? HEALTH_TICK_MS : (second - lastSecond) * HEALTH_TICK_MS;
      lastSecond = second;
      // Wave H Z1 (D203 (1)): where the capture is the Core's own the slice says the host clock, whatever a stored state or a demo control last put there.
      // Closing pass J (D217 (7)): and no platform reading (`security.platformNotReported`).
      const state = capture === 'external' ? ownCaptureCoreFactsTransition(engine.store.getState()) : engine.store.getState();
      engine.store.setState(healthStep(state, at, dtMs, engine.rng.get(RngStream.HEALTH)));
    },
  };
}
