---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
date: 2026-10-04
agent: coder-execution
blueprint_row: 31
plan_row: W09 (hand-built element HB-4, wave E2; smaller proof AS-08)
source_plan: /docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md
evidence_tier: 3 (mechanical output: statement plus command output)
status: complete
---

# 09 Password-hash wrapper HB-4 (blueprint step 31, plan row W09)

Row, verbatim: [W09] Password-hash wrapper HB-4 over the Node built-in `crypto.argon2` (argon2id,
19,456 KiB, 2 passes, parallelism 1, a 16-byte salt from `crypto.randomBytes(16)`, constant-time
verify, no pepper); built before the seed, which needs it. Writes:
`apps/core-server/src/modules/identity/password-hash/**`. Locks: none. Implements SR-05, SR-06;
AC-B-30 (hash record and vector). On failure: conditional row Fh. Rollback R-NEW.

**Result: TD-05 built-in CONFIRMED.** `crypto.argon2` exists on Node v26.8.2, reproduces the
Argon2id test vector of RFC 9106 in both of its forms, emits no warning, and carries the wrapper.
The fallback row Fh (`@node-rs/argon2` 2.2.1) is not needed. No package was installed.

| Field | Value |
|---|---|
| Result | Wrapper and tests written; 74 tests in 3 files pass; typecheck and lint of `@dems/core-server` exit 0 (section 8) |
| Files written (code) | Five, all inside `apps/core-server/src/modules/identity/password-hash/` (section 1) |
| Runtime | Node v26.8.2, OpenSSL 3.5.8, libuv 1.52.1 (`process.versions`), darwin arm64, Apple M5 x 10, 24 GiB |
| Time per derivation (19,456 KiB, 2 passes, parallelism 1) | About 16 ms on a quiet host; 16 to 27 ms median while the wave's other agents ran; worst single sample 64.7 ms (section 7) |
| Vector | RFC 9106 section 5.3 (Argon2id), as published, with its secret and associated data (section 5) |
| Record | Six members, one per hash column of `operator_credentials` (section 4) |
| Row window | First recorded timestamp 06:56:38 WIB (progress file); final verification run 07:07:11 WIB |
| Sandbox bypass | None. Every command ran inside the sandbox |
| Processes started | Only short-lived `node`, `npm`, `vitest`, `tsc`, `oxlint` and `prettier` runs, each ended by itself. No port bound, no database, no network (P20) |
| Shared trackers | Not written (parallel run, P8): `status_tasks.md`, `delegation_progress_report.md`, `decisions/decisions.md`, `masterplan/02_plan.md`, `implementation/99_implementation_report.md` |
| Findings for the controller | Nine (section 11); two need attention now: the host load (F-7) and the default output path of Vitest's JSON reporter (F-8) |

## 1. What was written

All paths are under `/Users/gsp-budi/Documents/DEMS/apps/core-server/src/modules/identity/password-hash/`.

| File | Lines | SHA-256 (first 16) | Content |
|---|---|---|---|
| `password-hash.ts` | 328 | `d9d1e07c86686e49` | The wrapper |
| `index.ts` | 25 | `b508a19b002a27f0` | The folder's public surface (what the seed and the identity module import) |
| `argon2-builtin.test.ts` | 138 | `8dd0c87353574ddf` | Proof AS-08: the vectors through the built-in and through the wrapper's call |
| `password-hash.test.ts` | 553 | `947f6e1da046481e` | The wrapper's behaviour |
| `password-hash.wiring.test.ts` | 85 | `e533b71f38571aa9` | What the default exports hand to `node:crypto` |

Nothing else under `modules/identity/` was created or edited; no `package.json`, `app.ts`,
`config.ts` or shared file was touched. The folder did not exist before this row (`mkdir -p`
created `src/modules/identity/` as its parent; the scaffold row W08 had not written there yet).

### 1.1 Public API (`index.ts`)

| Export | Kind | Purpose |
|---|---|---|
| `hashPassword(password)` | `Promise<PasswordHashRecord>` | Validates the input, takes 16 bytes from `crypto.randomBytes(16)`, derives the 32-byte Argon2id tag with the current parameters, returns the hash set |
| `verifyPassword(password, record)` | `Promise<boolean>` | Validates the input and the record, derives with the STORED salt and parameters, compares with `crypto.timingSafeEqual` on two 32-byte buffers |
| `verifyAgainstDummy(password)` | `Promise<false>` | Same input check, one full derivation against a fixed record of the current parameters, one comparison, then `false` whatever the comparison says (ID-2, SR-08, SD-21 "always compute") |
| `needsRehash(record)` | `boolean` | `true` when any cost parameter is below the current one, or the record is not a well-formed Argon2id record; `false` for a row at or above the current parameters (no downgrade) |
| `createPasswordHasher({ derive?, randomBytes? })` | factory | The same four functions around an injected derivation and random source. The exports above are this factory bound to the built-in. It is the seam for the spy that AC-B-24 counts in W24 |
| `deriveArgon2id(request)` | `Promise<Buffer>` | The one call into `crypto.argon2` (asynchronous form), without `secret` and without `associatedData` |
| `PASSWORD_HASH_ALGORITHM`, `PASSWORD_HASH_PARAMETERS`, `PASSWORD_SALT_BYTES`, `PASSWORD_HASH_BYTES`, `PASSWORD_MAX_LENGTH` | constants | `'argon2id'`; `{ memoryKib: 19456, passes: 2, parallelism: 1 }`; 16; 32; 128 |
| `PasswordHashError`, `PasswordHashErrorCode` | error class, code set | An error has a code and nothing else |
| `PasswordHashRecord`, `StoredPasswordHash`, `PasswordHasher`, `PasswordHasherOptions`, `Argon2idDerive`, `Argon2idRequest` | types | Section 4 |

### 1.2 Rules the code keeps

