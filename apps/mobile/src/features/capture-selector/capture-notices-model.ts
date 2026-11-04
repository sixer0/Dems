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
 * | The slot of a "source not assigned" pre-check row (task 4 row 169) | `unassignedSlotOfPrecheckItem` of `@dems/shared/sim` (names register N12; not in this file) | from `value`, `status`, `params.rule` and `params.slot`; the item carries no device id |
 * | Whether a device carries the badge | `developmentSourceOf` | only from a `sourceClass` the Core sent (D131); absent = no badge, whatever the Core's demo flag says |
 * | The state of a local device | `localDeviceStateOf` | §8f.3: the row keeps its name and its badge; nothing replaces it |
 * | What an answer of operation 97 means | `classifyRescanAnswer` | §8g.1 states 4, 6, 7, 8 |
 * | Situation C (row 139): a start with no camera, and one camera of two | `failedStartOf`, `camerasNotConnectedOf` | a failed start is FAULT with `captureDurable: false`; its cause is the alert's `params.reason`; the degraded warning is the `SESSION_START` phase |
 *
 * Names, never values (§8e.1): a notification carries a device id and counts. The LABEL is resolved
 * here from the id; no address, no user name and no URL is read from an alert.
 */
import { CaptureInputScanSchema, type CaptureInputScan } from '@dems/shared/api';
import { CaptureStartRule, captureFaultSentence, type PrecheckItem, type SimAlert } from '@dems/shared/sim';
import { micInputName, micInputNumber } from './mic-input-name';

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

/**
 * "Camera 2 (CAM-02)", "Microphone 3 (MIC-03)"; a device the vocabulary does not name is named by
 * its id. A microphone is named by the number of the id the Core sent (`micInputName`, pass D2).
 */
export function deviceLabel(t: NoticeTranslate, deviceId: string): string {
  const key = deviceNameKey(deviceId);
  if (key !== null) return t(`${NOTICE_KEYS}.device`, { name: t(key), id: deviceId });
  return micInputNumber(deviceId) === null ? deviceId : t(`${NOTICE_KEYS}.device`, { name: micInputName(t, deviceId), id: deviceId });
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

/**
 * The suffixes of `notice.start.*` the Core may send as `params.rule` (C3 §3.1; row 133). Task 4 row 169
 * (names register E35): the eighth member, `sourceNotAssigned`, is the rule of an UNASSIGNED selector
 * slot. Its item names no device, so it is found by the shared `unassignedSlotOfPrecheckItem`
 * (names register N12), never by `precheckUnreachableOf` (which needs a device id). The rule's name
 * is the shared `CaptureStartRule.SOURCE_NOT_ASSIGNED` (N7) and the item's value the shared
 * `SOURCE_NOT_ASSIGNED_PRECHECK_VALUE` (N8): this file states neither again.
 */
export const START_RULES = ['noCamera', 'oneCamera', 'noMicrophone', 'activeMicrophone', 'noStandby', 'oneMicrophone', 'notRecordable', CaptureStartRule.SOURCE_NOT_ASSIGNED] as const;
export type StartRule = (typeof START_RULES)[number];

/** A rule of an UNREACHABLE device: every start rule but the one of an unassigned slot (that item names no device). */
export type UnreachableRule = Exclude<StartRule, typeof CaptureStartRule.SOURCE_NOT_ASSIGNED>;

export interface PrecheckUnreachable {
  readonly rule: UnreachableRule;
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
  // The rule of an unassigned slot is not a rule of a DEVICE: an unreachable item that carried it is not guessed either.
  if (!(START_RULES as readonly unknown[]).includes(rule) || rule === CaptureStartRule.SOURCE_NOT_ASSIGNED) return null;
  return { rule: rule as UnreachableRule, deviceId, deviceKind, otherDeviceId: text(params['other']) };
}

/** True for an item whose value is the unreachable word, whatever its rule. */
export function isUnreachableItem(item: Pick<PrecheckItem, 'value'> | null): boolean {
  return item?.value === 'UNREACHABLE';
}

// ── An unassigned selector slot at pre-check (task 4 row 169; decisions C18 (1), C25; names register 5.2) ──

/*
 * The selector slot a pre-check item says is NOT ASSIGNED (names register 5.2): `value:
 * 'NOT_ASSIGNED'`, `reasonCode: null`, `params { rule: 'sourceNotAssigned', slot }` - and NO
 * `deviceId`, because there is no device. The status is the Core's (BLOCK for every slot in
 * real capture, the second microphone channel too: decision C25, renumbered by D61 of 2026-11-04). It is recognised by the ONE recogniser
 * of both clients, `unassignedSlotOfPrecheckItem` of `@dems/shared/sim` (N12; integration pass I-6
 * removed the local form this file held until the shared one landed). Its caller here is
 * `precheckSentence` of `capture-notices.tsx`, which keeps the guard for "no item".
 */

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
}

/**
 * The badge of a device, or null. Drawn ONLY when both of this hold:
 *
 * | Condition | Why |
 * |---|---|
 * | the Core sent `sourceClass: 'DEVELOPMENT'` | §8f.1 "Decided by the Core": no local rule, no switch, no filter; absent = no badge |
 * | the data is the Core server's (Live mode) | Simulated client mode never badges devices (D83): there is no Core, and the mode banner says it |
 *
 * Decision D131 (it settles D129 (2) for both clients): nothing is inferred from the session's demo
 * flag (`demoControls`). "Never when the Core runs SIMULATED" (D91) is kept by the Core: in simulated
 * capture it sends no `sourceClass` for its built-in devices, so there is nothing to draw.
 */
