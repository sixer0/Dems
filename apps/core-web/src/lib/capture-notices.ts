/**
 * The no-device notifications of the web console, read from the Core's alerts (task 3, R-10,
 * blueprint row 137; `masterplan/08_client_ux_spec.md` §8e flow 11, §8g.3;
 * `masterplan/03_api_contract.md` §5.4; server side: blueprint row 133).
 *
 * | Rule (ux §8e.1) | Where |
 * |-----------------|-------|
 * | One alert, drawn everywhere: each notification is ONE alert the Core raised; the console raises, counts and stores none of its own | `captureNoticeOf` reads `alerts`, and nothing else |
 * | Told apart by reason: title and body come from `params.reason` (+ `phase`, `deviceKind`, `cause`), not from a fault kind | `captureNoticeOf`, `captureNoticeWords` |
 * | Names, never values: the device by label and id ("Camera 2 (CAM-02)") and counts. Never an address, a user name, a password or a URL | `captureDeviceNameKey`; the alert carries ids, counts and codes only |
 * | Cleared by the Core only: a banner or an item is a snapshot of the slice and changes only when the slice does | callers select from the store; nothing here keeps state or a timer |
 *
 * Situation C (no camera connected at session start) is blueprint row 139's and is not read here.
 * In `lib/` because three places draw the same notice: Devices & Inputs, the pre-check of Session
 * New, and the alert centre of the shell.
 */
import type { TFunction } from 'i18next'
import type { SimAlert } from '@dems/shared/sim'

export const CAPTURE_NOTICE_REASON = {
  DISCOVERY_EMPTY: 'CAPTURE_DISCOVERY_EMPTY',
  DEVICE_UNREACHABLE: 'CAPTURE_DEVICE_UNREACHABLE',
} as const

export type CaptureNoticeDeviceKind = 'CAMERA' | 'MIC'

/** The named causes the texts know (`common.captureNotice.cause.*`, `common.localDevice.*`). */
export const CAPTURE_NOTICE_CAUSES = [
  'UNREACHABLE',
  'AUTHENTICATION_FAILED',
  'NOT_CONNECTED',
  'PERMISSION_DENIED',
  'DEVICE_BUSY',
  'DEVICE_NOT_FOUND',
  'OPEN_FAILED',
  'HELPER_EXITED',
] as const
export type CaptureNoticeCause = (typeof CAPTURE_NOTICE_CAUSES)[number]

export type CaptureNotice =
  /** Situation A: the last search found no camera. */
  | { readonly kind: 'DISCOVERY_EMPTY'; readonly alertId: string }
  /** Situation B (pre-check) and the degraded warning of situation C (session start): one alert per device. */
  | {
      readonly kind: 'UNREACHABLE'
      readonly alertId: string
      readonly phase: 'PRECHECK' | 'SESSION_START'
      readonly deviceId: string
      readonly deviceKind: CaptureNoticeDeviceKind
      readonly cause: CaptureNoticeCause
      /** Cameras only: how many devices the one search of the pre-check found; `null` when no search ran. */
      readonly searchResponderCount: number | null
    }

type NoticeAlert = Pick<SimAlert, 'id' | 'kind' | 'active' | 'params'>

const DEVICE_ID = /^[A-Z][A-Z0-9-]{1,31}$/

/** The notice an alert is, or `null` for any other alert. Reads `params` as untrusted data: a member that does not fit is dropped. */
export function captureNoticeOf(alert: NoticeAlert): CaptureNotice | null {
  if (alert.kind !== 'SYSTEM') return null
  const params = alert.params ?? {}
  const reason = params['reason']
  if (reason === CAPTURE_NOTICE_REASON.DISCOVERY_EMPTY) return { kind: 'DISCOVERY_EMPTY', alertId: alert.id }
  if (reason !== CAPTURE_NOTICE_REASON.DEVICE_UNREACHABLE) return null
  const deviceId = params['deviceId']
  const deviceKind = params['deviceKind']
  if (typeof deviceId !== 'string' || !DEVICE_ID.test(deviceId) || (deviceKind !== 'CAMERA' && deviceKind !== 'MIC')) return null
  const cause = CAPTURE_NOTICE_CAUSES.find((known) => known === params['cause']) ?? 'UNREACHABLE'
  const count = params['searchResponderCount']
  return {
    kind: 'UNREACHABLE',
    alertId: alert.id,
    phase: params['phase'] === 'SESSION_START' ? 'SESSION_START' : 'PRECHECK',
    deviceId,
    deviceKind,
    cause,
    searchResponderCount: typeof count === 'number' && Number.isInteger(count) && count >= 0 ? count : null,
  }
}

/** The active notices, in the order of the alerts. Pure. */
export function activeCaptureNotices(alerts: readonly (NoticeAlert & { readonly active: boolean })[]): CaptureNotice[] {
  const notices: CaptureNotice[] = []
  for (const alert of alerts) {
    if (!alert.active) continue
    const notice = captureNoticeOf(alert)
    if (notice !== null) notices.push(notice)
  }
  return notices
}

/** The label key of a device the console names; `null` for any other id (an added camera is named by its id alone). */
export function captureDeviceNameKey(deviceId: string): 'common.devices.camera1' | 'common.devices.camera2' | 'common.devices.mic1' | 'common.devices.mic2' | null {
  switch (deviceId) {
    case 'CAM-01':
      return 'common.devices.camera1'
    case 'CAM-02':
      return 'common.devices.camera2'
    case 'MIC-01':
      return 'common.devices.mic1'
    case 'MIC-02':
      return 'common.devices.mic2'
    default:
      return null
  }
}

type Translate = TFunction

