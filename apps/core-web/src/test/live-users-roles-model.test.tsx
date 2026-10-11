/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Plan row W77: the pure rules of the Users & Roles page and the static rules of its folder
// (backend task 04_client_integration_spec §10.2; 02_plan section 8.1 CLG (c); gateway_check 08 §8
// rules 1, 3, 4; 08a §15).
//
// | Criterion | Where it is proven here |
// |-----------|-------------------------|
// | §10.2 "Gains" / "Loses" by the stored matrix, the last-administrator hint (RB-8: a hint only), the changed rows | "the model" |
// | PG-6a the answer of a command never re-creates a removed entry; the reason is trimmed, bounded, left out when empty | "the cache and the body" |
// | CLG (c) / AC-C-53 no `useSimActions` and no `.actions` read on a `Sim` in the folder's production files | "the folder's production files" |
// | Rule 1 no typed client, no second socket; rule 3 no key starts with `'core'` outside `CORE_QUERY_KEYS`; 08a §15 the reporter bound once to `usr`, no `console.*`, no reveal constant of its own | "the folder's production files" |
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { expectScanCovers } from './static-scan'
import { CORE_API_EXAMPLES, type AdminUser, type RoleMatrix } from '@dems/shared/api'
import { OperatorRole, Permission, ROLE_PERMISSIONS } from '@dems/shared/sim'
import { applyUserToCache, reasonBody } from '@/features/users-roles/commands'
import {
  administratorsOf,
  blockedRolesFor,
  changedRowIds,
  isLastAdministrator,
  matrixOf,
  permissionsOfRole,
  roleDiff,
  roleTone,
  rolesOf,
  summaryOf,
  usersOf,
} from '@/features/users-roles/model'
import { CORE_QUERY_KEYS } from '@/runtime'

const MATRIX = (CORE_API_EXAMPLES.getRoleMatrix!.responses[200] as Record<string, { value: RoleMatrix }>).seeded!.value
const USERS = (CORE_API_EXAMPLES.listUsers!.responses[200] as Record<string, { value: { users: AdminUser[] } }>).seeded!.value.users
const user = (id: string, change: Partial<AdminUser> = {}): AdminUser => ({ ...USERS.find((entry) => entry.id === id)!, ...change })

