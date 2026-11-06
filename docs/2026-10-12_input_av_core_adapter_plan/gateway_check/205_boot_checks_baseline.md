---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 205
requirement: SX-17 (verification/07_security_x1_x2.md)
agent: git-specialist
tier: T3 (each command and its output)
date: 2026-10-13
status: complete
---

# Row 205 - baseline record of the boot check files (SX-17)

Read-only git. No file but this record and `delegation_progress/row_205.md` was written. Every block below is a command run for this record and its output, in this pass.

Note on the path: the blueprint cell names `verification/205_sx17_boot_baseline.md`; the order of the controller for this pass names `gateway_check/205_boot_checks_baseline.md`. This file follows the order.

## 1. The commit the X rows start from

```
$ git rev-parse --abbrev-ref HEAD
task4/input-av-core-port
```

```
$ git rev-parse HEAD
0f5d2a8ede541bb08b05ad7d4c79a6c09953d5a6
```

```
$ git log --format='%H %ci %s' -1 HEAD | cut -c1-200
0f5d2a8ede541bb08b05ad7d4c79a6c09953d5a6 2026-10-13 10:36:28 +0700 feat: task 4 track D - production camera and microphone adapters, stream-level connection test, microphone registrar, selector closin
```

```
$ git rev-parse cf2f8008; git merge-base --is-ancestor cf2f8008 HEAD && echo 'cf2f8008 is an ancestor of HEAD'
cf2f80085a5c14775e129e9df306e504fa15651e
cf2f8008 is an ancestor of HEAD
```

## 2. Blob hash at HEAD, SHA-256 of the working-tree file, and whether the tree differs

### apps/core-server/src/capture/boot/checks.ts

```
$ git rev-parse HEAD:apps/core-server/src/capture/boot/checks.ts
1697e4b9dec975226974ae9f2053e2145166a0f2
```

```
$ git hash-object apps/core-server/src/capture/boot/checks.ts
1697e4b9dec975226974ae9f2053e2145166a0f2
```

```
$ shasum -a 256 apps/core-server/src/capture/boot/checks.ts
d201004b6710458674ad0fc861d872e4355fa05b607a03f313aec53ba510dd94  apps/core-server/src/capture/boot/checks.ts
```

```
$ git show HEAD:apps/core-server/src/capture/boot/checks.ts | shasum -a 256
d201004b6710458674ad0fc861d872e4355fa05b607a03f313aec53ba510dd94  -
```

```
$ wc -l apps/core-server/src/capture/boot/checks.ts
     485 apps/core-server/src/capture/boot/checks.ts
```

```
$ git status --short -- apps/core-server/src/capture/boot/checks.ts; echo "(exit $?; empty above = no difference in index or tree)"
(exit 0; empty above = no difference in index or tree)
```

```
$ git diff --stat -- apps/core-server/src/capture/boot/checks.ts; echo '(empty above = working tree equals index)'
(empty above = working tree equals index)
```

```
$ git diff HEAD --stat -- apps/core-server/src/capture/boot/checks.ts; echo '(empty above = working tree equals HEAD)'
(empty above = working tree equals HEAD)
```

```
$ git log --oneline -5 -- apps/core-server/src/capture/boot/checks.ts | cut -c1-160
0f5d2a8e feat: task 4 track D - production camera and microphone adapters, stream-level connection test, microphone registrar, selector closing rows, host and p
6e6707dd feat: task 4 track D - worker announce gate (branch B), production door, credential reader, unassigned selector slot contract, session start, test came
035150b2 fix: task 3 — final chain (rows 98-101) run, its small findings fixed; production Core refuses the demo operator password, one verify part rule for b
951c80e5 test: task 3 — test-suite consolidation after the measured audit; 165 per-wave test files merged into their feature homes, list pins turned into rule
74fd1f17 fix: task 3 wave G/H — six milestone gates run, their findings fixed; real-capture evidence states only facts, sealed player, export download, speech
```

```
$ git diff cf2f8008 --stat -- apps/core-server/src/capture/boot/checks.ts
 apps/core-server/src/capture/boot/checks.ts | 58 ++++++++++++++++++++++++++++-
 1 file changed, 57 insertions(+), 1 deletion(-)
```