| Rule | Source | How |
|---|---|---|
| Argon2id, 19,456 KiB, 2 passes, parallelism 1, tag 32 bytes, asynchronous form | SR-05; TD-05 | `PASSWORD_HASH_PARAMETERS`; `crypto.argon2` with a callback, wrapped in a promise |
| Salt of 16 bytes from `crypto.randomBytes(16)`, new for every password | SR-05; SD-21 (c) | `newSalt()`; a source that throws or gives another length is `SALT_UNAVAILABLE` |
| No pepper | SR-61; 01_specs §14.1; SD-21 (b) | `secret` and `associatedData` are never passed; the reason is the comment at the top of `password-hash.ts`: a pepper would be one more secret under the same `.data/` and the same uid, so it adds no separation, and the seeded password is a published constant. The wiring test asserts the exact member set of the parameters object |
| Verification recomputes with the stored parameters; constant-time comparison | SR-06; ID-2 | `matches()`: `timingSafeEqual(tag, record.hash)`, both 32 bytes (the stored length and the derived length are checked first) |
| The computation always runs for an unknown user | ID-2; SR-08; SD-21 (a) | `verifyAgainstDummy`; the dummy salt is a fixed public 16-byte value, the dummy tag is 32 zero bytes, and the result is `false` unconditionally |
| A row with older parameters is re-hashed at the next successful sign-in | SR-06 | `needsRehash`; the cost parameters of a stored row are not held to the current floor, so an older row still verifies |
| Password: 1 to 128 characters; nothing normalised | ID-P10; SR-07; 03_database_contract §5.1 | `passwordBytes()`: refuses a non-string, an empty string and more than 128 UTF-16 code units; hashes `Buffer.from(password, 'utf8')` as given (no trim, no case folding, no Unicode normalisation) |
| Never logs; an error carries a code only | Row rule 4; NL-1, NL-2 | No logger, no `console`; `PasswordHashError(code)` has `message === code` and no `cause`. The built-in's own error is dropped because its message can quote an argument (section 3.4) |

Error codes: `PASSWORD_NOT_STRING`, `PASSWORD_EMPTY`, `PASSWORD_TOO_LONG`, `RECORD_INVALID`,
`SALT_UNAVAILABLE`, `DERIVATION_FAILED`. The three asynchronous functions never throw
synchronously: every failure is a rejection.

## 2. How later rows use it

| Row | Use |
|---|---|
| W17 (schema) | The six hash columns map to the six members of section 4. `pg` returns `bytea` as a `Buffer`; any `Uint8Array` is accepted too |
| W20 (seed) | `const record = await hashPassword(DEMO_OPERATOR_PASSWORD)` once per operator (a fresh salt each, SD-4), then insert `record` with `operator_id` and `hashed_at`. About 16 to 27 ms each on this machine |
| W24 (sign-in) | After unit 1 (ENG-26): `const ok = row ? await verifyPassword(password, row) : await verifyAgainstDummy(password)`. For a disabled operator call `verifyPassword` with the stored row as for an enabled one, and look at `enabled` only afterwards (ID-2). After a success: `if (needsRehash(row)) update with await hashPassword(password)`. For AC-B-24 build the hasher with `createPasswordHasher({ derive: vi.fn(deriveArgon2id) })` and count the calls: each of the three functions calls the derivation exactly once (tested here) |
| W24, W08 (logging) | Log `error.code` of a `PasswordHashError`. Never log a record: every member is a column of `operator_credentials` (NL-1) |

A password that the request schema should have refused (empty, over 128 characters, not a string)
makes all three functions reject without a derivation. W19 and W24 keep that from happening by
validating the body with `z.string().min(1).max(128)` (decision D-a, section 12).

## 3. Facts of the built-in on Node v26.8.2

Sources: `node -e` introspection on this host and the installed typings
`node_modules/@types/node/crypto.d.ts` (`@types/node` 26.6.3). `node --help` was not used.

### 3.1 Presence and shape

```
$ node -e '<introspection>'
node v26.8.2 openssl 3.5.8
typeof argon2: function | typeof argon2Sync: function
argon2.length: 3 | argon2Sync.length: 2
argon2.name: argon2 | argon2Sync.name: argon2Sync
has util.promisify.custom: false
typeof crypto/promises? : (none)
typeof timingSafeEqual: function | randomBytes: function
getHashes has argon: []
exit=0
```

| Fact | Value | Evidence |
|---|---|---|
| Names | `crypto.argon2(algorithm, parameters, callback)` and `crypto.argon2Sync(algorithm, parameters)` | Introspection above; `crypto.d.ts:3491-3495`, `:3530` |
| Asynchronous form | Callback `(err, derivedKey)`; the call returns `undefined`; there is no promise form and no `util.promisify.custom` | Probe: `argon2() return value: undefined`; `callback: err = null | Buffer.isBuffer(key) = true | length = 32` |
| `algorithm` | `'argon2d' | 'argon2i' | 'argon2id'` | `crypto.d.ts:3442`; an unknown name throws `ERR_INVALID_ARG_VALUE` |
| `parameters.message` | The password: a string or bytes. A string is hashed as its UTF-8 bytes | `crypto.d.ts:3444`; probe: `string message == utf8 bytes: true` |
| `parameters.nonce` | The salt, at least 8 bytes | `crypto.d.ts:3445`; probe: `parameters.nonce.byteLength ... must be >= 8` |
| `parameters.parallelism` | Lanes, 1 to 16,777,215 | `crypto.d.ts:3446`; probe |
| `parameters.tagLength` | Bytes of the tag, at least 4 | `crypto.d.ts:3447`; probe |
| `parameters.memory` | **KiB** (1 KiB blocks), an integer, at least 8 | `crypto.d.ts:3448`; the RFC vector's "Memory: 32 KiB" reproduces with `memory: 32` |
| `parameters.passes` | Iterations, 1 to 4,294,967,295 | `crypto.d.ts:3449`; probe |
| `parameters.secret`, `parameters.associatedData` | Optional. The wrapper never passes them | `crypto.d.ts:3450-3451` |
| Return | A `Buffer` (the raw tag). No encoded string, no verify helper | `crypto.d.ts:3494`, `:3530`; [R10:131] |
| Since | v24.7.0 | `crypto.d.ts:3488`, `:3528` (`@since v24.7.0`) |
| Where it runs | The asynchronous form leaves the event loop free: 12 timer ticks of 1 ms fired during one 16.0 ms derivation; four at once took 23.4 ms of wall time | Probe (section 7) |

### 3.2 Stability and warnings

| Check | Result |
|---|---|
| `process.on('warning')` listener during 7 derivations (3 variants in both forms, plus one more) | `warnings emitted: (none)` |
| stderr of `node --trace-warnings <probe>` | 0 bytes |
| `@experimental` tag in the typings | Absent from the Argon2 declarations and from the whole of `crypto.d.ts` (0 occurrences), while 14 other declaration files of `@types/node` 26.6.3 use the tag |
| Documentation | "Stability: 2 (Stable)" as recorded by the research [R10:124]; not re-fetched here (P20) |
| Regression guard | `argon2-builtin.test.ts` > "process warnings" fails if any warning is emitted by the derivations of that file |

