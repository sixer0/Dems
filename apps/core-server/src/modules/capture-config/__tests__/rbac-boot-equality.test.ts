// The `rbac.matrix` boot equality against the SEEDED grants (blueprint row 52 / M2-W10; check
// M2-API-3 "rbac.matrix boot passes with D88 equality on the new permission rows"; the boot
// equality clause of M2-MT-7; decision D88; specs C-N9; register SH-04).
//
// HOW THE BOOT IS RUN WITH FAKES. The boot step of `modules/rbac` is exactly two calls on the
// guard (`modules/rbac/index.ts`): `checkRouter()`, then `reloadMatrix()`. This file builds the
// real app factory - every module, every stage, the real guard - with no PostgreSQL at all: the
// pool is a stand-in that answers the guard's ONE matrix statement with the rows the seed itself
// writes, produced by `rbacRows()` of `db/mapping`, the very function `db:seed` hands to
// `writeRbacRows`. The equality is therefore proven against the seeded grants at their source,
// not against a hand-typed copy. The live databases are never touched (row 54 is this turn's db
// runner); nothing here opens a connection.
//
// WHAT THE COMPARISON QUOTES. The stored grants as the boot read them, and the shared role table
// `ROLE_PERMISSIONS` the hosted simulator decides from - both as sorted `ROLE: PERMISSION` names,
// printed by the run and held equal member by member. The negative control then drops one of the
// TWO NEW grants (SUPERVISOR CAPTURE_CONFIG) and shows the same boot refusing with
// `STORED_GRANTS_MISMATCH` naming it: the equality genuinely bites on the new permission rows,
// which is what M2-API-3 asks.
import { ROLE_PERMISSIONS } from '@dems/shared/sim';
import { CORE_API_OPERATIONS, coreApiAccessPermissions } from '@dems/shared/api';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../../app';
import { rbacRows } from '../../../db/mapping';
import { AccessRuleErrorCode, READ_STORED_MATRIX, permissionGuard } from '../../../plugins/permission-guard';
import type { AccessRuleError } from '../../../plugins/permission-guard';
import { captureLog, unitTestConfig } from '../../../../test/support/config';
import { describe, expect, it } from 'vitest';

/** The three lists the seed writes, in the shape the guard's one statement returns them. */
function matrixAnswer(exclude?: { readonly role: string; readonly permission: string }): { rows: unknown[] } {
  const rows = rbacRows();
  const grants = rows.rolePermissions
    .filter((grant) => !(exclude !== undefined && grant.roleId === exclude.role && grant.permissionId === exclude.permission))
    .map((grant) => ({ role: grant.roleId, permission: grant.permissionId }));
  return {
    rows: [
      {
        roles: rows.roles.map((role) => role.id),
        permissions: rows.permissions.map((permission) => permission.id),
        grants,
      },
    ],
  };
}

interface Booted {
  readonly app: FastifyInstance;
  readonly queries: string[];
  close(): Promise<unknown>;
}

async function bootGuard(exclude?: { readonly role: string; readonly permission: string }): Promise<Booted> {
  const log = captureLog();
  const queries: string[] = [];
  const pool = {
    query(text: string) {
      queries.push(text);
      // The guard reads the matrix with ONE statement; anything else answers no row (unused here).
      return Promise.resolve(text.includes('public.role_permissions') ? matrixAnswer(exclude) : { rows: [] });
    },
    on() {
      return pool;
    },
    end: () => Promise.resolve(),
  };
  const app = buildApp({ config: unitTestConfig({ logLevel: 'silent' }), createPool: () => pool as never, logStream: log.stream });
  await app.ready();
  return { app, queries, close: () => app.close() };
}

const grantNames = (grants: readonly { role: string; permission: string }[]): string[] => grants.map((grant) => `${grant.role}: ${grant.permission}`).sort();
const sharedGrantNames = (): string[] =>
  Object.entries(ROLE_PERMISSIONS)
    .flatMap(([role, permissions]) => permissions.map((permission) => `${role}: ${permission}`))
    .sort();