### apps/core-server/src/capture/boot/index.ts

```
$ git rev-parse HEAD:apps/core-server/src/capture/boot/index.ts
88c660be39aa42fa5b4ea4f364f11f9fe572403c
```

```
$ git hash-object apps/core-server/src/capture/boot/index.ts
88c660be39aa42fa5b4ea4f364f11f9fe572403c
```

```
$ shasum -a 256 apps/core-server/src/capture/boot/index.ts
676285240618dc1c4d983cab9095f1b177b0025137d7b4c0c0a622e89c522dc0  apps/core-server/src/capture/boot/index.ts
```

```
$ git show HEAD:apps/core-server/src/capture/boot/index.ts | shasum -a 256
676285240618dc1c4d983cab9095f1b177b0025137d7b4c0c0a622e89c522dc0  -
```

```
$ wc -l apps/core-server/src/capture/boot/index.ts
     324 apps/core-server/src/capture/boot/index.ts
```

```
$ git status --short -- apps/core-server/src/capture/boot/index.ts; echo "(exit $?; empty above = no difference in index or tree)"
(exit 0; empty above = no difference in index or tree)
```

```
$ git diff --stat -- apps/core-server/src/capture/boot/index.ts; echo '(empty above = working tree equals index)'
(empty above = working tree equals index)
```

```
$ git diff HEAD --stat -- apps/core-server/src/capture/boot/index.ts; echo '(empty above = working tree equals HEAD)'
(empty above = working tree equals HEAD)
```

```
$ git log --oneline -5 -- apps/core-server/src/capture/boot/index.ts | cut -c1-160
0f5d2a8e feat: task 4 track D - production camera and microphone adapters, stream-level connection test, microphone registrar, selector closing rows, host and p
035150b2 fix: task 3 — final chain (rows 98-101) run, its small findings fixed; production Core refuses the demo operator password, one verify part rule for b
74fd1f17 fix: task 3 wave G/H — six milestone gates run, their findings fixed; real-capture evidence states only facts, sealed player, export download, speech
f2932211 fix: task 3 wave F — code reviews of M3-M8 (rows 63, 69, 74, 80, 88, 93) and their fixes; one-camera seal, seal way-out + quarantine, case scope, rea
abf742f5 feat: task 3 wave D/E checkpoint — real capture to sealed evidence end to end (rows 61, 71, 82, 86, 90, 91, 92, 139, 140), schema 6 / dbc-7, all suit
```

```
$ git diff cf2f8008 --stat -- apps/core-server/src/capture/boot/index.ts
 apps/core-server/src/capture/boot/index.ts | 93 +++++++++++++++++++++++++++++-
 1 file changed, 92 insertions(+), 1 deletion(-)
```

## 3. The folder as a whole (the tests of checks 4, 4b, 4c are part of the baseline: they must run unedited)

```
$ git status --short -- apps/core-server/src/capture/boot; echo '(empty above = nothing in the folder differs from HEAD)'
(empty above = nothing in the folder differs from HEAD)
```

```
$ git ls-tree HEAD apps/core-server/src/capture/boot/__tests__/boot.test.ts apps/core-server/src/capture/boot/__tests__/checks.test.ts
100644 blob 3b65b64144e9df319642b5fc3afb81d29bf5d2e4	apps/core-server/src/capture/boot/__tests__/boot.test.ts
100644 blob 13245e75283d6e0a354a70d5c294a02257361361	apps/core-server/src/capture/boot/__tests__/checks.test.ts
```

```
$ shasum -a 256 apps/core-server/src/capture/boot/__tests__/boot.test.ts apps/core-server/src/capture/boot/__tests__/checks.test.ts
8790531ec7b7e01e1ea694f51978b54abbda0c3598f08f3ffadb7ed54ac55130  apps/core-server/src/capture/boot/__tests__/boot.test.ts
04a3dd6984ff9bf8371fc452304e0de49f5cfd8311da77e5ca5f27726e83a8aa  apps/core-server/src/capture/boot/__tests__/checks.test.ts
```

```
$ git status --short -- apps/core-server | head -20; echo '(whole core-server tree)'
 M apps/core-server/src/db/schema/value-sets.ts
(whole core-server tree)
```