So the built-in is not experimental on this runtime and prints nothing to stderr.

### 3.3 The vectors

```
$ node --trace-warnings <probe: RFC 9106 section 5, one shared input, three variants>
argon2d sync MATCH | async MATCH
argon2i sync MATCH | async MATCH
argon2id sync MATCH | async MATCH
argon2() return value: undefined
callback: err = null | Buffer.isBuffer(key) = true | length = 32
warnings emitted: (none)
exit=0
stderr bytes:        0
```

### 3.4 Error shapes (why the wrapper drops the cause)

An invalid argument is thrown **synchronously**, with a Node error code, before any work starts:

```
nonce 7 bytes: thrown synchronously | code=ERR_OUT_OF_RANGE | message="The value of \"parameters.nonce.byteLength\" is out of range. It must be >= 8 && <= 4294967295. Received 7"
memory below 8*p: thrown synchronously | code=ERR_OUT_OF_RANGE | message="The value of \"parameters.memory\" is out of range. It must be >= 8 && <= 4294967295. Received 4"
tagLength 3: thrown synchronously | code=ERR_OUT_OF_RANGE | message="The value of \"parameters.tagLength\" is out of range. It must be >= 4 && <= 4294967295. Received 3"
passes 0: thrown synchronously | code=ERR_OUT_OF_RANGE | message="The value of \"parameters.passes\" is out of range. It must be >= 1 && <= 4294967295. Received 0"
parallelism 0: thrown synchronously | code=ERR_OUT_OF_RANGE | message="The value of \"parameters.parallelism\" is out of range. It must be >= 1 && <= 16777215. Received 0"
message number: thrown synchronously | code=ERR_INVALID_ARG_TYPE | message="The \"parameters.message\" property must be of type string or an instance of ArrayBuffer, Buffer, TypedArray, or DataView. Received type number (12345)"
memory non-integer: thrown synchronously | code=ERR_OUT_OF_RANGE | message="The value of \"parameters.memory\" is out of range. It must be an integer. Received 64.5"
unknown algorithm: ERR_INVALID_ARG_VALUE "The argument 'algorithm' must be one of: 'argon2d', 'argon2i', 'argon2id'. Received 'argon2x'"
```

The `ERR_INVALID_ARG_TYPE` message quotes the value it received (`(12345)`). A message of the
built-in can therefore carry an argument, so the wrapper never forwards it: `DERIVATION_FAILED`
has no `cause`, and a non-string password is refused before the built-in is called.

### 3.5 Two more observations

```
memory 67 gives the same tag as 64 (rounded down): false
empty message accepted by built-in, tag length 32
```

- The documentation text recorded by the research says `memory` is "rounded down to nearest
  multiple of 4 * parallelism" [R10:124]. The tag for `memory: 67` still differs from the tag
  for `memory: 64`. So the value that is stored must be exactly the value that was passed; the
  wrapper does that and normalises nothing. 19,456 is a multiple of 4, so SR-05 is unaffected.
- The built-in accepts an empty message. The wrapper refuses it (`PASSWORD_EMPTY`).

## 4. The record against the contract's columns

`03_database_contract.md` §4.5 (T-05 `operator_credentials`) and §5.1. Property names are the
column names in camelCase (N-6, read in reverse).

| Column | Type and rule in the contract | Member | TypeScript type | What `hashPassword` writes | What `verifyPassword` accepts |
|---|---|---|---|---|---|
| `operator_id` | `text`, primary key, foreign key | — | — | Added by the caller | Not used |
| `algorithm` | `text`; CHECK `= 'argon2id'` | `algorithm` | `'argon2id'` (produced); `string` (stored) | `'argon2id'` | `'argon2id'` only, else `RECORD_INVALID` |
| `memory_kib` | `integer`; CHECK `>= 19456`; unit KiB | `memoryKib` | `number` | `19456` | A positive safe integer of at least `8 * parallelism` (RFC 9106) |
| `passes` | `integer`; CHECK `>= 2` | `passes` | `number` | `2` | A positive safe integer |
| `parallelism` | `integer`; CHECK `>= 1` | `parallelism` | `number` | `1` | A positive safe integer |
| `salt` | `bytea`; CHECK `octet_length >= 16` | `salt` | `Buffer` (produced); `Uint8Array` (stored) | 16 bytes from `crypto.randomBytes(16)` | At least 16 bytes |
| `hash` | `bytea`; CHECK `octet_length = 32` | `hash` | `Buffer` (produced); `Uint8Array` (stored) | The 32-byte Argon2id tag (raw, not encoded) | Exactly 32 bytes |
| `hashed_at` | `bigint`, epoch ms on the server clock | — | — | Added by the caller (the wrapper reads no clock) | Not used |

Two types, because a row read back is wider than a record just made:

- `PasswordHashRecord`: what `hashPassword` returns (`algorithm: 'argon2id'`, `salt: Buffer`,
  `hash: Buffer`). The test "returns the hash set of SR-06" asserts that its keys are exactly
  `algorithm`, `hash`, `memoryKib`, `parallelism`, `passes`, `salt`.
- `StoredPasswordHash`: what `verifyPassword` and `needsRehash` take (`algorithm: string`, the two
  `bytea` members as any `Uint8Array`), checked at run time. A `PasswordHashRecord` is assignable
  to it.

A record that `hashPassword` returns satisfies the three CHECK constraints
(`operator_credentials_algorithm_check`, `_params_check`, `_lengths_check`): the values equal the
floors. Exact input of the hash: the password's UTF-8 bytes with the row's salt and parameters
(§5.1), which the test "holds the tag the built-in derives from the UTF-8 password, the salt and
the parameters" recomputes independently.

On the stored cost parameters the wrapper is deliberately wider than the table: it verifies a row
below today's floor, so that a later rise of the floor needs no migration (SR-06; TD-05
"Rollback"). It applies no ceiling: whoever can write this row can replace the hash itself, so a
bound on the cost would protect nothing.

## 5. The vector used and its source

**RFC 9106, section 5.3 "Argon2id Test Vectors"**, as published, including its secret and its
associated data: the built-in takes both, so no substitute vector was needed.