describe('M2-API-3 / M2-MT-7: the rbac.matrix boot passes with D88 equality on the seeded grants', () => {
  it('the boot step body (checkRouter + reloadMatrix) passes on the rows the seed writes', async () => {
    const booted = await bootGuard();
    try {
      const guard = permissionGuard(booted.app);
      guard.checkRouter();
      const loaded = await guard.reloadMatrix();

      // One statement, the guard's own matrix read, nothing else asked of the pool.
      expect(booted.queries).toEqual([READ_STORED_MATRIX]);
      expect(loaded.roles).toEqual(['INVESTIGATOR', 'SUPERVISOR', 'TECHNICIAN']);
      expect(loaded.permissions).toHaveLength(14);
      expect(loaded.grants).toHaveLength(22);

      // THE COMPARISON, quoted for the artifact: stored grants vs the shared role table.
      const stored = grantNames(loaded.grants);
      const shared = sharedGrantNames();
      console.info(`[row52] rbac.matrix boot equality | stored=${stored.length} shared=${shared.length} equal=${String(JSON.stringify(stored) === JSON.stringify(shared))}`);
      console.info(`[row52] stored grants: ${stored.join(' | ')}`);
      expect(stored).toEqual(shared);
      // The two new grants are inside the equality (SH-04): the rows M2-API-3 names.
      expect(stored).toContain('SUPERVISOR: CAPTURE_CONFIG');
      expect(stored).toContain('TECHNICIAN: CAPTURE_CONFIG');
      expect(stored).toContain('INVESTIGATOR: TRANSCRIPT_REVISE');
      expect(stored).toContain('SUPERVISOR: TRANSCRIPT_REVISE');
      expect(guard.matrix()).not.toBeNull();
    } finally {
      await booted.close();
    }
  });

  it('negative control: dropping the new SUPERVISOR CAPTURE_CONFIG grant stops the SAME boot with STORED_GRANTS_MISMATCH naming it', async () => {
    const booted = await bootGuard({ role: 'SUPERVISOR', permission: 'CAPTURE_CONFIG' });
    try {
      const guard = permissionGuard(booted.app);
      guard.checkRouter();
      let refused: AccessRuleError | undefined;
      try {
        await guard.reloadMatrix();
      } catch (cause) {
        refused = cause as AccessRuleError;
      }
      expect(refused, 'the boot must refuse a seed that lost a new grant').toBeDefined();
      expect(refused?.problems.some((problem) => problem.code === AccessRuleErrorCode.STORED_GRANTS_MISMATCH && problem.detail === 'missing grant: SUPERVISOR CAPTURE_CONFIG')).toBe(true);
      // The last matrix that passed stays: nothing was loaded from the refusing read.
      expect(guard.matrix()).toBeNull();
    } finally {
      await booted.close();
    }
  });

  it('every permission the NEW operations name is in the seeded vocabulary (no PERMISSION_NOT_STORED when row 66 registers them)', async () => {
    const booted = await bootGuard();
    try {
      const guard = permissionGuard(booted.app);
      guard.checkRouter();
      const loaded = await guard.reloadMatrix();
      // The capture-config routes land with row 66 (this module mounts when `app.ts` registers it);
      // what the boot equality can already promise is that every permission those entries name -
      // and every permission of the routes that ARE registered - is one of the 14 stored.
      const newOperations = ['getCaptureConfig', 'getCaptureDevices', 'updateCaptureConfig', 'setCaptureCameraSource', 'setPrimaryMic', 'setCaptureDeviceCredential', 'switchAudioSource'];
      const named = new Set<string>();
      for (const operationId of newOperations) {
        const operation = CORE_API_OPERATIONS.find((candidate) => candidate.operationId === operationId);
        if (operation === undefined) throw new Error(`the registry has no ${operationId}`);
        for (const permission of coreApiAccessPermissions(operation.access)) named.add(permission);
      }
      expect([...named].sort()).toEqual(['CAPTURE_CONFIG', 'SESSION_START']);
      for (const permission of named) expect(loaded.permissions, permission).toContain(permission);
      // And the registered routes themselves: no problem found at any point of the boot.
      expect(guard.routeProblems()).toEqual([]);
    } finally {
      await booted.close();
    }
  });
});