describe('the model', () => {
  it('the stored matrix gives each role its permissions, as the seeded table does (AC-B-17)', () => {
    for (const role of [OperatorRole.INVESTIGATOR, OperatorRole.SUPERVISOR, OperatorRole.TECHNICIAN]) {
      expect(new Set(permissionsOfRole(MATRIX, role))).toEqual(new Set(ROLE_PERMISSIONS[role]))
    }
  })

  it('"Gains" and "Loses" in the matrix\'s permission order; nothing for the same role', () => {
    expect(roleDiff(MATRIX, OperatorRole.TECHNICIAN, OperatorRole.INVESTIGATOR)).toEqual({
      // SH-04 (row 47): INVESTIGATOR gained TRANSCRIPT_REVISE and TECHNICIAN gained CAPTURE_CONFIG,
      // so this transition now carries those two in the matrix's permission order.
      gains: [Permission.SESSION_START, Permission.SESSION_NOTE, Permission.TRANSCRIPT_REVISE],
      loses: [Permission.DEVICE_MANAGE, Permission.MAINTENANCE, Permission.CAPTURE_CONFIG],
    })
    expect(roleDiff(MATRIX, OperatorRole.SUPERVISOR, OperatorRole.SUPERVISOR)).toEqual({ gains: [], loses: [] })
    expect(roleDiff(MATRIX, OperatorRole.SUPERVISOR, OperatorRole.INVESTIGATOR).loses).toContain(Permission.USER_ADMIN)
  })

  it('the last-administrator hint: only the one enabled holder of USER_ADMIN, by the matrix', () => {
    expect(administratorsOf(USERS, MATRIX).map((entry) => entry.id)).toEqual(['OPR-002'])
    expect(isLastAdministrator(user('OPR-002'), USERS, MATRIX)).toBe(true)
    expect(isLastAdministrator(user('OPR-001'), USERS, MATRIX)).toBe(false)
    expect(blockedRolesFor(user('OPR-002'), USERS, MATRIX)).toEqual(new Set([OperatorRole.INVESTIGATOR, OperatorRole.TECHNICIAN]))
    expect(blockedRolesFor(user('OPR-003'), USERS, MATRIX)).toEqual(new Set())
    // A second enabled holder lifts the hint; a DISABLED second holder does not count.
    const two = USERS.map((entry) => (entry.id === 'OPR-001' ? { ...entry, role: OperatorRole.SUPERVISOR } : entry))
    expect(isLastAdministrator(user('OPR-002'), two, MATRIX)).toBe(false)
    const disabledSecond = two.map((entry) => (entry.id === 'OPR-001' ? { ...entry, enabled: false } : entry))
    expect(isLastAdministrator(user('OPR-002'), disabledSecond, MATRIX)).toBe(true)
    // Without the matrix nothing is known and nothing is blocked: the server's 409 decides.
    expect(isLastAdministrator(user('OPR-002'), USERS, null)).toBe(false)
    expect(blockedRolesFor(user('OPR-002'), USERS, null)).toEqual(new Set())
    // The rule reads the STORED matrix, not a role name: USER_ADMIN granted to TECHNICIAN too.
    const wider: RoleMatrix = { ...MATRIX, grants: [...MATRIX.grants, { role: OperatorRole.TECHNICIAN, permission: Permission.USER_ADMIN }] }
    expect(isLastAdministrator(user('OPR-002'), USERS, wider)).toBe(false)
  })

  it('the changed rows: new rows and rows whose shown cells differ', () => {
    expect(changedRowIds(USERS, USERS)).toEqual([])
    expect(changedRowIds(USERS, USERS.map((entry) => (entry.id === 'OPR-003' ? { ...entry, activeSessions: 2 } : entry)))).toEqual(['OPR-003'])
    expect(changedRowIds(USERS.slice(0, 2), USERS)).toEqual(['OPR-003'])
  })

  it('the shape guards, the summary, the tones and the role order', () => {
    expect(usersOf({ users: USERS })).toHaveLength(3)
    expect(usersOf([{ id: 'OPR-001' }])).toEqual([])
    expect(usersOf(undefined)).toEqual([])
    expect(matrixOf({ roles: ['SUPERVISOR'] })).toBeNull()
    expect(matrixOf(MATRIX)).toBe(MATRIX)
    expect(summaryOf(USERS.map((entry) => (entry.id === 'OPR-001' ? { ...entry, enabled: false } : entry)))).toEqual({ users: 3, enabled: 2 })
    expect([roleTone(OperatorRole.SUPERVISOR), roleTone(OperatorRole.INVESTIGATOR), roleTone(OperatorRole.TECHNICIAN)]).toEqual(['accent', 'success', 'default'])
    expect(rolesOf(MATRIX)).toEqual(MATRIX.roles)
    expect(rolesOf(null)).toEqual([OperatorRole.INVESTIGATOR, OperatorRole.SUPERVISOR, OperatorRole.TECHNICIAN])
  })
})

describe('the cache and the body', () => {
  it('PG-6a: a command\'s answer replaces its row in an entry that exists, and creates none that the bridge removed', () => {
    const client = new QueryClient()
    applyUserToCache(client, user('OPR-003', { role: OperatorRole.INVESTIGATOR }))
    expect(client.getQueryData(CORE_QUERY_KEYS.users)).toBeUndefined()
    expect(client.getQueryCache().find({ queryKey: CORE_QUERY_KEYS.users })).toBeUndefined()

    client.setQueryData(CORE_QUERY_KEYS.users, { users: USERS })
    applyUserToCache(client, user('OPR-003', { role: OperatorRole.INVESTIGATOR }))
    const held = client.getQueryData<{ users: AdminUser[] }>(CORE_QUERY_KEYS.users)!
    expect(held.users.map((entry) => [entry.id, entry.role])).toEqual([
      ['OPR-001', 'INVESTIGATOR'],
      ['OPR-002', 'SUPERVISOR'],
      ['OPR-003', 'INVESTIGATOR'],
    ])
    client.clear()
  })

  it('the reason is trimmed, bounded to 500 and left out when empty', () => {
    expect(reasonBody('  Back from leave ')).toEqual({ reason: 'Back from leave' })
    expect(reasonBody('   ')).toEqual({})
    expect(reasonBody('x'.repeat(600)).reason).toHaveLength(500)
  })
})

