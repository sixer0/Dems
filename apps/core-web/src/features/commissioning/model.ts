/**
 * The commissioning screen of the camera network: its requests, its refusals and its form rules
 * (task 4, blueprint row 112, package M10; contract `implementation/102_commissioning_contract.md`,
 * operations 101 to 105; the Core routes of 101 and 102: `implementation/108_network_config_ops.md`).
 * Kept in a `.ts` module so the page file exports only components.
 *
 * | Export | What it is |
 * |--------|------------|
 * | `readNetworkConfig`, `updateNetworkConfig` | Operations 101 and 102 in both data modes |
 * | `scanFactoryCameras` | Operation 103: an active scan because an operator asked (decision U9) |
 * | `readHostAlias`, `removeHostAlias` | Operations 104 and 105: the temporary host address |
 * | `commissioningRefusal` | What a refusal is, by status and `details.reason`; pure |
 * | `networkSettingsFormSchema`, `formValuesOf`, `settingsChangeOf` | The form of the six settings: the contract's forms, and the body of ONLY what changed |
 * | `typedScanAddressOf` | The one typed address of a scan, in the contract's form |
 *
 * WHO (decision U10): the permission `CAPTURE_COMMISSION`, held by TECHNICIAN only, on a web
 * console session. The Core decides every call; what the page reads of the role is a hint.
 *
 * SET-IP IS NOT IN THIS FILE. Operations 106 and 107 (the set-network job and its typed
 * credential) are blueprint row 113: `set-ip-model.ts` and `set-ip.tsx`. The installation
 * acceptance (operations 109, 110; row 118) is `acceptance-model.ts` and `acceptance.tsx`. Nothing
 * in THIS file builds, sends or holds a credential.
 */
import { z } from 'zod'
import {
  CAPTURE_CAMERA_SUBNET_PATTERN,
  CAPTURE_INTERFACE_NAME_PATTERN,
  CAPTURE_NETWORK_CONFIG_LIMITS,
  CAPTURE_PRIVATE_HOST_ADDRESS_PATTERN,
  CaptureCommissioningReason,
  CaptureNetworkConfigUpdateRequestSchema,
  STT_REVISION_CONFLICT_REASON,
  type CameraFactoryScan,
  type CaptureNetworkConfig,
  type CaptureNetworkConfigUpdateRequest,
  type HostAliasState,
} from '@dems/shared/api'
import type { CoreCallFailure } from '@dems/shared/client'
import type { Sim } from '@dems/shared/sim'
import type { WebLive } from '@/runtime'

/** The route of the screen. */
export const COMMISSIONING_PATH = '/admin/commissioning'

const NETWORK_PATH = '/api/v1/capture/network'

// ── The requests ─────────────────────────────────────────────────────────────────────────

export type CommissioningOperation =
  | 'getCaptureNetworkConfig'
  | 'updateCaptureNetworkConfig'
  | 'scanFactoryCameras'
  | 'getHostAlias'
  | 'removeHostAlias'
  // Row 113 (`set-ip-model.ts`) and row 118 (`acceptance-model.ts`): the same failure shape.
  | 'setCameraNetwork'
  | 'getCameraNetworkJob'
  | 'acceptInstallation'
  | 'revokeInstallationAcceptance'

/** A refused or unanswered request: the status and the codes, never the answer's text. */
export interface CommissioningFailure {
  readonly ok: false
  readonly operationId: CommissioningOperation
  readonly status: number | null
  readonly code: string
  /** `details.reason`, when it is a word. */
  readonly reason: string | null
  /** `details.cause` of a helper refusal (`HOST_ALIAS_FAILED`, `HOST_ALIAS_REMOVE_FAILED`), when it has the form of a code. */
  readonly cause: string | null
  /** The failed Live call, for the presenter; `null` in Simulated mode. */
  readonly failure: CoreCallFailure | null
}

export type CommissioningAnswer<T> = { readonly ok: true; readonly data: T } | CommissioningFailure

export interface CommissioningTarget {
  readonly live: WebLive | null
  readonly sim: Sim
}

const CODE = /^[A-Z][A-Z0-9_]{0,63}$/

function detailsOf(details: unknown): Pick<CommissioningFailure, 'reason' | 'cause'> {
  const record = (typeof details === 'object' && details !== null ? details : {}) as { reason?: unknown; cause?: unknown }
  return {
    reason: typeof record.reason === 'string' && CODE.test(record.reason) ? record.reason : null,
    cause: typeof record.cause === 'string' && CODE.test(record.cause) ? record.cause : null,
  }
}

