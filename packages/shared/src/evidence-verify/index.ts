/**
 * Verify v2 (blueprint row 85 / M7-W4; evidence package spec §D): the checks V-01 to V-14, and V-15
 * (row 141: the development-source mark), over one sealed `dems.evidence-manifest/2` package, as
 * pure logic behind ports. `report.ts` words a result as lines, the source line first.
 *
 * WHY IT IS HERE AND NOT IN THE CORE. A package is verified in more than one place: by the Core
 * (operation 41) and by whoever receives a copy (spec §G.2, OD-16). The rules must be one piece of
 * code, so they live beside the package format (`../evidence-package`), platform neutral: zod and
 * `@noble/hashes` only, no file, no key, no clock. The Core supplies the file system, the
 * certificate parser, Ed25519 and the fragment opener (`apps/core-server/src/evidence-verify`).
 *
 * The v1 packages (`dems.evidence-manifest/1`, `../demo-data/verify.ts`) are verified by their own
 * verifier; this one answers `MANIFEST_VERSION_UNSUPPORTED` for them and touches nothing of v1.
 */
export * from './report';
export * from './revisions';
export * from './types';
export * from './verify';