| Input | Value |
|---|---|
| Version | 0x13 (19) |
| Memory, passes, parallelism, tag length | 32 KiB, 3, 4, 32 bytes |
| Password | 32 bytes of 0x01 |
| Salt | 16 bytes of 0x02 |
| Secret | 8 bytes of 0x03 |
| Associated data | 12 bytes of 0x04 |
| Expected tag | `0d640df58d78766c08c037a34a8b53c9d01ef0452d75b65eb52520e96b01e659` |

Tests: `argon2-builtin.test.ts` > "reproduces the Argon2id test vector of RFC 9106 section 5.3
(asynchronous form)" and "reproduces the same vector in the synchronous form".

The RFC's vector needs `secret` and `associatedData`, which the wrapper's own call never passes.
To tie the wrapper's call shape to a known answer as well, three vectors of the reference
implementation (P-H-C/phc-winner-argon2, `src/test.c`, the Argon2id block for version 0x13;
password `password`, salt `somesalt`, tag 32 bytes, no secret, no associated data) run through
`deriveArgon2id`:

| Memory | Passes | Parallelism | Expected tag |
|---|---|---|---|
| 256 KiB | 2 | 1 | `9dfeb910e80bad0311fee20f9c0e2b12c17987b4cac90c2ef54d5b3021c68bfe` |
| 256 KiB | 2 | 2 | `6d093c501fd5999645e0ea3bf620d7b8be7fd2db59c20d9fff9539da2bf57037` |
| 65,536 KiB | 2 | 1 | `09316115d5cf24ed5a15a31a3ba326e5cf32edc24702987c02b6566f61913cf7` |

**Provenance of the literals, stated plainly.** The research did not record a vector (plan W09
says so), and this row fetches nothing from the network (P20). The expected tags were written
from the published texts as the agent knows them; they were not copied from a file on this host.
What checks them is the run itself: an independent implementation (Node v26.8.2 with OpenSSL
3.5.8) reproduces every one of them bit for bit, namely the three RFC 9106 tags (Argon2d,
Argon2i, Argon2id; section 3.3) and seven reference tags (appendix A.3). A wrong 256-bit literal
cannot agree with a correct implementation by chance, and a wrong implementation cannot agree
with ten independent literals. A reviewer with network access can compare the first table with
`https://www.rfc-editor.org/rfc/rfc9106.txt`, section 5.3 (the URL the research fetched,
[R10:120]).

The strings `password` and `somesalt` are the inputs of the published vector, not credentials.
`grep -c` confirms that the demo constant equals none of them (0 lines), without printing it.
Every other test password is made in the test as `dummy-<9 random bytes, base64url>`; no test
imports `@dems/shared`, so the demo password is not used anywhere in this folder.

## 6. Tests

`unit` project of `@dems/core-server`: no database, no network, no port.

| File | Tests | What they show |
|---|---|---|
| `argon2-builtin.test.ts` | 9 | Both forms exist; the RFC 9106 Argon2id vector in the asynchronous and the synchronous form; an out-of-range parameter throws synchronously with `ERR_OUT_OF_RANGE`; three reference vectors through `deriveArgon2id`; `deriveArgon2id` rejects and does not throw; no process warning |
| `password-hash.test.ts` | 62 | The current parameters; the record's exact keys, values and lengths; the stored tag recomputed independently; round trip; wrong password; tampered tag, salt, `memoryKib`, `passes`, `parallelism`; two hashes of one password differ; the salt is the bytes the source returned for a request of 16; `SALT_UNAVAILABLE`; verification with the stored (older) parameters; plain `Uint8Array` members; `needsRehash` (13 cases); the dummy path (one derivation with the current parameters, the same work as a real verification, `false` even if the derivation hits the dummy tag); exactly one derivation per call; input limits in all three functions without a derivation (6 cases); 1 and 128 characters; 128 three-byte characters are 384 bytes; no trim, case folding or Unicode normalisation; 12 malformed records refused without a derivation; errors hold no password, salt, tag or built-in message, no `cause`; nothing is written to `console` or to the standard streams |
| `password-hash.wiring.test.ts` | 3 | With `node:crypto` replaced by call-through spies: `hashPassword` calls `randomBytes(16)` once and `argon2('argon2id', { message, nonce, parallelism: 1, tagLength: 32, memory: 19456, passes: 2 }, callback)` once, with exactly those six members (no `secret`, no `associatedData`), and never `argon2Sync`; `verifyPassword` calls `argon2` once with the stored salt and `timingSafeEqual` once on two 32-byte buffers; `verifyAgainstDummy` calls `argon2` once with the current parameters and a 16-byte nonce, compares once, and takes no new salt |
| **Total** | **74** | |

The dummy path is asserted by calls, not by wall-clock time: a counting spy on the derivation
(`vi.fn(deriveArgon2id)`), the request it received, the 32-byte tag it resolved, and in the
wiring test a spy on `crypto.argon2` itself.

**Production-cost derivations in the suite: 16** (12 in `password-hash.test.ts`, 4 in the wiring
test; three of the 16 use a tampered parameter: 19,460 KiB, 3 passes, parallelism 2), plus one
reference vector at 65,536 KiB. Every other derivation uses 64 KiB, 256 KiB or 1,024 KiB, or a
fake. The folder's tests run in 0.3 to 1.0 s (four runs: 296 ms, 1.02 s, 576 ms, 546 ms); the
whole unit project took 688 ms and 672 ms.

### 6.1 Mutation check (are the tests able to fail?)

Thirteen single changes were applied to `password-hash.ts`, one at a time, the folder's tests
were run, and the file was restored from a copy (`restored: True`; the hash of section 1 is the
hash after the restore). Every change made the suite fail:

```
M1 dummy path skips the derivation: exit=1 | 5 failed | 69 passed (74)
M2 a pepper is passed: exit=1 | 6 failed | 68 passed (74)
M3 comparison is not timingSafeEqual: exit=1 | 2 failed | 72 passed (74)
M4 no maximum length: exit=1 | 1 failed | 73 passed (74)
M5 verify ignores the stored memory: exit=1 | 4 failed | 70 passed (74)
M6 dummy path returns the comparison: exit=1 | 1 failed | 73 passed (74)
M7 salt of 8 bytes: exit=1 | 8 failed | 66 passed (74)
M8 derivation error passed through: exit=1 | 2 failed | 72 passed (74)
M9 needsRehash ignores passes: exit=1 | 2 failed | 72 passed (74)
M10 empty password accepted: exit=1 | 1 failed | 73 passed (74)
M11 salt from a constant, not the random source: exit=1 | 6 failed | 68 passed (74)
M12 tag length not checked: exit=1 | 2 failed | 72 passed (74)
M13 record not validated: exit=1 | 12 failed | 62 passed (74)
restored: True
```