## 4. Current line numbers, found by grepping the code names (working tree = HEAD, section 2)

```
$ grep -n 'signingKeyProblem()\|signingKeyIsDevelopment()\|demoPasswordOperators()\|// 4\|CaptureBootRefusal.SIGNING_KEY_UNUSABLE\|CaptureBootRefusal.DEVELOPMENT_SIGNING_KEY\|CaptureBootRefusal.DEMO_PASSWORD_IN_PRODUCTION\|hostCheckOutcomeOf(\|deliveredProgramOutcomeOf(' apps/core-server/src/capture/boot/checks.ts
350:  signingKeyProblem(): string | null;
355:  signingKeyIsDevelopment(): boolean;
362:  demoPasswordOperators(): Promise<number | null>;
440:  // 4: the evidence signing key.
441:  const signing = deps.signingKeyProblem();
442:  if (signing !== null) return refuse(CaptureBootRefusal.SIGNING_KEY_UNUSABLE, signing);
443:  // 4b: a development key never signs for a production Core (R88-08 (3)). REAL_DEVELOPMENT accepts it.
444:  if (operation === CaptureOperation.REAL_PRODUCTION && deps.signingKeyIsDevelopment()) return refuse(CaptureBootRefusal.DEVELOPMENT_SIGNING_KEY, null);
446:  // 4c: the published demo password is no credential of a production Core (S99-01, D241). REAL_DEVELOPMENT and SIMULATED never ask.
449:    const operators = await deps.demoPasswordOperators().catch(() => null);
450:    if (operators === null || !Number.isSafeInteger(operators) || operators < 0) return refuse(CaptureBootRefusal.DEMO_PASSWORD_IN_PRODUCTION, OPERATORS_UNREADABLE);
451:    if (operators > 0) return refuse(CaptureBootRefusal.DEMO_PASSWORD_IN_PRODUCTION, `operators=${operators}`, { operators });
454:  // 4d: the host of a production Core (task 4 row 80; BR-12, AD-09 (1), C19). REAL_DEVELOPMENT and SIMULATED never ask,
457:    const host = await hostCheckOutcomeOf(deps.host, (candidate) => workerProgramProblemOf(candidate, deps.inspect));
466:  // 4e: the delivered programs of a production Core (task 4 row 81; F10 (d), C19, HOST-44 to HOST-46). Asked like 4d:
469:    const programs = await deliveredProgramOutcomeOf(deps.programs, (candidate) => workerProgramProblemOf(candidate, deps.inspect));
```

```
$ grep -n "DEVELOPMENT_SIGNING_KEY:\|DEMO_PASSWORD_IN_PRODUCTION:\|SIGNING_KEY_UNUSABLE:\|OPERATORS_UNREADABLE =" apps/core-server/src/capture/boot/checks.ts
81:  SIGNING_KEY_UNUSABLE: 'CAPTURE_SIGNING_KEY_UNUSABLE',
83:  DEVELOPMENT_SIGNING_KEY: 'CAPTURE_DEVELOPMENT_SIGNING_KEY_IN_PRODUCTION',
88:  DEMO_PASSWORD_IN_PRODUCTION: 'CAPTURE_DEMO_OPERATOR_PASSWORD_IN_PRODUCTION',
115:  CAPTURE_SIGNING_KEY_UNUSABLE: 'The evidence signing key cannot be loaded from <data directory>/signer: real capture does not start without the key that seals its packages. Provision the key once, then start again.',
129:export const OPERATORS_UNREADABLE = 'OPERATORS_UNREADABLE';
```

