/**
 * Self-check support: the fixture folder that stands for `apps/core-server` in the self-check
 * project `convention`. It holds one hook module per standard template, at the conventional
 * places (`../hooks.ts`), so that a whole Vitest run shows the plug-in points working: the
 * global setup imports the schema and seed hooks in the main process, and a test file's worker
 * imports the bulk hook at its first request.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const CONVENTION_WORKSPACE = join(dirname(fileURLToPath(import.meta.url)), 'convention-workspace');