## 7. Measured time per derivation

Parameters of SR-05 (19,456 KiB, 2 passes, parallelism 1, 16-byte salt, 32-byte tag), Apple M5
with 10 cores and 24 GiB, Node v26.8.2, default libuv pool of 4 threads. The 1-minute load
average is quoted with each run, because other rows of the wave were running.

| Run (WIB) | Load (1 min) | What | n | Min | Median | Max or p95 | Mean |
|---|---|---|---|---|---|---|---|
| about 06:55 | 4.89 | Built-in, asynchronous, sequential | 10 | 15.5 ms | 16.3 ms | max 18.3 ms | 16.5 ms |
| about 06:55 | 4.89 | Built-in, synchronous | 5 | 16.2 ms | 16.7 ms | max 17.6 ms | — |
| about 07:03 | 11.20 | `hashPassword` | 20 | 20.5 ms | 25.3 ms | p95 64.7 ms | 27.4 ms |
| about 07:03 | 11.20 | `verifyPassword`, right password | 20 | 20.8 ms | 27.2 ms | p95 31.8 ms | 27.3 ms |
| about 07:03 | 11.20 | `verifyPassword`, wrong password | 20 | 20.5 ms | 25.6 ms | p95 34.1 ms | 26.4 ms |
| about 07:03 | 11.20 | `verifyAgainstDummy` | 20 | 22.0 ms | 25.7 ms | p95 40.7 ms | 26.6 ms |
| 07:05 | 33.93 | `hashPassword` | 20 | 21.8 ms | 25.6 ms | p95 29.1 ms | 25.8 ms |
| 07:05 | 33.93 | `verifyPassword`, right password | 20 | 21.9 ms | 26.1 ms | p95 28.5 ms | 25.6 ms |
| 07:05 | 33.93 | `verifyPassword`, wrong password | 20 | 22.4 ms | 25.8 ms | p95 29.6 ms | 25.8 ms |
| 07:05 | 33.93 | `verifyAgainstDummy` | 20 | 24.1 ms | 26.5 ms | p95 31.6 ms | 26.9 ms |
| 07:06 | 40.62 | `hashPassword` | 20 | 21.9 ms | 26.6 ms | p95 29.2 ms | 25.9 ms |
| 07:06 | 40.62 | `verifyPassword`, right password | 20 | 18.9 ms | 22.1 ms | p95 25.1 ms | 21.9 ms |
| 07:06 | 40.62 | `verifyPassword`, wrong password | 20 | 15.6 ms | 17.0 ms | p95 21.8 ms | 17.2 ms |
| 07:06 | 40.62 | `verifyAgainstDummy` | 20 | 14.3 ms | 15.5 ms | p95 17.3 ms | 15.6 ms |

Concurrency (wall time for k calls started together): 4 raw derivations 23.4 ms (load 4.89);
`hashPassword` x3 / x4 / x8: 130.4 / 83.6 / 160.9 ms (load 11.20), 32.8 / 34.9 / 91.3 ms
(load 33.93), 21.4 / 28.4 / 41.7 ms (load 40.62). Resident memory of the measuring process: 160 MiB
before and after four concurrent verifications (the 19 MiB per derivation is released).

Numbers for later rows:

| Use | Figure |
|---|---|
| One derivation | About 16 ms on a quiet host; plan for 30 ms, and for up to about 65 ms as a single outlier under load |
| The seed and a reset (three operators, SD-4) | Three derivations: about 50 ms quiet, about 80 ms under load |
| One sign-in attempt | Exactly one derivation, on the libuv pool, outside the pipeline (ENG-26); the event loop stays free |
| Five failed attempts up to the lock (ID-P1) | About 80 to 135 ms of hashing in total, far below the 300 s window and the 60 s lock |
| Known user against unknown user | The same work (one derivation with the same parameters, one comparison); the measured medians of `verifyPassword` (wrong password) and `verifyAgainstDummy` lie within 1 ms of each other in the two first runs and within 1.5 ms in the third. This is a measurement under load, not a proof of equal time; the tested property is the equal work |

## 8. Verification (final run, unfiltered)

```
2026-10-04 07:07:11 WIB
 7:07  1 user, load averages: 41.38 24.23 13.10
$ npm run test -w @dems/core-server -- --maxWorkers=2 src/modules/identity/password-hash

> @dems/core-server@0.2.0 test
> vitest run --project unit --maxWorkers=2 src/modules/identity/password-hash

ERROR: failed to copy trust settings of system certificate-25291
ERROR: failed to copy trust settings of system certificate-25291
ERROR: failed to copy trust settings of system certificate-25291
ERROR: failed to copy trust settings of system certificate-25291
ERROR: failed to copy trust settings of system certificate-25291
ERROR: failed to copy trust settings of system certificate-25291

 RUN  v5.0.3 /Users/gsp-budi/Documents/DEMS/apps/core-server


 Test Files  3 passed (3)
      Tests  74 passed (74)
   Start at  07:07:12
   Duration  546ms (tests 78%, transform 12%, import 9%, worker 1%)

exit=0
$ npm run typecheck -w @dems/core-server

> @dems/core-server@0.2.0 typecheck
> tsc --noEmit

exit=0
$ npm run lint -w @dems/core-server

> @dems/core-server@0.2.0 lint
> oxlint

exit=0
```

The six `ERROR: failed to copy trust settings of system certificate` lines are printed by the
sandboxed process start on this host (keychain access is denied in the sandbox); they come before
the runner starts and are not test output (F-9).

That `oxlint` reads this folder is shown by an earlier run, which reported one warning in it (an
unused import in `password-hash.test.ts`, `eslint(no-unused-vars)`, exit 0); the import is now
used and the final run reports nothing.

P11: typecheck and lint were run three times (about 07:02, 07:05:13, 07:07:11) and passed each
time. During all three runs `apps/core-server/src/` held only `version.ts`, `version.test.ts` and
this folder: the scaffold row W08 had not written its files yet, so no failure caused by a
sibling row was seen, and none can be excluded for later. A re-run after W08 settles is the
gate's job (SG).

