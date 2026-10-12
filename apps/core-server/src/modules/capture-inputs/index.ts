/**
 * Capture-inputs module (task 3 blueprint row 133; contract C3 §2.6 operation 97; specs R-10 AC-2,
 * AC-4; decision D80(5); UX flow 13 "Search again" on a microphone).
 *
 * WHAT THIS MODULE OWNS: the live path of operation 97 `rescanCaptureInputs` (`routes.ts`) - the
 * re-read of the local microphone inputs, its spacing limit and its one audit row.
 *
 * WHAT IT DOES NOT OWN. The contract of the operation (registry entry, schema, simulator answer,
 * OpenAPI, count pins) is row 132's (decision D106). The alerts of the no-device situations, the
 * reachability probe and the pre-check gate are the closed unit `src/capture-notices`, which this
 * module reaches through `captureNotices(app)`; the adapters behind the probe are provided by the
 * wiring of rows 71 / 136 (`captureNotices(app).provideProbe`).
 *
 * REGISTRATION. `app.ts` is frozen (P25) and this row's text names no waiver, so the plugin is
 * NOT in the unit list yet: the request is in `delegation_progress/file_requests.md`. Its tests
 * register it on the app they build.
 *
 * The plugin function opens no database connection, no socket and no process, and registers no
 * boot step, no hook of its own and no seam: `buildApp()` works without PostgreSQL. It makes the
 * boot registration of the notices unit (`registerCaptureNotices`, integration pass D8).
 */
import type { FastifyPluginAsync } from 'fastify';
import { captureNotices, registerCaptureNotices } from '../../capture-notices';
import { captureAudioCardsModule } from './audio-cards';
import { registerCaptureInputsRoutes } from './routes';

export { CAPTURE_INPUTS_MODULE_OPERATIONS, CAPTURE_INPUTS_UNIT_LABEL, captureInputsOperation, type CaptureInputsModuleOperation, type CaptureInputsRouteSeams } from './routes';

/**
 * The ID of a re-read for its audit row: `DSC-` and the Core clock in milliseconds. Thirteen
 * digits, so it fits the search-ID pattern and can never equal an ID of the discovery module's
 * six-digit counter; two re-reads are at least the spacing limit apart, so it is unique.
 */
export const rescanSearchId = (now: number): string => `DSC-${String(Math.trunc(now)).padStart(13, '0')}`;

export const captureInputsModule: FastifyPluginAsync = async (app) => {
  // The boot registration of the notices unit (integration pass D8): its session-start listener is attached when the app is ready.
  registerCaptureNotices(app);
  registerCaptureInputsRoutes(app, { notices: () => captureNotices(app), nextSearchId: rescanSearchId });
  // Task 4, blueprint row 70 (WP-07c): the two sound-card operations 98 and 99 are the other half of the
  // microphone inputs. Their folder (`./audio-cards`, as `capture-discovery/connect`) is mounted here, at the same
  // root scope: the unit list of `app.ts` is frozen (static rule P25) and a module imports no other module (rule 5
  // of `test/static/imports.test.ts`). One call, no option; nothing else of it is used here.
  await captureAudioCardsModule(app, {});
};
