/**
 * Test support of the permission guard (plan row W28; decision D85; not a test file).
 *
 * IMPORT THIS FILE FIRST in a test file whose app must not depend on which domain modules have
 * landed:
 *
 *     import './without-domain-modules';          // before anything that imports `app.ts`
 *
 * The real app factory then registers the eleven domain modules and the realtime channel as
 * units that add NO route: each keeps its place, its name and every other export, and provides
 * the seam it owns with the scaffold's "nothing there" answer (`deviceResolver`: no device is
 * known; `publish`: nobody is connected). Everything the guard is built on stays real: the core,
 * the four stage plugins, the engine, and the modules `health`, `identity` and `rbac`.
 *
 * Why. A test of the guard calls operations of every kind and gives them stand-in handlers. On
 * the real app a stand-in collides with the module that owns the operation as soon as that
 * module lands, and a real handler does what its module does. Without the domain modules the
 * app under test is the same on every day of the build, and a stand-in is never registered
 * beside a real route (rule M10).
 *
 * What it is not for: a test that asks what the server REALLY registers. That one builds the
 * real app and reads `permissionGuard(app).registeredRules()` (`registered-routes.test.ts`).
 *
 * How. `vi.mock` is hoisted to the top of THIS file and runs when the file is evaluated; a mock
 * holds for every later import of that module in the test file's module graph, so the import
 * order above is what makes it work. Each mock keeps the module's other exports
 * (`importOriginal`), so code that imports a helper from a module's index still finds it; if a
 * module's file cannot be loaded at that moment (a row is writing it), the stub alone is used.
 */
import type { FastifyInstance } from 'fastify';
import { vi } from 'vitest';

const stubs = vi.hoisted(() => {
  /** The module's other exports, or nothing when its file cannot be loaded right now. */
  const others = async (importOriginal: () => Promise<unknown>): Promise<Record<string, unknown>> => {
    try {
      return (await importOriginal()) as Record<string, unknown>;
    } catch {
      return {};
    }
  };
  /** A unit that registers nothing. */
  const routeless = async (): Promise<void> => {};
  return {
    /** A module that owns no seam: its unit under `exportName` adds nothing. */
    module: (exportName: string) => async (importOriginal: () => Promise<unknown>) => ({ ...(await others(importOriginal)), [exportName]: routeless }),
    /** The pairing module: no route, and the seam `deviceResolver` as the scaffold's stub gave it. */
    pairing: async (importOriginal: () => Promise<unknown>) => ({
      ...(await others(importOriginal)),
      pairingModule: async (app: FastifyInstance): Promise<void> => {
        app.seams.provide('deviceResolver', { resolveCredential: async () => null, resolveDevice: async () => null, deviceState: async () => null });
      },
    }),
    /** The realtime channel: no socket route, and the seam `publish` as the scaffold's stub gave it. */
    realtime: async (importOriginal: () => Promise<unknown>) => ({
      ...(await others(importOriginal)),
      realtimePlugin: async (app: FastifyInstance): Promise<void> => {
        app.seams.provide('publish', () => {});
      },
    }),
  };
});

vi.mock('../../../modules/admin', stubs.module('adminModule'));
vi.mock('../../../modules/alerts', stubs.module('alertsModule'));
vi.mock('../../../modules/demo', stubs.module('demoModule'));
vi.mock('../../../modules/devices', stubs.module('devicesModule'));
vi.mock('../../../modules/evidence', stubs.module('evidenceModule'));
vi.mock('../../../modules/network-time', stubs.module('networkTimeModule'));
vi.mock('../../../modules/pairing', stubs.pairing);
vi.mock('../../../modules/security-audit', stubs.module('securityAuditModule'));
vi.mock('../../../modules/sessions', stubs.module('sessionsModule'));
vi.mock('../../../modules/storage', stubs.module('storageModule'));
vi.mock('../../../modules/system', stubs.module('systemModule'));
vi.mock('../../../realtime', stubs.realtime);

/** The units this file takes the routes from, as `app.ts` names them. */
export const ROUTELESS_UNITS = [
  'modules/admin',
  'modules/alerts',
  'modules/demo',
  'modules/devices',
  'modules/evidence',
  'modules/network-time',
  'modules/pairing',
  'modules/security-audit',
  'modules/sessions',
  'modules/storage',
  'modules/system',
  'realtime',
] as const;

/** The units that register routes in an app built with this file: the guard's own module and the rows it depends on. */
export const REAL_ROUTE_UNITS = ['modules/health', 'modules/identity', 'modules/rbac'] as const;