```
$ sed -n '440,472p' apps/core-server/src/capture/boot/checks.ts | cat -n | awk '{n=$1+439; $1=""; print n ":" $0}'
440: // 4: the evidence signing key.
441: const signing = deps.signingKeyProblem();
442: if (signing !== null) return refuse(CaptureBootRefusal.SIGNING_KEY_UNUSABLE, signing);
443: // 4b: a development key never signs for a production Core (R88-08 (3)). REAL_DEVELOPMENT accepts it.
444: if (operation === CaptureOperation.REAL_PRODUCTION && deps.signingKeyIsDevelopment()) return refuse(CaptureBootRefusal.DEVELOPMENT_SIGNING_KEY, null);
445:
446: // 4c: the published demo password is no credential of a production Core (S99-01, D241). REAL_DEVELOPMENT and SIMULATED never ask.
447: if (operation === CaptureOperation.REAL_PRODUCTION) {
448: // A reader that throws is a reader that could not read: fail closed, and nothing of its error is passed on.
449: const operators = await deps.demoPasswordOperators().catch(() => null);
450: if (operators === null || !Number.isSafeInteger(operators) || operators < 0) return refuse(CaptureBootRefusal.DEMO_PASSWORD_IN_PRODUCTION, OPERATORS_UNREADABLE);
451: if (operators > 0) return refuse(CaptureBootRefusal.DEMO_PASSWORD_IN_PRODUCTION, `operators=${operators}`, { operators });
452: }
453:
454: // 4d: the host of a production Core (task 4 row 80; BR-12, AD-09 (1), C19). REAL_DEVELOPMENT and SIMULATED never ask,
455: // and neither does a composition that hands no host facts in. The relay and the guard are held to the rule of check 2.
456: if (operation === CaptureOperation.REAL_PRODUCTION && deps.host !== undefined) {
457: const host = await hostCheckOutcomeOf(deps.host, (candidate) => workerProgramProblemOf(candidate, deps.inspect));
458: if (host.failure !== null) return refuse(host.failure.code, host.failure.reason);
459: if (host.commands === 'NOT_LINUX') {
460: const context = { code: 'CAPTURE_HOST_PROFILE_NOT_ASKED', operation, hostChecks: host.inPlace };
461: sinks.warn(context, HOST_NOT_LINUX);
462: sinks.persist({ level: 'warn', source: SOURCE, message: HOST_NOT_LINUX, code: context.code, context });
463: } else sinks.info({ code: 'CAPTURE_HOST_CHECKS_PASSED', operation, hostChecks: host.inPlace }, HOST_PASSED);
464: }
465:
466: // 4e: the delivered programs of a production Core (task 4 row 81; F10 (d), C19, HOST-44 to HOST-46). Asked like 4d:
467: // REAL_PRODUCTION only, and only when the composition hands them in. The relay is started once, with no start message.
468: if (operation === CaptureOperation.REAL_PRODUCTION && deps.programs !== undefined) {
469: const programs = await deliveredProgramOutcomeOf(deps.programs, (candidate) => workerProgramProblemOf(candidate, deps.inspect));
470: if (programs.failure !== null) return refuse(programs.failure.code, programs.failure.reason);
471: sinks.info({ code: 'CAPTURE_PROGRAM_CHECKS_PASSED', operation, programChecks: programs.inPlace, notAsked: programs.notAsked }, PROGRAMS_PASSED);
472: }
```

### Symbols of boot/index.ts

```
$ grep -n 'function storedSigningKeyProblem\|function storedSigningKeyIsDevelopment\|export const SELECT_STORED_HASH_SETS\|export async function storedDemoPasswordOperators\|SELECT_STORED_HASH_SETS)\|DEMO_OPERATOR_PASSWORD, {\|signingKeyProblem: \|signingKeyIsDevelopment: \|demoPasswordOperators: ' apps/core-server/src/capture/boot/index.ts
198:function storedSigningKeyProblem(directory: string, now: number): string | null {
213:function storedSigningKeyIsDevelopment(directory: string, now: number): boolean {
222:export const SELECT_STORED_HASH_SETS = 'SELECT algorithm, memory_kib, passes, parallelism, salt, hash FROM public.operator_credentials';
239:export async function storedDemoPasswordOperators(
244:    const rows = await app.db.read('capture.boot.operators', async (pool) => (await pool.query<StoredHashSetRow>(SELECT_STORED_HASH_SETS)).rows);
247:      if (await verify(DEMO_OPERATOR_PASSWORD, { algorithm: row.algorithm, memoryKib: row.memory_kib, passes: row.passes, parallelism: row.parallelism, salt: row.salt, hash: row.hash })) count += 1;
313:        signingKeyProblem: () => (mount.signingKeyProblem ?? storedSigningKeyProblem)(`${dataDir}/${SIGNING_STORE_SUBPATH}`, app.clock.now()),
314:        signingKeyIsDevelopment: () => (mount.signingKeyIsDevelopment ?? storedSigningKeyIsDevelopment)(`${dataDir}/${SIGNING_STORE_SUBPATH}`, app.clock.now()),
315:        demoPasswordOperators: () => (mount.demoPasswordOperators ?? (() => storedDemoPasswordOperators(app)))(),
```