Per test, the verbose reporter listed 74 passed lines; the per-file counts come from the JSON
reporter:

```
src/modules/identity/password-hash/argon2-builtin.test.ts | 9 tests | 9 passed
src/modules/identity/password-hash/password-hash.test.ts | 62 tests | 62 passed
src/modules/identity/password-hash/password-hash.wiring.test.ts | 3 tests | 3 passed
total 74 | passed 74 | failed 0 | pending 0
```

## 9. Test ledger (P24)

| Workspace, project | Before this row | After this row | Added by this row |
|---|---|---|---|
| `@dems/core-server`, `unit` | 1 test in 1 file (`src/version.test.ts`, row W03) | **75 tests in 4 files** | **74 tests in 3 files** |
| `@dems/core-server`, `db` | not run (no file of this row; the global setup belongs to W11) | — | 0 |
| `@dems/shared`, `@dems/core-web`, `@dems/mobile`, `@dems/mock-core` | not touched, not run | — | 0 |

New test files by name:

| File | Tests |
|---|---|
| `apps/core-server/src/modules/identity/password-hash/argon2-builtin.test.ts` | 9 |
| `apps/core-server/src/modules/identity/password-hash/password-hash.test.ts` | 62 |
| `apps/core-server/src/modules/identity/password-hash/password-hash.wiring.test.ts` | 3 |

```
$ npm run test -w @dems/core-server -- --maxWorkers=2   (whole unit project)
 Test Files  4 passed (4)
      Tests  75 passed (75)
   Duration  672ms (tests 76%, transform 12%, import 9%, worker 2%)
exit=0
```

The "before" figure is the "after" figure minus this row's 74 tests, and equals the one file that
existed (`version.test.ts`, 1 test). The baseline at `acaff20` is 0 for this workspace.

## 10. Write paths (P6) and `git status`

```
$ git status --porcelain --untracked-files=all -- apps/core-server
?? apps/core-server/package.json
?? apps/core-server/src/modules/identity/password-hash/argon2-builtin.test.ts
?? apps/core-server/src/modules/identity/password-hash/index.ts
?? apps/core-server/src/modules/identity/password-hash/password-hash.test.ts
?? apps/core-server/src/modules/identity/password-hash/password-hash.ts
?? apps/core-server/src/modules/identity/password-hash/password-hash.wiring.test.ts
?? apps/core-server/src/version.test.ts
?? apps/core-server/src/version.ts
?? apps/core-server/tsconfig.json
?? apps/core-server/vitest.config.ts
```

Mine: the five files under `password-hash/`. The other five belong to W03. In the task folder
this row wrote this document and `delegation_progress/coder_execution_step_31.md`. The whole
workspace is still untracked (`?? apps/core-server/`), so the root `git status --porcelain` shows
the folder only as part of that line.

Two things this row created outside its folder and removed again, both its own files of a few
minutes' age:

| What | Why | State |
|---|---|---|
| `apps/core-server/.vitest/json/output.json` (28,493 bytes, 07:04:23) and its two folders | A run with `--reporter=json` and no `--outputFile` writes there by default (F-8). The file held this folder's 74 results only | Removed (`rm` of the file, `rmdir` of the two empty folders); `git status` above shows nothing of it |
| Six files `implementation/assets/09_*` (copies of the probe scripts and a run log) | Written as evidence copies, then withdrawn because 02_plan §8.7 allows one output document and a progress file per row | Removed; the scripts and their output are in appendix A instead |

Scratch files are under the session's `$TMPDIR/w09/` (outside the repository).

## 11. Findings for the controller (P22)

| ID | Finding | Evidence | Consequence |
|---|---|---|---|
| F-1 | `crypto.argon2` on Node v26.8.2 is present, takes the documented parameters, emits no warning and reproduces the RFC 9106 vectors of all three variants in both forms. AS-08 holds; TD-05 stands; Fh is not triggered | Sections 3, 5 | None |
| F-2 | A message of the built-in can quote an argument (`ERR_INVALID_ARG_TYPE ... Received type number (12345)`) | Section 3.4 | The wrapper drops the cause. Any other row that calls `node:crypto` with a secret as an argument must not log the raw error either (W24, W32, W41) |
| F-3 | `memory: 67` and `memory: 64` give different tags, although the documentation speaks of rounding down to a multiple of 4 x parallelism | Section 3.5 | Store and pass exactly the same value. No effect on 19,456 |
| F-4 | The built-in accepts an empty message | Section 3.5 | The wrapper refuses it; the request schema must as well |
| F-5 | `Buffer.from(string, 'utf8')` replaces a lone surrogate by U+FFFD (`\ud800` and `\udfff` both give `efbfbd`), so two ill-formed strings can map to the same bytes. The specification states no rule for it and the wrapper adds none ("normalise nothing") | Probe output: `lone surrogate \ud800 as utf8: efbfbd | \udfff: efbfbd` | No effect today: no operation changes a password (ID-11) and the seeded password is well formed. If a password-change operation is ever added, decide whether an ill-formed string is refused (D-b) |
| F-6 | One derivation costs about 16 ms quiet and 16 to 27 ms (median) under the wave's load | Section 7 | Figures for W20, W24, W29, W98 |
| F-7 | **Host load.** The 1-minute load average was 4.89 at about 06:55, 11.20 at about 07:03, 30.12 at 07:05:13, 33.93 and 40.62 shortly after, and 41.38 at 07:07:11 | `uptime` lines quoted in sections 7 and 8 | The load guard of P9 names 10 as its limit. No test of this row timed out, but the controller may want to apply the guard |
| F-8 | Vitest 5.0.3 with `--reporter=json` and no `--outputFile` writes `apps/core-server/.vitest/json/output.json`, which no `.gitignore` rule covers (`git check-ignore` exit 1) | Section 10 | A row that needs the JSON reporter should pass `--outputFile` with a scratch path. Whether `.vitest/` is added to `.gitignore` is a decision for the row that owns that file (D-c) |
| F-9 | Sandboxed `npm` and `vitest` runs print six lines `ERROR: failed to copy trust settings of system certificate` before the runner starts | Section 8 | Noise; not a failure |

## 12. Deviations from the plan and decisions needed

