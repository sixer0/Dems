/**
 * Pure model of the no-device notifications, the development-source label and the microphone re-read
 * on the tablet and the phone (task 3, blueprint row 138; `masterplan/08_client_ux_spec.md` §8e flow
 * 11, §8f flow 12, §8g flow 13; specs R-10, R-11 AC-2 / AC-5 / AC-6; decisions D83, D91, D114).
 * No React, no simulator instance, no clock.
 *
 * | What | Function | Rule |
 * |---|---|---|
 * | The notifications of situations A and B | `captureNoticesOf` | one per ACTIVE alert of the `alerts` slice, told apart by `params.reason` — never by a fault kind, never counted or stored by the client (§8e.1) |
 * | The sentence of an unreachable pre-check row | `precheckUnreachableOf` | from `params.rule` of the item (D114), never "lens fault" / "no signal" |
 * | Whether a device carries the badge | `developmentSourceOf` | only from a `sourceClass` the Core sent, and only in real capture (D91); absent = no badge |
 * | The state of a local device | `localDeviceStateOf` | §8f.3: the row keeps its name and its badge; nothing replaces it |
 * | What an answer of operation 97 means | `classifyRescanAnswer` | §8g.1 states 4, 6, 7, 8 |
 *
 * Names, never values (§8e.1): a notification carries a device id and counts. The LABEL is resolved
 * here from the id; no address, no user name and no URL is read from an alert.
 */
import { CaptureInputScanSchema, type CaptureInputScan } from '@dems/shared/api';
import type { PrecheckItem, SimAlert } from '@dems/shared/sim';

// ── Flow 11: situations A and B ──────────────────────────────────────────────────────────

export const NOTICE_REASON_DISCOVERY_EMPTY = 'CAPTURE_DISCOVERY_EMPTY';
export const NOTICE_REASON_DEVICE_UNREACHABLE = 'CAPTURE_DEVICE_UNREACHABLE';

/** The causes an alert or a re-read may name (C3 §5.2, erratum PE-128-35). Anything else reads as `UNREACHABLE`. */
export const NOTICE_CAUSES = ['UNREACHABLE', 'AUTHENTICATION_FAILED', 'NOT_CONNECTED', 'PERMISSION_DENIED', 'DEVICE_BUSY', 'DEVICE_NOT_FOUND', 'OPEN_FAILED', 'HELPER_EXITED'] as const;
export type NoticeCause = (typeof NOTICE_CAUSES)[number];

export type CaptureNotice =
  | { readonly kind: 'discoveryEmpty'; readonly alertId: string }
  | {
      readonly kind: 'unreachable';
      readonly alertId: string;
      readonly deviceId: string;
      readonly deviceKind: 'CAMERA' | 'MIC';
      readonly phase: 'PRECHECK' | 'SESSION_START';
      readonly cause: NoticeCause;
      /** How many devices the one search of the pre-check found; null when no count was sent. */
      readonly searchCount: number | null;
    };

const text = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);

/**
 * The notifications a screen draws now: the ACTIVE `SYSTEM` alerts whose `params.reason` is one of
 * the two notice reasons, newest first. A resolved alert is not in the result, so a banner is gone at
 * the first state update after the Core resolved it (§8e.4); no timer hides anything.
 */
export function captureNoticesOf(alerts: readonly SimAlert[]): CaptureNotice[] {
  const notices: CaptureNotice[] = [];
  for (const alert of alerts) {
    if (!alert.active || alert.kind !== 'SYSTEM') continue;
    const params = alert.params ?? {};
    const reason = params['reason'];
    if (reason === NOTICE_REASON_DISCOVERY_EMPTY) {
      notices.push({ kind: 'discoveryEmpty', alertId: alert.id });
      continue;
    }
    if (reason !== NOTICE_REASON_DEVICE_UNREACHABLE) continue;
    const deviceId = text(params['deviceId']) ?? text(alert.target);
    const deviceKind = params['deviceKind'];
    if (deviceId === null || (deviceKind !== 'CAMERA' && deviceKind !== 'MIC')) continue;
    const cause = params['cause'];
    const count = params['searchResponderCount'];
    notices.push({
      kind: 'unreachable',
      alertId: alert.id,
      deviceId,
      deviceKind,
      phase: params['phase'] === 'SESSION_START' ? 'SESSION_START' : 'PRECHECK',
      cause: (NOTICE_CAUSES as readonly unknown[]).includes(cause) ? (cause as NoticeCause) : 'UNREACHABLE',
      searchCount: typeof count === 'number' && Number.isInteger(count) && count >= 0 ? count : null,
    });
  }
  return notices.sort((a, b) => (a.alertId < b.alertId ? 1 : a.alertId > b.alertId ? -1 : 0));
}

