---
task_id: 2026-10-07_dems_real_capture_sealing
row: 84
date: 2026-10-09
agent: coder-execution
status: needs-review (parts 1-3 built and tested; M7-TP-1, M7-VV-SRV and the op-96 half of M7-CONN-CRED-1 wait for rows 59, 82, 85, 142)
---

# Row 84 — Core credential store, credential sealer, per-fragment AES-256-GCM (M7-W3)

Paths are relative to `apps/core-server/`. Node's built-in `crypto` only; no new dependency; no
lockfile write; no edit of `app.ts`, `index.ts`, `config.ts`, `src/db/**`, `apps/transcriber/**`.

## 1. What was built

| Piece | Where | Real / stand-in |
|---|---|---|
| Key files (the only file-system code of the unit) | `src/credential-store/key-store.ts:120` (`createFileKeyStore`), `:169` write-once + fsync, `:199` private-file read, `:279` destroy | real |
| Opaque key material (prints as `[key]`, bytes read by one function) | `src/credential-store/key-material.ts` | real |
| Credential envelope v1 (frame + padding + AAD) | `src/credential-store/envelope.ts:77` (`frameOf`), `:99` (`sealSecret`), `:131` (`openSecret`) | real |
| The store and its seams | `src/credential-store/index.ts:159` (`createCredentialStore`), `:270` (`coreCredentialStore(app)`), interfaces `:92`-`:135` | real |
| Per-fragment AES-256-GCM, pure | `src/credential-store/fragment-cipher.ts:106` (`fragmentAad`), `:135` (`createFragmentSealer`), `:171` (`openFragment`), `:220` (`planRangeRead`), `:260` (`readDecryptedRange`) | real cipher; fed by typed synthetic inputs only (no fMP4 writer yet) |
| STT wiring (operation 91) | `src/modules/stt-config/index.ts:238` (`onReady`: takes the sealer from the store), `:276`, `:171`; header text in `seams.ts` | real |
| Closed-unit pin | `test/static/imports.test.ts:62` — ONE added entry `'src/credential-store'` (+ comment) | — |

**Store.** `<dataDir>/credential-store/keys/<reference>.key`, directories 0700, files 0600,
`O_EXCL|O_NOFOLLOW`, fsync before the reference is handed out; a read refuses a link, a file
others may read, another owner, another size or a missing format mark. Under the git-ignored
`/.data/`. Not the OS keychain (would need a child process or a native module — both forbidden
here). The folders are made with the first key, never at start, and the data directory itself is
never made. Nothing in the unit logs; a failure is a code (`CredentialStoreError`), with at most an
`errno` name.

**Envelope (versioned AEAD).** Stored: `key_ref` (CODE, e.g. `STT_API_KEY_K_<20 hex>`), `nonce`
(12 random bytes), `secret_ciphertext` = AES-256-GCM(frame) ‖ 16-byte tag. Frame = version byte 1 ‖
u16 length ‖ UTF-8 secret ‖ zero padding to a multiple of 64. Every ciphertext is **>= 80 bytes**
(F-122-2: the 33-byte CHECK holds for a one-character secret; length hidden to 64-byte steps).
AAD = `dems.credential-envelope/1 ‖ purpose ‖ subject ‖ keyRef` (subject = device ID for a camera,
`stt_config` for STT): an envelope moved to another row, purpose or key reference does not open.
Opening fails closed with one code (`CREDENTIAL_OPEN_FAILED`); a missing key is
`CREDENTIAL_KEY_NOT_FOUND`.

**One key per credential; rotation hook.** Every `seal` makes a new key and a new reference, so
writing a credential again is its rotation. The replaced key stays until
`store.credentialKeys.retainOnly(purpose, storedRefs)` is called by the unit that can read the
stored references (the reveal side — rows 115 / 142). Not called by anything yet: until then
replaced and never-committed keys accumulate (40 bytes each).

**STT wiring.** When the app is ready the module asks `coreCredentialStore(app)`. `READY`: a
`SECRET` write answers 200 with `credentialKind: ENCRYPTED`. `ABSENT` (no data directory — every
in-process test app): 503 `CREDENTIAL_STORE_NOT_READY` as before. `UNAVAILABLE` (store directory
not private): the same 503, plus one error line and one persistent error-log entry by code.
`provideCredentialSealer` is kept and wins over the store (existing tests unchanged). The module
still never names the reveal function; `STT_REVEAL_CALLERS` is still empty.