/** A failed Live call as this screen keeps it: the status and the codes; the envelope stays with the presenter, the request body is nowhere in it. */
export const liveFailure = (operationId: CommissioningOperation, answer: CoreCallFailure): CommissioningFailure => ({
  ok: false,
  operationId,
  status: answer.status,
  code: answer.error.code,
  ...detailsOf(answer.error.details),
  failure: answer,
})

/** An answer of the in-app simulator in the same shape. */
export function simAnswer<T>(operationId: CommissioningOperation, response: { readonly status: number; readonly body: unknown }): CommissioningAnswer<T> {
  if (response.status >= 200 && response.status < 300) return { ok: true, data: response.body as T }
  const error = (response.body as { error?: { code?: unknown; details?: unknown } } | null)?.error
  return { ok: false, operationId, status: response.status, code: typeof error?.code === 'string' ? error.code : 'SIMULATOR_ERROR', ...detailsOf(error?.details), failure: null }
}

/** Operation 101: the one configuration row of the Core. */
export async function readNetworkConfig(target: CommissioningTarget): Promise<CommissioningAnswer<CaptureNetworkConfig>> {
  if (target.live !== null) {
    const answer = await target.live.client.call('getCaptureNetworkConfig')
    return answer.ok ? { ok: true, data: answer.data } : liveFailure('getCaptureNetworkConfig', answer)
  }
  return simAnswer('getCaptureNetworkConfig', target.sim.request({ method: 'GET', path: `${NETWORK_PATH}/config` }))
}

/** Operation 102: `revision` and the settings that changed. */
export async function updateNetworkConfig(target: CommissioningTarget, body: CaptureNetworkConfigUpdateRequest): Promise<CommissioningAnswer<CaptureNetworkConfig>> {
  if (target.live !== null) {
    const answer = await target.live.client.call('updateCaptureNetworkConfig', { body })
    return answer.ok ? { ok: true, data: answer.data } : liveFailure('updateCaptureNetworkConfig', answer)
  }
  return simAnswer('updateCaptureNetworkConfig', target.sim.request({ method: 'POST', path: `${NETWORK_PATH}/config`, body }))
}

/** Operation 103: ONE scan of the stored list, plus at most one typed address. Its result is not stored. */
export async function scanFactoryCameras(target: CommissioningTarget, address: string | null): Promise<CommissioningAnswer<CameraFactoryScan>> {
  const body = address === null ? {} : { address }
  if (target.live !== null) {
    const answer = await target.live.client.call('scanFactoryCameras', { body })
    return answer.ok ? { ok: true, data: answer.data } : liveFailure('scanFactoryCameras', answer)
  }
  return simAnswer('scanFactoryCameras', target.sim.request({ method: 'POST', path: `${NETWORK_PATH}/scan`, body }))
}

/** Operation 104: the temporary host address in place, or none. */
export async function readHostAlias(target: CommissioningTarget): Promise<CommissioningAnswer<HostAliasState>> {
  if (target.live !== null) {
    const answer = await target.live.client.call('getHostAlias')
    return answer.ok ? { ok: true, data: answer.data } : liveFailure('getHostAlias', answer)
  }
  return simAnswer('getHostAlias', target.sim.request({ method: 'GET', path: `${NETWORK_PATH}/alias` }))
}

/** Operation 105: removes the temporary host address. */
export async function removeHostAlias(target: CommissioningTarget): Promise<CommissioningAnswer<HostAliasState>> {
  if (target.live !== null) {
    const answer = await target.live.client.call('removeHostAlias')
    return answer.ok ? { ok: true, data: answer.data } : liveFailure('removeHostAlias', answer)
  }
  return simAnswer('removeHostAlias', target.sim.request({ method: 'POST', path: `${NETWORK_PATH}/alias/remove` }))
}

// ── What a refusal is ────────────────────────────────────────────────────────────────────

const COMMISSIONING_REASONS = Object.values(CaptureCommissioningReason) as readonly string[]

