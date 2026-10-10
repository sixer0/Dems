/**
 * Test support of the permission guard (plan row W28; decision D85; not a test file).
 *
 * IMPORT THIS FILE FIRST in a test file whose app must not depend on which domain modules have
 * landed:
 *
 *     import './without-domain-modules';          // before anything that imports `app.ts`
 *
 * The real app factory then registers the twelve domain modules (the eleven of the backend task and
 * the STT configuration module of task 3 row 113) and the realtime channel as
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
// Task 3: the capture selector (operations 76 to 80, row 66), the camera search (93 and 94, row 132)
// and the local inputs (97, row 133) are domain modules too (decision D114 registers the last two).
vi.mock('../../../modules/capture-config', stubs.module('captureConfigModule'));
vi.mock('../../../modules/capture-discovery', stubs.module('captureDiscoveryModule'));
vi.mock('../../../modules/capture-inputs', stubs.module('captureInputsModule'));
vi.mock('../../../modules/demo', stubs.module('demoModule'));
vi.mock('../../../modules/devices', stubs.module('devicesModule'));
vi.mock('../../../modules/evidence', stubs.module('evidenceModule'));
// Task 3 M8, blueprint row 91 (ruling D143): the evidence-export module (operation 87) is a domain module too.
vi.mock('../../../modules/evidence-export', stubs.module('evidenceExportModule'));
// Task 3 M8, blueprint row 90 (ruling D140): the media-stream module (operation 88 and the evidence media route) is a domain module too.
vi.mock('../../../modules/media-stream', stubs.module('mediaStreamModule'));
vi.mock('../../../modules/network-time', stubs.module('networkTimeModule'));
vi.mock('../../../modules/pairing', stubs.pairing);
// Task 3 M7, blueprint row 82b (ruling D147): the sealing module (operation 83 and the mount of the sealing composition) is a domain module too.
vi.mock('../../../modules/sealing', stubs.module('sealingModule'));
vi.mock('../../../modules/security-audit', stubs.module('securityAuditModule'));
vi.mock('../../../modules/sessions', stubs.module('sessionsModule'));
vi.mock('../../../modules/storage', stubs.module('storageModule'));
// Task 3 M6, blueprint row 113: the STT configuration module (operations 90 to 92) is a domain module too.
vi.mock('../../../modules/stt-config', stubs.module('sttConfigModule'));
vi.mock('../../../modules/system', stubs.module('systemModule'));
// Task 3 integration pass D4 (decision D146): the transcripts module (operations 84 to 86) is a domain module too.
vi.mock('../../../modules/transcripts', stubs.module('transcriptsModule'));
vi.mock('../../../realtime', stubs.realtime);

/** The units this file takes the routes from, as `app.ts` names them. */
export const ROUTELESS_UNITS = [
  'modules/admin',
  'modules/alerts',
  'modules/capture-config',
  'modules/capture-discovery',
  'modules/capture-inputs',
  'modules/demo',
  'modules/devices',
  'modules/evidence',
  'modules/evidence-export',
  'modules/media-stream',
  'modules/network-time',
  'modules/pairing',
  'modules/sealing',
  'modules/security-audit',
  'modules/sessions',
  'modules/storage',
  'modules/stt-config',
  'modules/system',
  'modules/transcripts',
  'realtime',
] as const;

/** The units that register routes in an app built with this file: the guard's own module and the rows it depends on. */
export const REAL_ROUTE_UNITS = ['modules/health', 'modules/identity', 'modules/rbac'] as const;