```
$ sed -n '197,254p' apps/core-server/src/capture/boot/index.ts | cat -n | awk '{n=$1+196; $1=""; print n ":" $0}'
197: /** The evidence signing key of the store, loaded and dropped: a code of the signer when it does not load. */
198: function storedSigningKeyProblem(directory: string, now: number): string | null {
199: try {
200: loadSoftwareSigner({ dir: directory, now });
201: return null;
202: } catch (error) {
203: // The signer's errors hold a code and a key ID; anything else is reduced to a fixed word.
204: return error instanceof SignerError ? error.code : 'UNREADABLE';
205: }
206: }
207:
208: /**
209: * True when the certificate of the stored signing key carries the development-key mark (the unit
210: * `provisionDevelopmentSigningKey` writes; the verifier reads the same mark from the certificate).
211: * A key that does not load is not "development": check 4 has refused it before this is asked.
212: */
213: function storedSigningKeyIsDevelopment(directory: string, now: number): boolean {
214: try {
215: return isDevelopmentKeySubject(loadSoftwareSigner({ dir: directory, now }).certificate.subject);
216: } catch {
217: return false;
218: }
219: }
220:
221: /** Every stored hash set of an operator, by the columns the verifier needs. Read at boot of a production Core only (S99-01). */
222: export const SELECT_STORED_HASH_SETS = 'SELECT algorithm, memory_kib, passes, parallelism, salt, hash FROM public.operator_credentials';
223:
224: interface StoredHashSetRow extends QueryResultRow {
225: readonly algorithm: string;
226: readonly memory_kib: number;
227: readonly passes: number;
228: readonly parallelism: number;
229: readonly salt: Buffer;
230: readonly hash: Buffer;
231: }
232:
233: /**
234: * S99-01: how many operators of this database still have the published demo password - each stored
235: * hash set is verified with the product's verifier, one after another (a derivation is memory-hard;
236: * a boot is no place to run a dozen at once). Null when the operators cannot be read or a stored set
237: * cannot be verified: the caller refuses the start. Nothing but the count is returned.
238: */
239: export async function storedDemoPasswordOperators(
240: app: Pick<FastifyInstance, 'db'>,
241: verify: (candidate: string, record: Parameters<typeof verifyPassword>[1]) => Promise<boolean> = verifyPassword,
242: ): Promise<number | null> {
243: try {
244: const rows = await app.db.read('capture.boot.operators', async (pool) => (await pool.query<StoredHashSetRow>(SELECT_STORED_HASH_SETS)).rows);
245: let count = 0;
246: for (const row of rows) {
247: if (await verify(DEMO_OPERATOR_PASSWORD, { algorithm: row.algorithm, memoryKib: row.memory_kib, passes: row.passes, parallelism: row.parallelism, salt: row.salt, hash: row.hash })) count += 1;
248: }
249: return count;
250: } catch {
251: // The error of a read or of a derivation is not passed on: it could name a row. The refusal says OPERATORS_UNREADABLE.
252: return null;
253: }
254: }
```

### Digest of the exact text of each condition (symbol baseline: a later row compares these ranges by symbol, not by line)

```
$ sed -n '440,452p' apps/core-server/src/capture/boot/checks.ts | shasum -a 256; echo '(checks.ts 440-452: checks 4, 4b, 4c)'
232a48373c3637b7fb037b63df160de95d1b222443ac89a14d0c208371566756  -
(checks.ts 440-452: checks 4, 4b, 4c)
```

```
$ sed -n '440,452p' apps/core-server/src/capture/boot/checks.ts | cat -n | sed -n '1p;3p;5,13p' >/dev/null; git show HEAD:apps/core-server/src/capture/boot/checks.ts | sed -n '440,452p' | shasum -a 256; echo '(same range read from the HEAD blob)'
232a48373c3637b7fb037b63df160de95d1b222443ac89a14d0c208371566756  -
(same range read from the HEAD blob)
```

