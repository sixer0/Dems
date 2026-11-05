/**
 * One gate model for the device commands of both device menus: the Dashboard tile kebab
 * (`features/dashboard/devices-panel.tsx`) and the Devices & Inputs kebab
 * (`features/devices/device-menu.tsx`). FXR-W, finding W92-14 (`verification/11_code_review_shared_web.md`;
 * decision D242; ruling R3 of D201).
 *
 * The two menus agreed only by accident: the Dashboard gated Test signal on DIAGNOSTICS_RUN and the
 * Devices page did not gate it (nor Identify) at all; the Devices page disabled Restart while
 * recording and the Dashboard offered a Restart the Core refuses with 409 `RECORDING_ACTIVE`
 * (`masterplan/01_specs.md:912`); the Devices page named its role as a hard-coded
 * "TECHNICIAN". Here each command follows the permission the Core server checks for its operation
 * (`packages/shared/src/api/devices.ts`, operations 48 to 50), the recording rule of Restart, and the
 * pending rule of LB-1, and the role is the first one that holds the permission.
 *
 * | Command | Operation | Permission | Also blocked |
 * |---------|-----------|------------|--------------|
 * | Test signal | 49 `testDeviceSignal` | DIAGNOSTICS_RUN | a command of the device is out (LB-1) |
 * | Identify | 50 `identifyDevice` | DIAGNOSTICS_RUN | a command of the device is out (LB-1) |
 * | Restart | 48 `restartDevice` | DEVICE_MANAGE | a command is out; a recording is running (409 `RECORDING_ACTIVE`) |
 *
 * Audit row CS2 (finding O-124-1, ruling D89): a Core in its own capture (`useSelfCaptureCore`, the one rule; the Core's
 * `isOwnCaptureCoreState`) refuses all three with 409 `COMMAND_UNSUPPORTED` / `DEVICE_COMMAND_NOT_AVAILABLE` - it has no
 * adapter that restarts, tones or blinks a device. Each item is then disabled with that reason (`NOT_AVAILABLE`), the
 * first and lasting block: no press, no toast, no request. The simulated lane is unchanged.
 */
import { useTranslation } from 'react-i18next'
import { OperatorRole, Permission, selectCan, selectIsRecording, useSim } from '@dems/shared/sim'
import { requiredRoleForPermission } from '@/lib/core-errors'
import { useSelfCaptureCore } from '@/lib/own-capture'

export type DeviceCommandKey = 'testSignal' | 'identify' | 'restart'

/** The permission the Core server checks for each command. */
export const DEVICE_COMMAND_PERMISSION: Readonly<Record<DeviceCommandKey, Permission>> = {
  testSignal: Permission.DIAGNOSTICS_RUN,
  identify: Permission.DIAGNOSTICS_RUN,
  restart: Permission.DEVICE_MANAGE,
}

/** Why a command is not offered now; `null` when it is. */
export type DeviceCommandBlock =
  | { readonly kind: 'BUSY' }
  | { readonly kind: 'ROLE'; readonly permission: Permission; readonly role: OperatorRole | null }
  | { readonly kind: 'RECORDING' }
  | { readonly kind: 'NOT_AVAILABLE' }

export interface DeviceCommandGateInput {
  /** Whether the session holds a permission (the hint of the Core in Live mode, the simulator's table otherwise). */
  readonly can: (permission: Permission) => boolean
  /** A recording is running. */
  readonly recording: boolean
  /** A command of this device is out (LB-1). */
  readonly busy: boolean
  /** The Core runs its own capture: it refuses every device command (audit row CS2). Absent: false. */
  readonly notAvailable?: boolean
}

/** The block of each command, by the rules above; pure. */
export function deviceCommandGate({ can, recording, busy, notAvailable = false }: DeviceCommandGateInput): Readonly<Record<DeviceCommandKey, DeviceCommandBlock | null>> {
  // The lasting reasons first (the role, a recording), so their sentence stays under the item while a
  // command is out; BUSY only blocks an item that is otherwise offered.
  const blockOf = (key: DeviceCommandKey): DeviceCommandBlock | null => {
    const permission = DEVICE_COMMAND_PERMISSION[key]
    // Row CS2: what the Core refuses for every role and in every state is said first.
    if (notAvailable) return { kind: 'NOT_AVAILABLE' }
    if (!can(permission)) return { kind: 'ROLE', permission, role: requiredRoleForPermission(permission) }
    if (key === 'restart' && recording) return { kind: 'RECORDING' }
    if (busy) return { kind: 'BUSY' }
    return null
  }
  return { testSignal: blockOf('testSignal'), identify: blockOf('identify'), restart: blockOf('restart') }
}

export interface DeviceCommandGateView {
  /** The block of each command. */
  readonly blocks: Readonly<Record<DeviceCommandKey, DeviceCommandBlock | null>>
  /** The sentence under a blocked item ("Requires the … role", "Not available while recording"); `null` when there is none to say (offered, or busy). */
  readonly reasonOf: (key: DeviceCommandKey) => string | null
}

/** The gate for one device's menu, read from the store, with its sentences. */
export function useDeviceCommandGate(busy: boolean): DeviceCommandGateView {
  const { t } = useTranslation()
  const canTest = useSim((s) => selectCan(s, Permission.DIAGNOSTICS_RUN))
  const canManage = useSim((s) => selectCan(s, Permission.DEVICE_MANAGE))
  const recording = useSim(selectIsRecording)
  const notAvailable = useSelfCaptureCore()
  const held: Partial<Record<Permission, boolean>> = { [Permission.DIAGNOSTICS_RUN]: canTest, [Permission.DEVICE_MANAGE]: canManage }
  const blocks = deviceCommandGate({ can: (permission) => held[permission] === true, recording, busy, notAvailable })
  const reasonOf = (key: DeviceCommandKey): string | null => {
    const block = blocks[key]
    if (block === null || block.kind === 'BUSY') return null
    if (block.kind === 'NOT_AVAILABLE') return t('common.deviceMenuHint.notAvailable')
    if (block.kind === 'RECORDING') return t('devices.actions.restartWhileRecording')
    return t('common.rbac.requiresRole', { role: block.role ? t(`common.roles.${block.role}`) : '' })
  }
  return { blocks, reasonOf }
}