export type CommissioningRefusal =
  /** One of the thirteen reasons of the contract: its sentence is the contract's (`CAPTURE_COMMISSIONING_REFUSAL_SENTENCES`). */
  | { readonly kind: 'REASON'; readonly reason: CaptureCommissioningReason; readonly cause: string | null }
  /** `409 CAPTURE_CONFIG_LOCKED`: a session is open. */
  | { readonly kind: 'LOCKED' }
  /** `409` with `REVISION_CONFLICT`: somebody else wrote the configuration meanwhile. */
  | { readonly kind: 'REVISION_CONFLICT' }
  /** `403`: the role, or not a web console session. */
  | { readonly kind: 'ROLE' }
  /** Another `422`: the body was not accepted as written. */
  | { readonly kind: 'INVALID_INPUT' }
  /** Anything else (an outage, a time-out, another 429, a 5xx): the presenter's. */
  | { readonly kind: 'OTHER' }

/** What a refused commissioning request is; pure. */
export function commissioningRefusal(failure: Pick<CommissioningFailure, 'status' | 'code' | 'reason' | 'cause'>): CommissioningRefusal {
  const { status, code, reason, cause } = failure
  if (status === 409 && code === 'CAPTURE_CONFIG_LOCKED') return { kind: 'LOCKED' }
  if (reason !== null && COMMISSIONING_REASONS.includes(reason) && (status === 409 || status === 422 || status === 429)) {
    return { kind: 'REASON', reason: reason as CaptureCommissioningReason, cause }
  }
  if (status === 409 && reason === STT_REVISION_CONFLICT_REASON) return { kind: 'REVISION_CONFLICT' }
  if (status === 403) return { kind: 'ROLE' }
  if (status === 422) return { kind: 'INVALID_INPUT' }
  return { kind: 'OTHER' }
}

/** A refusal that says the Core is not in production capture operation: the screen keeps saying so. */
export const isNotProduction = (refusal: CommissioningRefusal | null): boolean => refusal?.kind === 'REASON' && refusal.reason === CaptureCommissioningReason.COMMISSIONING_NOT_AVAILABLE

// ── The form of the six settings ─────────────────────────────────────────────────────────

/** The form's values: text, as typed. An empty interface or subnet is "not chosen". */
export interface NetworkSettingsFormValues {
  interfaceName: string
  cameraSubnet: string
  /** One address per line (blanks and commas separate too). */
  factoryAddresses: string
  aliasHost: string
  aliasMinutes: string
  cameraIpStart: string
  /** Row W6 (request line 557, row V7b): the allowed ONVIF ports, comma- or line-separated, in the stored order. */
  onvifPorts: string
}

export const NETWORK_SETTINGS_FIELDS = ['interfaceName', 'cameraSubnet', 'factoryAddresses', 'aliasHost', 'aliasMinutes', 'cameraIpStart', 'onvifPorts'] as const
export type NetworkSettingsField = (typeof NETWORK_SETTINGS_FIELDS)[number]

/** The addresses of the list field, in the order typed. */
export function factoryListOf(text: string): string[] {
  return text
    .split(/[\s,]+/)
    .map((part) => part.trim())
    .filter((part) => part !== '')
}

const L = CAPTURE_NETWORK_CONFIG_LIMITS
const wholeNumberIn = (min: number, max: number) => (text: string): boolean => /^(?:0|[1-9]\d{0,3})$/.test(text.trim()) && Number(text.trim()) >= min && Number(text.trim()) <= max
const validList = (text: string): boolean => {
  const list = factoryListOf(text)
  return list.length <= L.factoryAddressesMax && list.every((address) => CAPTURE_PRIVATE_HOST_ADDRESS_PATTERN.test(address)) && new Set(list).size === list.length
}

/**
 * Row W6 (request line 557, row V7b; S2-02, C116): the ports of the ONVIF field in the order typed, or `null`
 * when the text is no valid list - 1 to 8 entries (`onvifPortsMin/Max`), each a whole number 1 to 65535
 * (`onvifPortMin/Max`, no sign, no leading zero), no port twice. The contract refuses all three.
 */
export function onvifPortsOf(text: string): number[] | null {
  const parts = factoryListOf(text)
  if (parts.length < L.onvifPortsMin || parts.length > L.onvifPortsMax) return null
  if (!parts.every((part) => /^[1-9]\d{0,4}$/.test(part))) return null
  const ports = parts.map(Number)
  if (!ports.every((port) => port >= L.onvifPortMin && port <= L.onvifPortMax)) return null
  return new Set(ports).size === ports.length ? ports : null
}