```
$ sed -n '222p' apps/core-server/src/capture/boot/index.ts | shasum -a 256; git show HEAD:apps/core-server/src/capture/boot/index.ts | sed -n '222p' | shasum -a 256; echo '(SELECT_STORED_HASH_SETS line, tree then HEAD)'
5cddf11b39c6ff0edda4c96b4f93444ca7eb6a0137be93bd6cf7abc812d484e1  -
5cddf11b39c6ff0edda4c96b4f93444ca7eb6a0137be93bd6cf7abc812d484e1  -
(SELECT_STORED_HASH_SETS line, tree then HEAD)
```

```
$ sed -n '239,254p' apps/core-server/src/capture/boot/index.ts | shasum -a 256; git show HEAD:apps/core-server/src/capture/boot/index.ts | sed -n '239,254p' | shasum -a 256; echo '(storedDemoPasswordOperators, tree then HEAD)'
946a58b4ee80ac0ebcd8a831ddf3ff0feb57fc52a24554f1c345cb0fff004f19  -
946a58b4ee80ac0ebcd8a831ddf3ff0feb57fc52a24554f1c345cb0fff004f19  -
(storedDemoPasswordOperators, tree then HEAD)
```

(Indentation of the code lines in the numbered listings above was dropped by the `awk` used to number them; the text is otherwise as in the files.)

## 5. The design's cited lines beside the true ones

Design: `masterplan/05_design_x1_x2.md` sections 2.x (lines 37-42, 118, 232, 436 of that file). Security review: `verification/07_security_x1_x2.md` line 40 gave the intermediate numbers. True lines: sections 2 and 4 above (HEAD `0f5d2a8e`, tree equal to HEAD).

| What | Design cites | Review found (tree then) | TRUE now (HEAD = tree) | One-line condition |
|------|--------------|--------------------------|------------------------|--------------------|
| Check 4 | `checks.ts:423-424` | `checks.ts:440-452` block | `checks.ts:440-442` (call 441, refusal 442) | `deps.signingKeyProblem()` returns non-null -> refuse `SIGNING_KEY_UNUSABLE` (`CAPTURE_SIGNING_KEY_UNUSABLE`) |
| Check 4b | `checks.ts:426-427` | same block | `checks.ts:443-444` (condition and refusal on 444) | `operation === REAL_PRODUCTION && deps.signingKeyIsDevelopment()` -> refuse `DEVELOPMENT_SIGNING_KEY` (`CAPTURE_DEVELOPMENT_SIGNING_KEY_IN_PRODUCTION`), reason null |
| Check 4c | `checks.ts:429-435` | same block | `checks.ts:446-452` (read 449; unreadable 450; counted 451) | REAL_PRODUCTION only: `await deps.demoPasswordOperators().catch(() => null)`; null / not a safe integer / below 0 -> refuse `DEMO_PASSWORD_IN_PRODUCTION` (`CAPTURE_DEMO_OPERATOR_PASSWORD_IN_PRODUCTION`) with `OPERATORS_UNREADABLE`; above 0 -> same code with `operators=<n>` |
| Check 4d (host checks) | `checks.ts:36-37` (the doc comment only) | not given | code `checks.ts:454-464` (call 457, refusal 458, non-Linux warning 459-462, pass 463); doc comment `checks.ts:35-41` | REAL_PRODUCTION and `deps.host !== undefined`: `hostCheckOutcomeOf(...)` failure -> refuse with its own code; NOT_LINUX is a warning, not a refusal |
| Check 4e (program checks) | not cited | not given | code `checks.ts:466-472` (call 469, refusal 470, pass 471); doc comment `checks.ts:42-46` | REAL_PRODUCTION and `deps.programs !== undefined`: `deliveredProgramOutcomeOf(...)` failure -> refuse with its own code |
| Key-load reader (F1) | `boot/index.ts:141-149` | `boot/index.ts:198-262` block | `index.ts:198-206` (`storedSigningKeyProblem`; wired at 313) | loads the signer, returns the `SignerError` code or `UNREADABLE` |
| Development test (F3) | `boot/index.ts:157-163` | same block | `index.ts:213-219` (`storedSigningKeyIsDevelopment`; wired at 314) | `isDevelopmentKeySubject(certificate.subject)`; a throw answers false |
| Statement (F6) | `boot/index.ts:166` | same block | `index.ts:222` (`SELECT_STORED_HASH_SETS`); used at 244 | see section 6 |
| Per-row count (F6) | `boot/index.ts:179-198` | same block | `index.ts:239-254` (`storedDemoPasswordOperators`; per-row verify at 247; catch 250-253; wired at 315) | every row of `operator_credentials` (no `enabled` filter) verified against `DEMO_OPERATOR_PASSWORD`; any throw returns null |
| Refusal codes table | not cited | not cited | `checks.ts:81, 83, 88` (names), `111-113` (texts), `129` (`OPERATORS_UNREADABLE`) | - |
| Design 118 ("rule of check 2") | `checks.ts:21-24` | - | `checks.ts:21-24` (doc comment of check 2): still exact | - |
| Design 436 ("seeded database") | `checks.ts:33-34` | - | `checks.ts:33-34` (doc comment of 4c): still exact | - |