## 2. Interfaces for other rows

| For | Call | Notes |
|---|---|---|
| Row 115 (transcriber key-loader; `apps/transcriber` not edited) | `store.stt.open({ keyRef, ciphertext, nonce }) => string` — synchronous, memory only, throws `CredentialStoreError` | The key-loader should take `openEncrypted?: (sealed: { keyRef: string; ciphertext: Uint8Array; nonce: Uint8Array }) => string`; absent = `ENCRYPTED` unavailable. Row 115 reads the three columns through `dems_stt_credential_reveal()` in its ONE file (added to `STT_REVEAL_CALLERS`) and to `CREDENTIAL_STORE_USERS` |
| Rows 142 / 66 (operations 89, 96) | `store.capture.seal(deviceId, secret)`, `store.capture.open(deviceId, sealed)` | Answer 503 `CREDENTIAL_STORE_NOT_READY` when `coreCredentialStore(app).status !== 'READY'`. Username is the clear column, not sealed, not bound |
| Rows 59 / 82 (writer, sealing) | `store.sessionKeys.create(sessionId)` -> `{ keyId: 'KID-<sessionId>', key }`; `createFragmentSealer(key).seal({ trackId, seq, byteOffset }, plaintext)` -> `{ ciphertext, gcmIv, gcmTag, keyId }` | ciphertext length = plaintext length, so offsets do not move; iv/tag/keyId go into the fragment record |
| Rows 85 / 87 (verify V-05, export, Range) | `openFragment(key, record, stored)`, `planRangeRead(records, { start, end })`, `readDecryptedRange({ sessionKey, records, range, read })`; `fragmentAad(position)` is THE canonical AAD encoding | A range decrypts whole fragments; tags are verified before any byte is returned |
| Row 83 signer, wired by row 82 (request 09:38:38Z) | `store.keyWrapSecrets` — `get(keyId): Uint8Array \| null`, `put(keyId, secret): void` (refuses a second `put`: `CREDENTIAL_KEY_EXISTS`) | Satisfies `KeyWrapSecrets` of `src/capture/signer/types.ts` (type-checked in `store.test.ts`); file `keys/WRAP-<keyId>.blob`, 0600; `capture/signer/**` not edited. Row 82 passes it in the place of `fileWrapSecrets(dir)` |
| Any other unit | `store.namedSecrets.put(name, bytes)` / `.use(name, fn)` / `.has(name)` | Named blob <= 4096 bytes, private file, written once; the copy handed to `fn` is overwritten afterwards |
| Retention / deletion | `store.sessionKeys.destroy(keyId)` | The caller audits the fact; no audit type is written here |

Every new importer adds its one file to `CREDENTIAL_STORE_USERS` in
`src/credential-store/__tests__/static.test.ts`.

**AAD encoding (SEC35-10).** `"dems.fragment-aad/1" 00 | u16 len, trackId | u64 seq | u64
byteOffset | u16 len, keyId`, big endian. Derived, never stored. Pinned by a byte-exact test.

**Open design point for row 59.** Spec §D.1 says both "each fragment's stored byte range is one GCM
message" and "moof/trun stay clear". The module seals whatever range it is handed and
authenticates the record's `byteOffset`; `planRangeRead` serves bytes outside sealed ranges as
stored. Which bytes are the sealed range is the writer's decision.

## 3. Commands and results