/**
 * The rule of each field, no looser than the contract's own form (`capture-commissioning.ts`): the
 * message of an issue is the FIELD's name, which the page words. Whether a value of the right form
 * may be stored (an interface the host has, a subnet with zero host bits) is the Core's decision.
 */
export const networkSettingsFormSchema = z.object({
  interfaceName: z.string().refine((text) => text.trim() === '' || CAPTURE_INTERFACE_NAME_PATTERN.test(text.trim()), 'interfaceName'),
  cameraSubnet: z.string().refine((text) => text.trim() === '' || CAPTURE_CAMERA_SUBNET_PATTERN.test(text.trim()), 'cameraSubnet'),
  factoryAddresses: z.string().refine(validList, 'factoryAddresses'),
  aliasHost: z.string().refine(wholeNumberIn(L.aliasHostMin, L.aliasHostMax), 'aliasHost'),
  aliasMinutes: z.string().refine(wholeNumberIn(L.aliasMinutesMin, L.aliasMinutesMax), 'aliasMinutes'),
  cameraIpStart: z.string().refine(wholeNumberIn(L.cameraIpStartMin, L.cameraIpStartMax), 'cameraIpStart'),
  onvifPorts: z.string().refine((text) => onvifPortsOf(text) !== null, 'onvifPorts'),
})

/** The form's values for a configuration the Core answered. */
export function formValuesOf(config: CaptureNetworkConfig): NetworkSettingsFormValues {
  return {
    interfaceName: config.interfaceName ?? '',
    cameraSubnet: config.cameraSubnet ?? '',
    factoryAddresses: config.factoryAddresses.join('\n'),
    aliasHost: String(config.aliasHost),
    aliasMinutes: String(config.aliasMinutes),
    cameraIpStart: String(config.cameraIpStart),
    // The stored order, one port per line (row W6).
    onvifPorts: config.onvifPorts.join('\n'),
  }
}

const sameList = <T extends string | number>(a: readonly T[], b: readonly T[]): boolean => a.length === b.length && a.every((entry, index) => entry === b[index])

/**
 * The body of operation 102 for valid form values: `revision` and ONLY the settings that differ
 * from `config` (a setting that is absent is left as it is). `null`: nothing changed, or the
 * values are outside the contract's schema - nothing is sent then.
 */
export function settingsChangeOf(values: NetworkSettingsFormValues, config: CaptureNetworkConfig): CaptureNetworkConfigUpdateRequest | null {
  if (!networkSettingsFormSchema.safeParse(values).success) return null
  const interfaceName = values.interfaceName.trim() === '' ? null : values.interfaceName.trim()
  const cameraSubnet = values.cameraSubnet.trim() === '' ? null : values.cameraSubnet.trim()
  const factoryAddresses = factoryListOf(values.factoryAddresses)
  const aliasHost = Number(values.aliasHost.trim())
  const aliasMinutes = Number(values.aliasMinutes.trim())
  const cameraIpStart = Number(values.cameraIpStart.trim())
  const onvifPorts = onvifPortsOf(values.onvifPorts) ?? []
  const change = {
    ...(interfaceName !== config.interfaceName ? { interfaceName } : {}),
    ...(cameraSubnet !== config.cameraSubnet ? { cameraSubnet } : {}),
    ...(!sameList(factoryAddresses, config.factoryAddresses) ? { factoryAddresses } : {}),
    ...(aliasHost !== config.aliasHost ? { aliasHost } : {}),
    ...(aliasMinutes !== config.aliasMinutes ? { aliasMinutes } : {}),
    ...(cameraIpStart !== config.cameraIpStart ? { cameraIpStart } : {}),
    // The WHOLE list, only when it differs entry by entry IN ORDER: another order is a change (the first is the default port's place).
    ...(!sameList(onvifPorts, config.onvifPorts) ? { onvifPorts } : {}),
  }
  if (Object.keys(change).length === 0) return null
  const parsed = CaptureNetworkConfigUpdateRequestSchema.safeParse({ revision: config.revision, ...change })
  return parsed.success ? parsed.data : null
}

/** The one typed address of a scan: a private IPv4 host address in the contract's form, or `null`. Blanks around it are not part of it. */
export function typedScanAddressOf(text: string): string | null {
  const trimmed = text.trim()
  return CAPTURE_PRIVATE_HOST_ADDRESS_PATTERN.test(trimmed) ? trimmed : null
}