The design's cited numbers for 4, 4b, 4c and for the `index.ts` functions were stale (a shift of +17 in `checks.ts`, and the `index.ts` functions are about +57 to +60 lines further down). The CONTENT they quote is unchanged in substance (section 4). The review's `440-452` and `198-262` ranges are correct for the present file. The stale numbers must not be used by rows 211, 225, 228 or the gate 223: they cite by symbol.

## 6. The symbols to quote (blueprint cell: by symbol, not by line)

`SELECT_STORED_HASH_SETS`, `boot/index.ts:222`, byte-exact, sha256 of that line `5cddf11b39c6ff0edda4c96b4f93444ca7eb6a0137be93bd6cf7abc812d484e1`:

    export const SELECT_STORED_HASH_SETS = 'SELECT algorithm, memory_kib, passes, parallelism, salt, hash FROM public.operator_credentials';

Check 4 (`checks.ts:441-442`):

    const signing = deps.signingKeyProblem();
    if (signing !== null) return refuse(CaptureBootRefusal.SIGNING_KEY_UNUSABLE, signing);

Check 4b (`checks.ts:444`):

    if (operation === CaptureOperation.REAL_PRODUCTION && deps.signingKeyIsDevelopment()) return refuse(CaptureBootRefusal.DEVELOPMENT_SIGNING_KEY, null);

Check 4c (`checks.ts:447-452`):

    if (operation === CaptureOperation.REAL_PRODUCTION) {
      const operators = await deps.demoPasswordOperators().catch(() => null);
      if (operators === null || !Number.isSafeInteger(operators) || operators < 0) return refuse(CaptureBootRefusal.DEMO_PASSWORD_IN_PRODUCTION, OPERATORS_UNREADABLE);
      if (operators > 0) return refuse(CaptureBootRefusal.DEMO_PASSWORD_IN_PRODUCTION, `operators=${operators}`, { operators });
    }

The fail-closed catch of the count: `index.ts:250-253` (`} catch { return null; }`), and the `.catch(() => null)` of `checks.ts:449`. Digests of the text, for comparison by later rows: `checks.ts` lines 440-452: `232a4837...6756`; `index.ts` lines 239-254: `946a58b4ee80ac0ebcd8a831ddf3ff0feb57fc52a24554f1c345cb0fff004f19` (full values in section 4).

## 7. Result