| ID | Deviation | Reason |
|---|---|---|
| DV-1 | The API has two more exports than the four functions the row names: the factory `createPasswordHasher` and `deriveArgon2id` | The seam for a derivation spy: this row's dummy-path tests need it, and AC-B-24 asks W24 for a spy that counts one derivation per attempt. The four named functions are the factory bound to the built-in |
| DV-2 | Two record types instead of one | A row read back has `algorithm: string` and possibly `Uint8Array` bytes; a record just made is narrower. Both name the same six members |
| DV-3 | Three test files instead of one; one of them replaces `node:crypto` by call-through spies (`vi.mock('node:crypto', { spy: true })`) | It proves the default exports' wiring (salt source, no pepper, `timingSafeEqual`) on the production path, which an injected seam cannot show |
| DV-4 | The wrapper writes no error log | Row rule 4 ("never logs"). No error is swallowed: every failure is rethrown as a coded `PasswordHashError`, and the caller (W24, W20) logs the code through the server's logger |
| DV-5 | `prettier` 3.9.9 (present in `node_modules`, not a declared dependency) was run once on the five files with `--print-width 100 --single-quote` | To match the style of the workspace's existing files, which pass the same check. No manifest was edited and nothing was installed |
| DV-6 | The shared trackers and `implementation/99_implementation_report.md` were not written | Parallel run (P8; CLAUDE.md §3, rule 4). This document and the progress file replace them |
| DV-7 | The expected vector tags were written from the published texts as the agent knows them, not copied from a fetched source | No network in this row (P20) and no vector in the research. The run reproduces all ten literals bit for bit (section 5) |

| ID | Decision for the controller | Proposal |
|---|---|---|
| D-a | **How the 128 characters of ID-P10 are counted.** The wrapper counts UTF-16 code units (`password.length`), which is what zod's `.max(128)` counts; the largest accepted input is then 384 UTF-8 bytes | Record it, and have W19 write the body schema of `signIn` as `z.string().min(1).max(128)`, so the contract and the wrapper cannot disagree |
| D-b | Lone surrogates (F-5) | Accept as is for this task; revisit only if a password-change operation is added |
| D-c | `.vitest/` in `.gitignore` (F-8) | Add it in the next row that owns `.gitignore`, or instruct rows to pass `--outputFile` |
| D-d | A malformed stored record makes `verifyPassword` reject with `RECORD_INVALID` without a derivation | Accept: the CHECK constraints of T-05 make such a row impossible, and failing closed with a code is preferable to answering "wrong password" for a corrupted row. W24 maps it to a 500 logged by code |

## 13. Rollback (R-NEW)

The row created its paths; no stub or placeholder existed before, so P23 does not apply.

```
cd /Users/gsp-budi/Documents/DEMS
git clean -fd -- apps/core-server/src/modules/identity/password-hash
```

Run only on the controller's instruction. It removes the five files and the folder. If W08 has
not written `modules/identity/index.ts` by then, the empty parent folders
`apps/core-server/src/modules/identity/` and `apps/core-server/src/modules/` remain and can be
removed with `rmdir`. Rows that depend on this one: W20 (seed), W24 (identity core).

## 14. Not done here

| Item | Owner |
|---|---|
| The table `operator_credentials`, its typed schema and its CHECK constraints | W17 |
| Hashing the seeded operators; AC-B-30's query on the stored row | W20 |
| The sign-in handler, the lockout, the re-hash after a success, the spy of AC-B-24 | W24 |
| A byte-level comparison of the RFC literal with the RFC text | A reviewer with network access (section 5) |

## Appendix A. Probe scripts and their output

The scripts lived in the session's scratch folder. They are reproduced here so that the evidence
outlives it. Run from `/Users/gsp-budi/Documents/DEMS` with `node <file>`; A.4 needs
`node --import tsx`.

### A.1 RFC 9106 vectors and warnings (output in section 3.3)

```js
import { argon2, argon2Sync } from 'node:crypto';
const warnings = [];
process.on('warning', (w) => warnings.push(`${w.name}: ${w.message}`));

// RFC 9106 section 5 test vectors: one shared input, three variants.
const base = {
  message: Buffer.alloc(32, 0x01),
  nonce: Buffer.alloc(16, 0x02),
  secret: Buffer.alloc(8, 0x03),
  associatedData: Buffer.alloc(12, 0x04),
  parallelism: 4,
  tagLength: 32,
  memory: 32,
  passes: 3,
};
const expected = {
  argon2d: '512b391b6f1162975371d30919734294f868e3be3984f3c1a13a4db9fabe4acb',
  argon2i: 'c814d9d1dc7f37aa13f0d77f2494bda1c8de6b016dd388d29952a4c4672b6ce8',
  argon2id: '0d640df58d78766c08c037a34a8b53c9d01ef0452d75b65eb52520e96b01e659',
};
for (const alg of Object.keys(expected)) {
  const sync = argon2Sync(alg, base).toString('hex');
  const asyncHex = await new Promise((res, rej) =>
    argon2(alg, base, (err, key) => (err ? rej(err) : res(key.toString('hex')))),
  );
  console.log(alg, 'sync', sync === expected[alg] ? 'MATCH' : `MISMATCH ${sync}`, '| async', asyncHex === expected[alg] ? 'MATCH' : `MISMATCH ${asyncHex}`);
}
// Return type and shape of the async form.
const ret = argon2('argon2id', base, (err, key) => {
  console.log('callback: err =', err, '| Buffer.isBuffer(key) =', Buffer.isBuffer(key), '| length =', key.length);
});
console.log('argon2() return value:', ret);
await new Promise((r) => setTimeout(r, 50));
console.log('warnings emitted:', warnings.length ? warnings : '(none)');
```

### A.2 API facts, error shapes and raw timing

The script times ten asynchronous and five synchronous derivations with the parameters of SR-05,
counts 1 ms timer ticks during one asynchronous derivation, starts four at once, compares a
string message with its UTF-8 bytes, calls the built-in with seven invalid parameter sets and an
unknown algorithm (each with the marker password `SECRETMARK`, checking that no message quotes
it), compares `memory: 67` with `memory: 64`, and passes an empty message. First run (about
06:55 WIB), unabridged apart from the error lines already quoted in section 3.4:

```
cpu: Apple M5 x 10 | loadavg: 4.89 4.52 3.43
async x10 ms: min 15.5 median 16.3 max 18.3 mean 16.5
sync  x5  ms: min 16.2 median 16.7 max 17.6
event loop during one async derivation of 16.0 ms: 12 timer ticks (0 would mean blocked)
4 concurrent async derivations, wall ms: 23.4
string message == utf8 bytes: true
memory 67 gives the same tag as 64 (rounded down): false
empty message accepted by built-in, tag length 32
exit=0
stderr bytes:        0
```