export function developmentSourceOf(input: DevelopmentSourceInput): DevelopmentSourceKind | null {
  if (input.sourceClass !== 'DEVELOPMENT') return null;
  if (!input.live) return null;
  if (input.adapter === 'LOCAL_DEVICE') return input.deviceKind === 'MIC' ? 'localMicrophone' : 'localCamera';
  return 'test';
}

/**
 * The badge of a search candidate, by the same two conditions. A candidate is never a local
 * device (D83 O-8): a development candidate is a test source.
 */
export function candidateSourceOf(input: { development: boolean; live: boolean }): DevelopmentSourceKind | null {
  return input.development && input.live ? 'test' : null;
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

// ── A capture fault by its reason (fix pass F-M5, review R74-03) ─────────────────────────────────

/**
 * The line of a `CAPTURE_FAULT` alert, or null for any other alert: THE SHARED SENTENCE of its
 * `params.reason` (`captureFaultSentence`, the one wording source of `@dems/shared/sim`), with the
 * device named as this app names it. A reason without a sentence reads neutrally with its code;
 * the capture as a whole without a cause reads as an interrupted recording.
 */
export function captureFaultLine(t: NoticeTranslate, alert: Pick<SimAlert, 'kind' | 'target' | 'params'>): string | null {
  if (alert.kind !== 'CAPTURE_FAULT') return null;
  const reason = alert.params?.['reason'];
  const target = alert.target ?? null;
  return captureFaultSentence(typeof reason === 'string' ? reason : null, target === null ? null : deviceLabel(t, target));
}

// ── Flow 11, situation C: a session start with no camera (blueprint row 139; ux §8e.2; D72(k), D84, D91) ──

/** `params.reason` of the `CAPTURE_FAULT` alert of a start at which no camera connected (C3 §5.4). */
export const NOTICE_REASON_NO_CAMERA_CONNECTED = 'NO_CAMERA_CONNECTED';

/** Why a recording did not start: "no camera" only when the Core says so on its alert. Either way nothing was recorded. */
export type FailedStart = typeof NOTICE_REASON_NO_CAMERA_CONNECTED | 'OTHER';

/**
 * The failed start a session is in, or null. A FAILED START is a session in FAULT whose payload says
 * `captureDurable: false` (D84, D91 ruling R-1 option A): the capture ended before its first durable
 * fragment, so there is no evidence file and no evidence item, and nothing to recover. Only an
 * explicit `false` counts: a session without the member (the simulator, an interrupted recording)
 * is not one.
 */
export function failedStartOf(session: unknown, alerts: readonly Pick<SimAlert, 'kind' | 'active' | 'params'>[]): FailedStart | null {
  if (typeof session !== 'object' || session === null) return null;
  const facts = session as { state?: unknown; captureDurable?: unknown };
  if (facts.state !== 'FAULT' || facts.captureDurable !== false) return null;
  const named = alerts.some((alert) => alert.active && alert.kind === 'CAPTURE_FAULT' && alert.params?.['reason'] === NOTICE_REASON_NO_CAMERA_CONNECTED);
  return named ? NOTICE_REASON_NO_CAMERA_CONNECTED : 'OTHER';
}

/**
 * A failed start THE CORE IS CLOSING, or null (fix pass F-M5, review R74-12; decision D158, MB-06):
 * "Close session" is the Core's recovery of a session that recorded nothing, so the session passes
 * through RECOVERY with `captureDurable` still `false` - only a failed start can be there (an
 * interrupted recording is durable). The rule of the web console (`selectFailedStartClosing`): a
 * screen that first sees the session in that state presents no recovery of evidence. The cause is
 * read as for the FAULT.
 */
export function failedStartClosingOf(session: unknown, alerts: readonly Pick<SimAlert, 'kind' | 'active' | 'params'>[]): FailedStart | null {
  if (typeof session !== 'object' || session === null) return null;
  const facts = session as { state?: unknown; captureDurable?: unknown };
  if (facts.state !== 'RECOVERY' || facts.captureDurable !== false) return null;
  return failedStartOf({ state: 'FAULT', captureDurable: false }, alerts);
}

/** "No camera connected" / "Nothing was recorded." (shared words, ux §14.2). The body is said in full for every failed start. */
export function failedStartWords(t: NoticeTranslate, failed: FailedStart): { title: string; body: string } {
  return {
    title: failed === NOTICE_REASON_NO_CAMERA_CONNECTED ? t('common.captureNotice.noCamera.title') : t('common.session.failedStart.title'),
    body: t('common.captureNotice.noCamera.body'),
  };
}

/** The cameras a degraded session start names as not connected: the active `SESSION_START` notices of cameras, newest first. */
export function camerasNotConnectedOf(alerts: readonly SimAlert[]): Extract<CaptureNotice, { kind: 'unreachable' }>[] {
  return captureNoticesOf(alerts).flatMap((notice) => (notice.kind === 'unreachable' && notice.phase === 'SESSION_START' && notice.deviceKind === 'CAMERA' ? [notice] : []));
}
