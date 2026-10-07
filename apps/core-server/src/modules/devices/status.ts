/**
 * The answers of the four device reads, built from the engine's COMMITTED slices (plan row W36;
 * spec §7.10 operations 44 to 47, §7.1 API-5 and API-6). Pure functions: no clock, no engine, no
 * request. The module's routes hand them `app.engine.state()`, `app.clock.now()` and, for the
 * two answers with audio channels, the newest meter frame (`app.engine.meters()`).
 *
 * Operations 44, 45 and 46 are design-book operations: they keep the shape the in-app simulator
 * answers in Simulated mode (`packages/shared/src/sim/api.ts`, whose builders are not exported),
 * with ISO-8601 times at UTC+07:00. A test holds every answer of this file against that handler
 * on the same state, member by member. Operation 47 answers seven slices in their wire form.
 *
 * WHAT IS NOT IN THE COMMITTED STATE: the 20 Hz meter levels. They are read from the engine's
 * newest meter frame; before the first frame of a start, see `stateLevelsOf`.
 */
import type {
  AudioChannelStatus,
  AudioStatusResponse,
  DeviceHealthResponse,
  DeviceInventory,
  StorageStatusResponse,
  VideoStatusResponse,
  VideoTrackStatus,
} from '@dems/shared/api';
import { MicState } from '@dems/shared/domain';
import {
  AUDIO_CLIP_BURST_DBFS,
  noSignalFrame,
  silentFrame,
  storageSummary,
  systemStatus,
  toWibIso,
  type AudioFrame,
  type MicStatus,
  type SimState,
} from '@dems/shared/sim';
import type { EngineHost, EngineMeterFrame } from '../../engine';

/** The committed state of the engine: the 28 replicated slices, as `app.engine.state()` returns them. */
export type CommittedState = ReturnType<EngineHost['state']>;

/** The four members of an audio channel's answer that the simulator takes from its 20 Hz frame. */
export type ChannelLevels = Pick<AudioFrame, 'dbfs' | 'peak' | 'clip' | 'noSignal'>;

/**
 * The levels of one channel as the committed `mics` slice decides them: the frame the shared
 * simulator gives a channel at the moment it ENTERS the state the mic is in.
 *
 * THE FALLBACK OF `audioChannelsOf` (a recorded difference, ruled by decision D89; formerly listed as gap BE-GAP-W36-1). The simulator
 * answers `dbfs` and `peak` from the newest frame of its `audio` slice. That slice is streamed
 * only (spec §3.2, class X): it is no durable slice, so `app.engine.state()` does not hold it.
 * The engine seam returns the newest frame of a start (`app.engine.meters()`), and null before
 * the first tick of that start. With no frame, this module answers what the committed state
 * decides:
 *
 *   `clip`      the CLIP latch of the mic (`clipLatched`): exactly the simulator's value;
 *   `noSignal`  the mic is NO_SIGNAL: exactly the simulator's value;
 *   `dbfs`, `peak`, by the state of the mic:
 *     NO_SIGNAL   the flat -90 of the shared `noSignalFrame` (exact: such a channel does not move);
 *     CLIP        the burst level of the MIC_CLIP fault (`AUDIO_CLIP_BURST_DBFS`), the frame the
 *                 fault sets when it is injected;
 *     READY       the noise floor of the shared `silentFrame`, which is what a fresh engine
 *                 holds before its first tick (spec §8.6).
 *
 * So the answer is the simulator's own for a state whose generator has not run (every scenario
 * as it is loaded). From the first tick on, `audioChannelsOf` reads the frame and the answer
 * follows the 20 Hz motion: speech, the peak hold, a test tone.
 */
export function stateLevelsOf(mic: Pick<MicStatus, 'state' | 'clipLatched'>, at: number): ChannelLevels {
  const clip = mic.clipLatched;
  if (mic.state === MicState.NO_SIGNAL) {
    const frame = noSignalFrame(at);
    return { dbfs: frame.dbfs, peak: frame.peak, clip, noSignal: frame.noSignal };
  }
  const frame = silentFrame(at);
  if (mic.state === MicState.CLIP) return { dbfs: AUDIO_CLIP_BURST_DBFS, peak: AUDIO_CLIP_BURST_DBFS, clip, noSignal: frame.noSignal };
  return { dbfs: frame.dbfs, peak: frame.peak, clip, noSignal: frame.noSignal };
}

/** Operation 46, and `cameras` of operation 44: one entry per video track. */
export function videoTracksOf(cameras: CommittedState['cameras']): VideoTrackStatus[] {
  return cameras.map((camera) => ({
    trackId: camera.id,
    deviceId: camera.deviceId,
    name: camera.name,
    lens: camera.lens,
    online: camera.online,
    recState: camera.recState,
    resolution: camera.resolution,
    fps: camera.fps,
    codec: camera.codec,
    bitrateMbps: camera.bitrateMbps,
  }));
}

