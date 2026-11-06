/**
 * The closing notes of the two asset READMEs (task 3 row 96, register DOC-04; finding R96-1, closed
 * by row 97). The READMEs are generator outputs: `readmeText` of `gen-demo-evidence.ts` and of
 * `gen-demo-media.ts` ends with these texts, so a regeneration keeps them. They state facts of the
 * repository, not of one generator run: no argument, no date of the run.
 *
 * `packages/shared/test/demo-evidence.test.ts` holds each committed README to its note, and each
 * generator to the line that appends it.
 */

/** Appended to `assets/demo-evidence/README.md`. Begins with the blank line before its heading. */
export const DEMO_EVIDENCE_README_NOTE = `
## Note on packages of schema version 2 (task 3 row 96, register DOC-04)

This section is written by \`gen-demo-evidence.ts\` (the text is in \`packages/shared/scripts/demo-readme-notes.ts\`, task 3 row 97, finding R96-1): a regeneration keeps it. Everything above is unchanged and still describes this folder exactly.

- **This folder holds version-1 packages only**: the 14 packages listed above, with \`manifest.json\`, whole-file hashes of four track files and the published DEMO key. They are the evidence of Simulated mode and of the 0.1.0 packages in \`release/\`. The real-capture task did not change them.
- **Version-2 demo packages are never stored here or anywhere in git.** A Core server in development capture seals two of them at seed time (\`db:seed\`, \`db:reset\`) from generated sources, with the development signing key, into its own media store (\`<media store>/SESSION-<sessionId>/\`). One verifies with all 15 checks passing; the other has one fragment altered after the seal and verify names exactly that fragment (\`VIDEO-02\`, fragment 3). Without the helper program the seed writes the dataset without them and says \`NOT generated (HELPER_ABSENT)\`.
- **What a version-2 package is** (\`packages/shared/src/evidence-package/layout.ts\`):

| File | Content |
|---|---|
| \`session-manifest.json\` | The signed manifest, schema \`dems.evidence-manifest/2\` |
| \`signature.sig\`, \`device-certificate.pem\` | The detached signature and the certificate of the Core's signing key. A development key is marked as such in its certificate |
| \`fragments/VIDEO-01.mp4\`, \`fragments/VIDEO-02.mp4\` | The camera files, one or two. The init segment is clear; every fragment is one AES-256-GCM message. The session audio (\`AUDIO-01\`) is a track inside the camera files, not a file of its own |
| \`fragments/fragments.json\` | Per fragment: offsets, hashes of the stored bytes and of the plaintext, the hash chain, IV, tag and key ID |
| \`transcript/transcript.json\`, \`.srt\`, \`.vtt\`, \`transcript-revisions.json\` | Only when a transcript was sealed. Revisions are appended; the sealed transcript never changes |
| \`audit-session-extract.jsonl\` | The session's audit rows. Declared, but NOT covered by the package signature: verify says so on every version-2 package |
| \`export/\` | Only once exported: \`EXP-<id>.zip\` (decrypted), the manifest and signature of each export |

- Differences a reader of this folder should know: version 1 has four track files and one tampered audio file (\`track:AUDIO-02\`); version 2 has one or two camera files with the audio inside, is encrypted per fragment, and its tamper demonstration fails one named fragment. Verify of version 2 has 15 checks.
- More: the repository \`README.md\`, section "Real capture, sealing and transcript"; the specification \`docs/2026-10-07_dems_real_capture_sealing/masterplan/06_evidence_package_spec.md\`.
- Correction (2026-10-10, fix wave H; erratum PE-WH-09 of \`06_evidence_package_spec.md\` §G.1; decision D205): the row \`export/\` above says "\`EXP-<id>.zip\` (decrypted), the manifest and signature of each export". Since wave H an export is ONE self-contained archive: its export manifest and signature are the last two entries INSIDE \`EXP-<id>.zip\` (\`export/EXP-<id>.manifest.json\`, \`.sig\`); only an export written before wave H has them beside the archive. A receiver checks a downloaded archive with \`npm run evidence:verify-export -- <archive.zip>\` (root \`package.json\`, script \`evidence:verify-export\`). Like the rest of this section, this line is hand-written and a regeneration removes it (review item R96-1, open: the generator's README text does not carry it).
`;

/** Appended to `assets/demo-media/README.md`. Begins with the blank line before its heading. */
export const DEMO_MEDIA_README_NOTE = `
## Note on real capture and version-2 packages (task 3 row 96, register DOC-04)

This section is written by \`gen-demo-media.ts\` (the text is in \`packages/shared/scripts/demo-readme-notes.ts\`, task 3 row 97, finding R96-1): a regeneration keeps it. Everything above is unchanged and still describes this folder exactly.

- The media here are the demo pictures and voices of Simulated mode and of the version-1 demo evidence packages (\`../demo-evidence/\`): four separate track files per item (\`VIDEO-01\`, \`VIDEO-02\`, \`AUDIO-01\` = MIC 1, \`AUDIO-02\` = MIC 2). The real-capture task did not change them.
- **A real recording does not use this layout.** The capture worker writes one file per camera with the ONE session audio track (\`AUDIO-01\`) inside it; \`AUDIO-02\` exists in the version-1 demo data only. The two microphone inputs are \`MIC-01\` and \`MIC-02\` (primary and standby), and which one feeds the session audio at a given time is recorded as intervals.
- **None of these files is used by a version-2 demo package.** The two version-2 demo packages of a development-capture Core are recorded at seed time from generated test sources (a test picture and generated audio) by the Core's helper program, and are sealed into that Core's media store. They are never stored in this folder or in git.
- In Live mode the camera picture shown by the clients is still the demo loop of \`live/\`; there is no live preview of a real camera in this phase.
- More: the repository \`README.md\`, section "Real capture, sealing and transcript".
- Correction (2026-10-10, fix waves H and I; errata PE-WH-12 and PE-WI-17 of \`08_client_ux_spec.md\` §8f.2; decisions D196, D206, D210, D217): the sentence above "In Live mode the camera picture shown by the clients is still the demo loop of \`live/\`" holds for a Core in SIMULATED capture only. Connected to a Core in real capture the clients show a neutral "No preview" tile or thumb in the place of these pictures (camera tiles, session rows, Home "Recent Sessions"); there is still no live preview of a real camera. Like the rest of this section, this line is hand-written and a regeneration removes it (review item R96-1, open: the generator's README text does not carry it).
`;