| Command | Result |
|---|---|
| `npx vitest run --root apps/core-server --project unit src/modules/stt-config src/credential-store test/static/{imports,credentials,log-calls,logging,network,scaffold,test-support-imports}.test.ts` (outside the sandbox: loopback listeners) | 12 files passed, 1 failed; 244 tests passed, 1 failed. The failure is `test/static/credentials.test.ts` "starts no child process but the capture worker": it names `src/capture/adapters/local/process-door.ts` (row 134), not this row |
| of which: `src/credential-store` (3 files; re-run after the key-wrap adapter was added) | 58 passed |
| of which: `stt-config/__tests__/credential-store.test.ts` | 8 passed; the canary is asserted at 0 hits in responses, logs (level `trace`), error log, audit rows, events, the stored row and the key file, plain and base64 (the runner does not print the report line of a passing test) |
| `/usr/bin/lockf -k .locks/db-migrate.lock npx vitest run --root apps/core-server --project db src/modules/stt-config/__tests__/credential-store.db.test.ts src/modules/stt-config/__tests__/stt-config.db.test.ts` | 2 files, 14 tests passed (6 new + the 8 existing, unchanged); throw-away clones, 0 remain |
| `npx vitest run --root packages/shared test/api-stt-config.test.ts` (simulator, unchanged) | 43 passed |
| `test/static/imports.test.ts` | `src/credential-store` is closed and passes; at the last run the file is red for `src/sealing` (another row's new folder listed as an open unit), not this row |
| `npx tsc --noEmit -p apps/core-server` | 0 errors in this row's files. Red elsewhere: `src/capture/adapters/local/{camera,mic}-helper-args.ts` TS1294 (row 134); `packages/shared/src/api/sim-actions.ts:98`, `src/live/source/bindings.ts:264` (missing `setCaptureConfig`, `switchAudioSource`; another row) |
| `npm run lint -w apps/core-server` | no finding in this row's files |
| `src/capture/__tests__/static.test.ts` | 2 failed, both naming `src/capture/adapters/local/*` (row 134) |

What the tests show (each has a negative or positive control): round trip; any flipped byte of
ciphertext, tag or nonce fails; wrong key, other purpose, other device, other key reference fail
closed; one-character secret -> 80 bytes, while the bare 17-byte cipher is refused `23514` by
PostgreSQL; `dems_app` gets `42501` on both credential tables (owner read as control); key loss ->
`KEY_NOT_FOUND`; H-2 on synthetic ranges — a flipped bit in fragment k of 5 fails exactly
`(VIDEO-01, k)`; a relocated ciphertext with its own iv/tag fails; other seq / offset / track /
keyId fail; 2000 seals -> 2000 nonces; a repeating random source encrypts nothing the second time;
8 byte ranges decrypt to the plaintext reading whole fragments only.

The live `.data/` directory was not written: `.data/credential-store` does not exist after the runs.

## 4. Not proven here

- **M7-TP-1, M7-VV-SRV**: need the verifier (row 85) and real fragments (rows 59, 82). H-2 is
  shown for the cipher on synthetic ranges, not on an fMP4.
- **M7-CONN-CRED-1**: the sealer part only (one-character secret stored, 42501, canary sweep). Op
  96 answering 201 and op 89 answering 200 need rows 142 / 66.
- "The key-loader opens it": the opener opens exactly what the table holds; the key-loader mount is row 115.
- No booted listener was exercised (`index.ts` path); the 200 is on the app factory booted as the
  entry point boots it, in-process.

## 5. To wire when rows land

- 115: opener into the key-loader; `retainOnly('STT_API_KEY', [storedRef])` after a successful reveal.
- 142 / 66: `store.capture` behind ops 89 / 96; `retainOnly('CAPTURE_DEVICE', refs)`.
- 59 / 82: session key at RECORDING start; sealer per session; iv/tag/keyId into `recording_fragments` / manifest.
- 85 / 87: `openFragment` for V-05 / export; `readDecryptedRange` for Range.
- 82: `store.keyWrapSecrets` handed to the signer at composition (adds its file to `CREDENTIAL_STORE_USERS`).
- Retention: `sessionKeys.destroy` + an audit fact (no audit type exists for it in the contract yet).

## 6. Findings and decisions

| ID | Finding / decision |
|---|---|
| F-84-1 | **`dems_app` cannot replace a stored camera credential.** With INSERT + column UPDATE and no SELECT, `UPDATE … WHERE device_id`, `ON CONFLICT (device_id) DO UPDATE` and `ON CONFLICT ON CONSTRAINT …_pkey DO UPDATE` all answer `42501` (measured in `credential-store.db.test.ts`). The first INSERT works. Filed in `delegation_progress/file_requests.md`. **Wanted (a migration decision for the database owner, not edited here):** `GRANT SELECT (device_id) ON public.capture_device_credentials TO dems_app;` — then op 89 sends `INSERT … ON CONFLICT (device_id) DO UPDATE SET username = EXCLUDED.username, secret_ciphertext = EXCLUDED.secret_ciphertext, nonce = EXCLUDED.nonce, key_ref = EXCLUDED.key_ref, rotated_at = EXCLUDED.rotated_at` (one statement, as §B.3 'one UPDATE' asks). Why it is safe: `device_id` is no secret (it is readable in `capture_devices`); the four secret-bearing columns stay unreadable. It does let the runtime role learn WHETHER a camera has a credential — which C3 already exposes as `credentialSet`. Alternative without any SELECT: an owner-owned `SECURITY DEFINER` function `dems_capture_credential_write(device, username, ciphertext, nonce, key_ref, rotated_at)`. The contract pins that change with it: `test/db/privileges.db.test.ts`, the contract inventory, and the new test's `['42501','42501','42501']` assertion (which then must flip) |
| D-84-1 | The store is a new closed top-level unit `src/credential-store`, not under `src/capture` (whose G-R2 / G-R8 rules forbid the file system and `crypto`) and not a host unit (G-R1). No allowlist entry was needed; one entry in `CLOSED_UNITS` |
| D-84-2 | No `app.ts` edit and no boot step: the STT module takes the sealer in an `onReady` hook. A boot step would have changed the pinned boot-step lists of other rows' tests |
| D-84-3 | Store unusable -> 503 `CREDENTIAL_STORE_NOT_READY` and a logged fault; the server still boots (Simulated mode needs no store) |
| D-84-4 | Random 96-bit nonce per fragment, with a per-sealer reuse guard; never derived from position (a re-sealed fragment after a restart would otherwise reuse a nonce) |
| D-84-5 | Camera username is not bound into the AAD (it is a separately updatable clear column) |
| D-84-6 | Keys and media are on the same volume on this Mac; "held separately from the media volume" (§D.2) is met by path only — see §7 |

## 7. Custody-policy note (for handover)

1. **Where the keys are.** `<dataDir>/credential-store/keys/`, owner-only. One file per STT
   credential, per camera credential, per recording session (`KID-<sessionId>`). The database and
   the manifest hold references, nonces, tags — never a key.
2. **No escrow, no backup (SEC35-09; Q-SEC-2 default).** Key lost = data unreadable. A lost session
   key leaves the package verifiable (stored-bytes hashes, signature) and its video undecryptable
   for ever: no plaintext export, no playback. A lost credential key means the credential is typed
   again. **A REAL item must be exported (OD-16, decrypted copy) before anything that can lose the
   data directory**: disk replacement, OS reinstall, deleting `.data/`, moving the Core to another Mac.
3. **Backups cut both ways.** A backup or cloud sync that includes `.data/` copies the keys next to
   the encrypted media and defeats the encryption; one that excludes the store makes a restore
   unreadable. Whoever owns the Core must decide and write down which (ties to user decision U-3).
4. **Same volume.** On this Mac keys and media share a disk; encryption at rest protects against a
   copied media folder, not against a copy of the whole data directory or a process running as the
   server user. Separate volume / keychain / hardware store is a class-C deployment decision.
5. **Rotation.** Re-entering a credential rotates its key. Session keys are never rotated. Replaced
   keys are destroyed by the rotation hook once rows 115 / 142 call it.
6. **Destruction.** A session key is destroyed when its item is deleted or its retention expires,
   after any export; the fact is audited by the caller. On APFS / flash, destruction means the
   server can no longer read the key, not forensic erasure.
7. **Moving the Core.** Database and `credential-store/` move together or not at all; a restored
   database without its store has credentials that answer "unavailable" and media that cannot be decrypted.
8. **If escrow is wanted** it is a new decision (second blueprint gate, spec §D.2): who holds the
   copy, how it is protected, how its use is audited. Nothing here prepares or prevents it.

## 8. Device / browser checks left for the M7 gate (one scripted flow)

Web console, live Core with a real data directory: System -> STT settings -> enter a secret ->
saved, `ENCRYPTED` shown, field empty on reload (row 117's form) -> test connection (row 115) ->
`.data/credential-store/keys/` holds one 0600 file -> canary grep of `logs/errors.log`, the stream
log and `audit_log` = 0. Then the M7 tamper flow (EV-0005, one fragment) once rows 59 / 82 / 85 exist.