/** True when the alert is one of the two notices (the alert centre then words it from `params`). */
export function isCaptureNoticeAlert(alert: Pick<SimAlert, 'kind' | 'params'>): boolean {
  const reason = alert.kind === 'SYSTEM' ? alert.params?.['reason'] : null;
  return reason === NOTICE_REASON_DISCOVERY_EMPTY || reason === NOTICE_REASON_DEVICE_UNREACHABLE;
}

/**
 * The i18n key of the product name of a capture device id ("Camera 2", "MIC 1"), or null for an id
 * the vocabulary does not name (a camera added later, `CAM-03`): such a device is named by its id.
 */
export function deviceNameKey(deviceId: string): string | null {
  switch (deviceId) {
    case 'CAM-01':
      return 'common.devices.camera1';
    case 'CAM-02':
      return 'common.devices.camera2';
    case 'MIC-01':
      return 'common.devices.mic1';
    case 'MIC-02':
      return 'common.devices.mic2';
    default:
      return null;
  }
}

// ── Words (pure: the translate function is handed in) ────────────────────────────────────

export type NoticeTranslate = (key: string, options?: Record<string, unknown>) => string;

const NOTICE_KEYS = 'features.capture-selector.notice';

/** "Camera 2 (CAM-02)"; a device the vocabulary does not name is named by its id. */
export function deviceLabel(t: NoticeTranslate, deviceId: string): string {
  const key = deviceNameKey(deviceId);
  return key === null ? deviceId : t(`${NOTICE_KEYS}.device`, { name: t(key), id: deviceId });
}

export function noticeTitle(t: NoticeTranslate, notice: CaptureNotice): string {
  if (notice.kind === 'discoveryEmpty') return t(`${NOTICE_KEYS}.discoveryEmpty.title`);
  const device = deviceLabel(t, notice.deviceId);
  return notice.phase === 'SESSION_START' ? t(`${NOTICE_KEYS}.unreachable.sessionStart.title`, { device }) : t(`${NOTICE_KEYS}.unreachable.precheck.title`, { device });
}

/**
 * The title of an alert-centre item that is a capture notice ("No camera found", "Camera 2 (CAM-02)
 * is not reachable"), or null for any other alert: the WARNING notices have the kind `SYSTEM`, which
 * has no fault label of its own (§8e.1 "Told apart by reason").
 */
export function captureNoticeTitle(t: NoticeTranslate, alert: SimAlert): string | null {
  const [notice] = captureNoticesOf([{ ...alert, active: true }]);
  return notice === undefined ? null : noticeTitle(t, notice);
}

// ── Flow 13 / flow 11 B: the unreachable row of the pre-check (D114) ─────────────────────

/** The suffixes of `notice.start.*` the Core may send as `params.rule` (C3 §3.1; row 133). */
export const START_RULES = ['noCamera', 'oneCamera', 'noMicrophone', 'activeMicrophone', 'noStandby', 'oneMicrophone', 'notRecordable'] as const;
export type StartRule = (typeof START_RULES)[number];

export interface PrecheckUnreachable {
  readonly rule: StartRule;
  readonly deviceId: string;
  readonly deviceKind: 'CAMERA' | 'MIC';
  /** The other microphone of an `activeMicrophone` row, or null. */
  readonly otherDeviceId: string | null;
}

/**
 * An item the Core resolved as unreachable (`value: 'UNREACHABLE'` with `params.rule`), or null for
 * every other item. A rule this client does not know is NOT guessed: the row then keeps the plain
 * "Not reachable" word and no sentence is invented.
 */
export function precheckUnreachableOf(item: Pick<PrecheckItem, 'value' | 'params'> | null): PrecheckUnreachable | null {
  if (item === null || item.value !== 'UNREACHABLE') return null;
  const params = item.params ?? {};
  const rule = params['rule'];
  const deviceId = text(params['deviceId']);
  const deviceKind = params['deviceKind'];
  if (deviceId === null || (deviceKind !== 'CAMERA' && deviceKind !== 'MIC')) return null;
  if (!(START_RULES as readonly unknown[]).includes(rule)) return null;
  return { rule: rule as StartRule, deviceId, deviceKind, otherDeviceId: text(params['other']) };
}

/** True for an item whose value is the unreachable word, whatever its rule. */
export function isUnreachableItem(item: Pick<PrecheckItem, 'value'> | null): boolean {
  return item?.value === 'UNREACHABLE';
}

// ── Flow 12: the badge ───────────────────────────────────────────────────────────────────

export type DevelopmentSourceKind = 'localCamera' | 'localMicrophone' | 'test';

export interface DevelopmentSourceInput {
  /** `sourceClass` as the Core sent it; undefined when the device carries none. */
  readonly sourceClass: string | undefined;
  /** `adapter` as the Core sent it; undefined when the device carries none. */
  readonly adapter: string | undefined;
  /** CAMERA or MIC (the kind text of a local device). */
  readonly deviceKind: string;
  /** The data comes from a Core server (Live mode), not from the in-app simulator. */
  readonly live: boolean;
  /** The Core's demo flag of the signed-in session: true means the Core runs SIMULATED. */
  readonly demoControls: boolean;
}

