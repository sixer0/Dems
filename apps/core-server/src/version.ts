/**
 * Version of the DEMS Core server (masterplan/01_specs.md §10.2: "Server version 0.2.0").
 *
 * It is the value the health operation reports as `version` (AC-B-08) and it must stay equal to
 * the `version` field of this workspace's manifest; `version.test.ts` holds the two together.
 */
export const CORE_SERVER_VERSION = '0.2.0';
