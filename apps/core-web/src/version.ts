/**
 * THE ONE PLACE the web console states its OWN build version (fix wave J round two, finding JW-26;
 * `contract_wave_j.md` J2-S 2, row "web console"). It equals `version` of this workspace's
 * `package.json`; `src/version.test.ts` holds the two equal, as the Core server holds its own
 * (`apps/core-server/src/version.ts`). It is the console's version and nothing else: the Core server,
 * the capture worker and the API contract each state theirs through operation 64 `components`.
 */
export const WEB_CONSOLE_VERSION = '0.1.0'