/**
 * The badge of a device, or null. Drawn ONLY when all of this holds:
 *
 * | Condition | Why |
 * |---|---|
 * | the Core sent `sourceClass: 'DEVELOPMENT'` | §8f.1 "Decided by the Core": no local rule, no switch, no filter; absent = no badge |
 * | the data is the Core server's (Live mode) | Simulated client mode never badges devices (D83): the mode banner says it |
 * | the Core's demo flag is off | D91 ruling R-2 option A: only in real capture, never when the Core runs SIMULATED |
 */
export function developmentSourceOf(input: DevelopmentSourceInput): DevelopmentSourceKind | null {
  if (input.sourceClass !== 'DEVELOPMENT') return null;
  if (!input.live || input.demoControls) return null;
  if (input.adapter === 'LOCAL_DEVICE') return input.deviceKind === 'MIC' ? 'localMicrophone' : 'localCamera';
  return 'test';
}

/**
 * The badge of a search candidate, by the same three conditions. A candidate is never a local
 * device (D83 O-8): a development candidate is a test source.
 */
export function candidateSourceOf(input: { development: boolean; live: boolean; demoControls: boolean }): DevelopmentSourceKind | null {
  return input.development && input.live && !input.demoControls ? 'test' : null;
}

// ── Flow 12: the local-device states (§8f.3) ─────────────────────────────────────────────

/** `READY`, the five named causes, or `ABSENT` (not present, no cause named). */
export type LocalDeviceState = 'READY' | 'PERMISSION_DENIED' | 'DEVICE_BUSY' | 'DEVICE_NOT_FOUND' | 'OPEN_FAILED' | 'HELPER_EXITED' | 'ABSENT';

export function localDeviceStateOf(present: boolean, errorCode: string | null): LocalDeviceState {
  switch (errorCode) {
    case 'PERMISSION_DENIED':
    case 'DEVICE_BUSY':
    case 'DEVICE_NOT_FOUND':
    case 'OPEN_FAILED':
    case 'HELPER_EXITED':
      return errorCode;
    default:
      return present ? 'READY' : 'ABSENT';
  }
}

export const LOCAL_STATE_TONE = {
  READY: 'success',
  PERMISSION_DENIED: 'warning',
  DEVICE_BUSY: 'warning',
  DEVICE_NOT_FOUND: 'danger',
  OPEN_FAILED: 'warning',
  HELPER_EXITED: 'warning',
  ABSENT: 'danger',
} as const satisfies Record<LocalDeviceState, 'success' | 'warning' | 'danger'>;

/** The key (under `features.capture-selector.localDevice`) of the sentence of a state, or null for `READY`. */
export function localDeviceSentenceKey(state: LocalDeviceState, deviceKind: 'CAMERA' | 'MIC'): string | null {
  const suffix = deviceKind === 'MIC' ? 'Microphone' : 'Camera';
  switch (state) {
    case 'READY':
      return null;
    case 'PERMISSION_DENIED':
      return `permission${suffix}`;
    case 'DEVICE_BUSY':
      return `busy${suffix}`;
    case 'DEVICE_NOT_FOUND':
      return `notFound${suffix}`;
    case 'OPEN_FAILED':
    case 'HELPER_EXITED':
      return `openFailed${suffix}`;
    case 'ABSENT':
      return deviceKind === 'MIC' ? 'absentMicrophone' : 'notFoundCamera';
  }
}

// ── Flow 13: operation 97 ────────────────────────────────────────────────────────────────

/**
 * | Class | Answer | Presentation (§8g.1) |
 * |---|---|---|
 * | `ok` | 200 | state 4: one line per registered microphone, "Checked at" |
 * | `limited` | 429 | state 6: the fixed seconds; re-enables by itself |
 * | `notReady` | 503 | state 7: "Capture is not ready yet" + Retry |
 * | `denied` | 403 | state 8: the role sentence |
 * | `signedOut`, `offline`, `failed` | 401, no answer, anything else | a failure line, nothing changed |
 */
export type RescanAnswerClass = 'ok' | 'limited' | 'notReady' | 'denied' | 'signedOut' | 'offline' | 'failed';

export function classifyRescanAnswer(status: number | null): RescanAnswerClass {
  if (status === null) return 'offline';
  if (status >= 200 && status < 300) return 'ok';
  if (status === 401) return 'signedOut';
  if (status === 403) return 'denied';
  if (status === 429) return 'limited';
  if (status === 503) return 'notReady';
  return 'failed';
}

/** Operation 97's body, or null when it is not one. */
export function inputScanOf(body: unknown): CaptureInputScan | null {
  const parsed = CaptureInputScanSchema.safeParse(body);
  return parsed.success ? parsed.data : null;
}

/** The gated control of flow 13 on these clients (§11; check `M4-MIC-RESCAN-T` / `-P`). */
export const RESCAN_GATED_CONTROLS = ['G17'] as const;