/**
 * Operation 45, and `audio` of operation 44: one entry per audio channel, never merged (SYS-003).
 *
 * `frame` is the engine's newest meter frame (`app.engine.meters()`), or null before the first
 * tick of a start. With a frame, `dbfs`, `peak` and `noSignal` of a channel are the frame's, as
 * the in-app simulator answers them; `clip` is the latch of the committed `mics` slice, which a
 * command changes between two frames. Without one: `stateLevelsOf`.
 */
export function audioChannelsOf(mics: CommittedState['mics'], at: number, frame: EngineMeterFrame | null = null): AudioChannelStatus[] {
  return mics.map((mic) => {
    const live = frame?.audio.channels[mic.id];
    const levels: ChannelLevels = live === undefined ? stateLevelsOf(mic, at) : { dbfs: live.dbfs, peak: live.peak, clip: mic.clipLatched, noSignal: live.noSignal };
    return {
      trackId: mic.id,
      deviceId: mic.deviceId,
      name: mic.name,
      state: mic.state,
      recState: mic.recState,
      dbfs: levels.dbfs,
      peak: levels.peak,
      clip: levels.clip,
      noSignal: levels.noSignal,
      gainDb: mic.gainDb,
      phantom: mic.phantom,
    };
  });
}

/** `storage` of operation 44: the evidence volume, the write rate and the retention policy. */
export function storageStatusOf(state: Pick<CommittedState, 'storage' | 'storagePolicy'>): StorageStatusResponse {
  const summary = storageSummary(state);
  return {
    state: summary.state,
    totalBytes: summary.totalBytes,
    usedBytes: summary.usedBytes,
    freeBytes: summary.freeBytes,
    usedPercent: summary.usedPercent,
    estimatedRemainingMs: Math.round(summary.estimatedRemainingMs),
    writeBytesPerSec: state.storage.writeBytesPerSec,
    bitrateMbps: state.storage.bitrateMbps,
    volumes: state.storage.volumes.map((volume) => ({
      id: volume.id,
      kind: volume.kind,
      label: volume.label,
      totalBytes: volume.totalBytes,
      usedBytes: volume.usedBytes,
    })),
    retention: {
      policy: state.storagePolicy.retentionPolicy,
      days: state.storagePolicy.retentionDays,
      autoArchive: state.storagePolicy.autoArchive,
    },
  };
}

/** Operation 45. */
export function audioStatusOf(state: Pick<CommittedState, 'mics'>, now: number, frame: EngineMeterFrame | null = null): AudioStatusResponse {
  return { channels: audioChannelsOf(state.mics, now, frame) };
}

/** Operation 46. */
export function videoStatusOf(state: Pick<CommittedState, 'cameras'>): VideoStatusResponse {
  return { tracks: videoTracksOf(state.cameras) };
}

/** Operation 44: the health of camera, audio, storage, time and security, and the services. */
export function deviceHealthOf(state: CommittedState, now: number, frame: EngineMeterFrame | null = null): DeviceHealthResponse {
  // The shared rule of the Dashboard ring. It is typed for the whole simulator state and reads
  // nine slices of it, all of them durable (a test calls it on a state that holds no other).
  const system = systemStatus(state as SimState);
  return {
    device: { id: state.device.id, name: state.device.name, softwareVersion: state.device.softwareVersion },
    systemState: system.state,
    flags: system.flags.map((flag) => ({ id: flag.id, severity: flag.severity, message: flag.message })),
    cameras: videoTracksOf(state.cameras),
    audio: audioChannelsOf(state.mics, now, frame),
    storage: storageStatusOf(state),
    time: {
      source: state.time.source,
      locked: state.time.locked,
      stratum: state.time.stratum,
      offsetMs: state.time.offsetMs,
      lastSyncAt: toWibIso(state.time.lastSyncAt),
    },
    security: {
      state: state.security.state,
      posture: state.security.posture,
      tpmOk: state.security.tpm.ok,
      secureBoot: state.security.secureBoot,
      tamper: state.security.tamper,
    },
    services: state.services.map((service) => ({ id: service.id, name: service.name, status: service.status })),
    serverTime: toWibIso(now),
  };
}

/** Operation 47: the seven slices, each under its slice name, by reference (API-6). */
export function deviceInventoryOf(state: CommittedState): DeviceInventory {
  return {
    device: state.device,
    cameras: state.cameras,
    mics: state.mics,
    otherDevices: state.otherDevices,
    ports: state.ports,
    activeCameraId: state.activeCameraId,
    tabletLink: state.tabletLink,
  };
}