| Property | Value |
|----------|-------|
| Branch / HEAD | `task4/input-av-core-port` / `0f5d2a8ede541bb08b05ad7d4c79a6c09953d5a6` (holds rows 80 and 81: batches 7-8; `cf2f8008` is its ancestor) |
| `boot/checks.ts` | blob `1697e4b9dec975226974ae9f2053e2145166a0f2`; sha256 `d201004b6710458674ad0fc861d872e4355fa05b607a03f313aec53ba510dd94`; 485 lines; tree equals HEAD |
| `boot/index.ts` | blob `88c660be39aa42fa5b4ea4f364f11f9fe572403c`; sha256 `676285240618dc1c4d983cab9095f1b177b0025137d7b4c0c0a622e89c522dc0`; 324 lines; tree equals HEAD |
| Folder `capture/boot/` | no difference from HEAD, tests included (`boot.test.ts` blob `3b65b641...`, `checks.test.ts` blob `13245e75...`) |
| Against `cf2f8008` | `checks.ts` +57 -1; `index.ts` +92 -1 (rows 80, 81 and earlier task-4 rows; the line-level check below shows no line of checks 4, 4b, 4c or of `SELECT_STORED_HASH_SETS` changed) |
| True lines | 4: 440-442; 4b: 443-444; 4c: 446-452; 4d: 454-464; 4e: 466-472 |
| Condition "unmodified against that commit" (blueprint cell) | MET: both files and the folder equal HEAD |

Check against `cf2f8008`, line level (run after the stat, `-U0`, deleted lines and hunk heads only):

```
$ git diff cf2f8008 -U0 -- apps/core-server/src/capture/boot/checks.ts | grep '^@@\|^-[^-]'
@@ -34,0 +35,13 @@
@@ -51,0 +65,2 @@ import type { CaptureOperationDecision } from '../fence/operation';
@@ -81,0 +97,4 @@ export const CaptureBootRefusal = {
@@ -104,0 +124,2 @@ const TEXT: Readonly<Record<CaptureBootRefusal, string>> = Object.freeze({
@@ -285 +306 @@ export const RELEASE_WORKER_VERSION = /^capture-worker\/\d{1,4}\.\d{1,4}\.\d{1,4
-export const CAPTURE_WORKER_VERSION = 'capture-worker/0.5.0';
@@ -343,0 +365,12 @@ export interface CaptureBootDeps {
@@ -363,0 +397,3 @@ const WORKER_IGNORED = 'a capture worker program is configured and capture mode
@@ -417,0 +454,20 @@ export async function runCaptureBootChecks(deps: CaptureBootDeps): Promise<Captu
$ git diff cf2f8008 -U0 -- apps/core-server/src/capture/boot/index.ts | grep '^@@\|^-[^-]'
@@ -33,0 +34,11 @@
@@ -48,0 +60 @@ import { probeEvidenceVolume } from './evidence-volume';
@@ -76,0 +89,25 @@ export { probeEvidenceVolume } from './evidence-volume';
@@ -78,0 +116,7 @@ export { BOOT_PROBE_SESSION, probeWorkerHandshake, type WorkerProbeOptions } fro
@@ -113,0 +158,12 @@ export interface CaptureBootMount {
@@ -199,0 +256,19 @@ export async function storedDemoPasswordOperators(
@@ -207 +282,16 @@ export function mountCaptureBootChecks(app: FastifyInstance, mount: CaptureBootM
-  const { captureWorkerPath, mediaStoreDir, dataDir } = app.config;
@@ -226,0 +317 @@ export function mountCaptureBootChecks(app: FastifyInstance, mount: CaptureBootM
```

Reading: in `checks.ts` the only deleted line is the `CAPTURE_WORKER_VERSION` constant (a version bump); the only hunk in the body of `runCaptureBootChecks` is an addition of 20 lines at new 454-473 (checks 4d and 4e, after 4c). In `index.ts` the only deleted line is a destructure in `mountCaptureBootChecks`; the hunk `+256,19` is 19 lines added after the end of `storedDemoPasswordOperators` (the camera-interface reader, `index.ts:256` onward; the hunk head names the nearest function above it), and no line of `SELECT_STORED_HASH_SETS` (222), `storedSigningKeyProblem`, `storedSigningKeyIsDevelopment` or `storedDemoPasswordOperators` body (239-254) is in a hunk. So the three conditions of 4, 4b, 4c and `SELECT_STORED_HASH_SETS` are byte-identical to `cf2f8008` as well as being the baseline at HEAD. The baseline for the X rows remains HEAD `0f5d2a8e`.

Stated also: the working tree has one other unrelated modified file in `apps/core-server` (`src/db/schema/value-sets.ts`), which is outside the files of this record. No `add`, `commit`, `stash`, `clean`, `reset`, `checkout` or `push` was run.
