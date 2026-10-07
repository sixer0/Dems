// FXR-W, finding W92-14 (`verification/11_code_review_shared_web.md`; decision D242): one gate model
// for both device menus. The table is the Core server's (operations 48 to 50 of
// `packages/shared/src/api/devices.ts`); the role named is the first that holds the permission
// (never a hard-coded name); Restart is not offered while recording (409 RECORDING_ACTIVE); LB-1
// blocks every command while one is out.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CORE_API_OPERATIONS } from '@dems/shared/api'
import { OperatorRole, Permission, ROLE_PERMISSIONS } from '@dems/shared/sim'
import { DEVICE_COMMAND_PERMISSION, deviceCommandGate } from '../device-command-gate'

const holding = (...held: Permission[]) => (permission: Permission) => held.includes(permission)

describe('the gate (pure)', () => {
  it('each command follows the permission the Core checks for its operation', () => {
    const operation = (id: string) => CORE_API_OPERATIONS.find((entry) => entry.operationId === id) as { permission?: unknown } | undefined
    const permissionOf = (id: string) => JSON.stringify(operation(id))
    expect(DEVICE_COMMAND_PERMISSION).toEqual({ testSignal: Permission.DIAGNOSTICS_RUN, identify: Permission.DIAGNOSTICS_RUN, restart: Permission.DEVICE_MANAGE })
    expect(permissionOf('testDeviceSignal')).toContain(Permission.DIAGNOSTICS_RUN)
    expect(permissionOf('identifyDevice')).toContain(Permission.DIAGNOSTICS_RUN)
    expect(permissionOf('restartDevice')).toContain(Permission.DEVICE_MANAGE)
  })

  it('a role without DIAGNOSTICS_RUN: Test signal and Identify blocked naming the first role that holds it; Restart by its own permission', () => {
    const gate = deviceCommandGate({ can: holding(Permission.DEVICE_MANAGE), recording: false, busy: false })
    const first = [OperatorRole.INVESTIGATOR, OperatorRole.SUPERVISOR, OperatorRole.TECHNICIAN].find((role) => (ROLE_PERMISSIONS[role] as readonly Permission[]).includes(Permission.DIAGNOSTICS_RUN))
    expect(gate.testSignal).toEqual({ kind: 'ROLE', permission: Permission.DIAGNOSTICS_RUN, role: first })
    expect(gate.identify).toEqual({ kind: 'ROLE', permission: Permission.DIAGNOSTICS_RUN, role: first })
    expect(gate.restart).toBeNull()
  })

  it('without DEVICE_MANAGE Restart names the first role that holds it (computed, not hard-coded)', () => {
    const gate = deviceCommandGate({ can: holding(Permission.DIAGNOSTICS_RUN), recording: false, busy: false })
    expect(gate.restart).toEqual({ kind: 'ROLE', permission: Permission.DEVICE_MANAGE, role: OperatorRole.TECHNICIAN })
    expect(gate.testSignal).toBeNull()
    expect(gate.identify).toBeNull()
  })

  it('while recording only Restart is blocked; the role reason wins over the recording one', () => {
    const all = holding(Permission.DIAGNOSTICS_RUN, Permission.DEVICE_MANAGE)
    expect(deviceCommandGate({ can: all, recording: true, busy: false })).toEqual({ testSignal: null, identify: null, restart: { kind: 'RECORDING' } })
    expect(deviceCommandGate({ can: holding(Permission.DIAGNOSTICS_RUN), recording: true, busy: false }).restart).toMatchObject({ kind: 'ROLE' })
  })

  it('LB-1: while a command is out every command is blocked; a lasting reason keeps its place', () => {
    const all = holding(Permission.DIAGNOSTICS_RUN, Permission.DEVICE_MANAGE)
    expect(deviceCommandGate({ can: all, recording: false, busy: true })).toEqual({ testSignal: { kind: 'BUSY' }, identify: { kind: 'BUSY' }, restart: { kind: 'BUSY' } })
    expect(deviceCommandGate({ can: all, recording: true, busy: true }).restart).toEqual({ kind: 'RECORDING' })
  })
})

describe('static: both menus use the one gate', () => {
  const read = (path: string) => readFileSync(resolve(import.meta.dirname, '../..', path), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  it.each(['features/dashboard/devices-panel.tsx', 'features/devices/device-menu.tsx'])('%s calls `useDeviceCommandGate` and gates nothing of its own', (path) => {
    const code = read(path)
    expect(code).toMatch(/useDeviceCommandGate\(busy\)/)
    expect(code).not.toMatch(/common\.roles\.TECHNICIAN|selectCan\(s, Permission\.(DEVICE_MANAGE|DIAGNOSTICS_RUN)\)|selectIsRecordingNow/)
  })
})
