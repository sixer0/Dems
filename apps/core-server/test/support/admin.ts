/**
 * Test support of the administration module (plan row W33; not a test file): the URLs of
 * operations 11 to 14, which tests of other rows call too (a disable or a role change as a step
 * of their own scenario).
 *
 * NEUTRAL TEST SUPPORT (fix round B1, review finding CPB1-12). These four names moved here from
 * `src/modules/admin/__tests__/support.ts`, which re-exports them and keeps what only the
 * administration row's own tests use (its app, its recording pool, its readers of `operators`).
 */
export const USERS = '/api/v1/admin/users';
export const roleUrl = (operatorId: string): string => `${USERS}/${operatorId}/role`;
export const enableUrl = (operatorId: string): string => `${USERS}/${operatorId}/enable`;
export const disableUrl = (operatorId: string): string => `${USERS}/${operatorId}/disable`;
