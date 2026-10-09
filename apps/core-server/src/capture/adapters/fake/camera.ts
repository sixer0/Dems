/**
 * The fake camera adapter (blueprint row 65; check M4-FAKE-1; capture spec §A.1 "Test hook", §A.6).
 *
 * Adapter kind `FAKE`: an in-memory camera that satisfies the `CameraAdapter` seam without a
 * socket, a process or a file. One instance is one camera; two instances are the two-camera
 * topology and one instance with two profiles is the dual-lens topology (OD-05).
 *
 * It holds no credential (static rule G-R14; CR-7): a test that wants the authenticated outcomes
 * passes its own `authenticate` function from its set-up. It is NOT the fake ONVIF stub of row 60
 * (`test/support/fake-onvif-stub.ts`), which answers on loopback sockets for the real search and
 * connection-test code of rows 131 and 142; this fake stands where those rows' adapter will stand
 * when a test needs no network at all.
 */
import { streamLocator, usingCredential, type CameraCredential, type SealedCredential } from '../credential';
import { CaptureAdapterError, CaptureAdapterRefusal } from '../errors';
import { CaptureAdapterKind } from '../kinds';
import { ConnectionTestOutcome, type CameraAdapter, type CameraCandidate, type CameraSourceTarget, type CaptureCapability, type ConnectionTestResult, type DiscoveryResult, type DiscoverySearch, type MediaProfile, type SourceHandle } from '../types';

export interface FakeCameraOptions {
  readonly id: string;
  readonly label?: string;
  /** Profile codes, in order. Default: one profile. Two make a dual-lens camera. */
  readonly profiles?: readonly string[];
  readonly capabilities?: readonly CaptureCapability[];
  /** Host and port of the fake's locator (loopback). */
  readonly host?: string;
  readonly port?: number;
  /** What a search answers. Default: nothing. */
  readonly candidates?: readonly CameraCandidate[];
  /** Says whether a credential is the fixture's. Absent: the fake asks for none. Supplied by the test's set-up only. */
  readonly authenticate?: (credential: CameraCredential) => boolean;
  readonly ntpOffsetMs?: number;
}

export interface FakeCameraAdapter extends CameraAdapter {
  /** What was asked of the fake: counts and device IDs only. */
  readonly calls: { discover: number; tests: number; opened: string[]; closed: string[] };
  /** The sources that are open now. */
  openSources(): readonly string[];
  /** Scripts the next connection tests: an outcome the fixture cannot produce by itself (`UNREACHABLE`, `WRONG_PROFILE`, `NOT_H264`), or null for the fixture's own answer. */
  script(outcome: ConnectionTestOutcome | null): void;
  /** Makes `openSource` fail (a source that cannot be opened), or work again. */
  failOpen(fail: boolean): void;
}

export const FAKE_CAMERA_PROFILE = 'H264_1080P25';

export function createFakeCameraAdapter(options: FakeCameraOptions): FakeCameraAdapter {
  const profiles = Object.freeze([...(options.profiles ?? [FAKE_CAMERA_PROFILE])]);
  const calls: FakeCameraAdapter['calls'] = { discover: 0, tests: 0, opened: [], closed: [] };
  const open = new Set<string>();
  let scripted: ConnectionTestOutcome | null = null;
  let openFails = false;

  const served = (deviceId: string): void => {
    if (deviceId !== options.id) throw new CaptureAdapterError(CaptureAdapterRefusal.DEVICE_UNKNOWN);
  };
  const result = (outcome: ConnectionTestOutcome, authenticated: boolean): ConnectionTestResult =>
    Object.freeze({ outcome, authenticated, usableProfiles: outcome === ConnectionTestOutcome.REACHABLE ? profiles : Object.freeze([]) });

  return {
    seam: 'CAMERA',
    kind: CaptureAdapterKind.FAKE,
    devices: Object.freeze([
      Object.freeze({
        id: options.id,
        deviceClass: 'CAMERA' as const,
        label: options.label ?? options.id,
        capabilities: Object.freeze([...(options.capabilities ?? (['VIDEO', 'PULL'] as const))]),
        profiles,
      }),
    ]),
    hasOpener: true,
    calls,

    async discover(search: DiscoverySearch): Promise<DiscoveryResult> {
      if (search.signal.aborted) throw new CaptureAdapterError(CaptureAdapterRefusal.ABORTED);
      calls.discover += 1;
      const candidates = Object.freeze([...(options.candidates ?? [])]);
      return Object.freeze({ candidates, responderCount: candidates.length, interfaceCount: 0, truncated: false });
    },

    async testConnection(candidate: CameraCandidate, credential: SealedCredential | null, signal: AbortSignal): Promise<ConnectionTestResult> {
      if (signal.aborted) throw new CaptureAdapterError(CaptureAdapterRefusal.ABORTED);
      calls.tests += 1;
      const authenticated = credential !== null;
      if (!candidate.testable) return result(ConnectionTestOutcome.UNREACHABLE, authenticated);
      if (scripted !== null) return result(scripted, authenticated);
      const { authenticate } = options;
      if (authenticate === undefined) return result(ConnectionTestOutcome.REACHABLE, authenticated);
      // The credential is read inside this one call and nothing of it is kept (CR-1).
      const accepted = credential !== null && usingCredential(credential, (value) => authenticate(value) === true);
      return result(accepted ? ConnectionTestOutcome.REACHABLE : ConnectionTestOutcome.AUTHENTICATION_FAILED, authenticated);
    },

    async openSource(deviceId: string, _target: CameraSourceTarget, signal: AbortSignal): Promise<SourceHandle> {
      served(deviceId);
      if (signal.aborted) throw new CaptureAdapterError(CaptureAdapterRefusal.ABORTED, deviceId);
      if (openFails || open.has(deviceId)) throw new CaptureAdapterError(CaptureAdapterRefusal.SOURCE_KIND_NOT_RECORDABLE, deviceId);
      open.add(deviceId);
      calls.opened.push(deviceId);
      let closed = false;
      return Object.freeze({
        deviceId,
        async close(): Promise<void> {
          if (closed) return;
          closed = true;
          open.delete(deviceId);
          calls.closed.push(deviceId);
        },
      });
    },

    async profiles(deviceId: string): Promise<MediaProfile[]> {
      served(deviceId);
      return profiles.map((code) => ({ code, codec: 'H264' as const }));
    },

    pullUrl(deviceId: string, profile: string): string {
      served(deviceId);
      if (!profiles.includes(profile)) throw new CaptureAdapterError(CaptureAdapterRefusal.PROFILE_UNKNOWN, deviceId);
      return streamLocator({ host: options.host ?? '127.0.0.1', port: options.port ?? null, path: `${options.id.toLowerCase()}/${profile.toLowerCase()}` }, deviceId);
    },

    async ntpOffsetMs(deviceId: string): Promise<number> {
      served(deviceId);
      return options.ntpOffsetMs ?? 0;
    },

    openSources: () => [...open],
    script(outcome) {
      scripted = outcome;
    },
    failOpen(fail) {
      openFails = fail;
    },
  };
}