describe('the folder\'s production files (CLG (c); rules 1, 3; 08a §15)', () => {
  const FOLDER = resolve(import.meta.dirname, '../features/users-roles')
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) return name === '__tests__' ? [] : walk(path)
      return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
    })
  /** The code without comments: a rule is about what runs. */
  const code = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
  /** The code without its quoted strings either (a translation key such as `common.actions.retry` is no read of `.actions`). */
  const bare = (text: string) => text.replace(/'(?:[^'\\\n]|\\.)*'/g, "''").replace(/"(?:[^"\\\n]|\\.)*"/g, '""').replace(/`(?:[^`\\]|\\.)*`/g, '``')
  const files = walk(FOLDER).map((path) => {
    const text = code(readFileSync(path, 'utf8'))
    return { name: path.slice(FOLDER.length + 1), text, bare: bare(text) }
  })

  it('reads the folder', () => {
    // Rule R1 (`static-scan.ts`): the scan equals an independent listing of the folder and is not empty.
    expectScanCovers({ scanned: files.map(({ name }) => name), listed: import.meta.glob('../features/users-roles/**/*.{ts,tsx}'), root: '../features/users-roles' })
  })

  it('CLG (c): no `useSimActions`, no `.actions` read on a `Sim`, no `SimContext`, no `useSimInstance`', () => {
    for (const { name, bare: text } of files) {
      expect(text, name).not.toMatch(/\buseSimActions\b/)
      expect(text, name).not.toMatch(/\.actions\b/)
      expect(text, name).not.toMatch(/\bSimContext\b/)
      expect(text, name).not.toMatch(/\buseSimInstance\b/)
    }
  })

  it('rule 1: no typed client and no socket of the page\'s own; operations only through `useWebLive()`\'s client', () => {
    for (const { name, text, bare: runs } of files) {
      expect(runs, name).not.toMatch(/\bcreateCoreClient\b|\bcreateLiveSim\b|\bnew WebSocket\b|\blive\.source\b/)
      // `@dems/shared/client` and `@dems/shared/live/source` are loaded as values by `runtime/live-start.ts` only: a type import is erased.
      for (const match of text.matchAll(/^import\s+(type\s+)?[^\n]*?from\s+'(@dems\/shared\/client|@dems\/shared\/live\/source)'/gm)) expect(match[1], `${name}: ${match[0]}`).toBe('type ')
    }
    const calls = files.flatMap(({ text }) => [...text.matchAll(/client\.call\('([A-Za-z]+)'/g)].map((match) => match[1]))
    // FXR-W W92-8 (by design): operation 10's key is shared with Security & Audit, so its one call lives in
    // `lib/core-queries.ts`; the page reads it through `roleMatrixQueryOptions`.
    expect(calls.sort()).toEqual(['assignUserRole', 'disableUser', 'enableUser', 'listUsers'])
    expect(files.find(({ name }) => name === 'queries.ts')?.text).toMatch(/useQuery\(roleMatrixQueryOptions\(useRoleMatrixGate\(\), allowed\)\)/)
  })

  it('rule 3: every query key is one of `CORE_QUERY_KEYS`; no literal key starts with `\'core\'`', () => {
    for (const { name, text } of files) {
      expect(text, name).not.toMatch(/queryKey:\s*\[/)
      expect(text, name).not.toMatch(/\[\s*['"]core['"]/)
    }
  })

  it('08a §15: the reporter is bound once to `usr`; no `console.*`; no reveal constant or press guard of the page\'s own', () => {
    const all = files.map(({ text }) => text).join('\n')
    expect(all.match(/createPageReporter\(/g)).toHaveLength(1)
    expect(files.find(({ name }) => name === 'report.ts')!.text).toContain("createPageReporter('usr')")
    expect(all).not.toMatch(/\bconsole\./)
    expect(all).not.toMatch(/LIVE_PENDING_REVEAL_MS/)
    expect(all).toMatch(/usePendingControl\(\)/)
    // The busy mark goes on the pressed kit Button (`ref` of the hook), never as an `aria-busy` prop of a Button.
    expect(all).not.toMatch(/<Button[^>]*aria-busy/)
  })
})