/** "Camera 2 (CAM-02)": the label and the id; the id alone when the console has no label for it. */
export function captureDeviceName(t: Translate, deviceId: string): string {
  const key = captureDeviceNameKey(deviceId)
  return key === null ? deviceId : `${t(key)} (${deviceId})`
}

/** The cause sentence of a notice; `null` for the plain "did not answer", which the body already says. */
function causeText(t: Translate, notice: Extract<CaptureNotice, { kind: 'UNREACHABLE' }>): string | null {
  switch (notice.cause) {
    case 'UNREACHABLE':
      return null
    case 'OPEN_FAILED':
    case 'HELPER_EXITED':
      return t((notice.deviceKind === 'CAMERA' ? 'common.localDevice.openFailed.camera' : 'common.localDevice.openFailed.microphone'))
    case 'PERMISSION_DENIED':
      return t((notice.deviceKind === 'CAMERA' ? 'common.localDevice.permissionCamera' : 'common.localDevice.permissionMicrophone'))
    case 'DEVICE_BUSY':
      return t((notice.deviceKind === 'CAMERA' ? 'common.localDevice.busyCamera' : 'common.localDevice.busyMicrophone'))
    case 'DEVICE_NOT_FOUND':
      return t((notice.deviceKind === 'CAMERA' ? 'common.localDevice.notFoundCamera' : 'common.localDevice.notFoundMicrophone'))
    case 'AUTHENTICATION_FAILED':
    case 'NOT_CONNECTED':
      return t(`common.captureNotice.cause.${notice.cause}`)
  }
}

export interface CaptureNoticeText {
  readonly title: string
  readonly body: string
}

/** The title and the body of a notice (ux §8e.2), in the console's words. Ids and counts only; never the alert's own text. */
export function captureNoticeText(t: Translate, notice: CaptureNotice): CaptureNoticeText {
  if (notice.kind === 'DISCOVERY_EMPTY') {
    return { title: t('common.captureNotice.discoveryEmpty.title'), body: t('common.captureNotice.discoveryEmpty.body') }
  }
  const device = captureDeviceName(t, notice.deviceId)
  const cause = causeText(t, notice)
  if (notice.phase === 'SESSION_START') {
    const body = t('common.captureNotice.unreachable.sessionStart.body')
    return { title: t('common.captureNotice.unreachable.sessionStart.title', { device }), body: cause === null ? body : `${body} ${cause}` }
  }
  const body =
    notice.deviceKind === 'CAMERA' && notice.searchResponderCount !== null
      ? t('common.captureNotice.unreachable.precheck.camera', { count: notice.searchResponderCount })
      : t('common.captureNotice.unreachable.precheck.microphone')
  return { title: t('common.captureNotice.unreachable.precheck.title', { device }), body: cause === null ? body : `${body} ${cause}` }
}

/** The one line of the alert centre for a notice. */
export function captureNoticeLine(t: Translate, notice: CaptureNotice): string {
  const text = captureNoticeText(t, notice)
  return `${text.title}. ${text.body}`
}

// ── The start rule at pre-check (ux §8g.3; D83, D114) ────────────────────────────────────

/** `params.rule` of an unreachable pre-check item: the suffix of `common.captureNotice.start.*`. */
export const CAPTURE_START_RULES = ['noCamera', 'oneCamera', 'noMicrophone', 'activeMicrophone', 'noStandby', 'oneMicrophone', 'notRecordable'] as const
export type CaptureStartRule = (typeof CAPTURE_START_RULES)[number]

/** The value a pre-check item carries when its source did not answer (D114: `reasonCode` is null then). */
export const PRECHECK_UNREACHABLE_VALUE = 'UNREACHABLE'

export interface UnreachablePrecheck {
  readonly rule: CaptureStartRule
  readonly deviceId: string
  readonly deviceKind: CaptureNoticeDeviceKind
  /** The other microphone, for the sentence that names it; `null` otherwise. */
  readonly otherDeviceId: string | null
}

/**
 * The unreachable source a pre-check item stands for, or `null` for any other item. D114: such an
 * item carries `value: 'UNREACHABLE'`, `reasonCode: null` and `params { deviceId, deviceKind, rule,
 * other? }`; it is drawn from `params.rule`, never as a lens fault or "no signal".
 */
export function unreachablePrecheckOf(item: { readonly value?: string | null; readonly status: string; readonly params?: Readonly<Record<string, unknown>> }): UnreachablePrecheck | null {
  if (item.value !== PRECHECK_UNREACHABLE_VALUE || (item.status !== 'WARN' && item.status !== 'BLOCK')) return null
  const params = item.params ?? {}
  const rule = CAPTURE_START_RULES.find((known) => known === params['rule'])
  const deviceId = params['deviceId']
  const deviceKind = params['deviceKind']
  if (rule === undefined || typeof deviceId !== 'string' || !DEVICE_ID.test(deviceId) || (deviceKind !== 'CAMERA' && deviceKind !== 'MIC')) return null
  const other = params['other']
  return { rule, deviceId, deviceKind, otherDeviceId: typeof other === 'string' && DEVICE_ID.test(other) ? other : null }
}

/** The sentence of the start rule for an unreachable source (ux §8g.3), with the devices named by label and id. */
export function unreachablePrecheckText(t: Translate, source: UnreachablePrecheck): string {
  const device = captureDeviceName(t, source.deviceId)
  const other = source.otherDeviceId === null ? '' : captureDeviceName(t, source.otherDeviceId)
  // The active microphone without a second one to name: the rule still blocks; the sentence says what cannot start.
  if (source.rule === 'activeMicrophone' && source.otherDeviceId === null) return t('common.captureNotice.start.noMicrophone')
  return t(`common.captureNotice.start.${source.rule}`, { device, other })
}