Second run of the same script at 07:06 WIB (load 40.62): `async x10 ms: min 21.2 median 27.2
max 31.3 mean 27.0`; `sync x5 ms: min 21.3 median 21.7 max 22.8`; `event loop during one async
derivation of 30.1 ms: 21 timer ticks`; `4 concurrent async derivations, wall ms: 33.7`; the other
lines identical; exit 0; stderr 0 bytes.

### A.3 Reference vectors without secret and associated data

```js
import { argon2Sync } from 'node:crypto';
// Reference implementation (phc-winner-argon2, src/test.c, Argon2id v=19 block): password "password", salt "somesalt", tag 32 bytes.
const cases = [
  [2, 16, 1, 'password', 'somesalt', '09316115d5cf24ed5a15a31a3ba326e5cf32edc24702987c02b6566f61913cf7'],
  [2, 8, 1, 'password', 'somesalt', '9dfeb910e80bad0311fee20f9c0e2b12c17987b4cac90c2ef54d5b3021c68bfe'],
  [2, 8, 2, 'password', 'somesalt', '6d093c501fd5999645e0ea3bf620d7b8be7fd2db59c20d9fff9539da2bf57037'],
  [1, 16, 1, 'password', 'somesalt', 'f6a5adc1ba723dddef9b5ac1d464e180fcd9dffc9d1cbf76cca2fed795d9ca98'],
  [4, 16, 1, 'password', 'somesalt', '9025d48e68ef7395cca9079da4c4ec3affb3c8911fe4f86d1a2520856f63172c'],
  [2, 16, 1, 'differentpassword', 'somesalt', '0b84d652cf6b0c4beaef0dfe278ba6a80df6696281d7e0d2891b817d8c458fde'],
  [2, 16, 1, 'password', 'diffsalt', 'bdf32b05ccc42eb15d58fd19b1f856b113da1e9a5874fdcc544308565aa8141c'],
];
for (const [t, mLog2, p, pw, salt, want] of cases) {
  const got = argon2Sync('argon2id', { message: Buffer.from(pw, 'utf8'), nonce: Buffer.from(salt, 'utf8'), parallelism: p, tagLength: 32, memory: 2 ** mLog2, passes: t }).toString('hex');
  console.log(`t=${t} m=2^${mLog2} p=${p} pw=${pw} salt=${salt}:`, got === want ? 'MATCH' : `MISMATCH got ${got}`);
}
```

```
t=2 m=2^16 p=1 pw=password salt=somesalt: MATCH
t=2 m=2^8 p=1 pw=password salt=somesalt: MATCH
t=2 m=2^8 p=2 pw=password salt=somesalt: MATCH
t=1 m=2^16 p=1 pw=password salt=somesalt: MATCH
t=4 m=2^16 p=1 pw=password salt=somesalt: MATCH
t=2 m=2^16 p=1 pw=differentpassword salt=somesalt: MATCH
t=2 m=2^16 p=1 pw=password salt=diffsalt: MATCH
exit=0
```

### A.4 Timing through the wrapper

The script imports the folder's `index.ts`, makes one dummy password, warms up with one
`hashPassword`, then times 20 sequential calls of each function and 3, 4 and 8 concurrent
`hashPassword` calls. Three runs:

```
node v26.8.2 | Apple M5 x 10 | 24 GiB | loadavg 11.20 7.39 5.53 | UV_THREADPOOL_SIZE (default 4)
hashPassword         n=20 min 20.5 median 25.3 p95 64.7 max 64.7 mean 27.4 ms
verifyPassword (ok)  n=20 min 20.8 median 27.2 p95 31.8 max 31.8 mean 27.3 ms
verifyPassword (bad) n=20 min 20.5 median 25.6 p95 34.1 max 34.1 mean 26.4 ms
verifyAgainstDummy   n=20 min 22.0 median 25.7 p95 40.7 max 40.7 mean 26.6 ms
3 hashPassword calls at once: wall 130.4 ms
4 hashPassword calls at once: wall 83.6 ms
8 hashPassword calls at once: wall 160.9 ms
rss 160 MiB before 4 concurrent verifications, 160 MiB after
exit=0
```

```
node v26.8.2 | Apple M5 x 10 | 24 GiB | loadavg 33.93 16.18 9.14 | UV_THREADPOOL_SIZE (default 4)
hashPassword         n=20 min 21.8 median 25.6 p95 29.1 max 29.1 mean 25.8 ms
verifyPassword (ok)  n=20 min 21.9 median 26.1 p95 28.5 max 28.5 mean 25.6 ms
verifyPassword (bad) n=20 min 22.4 median 25.8 p95 29.6 max 29.6 mean 25.8 ms
verifyAgainstDummy   n=20 min 24.1 median 26.5 p95 31.6 max 31.6 mean 26.9 ms
3 hashPassword calls at once: wall 32.8 ms
4 hashPassword calls at once: wall 34.9 ms
8 hashPassword calls at once: wall 91.3 ms
rss 145 MiB before 4 concurrent verifications, 145 MiB after
exit=0
```

```
node v26.8.2 | Apple M5 x 10 | 24 GiB | loadavg 40.62 20.60 11.16 | UV_THREADPOOL_SIZE (default 4)
hashPassword         n=20 min 21.9 median 26.6 p95 29.2 max 29.2 mean 25.9 ms
verifyPassword (ok)  n=20 min 18.9 median 22.1 p95 25.1 max 25.1 mean 21.9 ms
verifyPassword (bad) n=20 min 15.6 median 17.0 p95 21.8 max 21.8 mean 17.2 ms
verifyAgainstDummy   n=20 min 14.3 median 15.5 p95 17.3 max 17.3 mean 15.6 ms
3 hashPassword calls at once: wall 21.4 ms
4 hashPassword calls at once: wall 28.4 ms
8 hashPassword calls at once: wall 41.7 ms
rss 160 MiB before 4 concurrent verifications, 160 MiB after
exit=0
```

With n = 20 the "p95" column equals the maximum (index 19 of 20).

---
*Generated: 2026-10-04 07:10 WIB*
*Last Updated: 2026-10-04 07:10 WIB*
