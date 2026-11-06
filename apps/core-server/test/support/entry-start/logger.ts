/**
 * Task 4 row 89 (caution C-8 of review 086): THE LOGGER MODULE OF A TEST START OF `src/index.ts`, in the place of
 * `src/plugins/logger` for the entry file only (`hooks.mjs`): everything the product's module exports, with ONE value
 * replaced - the path of the error log, which the test names (a file below the fixture's temporary directory), so that
 * the started Core writes nothing into `apps/core-server/logs/`.
 */
export * from '../../../src/plugins/logger';

const named = process.env['ROW89_ENTRY_ERROR_LOG'];
if (named === undefined || !named.startsWith('/')) throw new Error('the test start of the entry names no absolute error-log path');

/** The error log of the started Core: the test's temporary file. */
export const DEFAULT_ERROR_LOG_FILE: string = named;
