---
task_id: 2026-10-04_dems_backend_rbac_pairing
date: 2026-10-04
agent: data-collector
blueprint_row: 10
narrative_tier: 2
items_collected: 56 findings (A1-A14, B1-B17, C1-C9, D1-D6, E1-E10); 12 search strings; 87 fetch calls over 86 distinct URLs; 34 npm package metadata lookups
last_updated: 2026-10-04
---

# Identity Security Evidence Collection (row 10, Tier 2)

## Task Overview

Source: `identification/02_structured.md`, row 10 (verbatim): "Collect evidence on identity security, with generic queries only: password hashing for Node 26 (algorithm, parameters, native versus pure implementations); session versus token models for a browser plus a React Native app on loopback; rotation and revocation; lockout and rate limiting; RBAC libraries versus a permission guard for Fastify; cite current public guidance."

Context given to this row (generic): Fastify 5 API on Node 26, a browser single-page app and a React Native (Expo, Android) app, both over loopback HTTP in a local demo; three fixed roles with a permission list; a paired mobile device later holds a device-bound credential. Project constraint: ready-made frameworks and libraries (I1).

This file collects evidence only. It contains no analysis, no choice and no recommendation. Where a source recommends a parameter, the sentence says "the source states"; the collector recommends nothing.

Row 10 verification the controller will apply: at least 2 options per topic; every source-recommended parameter cites a URL with fetch date; options that need an account or hosted service are marked excluded; the query log has no design-book term.

## Method, Confidence Legend and Caveats

- Every web fetch happened on 2026-10-04. "Fetched" in this file always means that date.
- `WebFetch` returns a model-written extraction of the page, not the raw bytes. Each prompt asked for verbatim quotes. Quotes below are as returned. Key OWASP numbers were fetched twice (rendered page and raw markdown source) and agreed.
- Confidence labels used per finding:
  - **H**: primary source (standard, vendor or project page) and cross-checked by a second fetch or a second source.
  - **M**: primary source, single extraction.
  - **L**: web-search summary or third-party page only; the primary page was not retrieved.
- "Not confirmed" means no fetched source states it. Section "Not Confirmed and Gaps" lists each.
- `time.modified` from `npm view` is the registry document's modified timestamp. It is not necessarily the date of the latest release.

## Host Facts and Metadata Lookups (read-only)

| Command | Output | Note |
|---|---|---|
| `node --version` | `v26.8.2` | Run once at the start as a version check |
| `npm view <pkg> version license time.modified --cache $TMPDIR/npmcache` | see "Package Metadata" | The first attempt without `--cache` failed with `npm error code EPERM syscall open` (the sandbox does not allow writing the default npm cache). Retried with a cache directory under the sandbox temp path; no install, no file in the workspace |
| `npm view <pkg> engines peerDependencies --json --cache $TMPDIR/npmcache` | see "Package Metadata" | Same command class, extra read-only fields |

### Package Metadata (verbatim `npm view` output, 2026-10-04)

| Package | version | license | time.modified | engines (if returned) |
|---|---|---|---|---|
| fastify | 5.12.5 | MIT | 2026-09-16T10:23:05.222Z | |
| argon2 | 0.45.1 | MIT | 2026-07-21T23:55:28.494Z | node >=16.17.0 |
| @node-rs/argon2 | 2.2.1 | MIT | 2026-09-10T06:03:49.881Z | node >= 10 |
| hash-wasm | 4.12.0 | MIT | 2024-11-19T19:01:58.371Z | |
| @noble/hashes | 2.4.0 | MIT | 2026-08-27T13:02:42.894Z | |
| bcrypt | 6.0.0 | MIT | 2026-03-28T01:14:17.584Z | node >= 18 |
| bcryptjs | 3.0.3 | BSD-3-Clause | 2026-04-24T23:30:17.803Z | none returned |
| @fastify/rate-limit | 11.2.0 | MIT | 2026-09-04T11:16:44.091Z | none returned |
| @fastify/cookie | 11.1.2 | MIT | 2026-09-04T11:16:38.638Z | none returned |
| @fastify/session | 11.1.3 | MIT | 2026-09-14T08:14:48.436Z | none returned |
| @fastify/secure-session | 8.4.0 | MIT | 2026-09-22T13:06:52.033Z | none returned |
| @fastify/jwt | 10.2.2 | MIT | 2026-09-04T11:16:44.008Z | none returned |
| @fastify/auth | 5.1.1 | MIT | 2026-09-16T12:41:12.347Z | none returned |
| @fastify/bearer-auth | 10.1.3 | MIT | 2026-09-04T11:16:37.972Z | |
| @fastify/passport | 4.0.3 | MIT | 2026-09-22T21:10:34.271Z | |
| @fastify/csrf-protection | 8.0.1 | MIT | 2026-09-04T11:16:37.916Z | |
| @fastify/websocket | 11.3.3 | MIT | 2026-10-03T14:44:35.209Z | |
| @fastify/cors | 11.3.0 | MIT | 2026-09-04T11:16:36.629Z | |
| @fastify/helmet | 13.1.1 | MIT | 2026-09-04T11:16:42.171Z | |
| @casl/ability | 7.0.1 | MIT | 2026-07-06T19:55:28.570Z | none returned |
| casbin | 5.51.1 | Apache-2.0 | 2026-06-25T15:58:12.018Z | |
| fastify-casbin | 4.0.0 | MIT | 2026-06-25T17:01:35.150Z | |
| accesscontrol | 3.1.1 | MIT | 2026-09-24T15:44:46.999Z | |
| fastify-guard | 3.0.1 | MIT | 2024-12-22T12:15:36.356Z | |
| fastify-casl | 2.0.1 | GPL-3.0 | 2022-05-02T04:50:00.993Z | |
| fastify-rbac | 1.0.3 | MIT | 2022-05-02T04:58:10.189Z | |
| rate-limiter-flexible | 11.2.1 | ISC | 2026-09-17T20:00:21.228Z | |
| better-auth | 1.7.7 | MIT | 2026-09-30T21:30:55.975Z | peerDependencies list optional frameworks and databases (e.g. `pg ^8.0.0`, `vitest`); no `fastify` peer listed |
| @better-auth/expo | 1.7.7 | MIT | 2026-09-30T21:29:42.389Z | peers: `better-auth ^1.7.7`, `expo-secure-store >=12.5.0`, `expo-network >=8.0.7`, `expo-linking >=7.0.0`, `expo-constants >=17.0.0`, `expo-web-browser >=14.0.0` |
| jose | 6.2.12 | MIT | 2026-09-05T09:17:12.931Z | |
| fast-jwt | 6.3.3 | Apache-2.0 | 2026-09-03T16:29:53.296Z | |
| lucia | 3.2.2 | MIT | 2025-06-06T16:55:06.618Z | |
| @openfga/sdk | 0.9.7 | Apache-2.0 | 2026-08-18T07:02:47.042Z | |
| cerbos (npm name) | 0.56.0 | Apache-2.0 | 2026-09-30T06:39:15.082Z | what this npm package is was not checked; not used as evidence |
| scrypt-kdf | lookup aborted in the first failing loop; not re-run | | | not used |
| permify-node, @cerbos/http-client | npm error 404 (package name does not exist) | | | not used |

---

## Topic A. Password Hashing for Node 26

### A1. OWASP: algorithm order and the Argon2id configuration set

- **Found**: "Use Argon2id with a minimum configuration of 19 MiB of memory, an iteration count of 2, and 1 degree of parallelism." The page lists these equivalent Argon2id sets (raw markdown wording): `m=47104 (46 MiB), t=1, p=1 (Do not use with Argon2i)`; `m=19456 (19 MiB), t=2, p=1 (Do not use with Argon2i)`; `m=12288 (12 MiB), t=3, p=1`; `m=9216 (9 MiB), t=4, p=1`; `m=7168 (7 MiB), t=5, p=1`. The introduction continues with a fallback ("If Argon2id is not available, use scrypt..."); the rest of that sentence was not captured.
- **Why it matters**: This is the parameter floor that the best-known public guidance states for the server-side hash of seeded and future operator passwords. Memory cost per concurrent sign-in is part of what the set fixes.
- **Verified**: two fetches (rendered page and raw markdown) returned the same sets. Confidence H.
- **Source**: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html and https://raw.githubusercontent.com/OWASP/CheatSheetSeries/master/cheatsheets/Password_Storage_Cheat_Sheet.md (fetched 2026-10-04).

### A2. OWASP: scrypt, bcrypt and PBKDF2 parameters

- **Found**: scrypt `N=2^17 (128 MiB), r=8 (1024 bytes), p=1`. bcrypt: "The work factor should be as large as verification server performance will allow, with a minimum of 10." and "bcrypt has a maximum length input length of 72 bytes" (raw markdown adds a bracketed qualifier "[for most implementations]"). PBKDF2: `PBKDF2-HMAC-SHA256: 600,000 iterations (recommended)`; `PBKDF2-HMAC-SHA512: 220,000 iterations`; `PBKDF2-HMAC-SHA1: 1,400,000 iterations` marked legacy only ("do not select for new systems"). A first extraction also attributed a FIPS statement to the page ("PBKDF2 is permitted by NIST SP 800-63B-4"); that sentence was not returned by the raw-markdown cross-check, so it is L and not relied on.
- **Why it matters**: gives the alternatives the same source states when Argon2id is not used, with exact numbers for the Node built-in `crypto.scrypt` and for bcrypt libraries.
- **Verified**: both fetches agree on the numbers above (HTML and raw markdown). The PBKDF2 SHA-512 and SHA-1 figures were not compared with any older document and were not byte-read. Confidence M-H.
- **Source**: same two OWASP URLs as A1 (fetched 2026-10-04). Other scrypt equivalent sets, if the page lists any, were not captured.

### A3. OWASP: salt, pepper, input limits, upgrade of the work factor

- **Found**: modern algorithms "require the caller to provide a salt" but "most widely used implementations and libraries automatically generate and manage salts internally." Pepper: "A pepper is shared between stored passwords" and "should not be stored along with the generated hash. The pepper should be stored separately." bcrypt: "enforce a maximum password length of 72 bytes (or less)". Upgrading: "wait until the user next authenticates, then re-hash their password with the new work factor."
- **Why it matters**: defines what a sign-in handler must do beyond hashing: salt handling, optional pepper storage separate from the database, and re-hash at next successful sign-in.
- **Verified**: single extraction of the rendered page (section names: Salting, Peppering, Input Limits of bcrypt, Upgrading the Work Factor). Confidence M.
- **Source**: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html (fetched 2026-10-04).

### A4. Password length, composition and blocklist rules (OWASP and NIST)

- **Found**: OWASP: "If MFA is enabled passwords shorter than 8 characters are considered to be weak"; "If MFA is not enabled passwords shorter than 15 characters are considered to be weak"; "Maximum password length should be at least 64 characters to allow passphrases"; "There should be no password composition rules"; "Block common and previously breached passwords". NIST SP 800-63B-4 (section 3.1.1.2 as returned): single-factor passwords SHALL be "a minimum of 15 characters"; passwords used only inside multi-factor MAY be shorter but "SHALL require them to be a minimum of eight characters"; "SHOULD permit a maximum password length of at least 64 characters"; "SHALL NOT impose other composition rules"; verifiers "SHALL compare the prospective secret against a blocklist"; "Passwords SHALL be salted and hashed using a suitable password hashing scheme" with "The salt SHALL be at least 32 bits in length."
- **Why it matters**: states the policy inputs for the seeded demo password and for any password-change endpoint.
- **Verified**: OWASP lengths and lockout-adjacent sentences were returned by both the rendered page and the raw markdown. NIST text from one extraction of the rendered standard. Confidence H (OWASP), M (NIST).
- **Source**: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html, https://raw.githubusercontent.com/OWASP/CheatSheetSeries/master/cheatsheets/Authentication_Cheat_Sheet.md, https://pages.nist.gov/800-63-4/sp800-63b.html (fetched 2026-10-04).

### A5. RFC 9106 (Argon2) parameter sets

- **Found**: status Informational, September 2021. "Argon2id variant with t=1 and 2 GiB memory is the FIRST RECOMMENDED option." First recommended (section 4): "Argon2id with t=1 iteration, p=4 lanes, m=2^(21) (2 GiB of RAM), 128-bit salt, and 256-bit tag size". Second recommended: "Argon2id with t=3 iterations, p=4 lanes, m=2^(16) (64 MiB of RAM), 128-bit salt, and 256-bit tag size". "16 bytes is RECOMMENDED for password hashing" (salt).
- **Why it matters**: a second public source for Argon2id parameters, with a memory range from 64 MiB to 2 GiB, against OWASP's 7-46 MiB sets.
- **Verified**: single extraction of the plain-text RFC. Confidence M.
- **Source**: https://www.rfc-editor.org/rfc/rfc9106.txt (fetched 2026-10-04).

### A6. Node built-in `crypto.argon2` (native, no dependency)

- **Found**: `crypto.argon2(algorithm, parameters, callback)` and `crypto.argon2Sync(algorithm, parameters)`: "Added: v24.7.0"; "Stability: 2 (Stable)" in the docs served on 2026-10-04 (an earlier fetch of the docs page referred to "Node.js v26.10.0"); algorithms `"argon2d"`, `"argon2i"`, `"argon2id"`. Parameters: `message` (password), `nonce` ("must be at least 8 bytes long"), `parallelism` (1 to 2^24-1), `tagLength` (at least 4), `memory` ("in 1KiB blocks; must be at least 8 * parallelism ... rounded down to nearest multiple of 4 * parallelism"), `passes` (at least 1), optional `secret` (pepper, "should NOT be stored with derived key"), optional `associatedData`. Release note for v24.7.0 (2025-08-27): "(SEMVER-MINOR) crypto: add argon2() and argon2Sync() methods (Ranieri Althoff) #50353".
- **Why it matters**: the host runs Node v26.8.2 (host check above), a later line than v24.7.0, so the API exists without any package; it is the only Argon2 option with no native build step and no third-party code.
- **Verified**: docs JSON entry plus Node release blog post; version ordering v24.7.0 < v26.8.2 is a comparison of two sourced numbers. Confidence H.
- **Source**: https://nodejs.org/api/crypto.json and https://nodejs.org/en/blog/release/v24.7.0 (fetched 2026-10-04).

### A7. What the Node `crypto.argon2` entry does and does not document

- **Found**: the documented return value is "Buffer containing the derived key". The example uses `parallelism: 4, tagLength: 64, memory: 65536, passes: 3` with `nonce: randomBytes(16)`; the entry presents these as example values, not as a recommendation. The fetched entry documents no encoded-hash string (PHC format) and no verify helper; `crypto.timingSafeEqual` is the comparison primitive in the same module but its entry was not retrievable (see gaps).
- **Why it matters**: tells what a caller using the built-in must supply itself (salt storage, parameter storage, comparison), compared with libraries that return an encoded string.
- **Verified**: single extraction of the docs JSON entry. Confidence M.
- **Source**: https://nodejs.org/api/crypto.json (fetched 2026-10-04).

### A8. Node built-in `crypto.scrypt` defaults

- **Found**: from Node's own source file the defaults object is `N: 16384, r: 8, p: 1, maxmem: 32 << 20` with the comment "32 MiB, matches SCRYPT_MAX_MEM"; `cost`, `blockSize`, `parallelization` are aliases for N, r, p. The same file as extracted shows no JavaScript-layer memory check (the check is in the native job). Search summaries of nodejs.org docs state "N must be a power of two greater than one, and it is an error when (approximately) 128*N*r > maxmem" (L). Arithmetic from sourced numbers: 128 x 2^17 x 8 = 134,217,728 bytes = 128 MiB, which is OWASP's stated memory for its scrypt set (A2) and is larger than the 32 MiB default `maxmem`.
- **Why it matters**: the built-in scrypt matches OWASP's scrypt set only if `maxmem` is raised above its default; this is a fact about the two sources, not a recommendation.
- **Verified**: source file fetch (M); doc sentence via search summary of nodejs.org (L); arithmetic by the collector.
- **Source**: https://raw.githubusercontent.com/nodejs/node/main/lib/internal/crypto/scrypt.js (fetched 2026-10-04); WebSearch results listing https://nodejs.org/api/crypto.html and https://nodejs.org/download/release/v10.8.0/docs/api/crypto.html (not fetched directly).

### A9. `argon2` (node-argon2): native binding to the reference C implementation

- **Found**: npm `argon2` 0.45.1, MIT, `engines.node >=16.17.0` (registry) while the README states "node-argon2 works only and is tested against Node >=22.0.0". Prebuilt binaries listed: Ubuntu 22.04 x86-64 and ARM64 and ARMv7, MacOS 13 x86-64, MacOS 14 ARM64 (from v0.29.0), Windows Server 2022 x86-64, Alpine 3.18 x86-64/ARM64/ARMv7, FreeBSD 14. If no prebuild matches: "You MUST have a node-gyp global install before proceeding with the install, along with GCC >= 5 / Clang >= 3.3." README: "Please check P-H-C/phc-winner-argon2 for license over Argon2 and the reference implementation." The README defers option defaults and API signatures to a wiki page that was not fetched.
- **Why it matters**: native option with a macOS ARM64 prebuild; the Node 26 line is not named by any fetched source and the registry and README disagree on the minimum Node.
- **Verified**: README extraction plus `npm view`. Confidence M.
- **Source**: https://github.com/ranisalt/node-argon2 ; `npm view argon2` (fetched 2026-10-04).

### A10. `@node-rs/argon2`: Rust binding (napi-rs) with WASM variants

- **Found**: npm 2.2.1, MIT, `engines.node >= 10`. README: "argon2-rust binding for Node.js"; Apple Silicon and linux/windows cross-platform builds mentioned, with browser and Node.js WASM implementations included. API: `hash(password, options?, abortSignal?) => Promise<string>`, `verify(hashed, password, options?, abortSignal?) => Promise<boolean>`. Defaults: `memoryCost 19456` (KiB), `timeCost 2`, `outputLen 32`, `parallelism 1`, algorithm Argon2id, version 0x13; "generates 16-byte salts". README benchmarks against node-argon2 (library authors' own numbers, machine not stated in the extraction): `m=19456 KiB, t=2, p=1: 7.58 ms vs 15.41 ms`; `m=65536 KiB, t=3, p=1: 49.35 ms vs 84.57 ms`; `m=65536 KiB, t=3, p=4: 13.62 ms vs 22.54 ms`.
- **Why it matters**: its default parameters equal OWASP's stated minimum set (m=19456, t=2, p=1); it returns an encoded string and has an async verify.
- **Verified**: README extraction plus `npm view`. Confidence M. Node 26 support not confirmed.
- **Source**: https://github.com/napi-rs/node-rs/tree/main/packages/argon2 ; `npm view @node-rs/argon2` (fetched 2026-10-04).

### A11. `hash-wasm`: WebAssembly implementation, zero dependencies

- **Found**: npm 4.12.0, MIT, registry `time.modified 2024-11-19`. README: "lightning fast hash function library for browsers and Node.js"; "Zero dependencies"; Node.js 8+ and Deno 1+ listed; algorithms include Argon2 (d, i, id v1.3), bcrypt, scrypt, PBKDF2. Argon2id example: `parallelism: 1, iterations: 256, memorySize: 512 (KB), hashLength: 32, outputType: "encoded"`, with `argon2Verify({ password, hash })`. Benchmark (Chrome v131, Ryzen 9 7900X): "Argon2id (m=512, t=8, p=1): hash-wasm 4.10.0 = 438 ops" (unit as returned).
- **Why it matters**: a pure-runtime (WASM) option that runs on Node and in a browser without a native build.
- **Verified**: README extraction plus `npm view`. Confidence M. Node 26 support not confirmed.
- **Source**: https://github.com/Daninet/hash-wasm ; `npm view hash-wasm` (fetched 2026-10-04).

### A12. `@noble/hashes`: audited pure JavaScript KDFs

- **Found**: npm 2.4.0, MIT. "Audited & minimal JS implementation of hash functions, MACs and KDFs"; "For this package, there are 0 dependencies." Functions: `argon2d`, `argon2i`, `argon2id`, `scrypt`, `scryptAsync`, `pbkdf2`, `pbkdf2Async`. README warning: "Argon2 can't be fast in JS, because there is no fast Uint64Array. It is suggested to use Scrypt instead." Argon2 defaults as extracted: `t=3, m=1GiB, p=1`; no async variant for argon2 on the page. Benchmarks as extracted (machine not stated): `scrypt(n: 2 ** 19, r: 8, p: 1) x 1 ops/sec @ 751 ms/op`; `argon2id(t: 1, m: 128MB) x 3 ops/sec @ 276 ms/op`. Audit: "at version 1.0.0, in Jan 2022, independently, by Cure53. Scope: everything, besides blake3, sha3-addons, sha1 and argon2, which have not been audited."
- **Why it matters**: the pure-JS option; the library's own text says its Argon2 is slow and unaudited.
- **Verified**: README extraction plus `npm view`. Confidence M.
- **Source**: https://github.com/paulmillr/noble-hashes ; `npm view @noble/hashes` (fetched 2026-10-04).

### A13. bcrypt: native `bcrypt` and pure `bcryptjs`

- **Found**: `bcrypt` 6.0.0, MIT, `engines.node >= 18`. README: "Only the current stable and supported LTS releases (Node 18+) are actively tested against." Prebuilt: Windows x64/arm64, Linux x64/arm64 (glibc and musl), macOS x64/arm64. "The module will use the value you enter and go through 2^rounds hashing iterations." Timings (from @garthk on a 2 GHz core, historical): `rounds=8 : ~40 hashes/sec`, `rounds=10: ~10 hashes/sec`, `rounds=13: ~1 sec/hash`, `rounds=15: ~3 sec/hash`. "only the first 72 bytes of a string are used." "The async version uses a thread pool which does not block the main event loop." `bcryptjs` 3.0.3, BSD-3-Clause: "Optimized bcrypt in JavaScript with zero dependencies, with TypeScript support."; "about 30%" slower than the C++ binding; "Compatible to the C++ bcrypt binding on Node.js and also working in the browser."; "Number of rounds defaults to 10 when omitted."; async implementation splits work in chunks that yield to the event queue; "exports an ECMAScript module with an UMD fallback."
- **Why it matters**: both implement the algorithm OWASP lists third (minimum work factor 10, 72-byte limit); one native, one pure JS.
- **Verified**: README extractions plus `npm view`. Confidence M. Node 26 not named by either source.
- **Source**: https://github.com/kelektiv/node.bcrypt.js ; https://github.com/dcodeIO/bcrypt.js ; `npm view bcrypt`, `npm view bcryptjs` (fetched 2026-10-04).

### A14. Better Auth default password hashing and length limits

- **Found**: "Better Auth uses `scrypt` to hash passwords." A custom algorithm is set through the `password` option of `emailAndPassword` with `hash` and `verify` functions. Password "should be at least 8 characters long and max 128 by default." "By default, other active sessions are not revoked when a user resets their password" (option `revokeSessionsOnPasswordReset`).
- **Why it matters**: a framework option bundles its own hashing default and allows replacing it.
- **Verified**: single extraction. Confidence M.
- **Source**: https://www.better-auth.com/docs/authentication/email-password (fetched 2026-10-04).

### Topic A options table (native versus pure)

| Option | Kind | Implementation | Algorithms stated | License | Version | Node 26 named by a source? | Notes (from sources) |
|---|---|---|---|---|---|---|---|
| `crypto.argon2` | Built-in, ready-made | Native (Node core) | argon2d, argon2i, argon2id | Node core | added v24.7.0 | Host is v26.8.2 (> v24.7.0) | Raw key output; caller stores salt and params (A6, A7) |
| `crypto.scrypt` | Built-in, ready-made | Native (Node core) | scrypt | Node core | longstanding | Host is v26.8.2 | Defaults N 16384, r 8, p 1, maxmem 32 MiB (A8) |
| `argon2` | Third-party, ready-made | Native C binding, prebuilds + node-gyp fallback | argon2d/i/id | MIT | 0.45.1 | Not named (README tests >=22) | A9 |
| `@node-rs/argon2` | Third-party, ready-made | Native Rust (napi-rs), WASM variants | argon2 (Argon2id default) | MIT | 2.2.1 | Not named | Defaults m=19456, t=2, p=1 (A10) |
| `hash-wasm` | Third-party, ready-made | WebAssembly | argon2, bcrypt, scrypt, pbkdf2 | MIT | 4.12.0 | Not named (Node 8+) | Zero dependencies (A11) |
| `@noble/hashes` | Third-party, ready-made | Pure JavaScript | argon2, scrypt, pbkdf2 | MIT | 2.4.0 | Not named | Argon2 unaudited and slow per its README (A12) |
| `bcrypt` | Third-party, ready-made | Native C++ | bcrypt | MIT | 6.0.0 | Not named (tests Node 18+) | 72-byte limit (A13) |
| `bcryptjs` | Third-party, ready-made | Pure JavaScript | bcrypt | BSD-3-Clause | 3.0.3 | Not named | About 30% slower than native (A13) |
| Better Auth (framework) | Third-party framework, ready-made | JavaScript, scrypt default | scrypt, custom hook | MIT | 1.7.7 | Not named | A14 |

---

## Topic B. Session versus Token Models: Browser plus React Native on Loopback

### B1. OWASP: session identifier properties

- **Found**: "Session identifiers must have at least 64 bits of entropy to prevent brute-force session guessing attacks." "A strong CSPRNG ... must be used to generate session IDs." The ID must be "meaningless" and "must never include sensitive information or Personally Identifiable Information (PII)." "Session IDs must be considered untrusted, as any other user input."
- **Why it matters**: defines the generation rule for any opaque session or bearer value (cookie or header).
- **Verified**: rendered page and raw markdown agree on the 64-bit sentence. Confidence H.
- **Source**: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html ; https://raw.githubusercontent.com/OWASP/CheatSheetSeries/master/cheatsheets/Session_Management_Cheat_Sheet.md (fetched 2026-10-04).

### B2. OWASP: cookie attributes, name prefix and renewal

- **Found**: "Session cookies must explicitly set SameSite=Strict (preferred) or SameSite=Lax." `Secure` and `HttpOnly` are defined as attributes to set. "the Domain attribute should not be set ... the Path attribute should be set as restrictive as possible." `__Host-` prefix: "must be set with Secure, must not have a Domain attribute, and must use Path=/. Recommended for session IDs." "The session ID must be renewed or regenerated by the web application after any privilege level change within the associated user session."
- **Why it matters**: gives the cookie attribute set that the source states for a browser session, and the renewal trigger (sign-in and role change).
- **Verified**: `SameSite` and renewal sentences agree in both fetches; the `__Host-` sentence is from the rendered page only. Confidence H / M.
- **Source**: same OWASP session URLs as B1 (fetched 2026-10-04).

### B3. OWASP: timeouts, server-side invalidation, binding, simultaneous logons

- **Found**: "Common idle timeouts ranges are 2-5 minutes for high-value applications and 15-30 minutes for low risk applications." "an appropriate absolute timeout range could be between 4 and 8 hours" (example: office worker using the application for a full day). On expiry or logout the application "must take active actions to invalidate the session on both sides, client and server. The latter is the most relevant and mandatory." "it is highly recommended to bind the session ID to other user or client properties, such as the client IP address, User-Agent, or client-based digital certificate." Whether simultaneous logons are allowed "is the web application design decision"; if not allowed "it must take effective actions after each new authentication event."
- **Why it matters**: the numeric timeout ranges and the invalidation duty come from one place; the page states no WebSocket or non-browser guidance ("not on page").
- **Verified**: idle and absolute sentences confirmed by raw markdown. Confidence H.
- **Source**: same OWASP session URLs (fetched 2026-10-04).

### B4. OWASP: where not to keep tokens in a browser

- **Found**: "Do not store authentication tokens, session IDs, JWTs, refresh tokens, or any credential in localStorage or sessionStorage." The rendered page adds that these APIs are readable by "any JavaScript executing in the origin" (extraction paraphrase) and recommends "HttpOnly; Secure; SameSite=Strict cookies (preferred) or a Backend-for-Frontend (BFF) pattern" (this last sentence appeared only in the first extraction and was not in the raw-markdown cross-check list, so it is M).
- **Why it matters**: constrains where a browser single-page app may keep a bearer value.
- **Verified**: first sentence in both fetches. Confidence H (first sentence), M (alternative).
- **Source**: same OWASP session URLs (fetched 2026-10-04).

### B5. NIST SP 800-63B-4: session secrets, cookies, storage

- **Found**: session secrets "are at least 64 bits in length" from an approved random bit generator. Bearer-style session secrets "SHOULD NOT be persistent". Cookies: "SHALL be tagged to be accessible only on secure (i.e., HTTPS) sessions"; "SHOULD be tagged as inaccessible via JavaScript (i.e., HttpOnly)"; "SHOULD set 'SameSite=Lax' or 'SameSite=Strict'." Logout: "Secrets are erased or invalidated by the session subject when the subscriber logs out." Storage: tokens "SHOULD NOT be placed in insecure locations (e.g., HTML5 Local Storage)". "The RP SHALL NOT interpret the presence of an access token as an indicator of the subscriber's presence."
- **Why it matters**: a second public standard on the same topics; note the HTTPS "SHALL" for cookies versus the loopback HTTP context (see B9).
- **Verified**: single extraction. Confidence M.
- **Source**: https://pages.nist.gov/800-63-4/sp800-63b/session/ (fetched 2026-10-04).

### B6. NIST SP 800-63B-4: reauthentication timeouts per assurance level

- **Found** (labelled "Sec. 5.2" by the AAL-page extraction): AAL1: overall timeout "SHOULD be no more than 30 days", inactivity timeout "MAY be applied but is not required". AAL2: overall "SHOULD be no more than 24 hours", inactivity "SHOULD be no more than 1 hour". AAL3: overall "SHALL be no more than 12 hours", inactivity "SHOULD be no more than 15 minutes".
- **Why it matters**: numeric reauthentication limits from a standards source, next to OWASP's ranges (B3).
- **Verified**: single extraction. The session-page extraction pointed to "Sections 2.1.3, 2.2.3, 2.3.3" for these numbers; the two section labels were not reconciled. Confidence M.
- **Source**: https://pages.nist.gov/800-63-4/sp800-63b/aal/ (fetched 2026-10-04).

### B7. Same-site versus same-origin, and CORS with credentials

- **Found**: web.dev: "Origin" is "a combination of a scheme ..., a hostname, and a port (if specified)." "site" is "a combination of the scheme, the TLD, and the part of the domain just before it (TLD+1)." Its table marks different ports as "Cross-origin: different ports" and "Same-site: different ports don't matter". The article does not discuss IP addresses or localhost. MDN CORS: for a credentialed request "The server must not specify the * wildcard for the Access-Control-Allow-Origin response-header value, but must instead specify an explicit origin"; "To ask for a fetch() request to include credentials, set the credentials option to "include"."; requests with a custom header are preflighted; cookies in CORS requests "are subject to normal third-party cookie policies."
- **Why it matters**: a page on one loopback port calling an API on another loopback port is cross-origin; the sources state what a cookie-based call then requires (explicit origin, credentials flag, preflight for custom headers). Whether two different loopback ports count as the same site for IP-literal hosts is not stated by these pages.
- **Verified**: two separate pages. Confidence M-H.
- **Source**: https://web.dev/articles/same-site-same-origin ; https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS (fetched 2026-10-04).

### B8. Cookies are not isolated by port

- **Found**: RFC 6265 section 8.5: "Cookies do not provide isolation by port. If a cookie is readable by a service running on one port, the cookie is also readable by a service running on another port of the same server." Also: "Cookies do not provide isolation by scheme." Section 8.6: cookies do not provide integrity guarantees across sibling domains (text returned concerns sibling domains).
- **Why it matters**: two servers on one loopback host (different ports) share the cookie jar for that host, per the RFC text; the cookie name and path are the only separators the RFC leaves.
- **Verified**: single extraction of the plain-text RFC. Confidence M.
- **Source**: https://www.rfc-editor.org/rfc/rfc6265.txt (fetched 2026-10-04).

### B9. Secure cookies and secure contexts on loopback HTTP

- **Found**: MDN Set-Cookie: `Secure` means the cookie is sent "only when a request is made with the https: scheme (except on localhost)"; "Insecure sites (http:) cannot set cookies with the Secure attribute. The https: requirements are ignored when the Secure attribute is set by localhost." Prefix rules: `__Secure-` requires Secure set by a secure page; `__Host-` additionally forbids Domain and requires `Path=/`. MDN Secure Contexts: "potentially trustworthy" includes "A host value of 127.0.0.0/8 or ::1/128" and "A host value of localhost". A comparison table in an IETF HTTP working-group issue for `http://localhost`: Safari: Secure no, `__Host-` no, `__Secure-` no; Chrome: Secure yes, `__Host-` no, `__Secure-` no; Firefox: all three yes (table scope printed in the extraction as "http://localhost, localhost subdomains, and http://127.0.1", so coverage of `127.0.0.1` itself is not confirmed). A WebKit bug page titled "Safari is ignoring the session cookie for localhost sites" has status NEW (latest comment 2025-02-13) and uses `127.0.0.1` hosts-file entries.
- **Why it matters**: bears on whether the OWASP-recommended `Secure` and `__Host-` cookie attributes (B2) work when the API is plain HTTP on loopback, per browser.
- **Verified**: MDN pages (M), issue table (M-L, third-party table), WebKit bug (M). Browser versions were not on the issue page.
- **Source**: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie ; https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts ; https://github.com/httpwg/http-extensions/issues/2605 ; https://bugs.webkit.org/show_bug.cgi?id=276313 (fetched 2026-10-04).

### B10. CSRF guidance when a cookie authenticates a cross-origin call

- **Found**: OWASP CSRF cheat sheet: "SameSite is useful as a defense-in-depth control but it does not replace a proper CSRF defense in most deployments." Origin/Referer: "we verify if both of them match." `Sec-Fetch-Site`: "By default, reject non-safe methods (POST / PUT / PATCH / DELETE) when Sec-Fetch-Site: cross-site." Custom request headers "rely on the CORS preflight mechanism". Login CSRF "can be mitigated by creating pre-sessions". Synchronizer token is "one of the most popular and recommended methods"; double-submit cookie "is stateless". The page does not state that Authorization-header token APIs are exempt (not on page). `@fastify/csrf-protection` 8.0.1, MIT exists (metadata only).
- **Why it matters**: lists the defenses the source names for cookie sessions; a bearer-in-header model is not addressed by this page.
- **Verified**: single extraction. Confidence M.
- **Source**: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html ; `npm view @fastify/csrf-protection` (fetched 2026-10-04).

### B11. WebSocket authentication constraints and options

- **Found**: websocket.org: "The browser WebSocket API has no way to set custom HTTP headers ... the WebSocket constructor accepts only a URL and an optional subprotocol array. There is no Authorization header." Options and the page's stated drawbacks: query-string token ("shows up in server access logs, proxy logs, browser history, and the Referer header"); cookie ("you need CSRF protection. Validate the Origin header on every upgrade request."); first-message authentication ("An attacker can open thousands of unauthenticated connections to exhaust your server's resources."). "Use short-lived tokens (5-15 minutes)". OWASP WebSocket cheat sheet: "Validate the Origin header on every handshake. Always use an explicit allowlist of trusted origins."; "Browsers include cookies in WebSocket handshake requests, making WebSocket applications vulnerable to Cross-Site WebSocket Hijacking."; tokens in query strings "will appear in access logs and should be redacted"; "Close WebSocket connections when sessions expire. Re-validate user sessions periodically (every 30 minutes is common)."; "Never use unencrypted ws:// connections in production"; limits "typically 64KB or less"; "100 messages per minute is a common starting point." `@fastify/websocket`: "Hooks that run before the websocket connection is established will be called - this includes onRequest, preParsing, preValidation, and preHandler", with a `preValidation` example that replies 401 when `!request.isAuthenticated()`; a `verifyClient` option "can be used to validate incoming connections".
- **Why it matters**: the browser client cannot send a bearer header on the socket, while a non-browser client's capability is not stated by these sources (React Native docs page is silent on socket headers; see B12).
- **Verified**: websocket.org (M), OWASP WebSocket (M), plugin README (M). The browser limitation is also stated in a web-search summary (L). The OWASP statement that `ws://` is never for production is as returned; the loopback demo exception is not discussed by the page.
- **Source**: https://websocket.org/guides/authentication/ ; https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html ; https://github.com/fastify/fastify-websocket (fetched 2026-10-04).

### B12. React Native networking, native-app guidance and mobile guidance

- **Found**: React Native docs: "The following options are currently not working with fetch: redirect:manual, credentials:omit" and "Cookie based authentication is currently unstable." On Android "as of API Level 28, clear text traffic is also blocked by default. This behaviour can be overridden by setting android:usesCleartextTraffic in the app manifest file."; iOS 9+ enforces App Transport Security. The page does not address custom headers on the WebSocket (not on page). RFC 8252 (BCP 212, October 2017): native apps "MUST NOT use embedded user-agents"; loopback redirects "http://127.0.0.1:{port}/{path}" and "http://[::1]:{port}/{path}", and "the use of localhost is NOT RECOMMENDED"; loopback "http scheme ... is acceptable for loopback interface redirect URIs as the HTTP request never leaves the device" (this passage concerns OAuth redirect URIs, not general API calls); "Secrets that are statically included as part of an app distributed to multiple users should not be treated as confidential secrets." A web-search summary of third-party pages (L) says Android fetch cookie handling needs manual handling in some setups. OWASP MASVS-AUTH page: the page fetched was an index; the control texts were not retrieved (not confirmed). A search summary (L) quotes the category text: enforcement "must be on the remote endpoint".
- **Why it matters**: the RN client cannot be assumed to behave like a browser for cookies; the RN docs say cookie authentication is unstable.
- **Verified**: RN docs (M), RFC 8252 (M), summaries (L).
- **Source**: https://reactnative.dev/docs/network ; https://www.rfc-editor.org/rfc/rfc8252 ; https://mas.owasp.org/MASVS/07-MASVS-AUTH/ (index only) (fetched 2026-10-04).

### B13. Option: server-side session, opaque cookie (`@fastify/session` + `@fastify/cookie`)

- **Found**: `@fastify/session` 11.1.3, MIT: "A session plugin for fastify. Requires the @fastify/cookie plugin." `secret`: "Must be an array of strings or a string with a length of 32 or greater". `cookieName` defaults to `sessionId`; cookie `path` defaults `/`, `httpOnly` true, `secure` true (with `secure: auto` false for HTTP requests); `rolling` true; `saveUninitialized` true. Store: "Defaults to a simple in-memory store. Note: The default store should not be used in a production environment because it will leak memory." "Compatible with stores from express-session" (store methods `set`, `get`, `destroy`). Methods: `regenerate()`, `destroy()`, `touch()`. Fastify 5 compatibility statement: not on page. `@fastify/cookie` 11.1.2, MIT: plugin >=10.x with Fastify ^5.x; `secret` may be a string, Buffer or Array; option `secure: "auto"` sets the flag "when the connection is using tls"; parse hook default `onRequest`; supported `setCookie` options include `httpOnly`, `secure`, `sameSite`, `path`, `maxAge`, `signed`, `partitioned`.
- **Why it matters**: represents the server-side session model; revocation is a store delete. The default-secure cookie and the in-memory default store are facts that bear on plain-HTTP loopback and on state surviving restarts.
- **Verified**: README extractions plus `npm view`. Confidence M.
- **Source**: https://github.com/fastify/session ; https://github.com/fastify/fastify-cookie (fetched 2026-10-04).

### B14. Option: stateless encrypted cookie session (`@fastify/secure-session`)

- **Found**: 8.4.0, MIT. "Create a secure stateless cookie session for Fastify, based on libsodium's Secret Key Box Encryption". Options: `key` (32-byte), or `secret` + `salt`; `cookie` (path, httpOnly, secure, sameSite); `expiry` (default 1 day); `sessionName`; `cookieName`. Methods `set`, `get`, `delete`, `regenerate`. "It is possible to use a non-empty array for the key field to support key rotation" (newest key at index 0 encrypts, older keys decrypt). Cookie size limits, server-side revocation and Fastify 5 compatibility: not on page.
- **Why it matters**: represents a no-database session model; the README does not state how a single session is revoked before expiry.
- **Verified**: README extraction plus `npm view`. Confidence M.
- **Source**: https://github.com/fastify/fastify-secure-session (fetched 2026-10-04).

### B15. Option: JSON Web Tokens (`@fastify/jwt`, `fast-jwt`, `jose`)

- **Found**: `@fastify/jwt` 10.2.2, MIT: "JWT utils for Fastify, internally it uses fast-jwt." "@fastify/jwt >= v9 supports Fastify@5." `secret` is a string, function, or `{ private, public }`; sign option `expiresIn`; verify options `algorithms` and `maxAge`; `cookie` option (`cookieName`, `signed`) lets `request.jwtVerify()` read the token from a cookie; `trusted: (request, decodedToken) => boolean|Promise<boolean>` is the documented place for a denylist (example `denylist = ['token1','token2']`). Default algorithm: not stated on page. `fast-jwt` 6.3.3 Apache-2.0; `jose` 6.2.12 MIT (metadata only). OWASP JWT cheat sheet (generic page) as extracted: "Make sure that "alg":"none" is not accepted by your JWT parser."; HMAC secret "must have at least the same size as the output (eg. 256, 384 and 512 bits respectively for HS256, HS384 and HS512)" and "at least 160 bits of entropy"; denylist: "A JWT deny list can typically be implemented based on the jti and iss claims", and the page warns that using "the raw JWT or a secure hash of the JWT (SHA-256(token)) as the denylist key is not safe" due to malleability. The Java-specific OWASP JWT page (sidejacking fingerprint cookie, hash-in-denylist) returned HTTP 404 at three URL forms; a search summary (L) describes the sidejacking fingerprint cookie (HttpOnly, Secure, SameSite, Max-Age) and a denylist keyed on `jti`.
- **Why it matters**: represents the signed-token model; the sources place revocation in an add-on list, not in the token.
- **Verified**: plugin README (M), OWASP generic page (M, partly contradicts the summary on the hash-keyed denylist; the page text is the one quoted), summary (L).
- **Source**: https://github.com/fastify/fastify-jwt ; https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_Cheat_Sheet ; WebSearch listing https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet (404 on fetch) (fetched 2026-10-04).

### B16. Option: opaque bearer token in the Authorization header (`@fastify/bearer-auth`)

- **Found**: 10.1.3, MIT: "provides a simple Bearer auth request hook for the Fastify web framework." `^10.x` with Fastify `^5.x`. `keys`: "A Set or array with valid keys of type string"; `auth`: "tests if key is a valid token. It must return true if accepted or false if rejected ... If auth is a function, keys will be ignored." `addHook` default `onRequest`. "The key is matched against the configured keys object using a constant time algorithm". RFC 9700 (4.3.2 as returned): "Clients MUST NOT pass access tokens in a URI query parameter".
- **Why it matters**: represents a token-in-header model for a non-browser client; the plugin validates a presented key, and where keys live (table, hash) is left to the caller.
- **Verified**: README extraction (M); RFC 9700 sentence from the first partial fetch (M).
- **Source**: https://github.com/fastify/fastify-bearer-auth ; https://www.rfc-editor.org/rfc/rfc9700 (fetched 2026-10-04).

### B17. Option: self-hosted framework, Better Auth (and the status of Lucia)

- **Found**: Better Auth 1.7.7, MIT (npm and repository page): "framework-agnostic authentication (and authorization) framework for TypeScript" ("free and open source project licensed under the MIT License"; no hosted service or account mentioned on the repository page; the docs introduction page did not state hosting model). Sessions: `expiresIn` 60*60*24*7 (7 days), `updateAge` 60*60*24 (1 day), `freshAge` default 1 day (0 disables). Cookie cache caveat: "When cookieCache is enabled, revoked sessions may remain active on other devices until the cookie cache expires (maxAge)." Revocation: `revokeSession({ token })`, `revokeSessions()`, `revokeOtherSessions()`. Sessions are stored in the database unless secondary storage is given. Bearer plugin: "enables authentication using Bearer tokens as an alternative to browser cookies"; token arrives in the `set-auth-token` response header; the doc example stores it with `localStorage`; caveat: "Use this cautiously; it is intended only for APIs that don't support cookies or require Bearer tokens". Expo integration (`@better-auth/expo`): packages `better-auth @better-auth/expo`, client `expo-network` and `expo-secure-store`; "expo-secure-store ... is used to store the session data and cookies securely"; deep-link scheme must be added to `trustedOrigins`. Fastify integration: a catch-all route `url: "/api/auth/*"` converting the Fastify request to a Fetch `Request` and calling `auth.handler(req)`; documented CORS options include `credentials: true`, explicit `origin`, `allowedHeaders: ['Content-Type','Authorization','X-Requested-With']`, `maxAge: 86400`; prerequisites mention Node.js v16 or later; Fastify version not stated. Databases: PostgreSQL, SQLite, MySQL, MSSQL through its Kysely adapter, plus Prisma and Drizzle; CLI `npx auth@latest migrate` / `generate`; core tables user, session, account, verification. Lucia (`lucia` 3.2.2, last modified 2025-06-06): "Lucia was deprecated in March 2025."; the site points to a single-file replacement and a book.
- **Why it matters**: a ready-made option that covers hashing, sessions, bearer tokens, rate limiting (D5), roles (E8) and an Expo client in one package; Fastify 5 and Node 26 compatibility are not stated by any fetched source.
- **Verified**: five docs pages plus repository plus `npm view` (M). Confidence M.
- **Source**: https://github.com/better-auth/better-auth ; https://www.better-auth.com/docs/concepts/session-management ; https://www.better-auth.com/docs/plugins/bearer ; https://www.better-auth.com/docs/integrations/expo ; https://www.better-auth.com/docs/integrations/fastify ; https://www.better-auth.com/docs/concepts/database ; https://lucia-auth.com/ (fetched 2026-10-04).

### Topic B options table

| Option | Model | Kind | License | Version | State / revocation as documented | Browser | React Native |
|---|---|---|---|---|---|---|---|
| `@fastify/session` + `@fastify/cookie` | Server-side session, opaque cookie | Ready-made plugin | MIT | 11.1.3 / 11.1.2 | Store-held; `destroy()`; default store in-memory | Cookie | Cookie behavior unstable per RN docs (B12) |
| `@fastify/secure-session` | Stateless encrypted cookie | Ready-made plugin | MIT | 8.4.0 | Key array rotation; per-session revoke not stated | Cookie | Same as above |
| `@fastify/jwt` (+ fast-jwt / jose) | Signed token | Ready-made plugin | MIT (plugin), Apache-2.0 (fast-jwt) | 10.2.2 / 6.3.3 | `trusted` denylist hook | Header or cookie | Header |
| `@fastify/bearer-auth` | Opaque bearer key | Ready-made plugin | MIT | 10.1.3 | `auth` function decides | Header | Header |
| Better Auth (+ bearer, expo) | DB-backed session, cookie or bearer | Ready-made framework (self-hosted) | MIT | 1.7.7 / 1.7.7 | `revokeSession(s)`; cookie-cache caveat | Cookie or bearer | Expo package stores in `expo-secure-store` |
| Hand-built opaque token table | Opaque token in application table | Hand-built (needs a recorded decision under I1) | n/a | n/a | Not evidence-based; guidance from B1-B3 applies | | |
| Lucia | Session library | Deprecated (March 2025) | MIT | 3.2.2 | n/a | | |
| Hosted identity providers (see Excluded Register) | | | | | | | |

---

## Topic C. Rotation and Revocation

### C1. RFC 9700 refresh-token protection

- **Found**: BCP 240 (2025). Section 2.2.2 as returned: "Refresh tokens for public clients MUST be sender-constrained or use refresh token rotation". Section 4.14.2: sender-constrained means "the authorization server cryptographically binds the refresh token to a certain client instance, e.g., by utilizing [RFC8705] or [RFC9449]." Rotation: "the authorization server issues a new refresh token with every access token refresh response. The previous refresh token is invalidated, but information about the relationship is retained by the authorization server." Replay: "If a refresh token is compromised and subsequently used by both the attacker and the legitimate client, one of them will present an invalidated refresh token, which will inform the authorization server of the breach ... the authorization server will revoke the active refresh token." Expiry: "Refresh tokens SHOULD expire if the client has been inactive for some time". Section 2.3: privileges "SHOULD be restricted to the minimum required"; tokens "SHOULD be audience-restricted".
- **Why it matters**: the named public standard for rotating and revoking long-lived credentials held by an app; it is written for OAuth and does not state how a non-OAuth device credential is rotated.
- **Verified**: 4.14.2 text from the plain-text RFC (M-H); other sections from the first partial fetch (M).
- **Source**: https://www.rfc-editor.org/rfc/rfc9700 ; https://www.rfc-editor.org/rfc/rfc9700.txt (fetched 2026-10-04).

### C2. RFC 9449 DPoP (proof of possession of a client-held key)

- **Found**: Standards Track, September 2023. Abstract: "a mechanism for sender-constraining OAuth 2.0 tokens via a proof-of-possession mechanism on the application level." Proof JWT header `typ: dpop+jwt`, `alg`, `jwk`; payload `jti`, `htm`, `htu`, `iat`, and `ath` (hash of the access token) when presenting a token. "An authorization server MAY supply a nonce value to be included by the client in DPoP proofs". "Servers MUST only accept DPoP proofs for a limited time after their creation (preferably only for a relatively brief period on the order of seconds or minutes)." "If the private key used for DPoP is stored in such a way that it cannot be exported ... the adversary cannot exfiltrate the key."
- **Why it matters**: the standard mechanism for binding a credential to a key held on a device.
- **Verified**: single extraction of the plain-text RFC. Confidence M.
- **Source**: https://www.rfc-editor.org/rfc/rfc9449.txt (fetched 2026-10-04).

### C3. RFC 7009 token revocation

- **Found**: Standards Track, August 2013. Revocation is an HTTP POST to a revocation endpoint with `token` (required) and `token_type_hint` (optional). "If the particular token is a refresh token and the authorization server supports the revocation of access tokens, then the authorization server SHOULD also invalidate all access tokens based on the same authorization grant." The response is "HTTP status code 200 if the token has been revoked successfully or if the client submitted an invalid token."
- **Why it matters**: gives the standard request and response shape for a client-initiated revoke and the cascade rule.
- **Verified**: single extraction. Confidence M.
- **Source**: https://www.rfc-editor.org/rfc/rfc7009.txt (fetched 2026-10-04).

### C4. Revocation mechanisms documented by the candidate libraries

- **Found**: `@fastify/session`: `destroy()` removes the session in the store; `regenerate()` issues a new ID (B13). `@fastify/jwt`: `trusted` function for a denylist (B15). Better Auth: `revokeSession`, `revokeSessions`, `revokeOtherSessions`; Admin plugin ban "revokes all of their existing sessions" and an unban "allowing them to sign in again"; `revokeSessionsOnPasswordReset` defaults to not revoking other sessions; cookie cache can delay effect of a revoke (B17, E8). `@fastify/secure-session`: no per-session revoke documented (B14). OWASP session guidance: invalidation on both sides is mandatory (B3); regenerate after a privilege change (B2).
- **Why it matters**: shows, per option, whether revocation is a store operation, a list the application maintains, or not documented.
- **Verified**: as in the cited findings. Confidence M.
- **Source**: findings B2, B3, B13-B15, B17 and E8 (URLs there; fetched 2026-10-04).

### C5. Key and secret rotation features in the candidate plugins

- **Found**: `@fastify/cookie`: "The plugin will always use the first key (key1) to sign cookies. When parsing incoming cookies, it will iterate over the supplied array to see if any of the available keys are able to decode the given signed cookie." `@fastify/secure-session`: array of keys, newest first for encryption, older for decryption. `@fastify/session`: `secret` may be an array of strings. OWASP Password Storage: re-hash "the next time the user authenticates" with a new work factor (A3). OWASP JWT sheet: HMAC secret size rules (B15). `@fastify/jwt` default algorithm and key rotation: not on page.
- **Why it matters**: the documented rotation capability exists for cookie signing and cookie encryption keys; for password-hash parameters the source gives the re-hash-on-sign-in rule.
- **Verified**: README extractions. Confidence M.
- **Source**: https://github.com/fastify/fastify-cookie ; https://github.com/fastify/fastify-secure-session ; https://github.com/fastify/session ; https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html (fetched 2026-10-04).

### C6. RFC 8628 (device authorization grant): short code and device code guidance

- **Found**: "it is recommended that the server rate-limit user code attempts" (section 5.1, User Code Brute Forcing); user codes need "enough entropy that, when combined with rate-limiting and other mitigations, a brute-force attack becomes infeasible." Section 6.1 example: user code "WDJB-MJHT" has 8 significant characters, base-20 set `BCDFGHJKLMNPQRSTVWXZ`, "entropy is 20^8"; "An example numeric user code ... with an entropy of 10^9." Device codes: "a very high entropy code SHOULD be used" (section 5.2). Response fields: `expires_in` ("The lifetime in seconds of the device_code and user_code"), `interval` ("The minimum amount of time in seconds that the client SHOULD wait between polling requests").
- **Why it matters**: a public specification for a short human-entered code that a second device redeems, with the sources' statements on entropy, expiry and attempt limiting. It is OAuth-specific and is not a pairing specification.
- **Verified**: single extraction of the plain-text RFC (section labels as returned). Confidence M.
- **Source**: https://www.rfc-editor.org/rfc/rfc8628.txt (fetched 2026-10-04).

### C7. NIST SP 800-63B-4: out-of-band and look-up secrets

- **Found**: section 3.1.3.2 as returned: out-of-band authentication "SHALL be considered invalid unless completed within 10 minutes"; "The verifier SHALL generate random authentication secrets that are at least six decimal digits (or equivalent) in length." Section 3.1.2.1: "Look-up secrets SHALL be at least six decimal digits (or equivalent) in length."
- **Why it matters**: numeric lifetime and minimum-length values from a standards source for a one-time secret delivered out of band.
- **Verified**: single extraction. Confidence M.
- **Source**: https://pages.nist.gov/800-63-4/sp800-63b.html (fetched 2026-10-04).

### C8. Revocation on long-lived WebSocket connections

- **Found**: OWASP WebSocket sheet: "Close WebSocket connections when sessions expire. Re-validate user sessions periodically (every 30 minutes is common)." websocket.org: "A chat application might hold a connection open for hours... If your token expires after 15 minutes, you need a renewal mechanism."; "For immediate revocation, check each message against a revocation list (Redis set or database query)." The latter page does not state that the socket is closed on revocation.
- **Why it matters**: a revoked credential must also stop an already-open socket; the sources give two mechanisms (periodic re-validation, per-message list check).
- **Verified**: two extractions. Confidence M.
- **Source**: https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html ; https://websocket.org/guides/authentication/ (fetched 2026-10-04).

### C9. OWASP: session renewal and re-authentication for sensitive operations

- **Found**: renewal after any privilege level change (B2). Authentication cheat sheet: "it's important to require the current credentials for an account before updating sensitive account information such as the user's password or email address."
- **Why it matters**: lists two events (privilege change, credential change) that the source ties to renewing or re-proving identity.
- **Verified**: both fetches of the authentication sheet. Confidence M-H.
- **Source**: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html ; https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html (fetched 2026-10-04).

### Topic C options table

| Option | What rotates or revokes | Source | Kind |
|---|---|---|---|
| Refresh-token rotation with reuse detection | Credential replaced at each use; replay revokes the active one | RFC 9700 4.14.2 | Pattern (library support not collected) |
| Sender-constrained credential (DPoP) | Credential bound to a client key; proof per request | RFC 9449 | Standard; library support not collected |
| Server-side session delete | Store removes session | `@fastify/session`, Better Auth | Ready-made |
| Denylist of token IDs | Application keeps list consulted at verify time | `@fastify/jwt` `trusted`; OWASP JWT sheet | Ready-made hook, hand-built list |
| Revocation endpoint (RFC 7009 shape) | POST `token`; cascade to access tokens | RFC 7009 | Standard; hand-built unless provided by a framework |
| Key array rotation for cookie keys | Newest key signs or encrypts; older keys still verify or decrypt | `@fastify/cookie`, `@fastify/secure-session` | Ready-made |
| Password hash re-hash on next sign-in | New parameters applied at next success | OWASP Password Storage | Pattern |

---

## Topic D. Lockout and Rate Limiting

### D1. OWASP Authentication cheat sheet: lockout, throttling, CAPTCHA, logging, generic responses

- **Found**: lockout design has three factors: "The number of failed attempts before the account is locked out (lockout threshold). The time period that these attempts must occur within (observation window). How long the account is locked out for (lockout duration)." Caution: "When designing an account lockout system, care must be taken to prevent it from being used to cause a denial of service by locking out other users' accounts." "Login Throttling is a security mechanism used to prevent an attacker from making too many attempts at guessing a password through normal interactive means". "It may be more user-friendly to only require a CAPTCHA be solved after a small number of failed login attempts". "Ensure that all failures are logged and reviewed"; password failures and account lockouts likewise. "an application must respond ... in a generic manner" and the example "Login failed; Invalid user ID or password." The page also illustrates a timing discrepancy between "user doesn't exist" and "user exists and the password doesn't". The page gives no numeric lockout threshold or duration ("Specific Thresholds/Durations: not on page").
- **Why it matters**: the source defines the lockout parameters to be chosen but states no values; it names the lockout-as-denial-of-service risk.
- **Verified**: rendered page and raw markdown agree on the quoted sentences. Confidence H.
- **Source**: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html ; https://raw.githubusercontent.com/OWASP/CheatSheetSeries/master/cheatsheets/Authentication_Cheat_Sheet.md (fetched 2026-10-04).

### D2. NIST SP 800-63B-4: rate limit on failed authentication

- **Found**: section 3.2.2 as returned: "the verifier SHALL limit consecutive failed authentication attempts using a specific authenticator on a single subscriber account to no more than 100 by disabling that authenticator."
- **Why it matters**: a numeric ceiling in a standard, expressed per authenticator per account.
- **Verified**: single extraction. Confidence M.
- **Source**: https://pages.nist.gov/800-63-4/sp800-63b.html (fetched 2026-10-04).

### D3. `@fastify/rate-limit`

- **Found**: 11.2.0, MIT. Compatibility: "Plugin version >=10.x / Fastify version ^5.x". Defaults: `max` 1000, `timeWindow` 1000 * 60, `global` true, `hook` `onRequest`, `cache` 5000, `allowList` `[]`, `ban` -1, `nameSpace` `fastify-rate-limit-`; `keyGenerator` default normalizes `request.ip` (IPv4-mapped IPv6 mapped to IPv4, IPv6 masked to a configured subnet); store: "By default, this plugin uses an in-memory store, but if an application runs on multiple servers, an external store will be needed." Per-route override: `config: { rateLimit: { max: 3, timeWindow: '1 minute' } }`. `errorResponseBuilder` responses carry `x-ratelimit-limit` and `retry-after`; default text "Rate limit exceeded, retry in ${context.after}". Client IP comes from `request.connection.remoteAddress` or `x-forwarded-for` "if trustProxy option is enabled".
- **Why it matters**: the Fastify-native rate-limit plugin; counts requests by key, not by account or sign-in outcome.
- **Verified**: README extraction plus `npm view`. Confidence M.
- **Source**: https://github.com/fastify/fastify-rate-limit (fetched 2026-10-04).

### D4. `rate-limiter-flexible` and its login-protection example

- **Found**: 11.2.1, ISC. "counts and limits the number of events and protects from DoS and brute force attacks at any scale." Stores: "Valkey, Redis, Prisma, DynamoDB, process Memory, Cluster or PM2, Memcached, MongoDB, MySQL, SQLite, and PostgreSQL." Options include `blockDuration` and `insuranceLimiter`. The project wiki's "Login endpoint protection" example uses `maxWrongAttemptsByIPperDay = 100` (IP limiter: duration 1 day, block 1 day) and `maxConsecutiveFailsByUsernameAndIP = 10` (key `username_ip`, duration 60*60*24*90, block 60*60) and explains that limiting by username alone lets an attacker "send 5 password tries every 15 minutes and block user account for infinity" (extraction wording).
- **Why it matters**: a library with a PostgreSQL store and a worked login example whose numbers are the library author's example values, not a standards recommendation.
- **Verified**: repository page and wiki page, each one extraction. Confidence M.
- **Source**: https://github.com/animir/node-rate-limiter-flexible ; https://github.com/animir/node-rate-limiter-flexible/wiki/Overall-example (fetched 2026-10-04).

### D5. Better Auth built-in rate limiting

- **Found**: production default "Window: 10 seconds" and "Max Requests: 100 requests"; special rules: `/sign-in/email` "limited to 3 requests within 10 seconds", `/two-factor/*` the same (via the twoFactor plugin); storage options "memory", "database", "secondary-storage" with memory as default; "Rate limiting is disabled in development mode by default"; "The default header checked is x-forwarded-for" (configurable via `ipAddressHeaders`).
- **Why it matters**: a framework option with sign-in-specific default limits; the development-mode default and the IP header default are stated facts relevant to a local demo.
- **Verified**: single extraction. Confidence M.
- **Source**: https://www.better-auth.com/docs/concepts/rate-limit (fetched 2026-10-04).

### D6. Limits stated for code entry and sockets

- **Found**: RFC 8628: rate-limit user code attempts (C6). NIST: one-time out-of-band secret valid for 10 minutes (C7). OWASP WebSocket: size limit "typically 64KB or less", "100 messages per minute is a common starting point", restrict total connections and per-user limits (B11).
- **Why it matters**: collects the non-password attempt-limit statements in one place.
- **Verified**: cross-reference to the cited findings. Confidence M.
- **Source**: C6, C7, B11 URLs (fetched 2026-10-04).

### Topic D options table

| Option | Counts by | Store | License | Version | Notes from sources |
|---|---|---|---|---|---|
| `@fastify/rate-limit` | Request key (IP default) | In-memory default; external store for multi-instance | MIT | 11.2.0 | Per-route override; D3 |
| `rate-limiter-flexible` | Any key (e.g. username+IP) | Memory, PostgreSQL, SQLite, Redis, others | ISC | 11.2.1 | Login example with numbers (D4) |
| Better Auth rate limit | Path rules (sign-in 3 per 10 s default) | memory / database / secondary | MIT | 1.7.7 | Off in development by default (D5) |
| Hand-built lockout counters in application tables | Account, device, code | Application database | n/a | n/a | Hand-built; needs a recorded decision under I1. Parameter definitions: OWASP D1; ceiling: NIST D2 |

---

## Topic E. RBAC Libraries versus a Permission Guard for Fastify

### E1. OWASP Authorization cheat sheet principles

- **Found**: "assign users only the minimum privileges necessary"; "an application should be configured to deny access by default"; "Permission should be validated correctly on every request"; "ABAC and ReBAC should typically be preferred for application development" over RBAC (reasons given: "fine-grained, complex Boolean logic", robustness, speed, multi-tenancy, "Ease of Management"); "Verify that Authorization Checks are Performed in the Right Location" (server-side, at the gateway or in a serverless function); "static resources must also be appropriately secured"; "Create Unit and Integration Test Cases for Authorization Logic"; "Implement Appropriate Logging".
- **Why it matters**: names the checks any guard or library must satisfy (deny by default, every request, tests, logging) and states a preference for attribute or relationship models over RBAC for application development.
- **Verified**: single extraction. Confidence M.
- **Source**: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html (fetched 2026-10-04).

### E2. Fastify primitives for a hand-written permission guard

- **Found**: hook order: "onRequest, preParsing, preValidation, preHandler, preSerialization, onError, onSend, onResponse, onTimeout, onRequestAbort"; in `onRequest` "`request.body` will always be `undefined`". `onRoute` application hook: "Triggered when a new route is registered. Listeners are passed a routeOptions object as the sole parameter" (extraction lists `method, schema, url, path, routePath, bodyLimit, logLevel, logSerializers, prefix`; `config` not in that list). Route option `config`: "object used to store custom configuration", read in handlers as `reply.routeOptions.config`. Route options `onRequest` and `preHandler` each accept a function or an array of functions. An async hook that answers must call `reply.send()` before returning or "the request will proceed"; "Warning: do not mix callbacks and async/Promise". `@fastify/auth` 5.1.1 (`>=5.x` with Fastify `^5.x`): "does not provide an authentication strategy but offers a fast utility to handle authentication and multiple strategies in routes"; `fastify.auth([fn1, fn2], { relation: 'or' | 'and' })` with default `or`; nested arrays flip the relation; usable as `preHandler: fastify.auth([...])` or `fastify.addHook('preHandler', fastify.auth([...]))`; failing functions pass an error to `done()` or throw/reject.
- **Why it matters**: these are the documented extension points a route-level permission check would use (route `config`, route hooks, an `onRoute` hook that sees every route).
- **Verified**: three Fastify doc and README extractions plus `npm view`. Confidence M.
- **Source**: https://fastify.dev/docs/latest/Reference/Hooks/ ; https://fastify.dev/docs/latest/Reference/Routes/ ; https://github.com/fastify/fastify-auth (fetched 2026-10-04).

### E3. `fastify-guard` (role and scope checks)

- **Found**: 3.0.1, MIT, `time.modified 2024-12-22`. "A simple user role and scope check plugin to protect endpoints for Fastify". Options `requestProperty` (default `user`), `roleProperty` (default `role`), `scopeProperty` (default `scope`), `errorHandler`. Functions `guard.role()` and `guard.scope()`; no `permission()` function on the page. "'user' should already be defined in req object". Plugin `^3.0.0` requires Fastify `^5.0.0`. Usage in preHandler: `fastify.guard.role(['cto','admin'])` (search summary L).
- **Why it matters**: an off-the-shelf role or scope guard; it does not authenticate, it reads the user attached by an earlier hook.
- **Verified**: README via jsdelivr (the npmjs page returned HTTP 403). Confidence M.
- **Source**: https://cdn.jsdelivr.net/npm/fastify-guard@3.0.1/README.md ; `npm view fastify-guard` (fetched 2026-10-04).

### E4. CASL (`@casl/ability`)

- **Found**: 7.0.1, MIT. "CASL ... is an isomorphic authorization JavaScript library which restricts what resources a given user is allowed to access." Bullets: "Versatile: An incrementally adoptable and can easily scale between a simple claim based and fully featured subject and attribute based authorization."; "Isomorphic: Can be used on frontend and backend"; "TypeSafe: Written in TypeScript"; "Tree shakable: The core is only 6KB mingzipped"; "Declarative: ... you can serialize and share permissions between UI and API or microservices". Usage: `can()`, `cannot()`, `ability.can()`, `ForbiddenError.from(ability).throwUnlessCan()`. Packages: `@casl/ability, @casl/mongoose, @casl/prisma, @casl/angular, @casl/react, @casl/vue`. Fastify adapter `fastify-casl` 2.0.1: license GPL-3.0, `time.modified 2022-05-02`; search summary (L): "exposing utility methods to attach to the preHandler or preSerialization hooks".
- **Why it matters**: permission-based library that can run in the web app and in the API with one rule set; the Fastify adapter is a separate, older, GPL-licensed package.
- **Verified**: repository README (M); the CASL docs page returned only a title (no content). Confidence M.
- **Source**: https://github.com/stalniy/casl ; `npm view @casl/ability`, `npm view fastify-casl` (fetched 2026-10-04).

### E5. Casbin (`casbin` / `fastify-casbin`)

- **Found**: `casbin` 5.51.1, Apache-2.0: "An authorization library that supports access control models like ACL, RBAC, ABAC in Node.js and Browser"; usage `await enforcer.enforce(sub, obj, act)`. Supported models, "what Casbin does NOT do", and storage adapters: not on page (the docs overview fetch failed with no output). `fastify-casbin` 4.0.0, MIT: "A plugin for Fastify that adds support for Casbin." with `fastify.register(require('fastify-casbin'), { model: 'basic_model.conf', adapter: 'basic_policy.csv' })` and `fastify.casbin.enforce('alice','data1','read')`; Fastify 5 compatibility, sibling REST-enforcement plugin and maintenance status: not on page.
- **Why it matters**: policy-file driven engine (model file plus policy) with a Fastify plugin; the fetched pages do not state the policy storage options.
- **Verified**: two repository extractions plus `npm view` (M).
- **Source**: https://github.com/casbin/node-casbin ; https://github.com/nearform/fastify-casbin (fetched 2026-10-04).

### E6. `accesscontrol`

- **Found**: 3.1.1, MIT, `time.modified 2026-09-24`. "Role and Attribute based Access Control for Node.js". Chained API from the README: `ac.grant('user').createOwn('video').deleteOwn('video').readAny('video').grant('admin').extend('user').updateAny('video', ['title']).deleteAny('video');`. No maintenance or deprecation banner on the repository page; latest release version and date: not on page.
- **Why it matters**: a role-and-attribute grant table API with role inheritance (`extend`); no Fastify plugin was found for it in the fetched sources.
- **Verified**: repository extraction plus `npm view` (M).
- **Source**: https://github.com/onury/accesscontrol (fetched 2026-10-04).

### E7. `fastify-rbac` (metadata only)

- **Found**: 1.0.3, MIT, `time.modified 2022-05-02`. A search summary (L) states: "RBAC (Role-based access control) plugin for Fastify. It supports wildcard rules and inheritance, requires fastify >=1.0.0".
- **Why it matters**: listed because it appeared in the ecosystem search; its README was not fetched.
- **Verified**: `npm view` (H for metadata), search summary (L).
- **Source**: `npm view fastify-rbac`; https://npmjs.com/package/fastify-rbac (search listing only) (fetched 2026-10-04).

### E8. Better Auth Admin plugin (users, roles, permissions, ban)

- **Found**: "a set of administrative functions for user management": create and delete users, set roles, ban and unban, impersonate, revoke sessions. Access control: permissions are defined with `createAccessControl` where "The statement object should have the resource name as the key and the array of actions as the value." Default roles `admin` ("full control over other users") and `user` ("no control over other users"); custom roles supported ("create roles with the permissions you have defined"). Default permission statements: resource `user`: `create list set-role ban impersonate impersonate-admins delete set-password set-email get update`; resource `session`: `list revoke delete`. Checks: `userHasPermission` (server) and `checkRolePermission` (synchronous client function, no server call). Ban "preventing them from signing in and revokes all of their existing sessions", with `banReason` and `banExpiresIn`. User-table additions: `role`, `banned`, `banReason`, `banExpires`.
- **Why it matters**: a ready-made user, role and permission administration layer with server and client checks tied to the same framework as the session (B17).
- **Verified**: single extraction. Confidence M.
- **Source**: https://www.better-auth.com/docs/plugins/admin (fetched 2026-10-04).

### E9. External authorization engines (separate processes)

- **Found**: **OpenFGA**: "A high-performance and flexible authorization/permission engine built for developers and inspired by Google Zanzibar."; run by `docker run -p 8080:8080 -p 3000:3000 openfga/openfga run` or `./openfga run`; also Homebrew, precompiled binaries, `go install`; datastores "PostgreSQL 14+, MySQL 8, SQLite (beta)"; default in-memory storage "is ephemeral and will be discarded once the service stops" and is marked "not for production"; Apache-2.0; no account requirement stated for the open-source server; `@openfga/sdk` 0.9.7 Apache-2.0. **Cerbos**: "The open-source policy decision point ... Stateless, AuthZEN-compliant, and designed to run anywhere"; deployment as binaries, containers, Helm; "Cerbos Hub" is a hosted control plane (optional); license of the open-source core: not on page. **Permify**: "An open-source authorization as a service inspired by Google Zanzibar"; documented run command `docker run -p 3476:3476 -p 3478:3478 ghcr.io/permify/permify serve`; gRPC and REST APIs; AGPL-3.0; a managed "Permify Cloud" exists; supported databases not on page.
- **Why it matters**: these are not libraries; each adds a separate service process, and two of the three document a Docker run command first.
- **Verified**: repository and docs extractions (M). 
- **Source**: https://github.com/openfga/openfga ; https://openfga.dev/docs/getting-started/setup-openfga/overview (Docker and Kubernetes only on that page) ; https://docs.cerbos.dev/cerbos/latest/ ; https://github.com/permify/permify (fetched 2026-10-04).

### E10. Fastify pattern text for route-level or plugin-level guards (non-library)

- **Found**: a search summary (L) of third-party articles states a guard can be applied "at the router level using fastify.addHook within that plugin's context, so all routes defined within that plugin inherit the hook". Fastify's own documentation for hooks and plugin encapsulation was only extracted for the hook list and route options (E2); encapsulation text was not extracted.
- **Why it matters**: identifies the pattern name for a plugin-scoped hook without any library; its official-doc support is not confirmed here.
- **Verified**: search summary only (L).
- **Source**: summary text returned by web search 10 (2026-10-04); the sentence is attributed there to third-party articles, among them https://www.permit.io/blog/how-to-create-an-authorization-middleware-for-fastify. That blog was fetched later (fetch 84) only for the Permit.io account evidence, not to confirm this sentence.

### Topic E options table

| Option | Kind | Model | License | Version | Fastify support as documented | Runs in browser and API |
|---|---|---|---|---|---|---|
| Hand-written guard (route `config` + `preHandler`/`onRequest` + `onRoute`) | Hand-built on Fastify primitives (needs a recorded decision under I1) | Permission list per route | n/a | Fastify 5.12.5 | Native hooks (E2) | API only |
| `@fastify/auth` | Ready-made plugin | Combines guard functions with or/and | MIT | 5.1.1 | Fastify ^5 with >=5.x | API only |
| `fastify-guard` | Ready-made plugin | Role and scope checks | MIT | 3.0.1 | Fastify ^5 with ^3.0.0 | API only |
| `@casl/ability` (+ `fastify-casl`) | Ready-made library (adapter GPL-3.0, 2022) | Permission rules, serializable | MIT (core) | 7.0.1 / 2.0.1 | Adapter exists; core is framework-neutral | Both |
| `casbin` + `fastify-casbin` | Ready-made library + plugin | Model file + policy | Apache-2.0 / MIT | 5.51.1 / 4.0.0 | Plugin exists; Fastify 5 statement not on page | API and browser (per README) |
| `accesscontrol` | Ready-made library | Role and attribute grants | MIT | 3.1.1 | No Fastify plugin found | API |
| Better Auth Admin plugin | Ready-made framework plugin | Resource and action statements, roles | MIT | 1.7.7 | Fastify integration via catch-all route (B17) | Server and client checks |
| `fastify-rbac` | Ready-made plugin (stale) | Role rules, wildcards, inheritance | MIT | 1.0.3 | Requires fastify >=1.0.0 (summary) | API |
| OpenFGA / Cerbos / Permify | Separate service | Relationship or policy engine | Apache-2.0 / not stated / AGPL-3.0 | n/a | SDK or HTTP | Separate process |

---

## Excluded Register (account, hosted service, or Docker-first; U5, I4)

| Option | Why excluded | Evidence | Fetched |
|---|---|---|---|
| Auth0 (Fastify SDK) | Needs an Auth0 tenant: configuration values are the tenant domain and API audience created "in the Auth0 Dashboard" | https://auth0.com/blog/auth0-fastify-sdk/ | 2026-10-04 |
| Clerk (Fastify SDK) | Hosted service; search summary says keys are copied from the Clerk Dashboard (`CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`) and the publishable key "tells your app what your FAPI URL is". The direct docs page fetched had no setup content, so this is L | WebSearch listing https://clerk.com/docs/fastify/getting-started/quickstart.md and https://clerk.com/docs/pr/main/references/fastify/overview | 2026-10-04 |
| Oso Cloud | "a centralized authorization service" (hosted); a search summary says a development API key is created in API Keys settings and an `OSO_AUTH` variable is set; an offline "Oso Dev Server" runs via `docker run ... public.ecr.aws/osohq/dev-server:latest`. Direct quickstart page returned 404, so the key/Dev-Server claims are L | https://www.osohq.com/docs (service description); WebSearch listing https://www.osohq.com/docs/quickstart | 2026-10-04 |
| Permit.io | Cloud account: "PERMIT_SDK_TOKEN=<permit_sdk_token>" from the application; ABAC "requires deploying a local PDP" | https://www.permit.io/blog/how-to-create-an-authorization-middleware-for-fastify | 2026-10-04 |
| Cerbos Hub | Hosted control plane (sign-up at hub.cerbos.cloud); optional, the open-source PDP is the separate option in E9 | https://docs.cerbos.dev/cerbos/latest/ | 2026-10-04 |
| Permify Cloud | Managed hosting; optional, the open-source service is E9 | https://github.com/permify/permify | 2026-10-04 |
| Auth0 FGA / Okta FGA (managed OpenFGA) | Managed service; the page says OpenFGA has been "Used in production by Auth0 FGA since December 2021"; the open-source server in E9 is not excluded for account reasons | https://github.com/openfga/openfga | 2026-10-04 |
| Docker-first run paths (Permify quickstart, Oso Dev Server) | The documented start command is `docker run`; I4 excludes Docker without the user's OK. OpenFGA also documents a non-Docker binary | E9 sources above | 2026-10-04 |

No source fetched states that Better Auth, CASL, Casbin, `accesscontrol`, the `@fastify/*` plugins, `rate-limiter-flexible` or the Node built-ins require an account or a hosted service. Better Auth's docs-introduction page did not state its hosting model; the repository page did not mention a hosted service.

---

## Source-Stated Parameters (consolidated; the collector recommends none)

All rows fetched 2026-10-04.

| # | Parameter | Value as stated | Stated by | URL |
|---|---|---|---|---|
| P1 | Argon2id minimum | m=19456 KiB (19 MiB), t=2, p=1 | OWASP Password Storage | https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html |
| P2 | Argon2id equivalents | m=47104 t=1 p=1; m=12288 t=3 p=1; m=9216 t=4 p=1; m=7168 t=5 p=1 | OWASP Password Storage | https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html |
| P3 | scrypt | N=2^17 (128 MiB), r=8, p=1 | OWASP Password Storage | https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html |
| P4 | bcrypt | work factor minimum 10; input max 72 bytes | OWASP Password Storage | https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html |
| P5 | PBKDF2 | HMAC-SHA256 600,000; HMAC-SHA512 220,000; HMAC-SHA1 1,400,000 (legacy only) | OWASP Password Storage | https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html |
| P6 | Argon2id first recommended | t=1, p=4, m=2^21 KiB (2 GiB), 128-bit salt, 256-bit tag | RFC 9106 section 4 | https://www.rfc-editor.org/rfc/rfc9106.txt |
| P7 | Argon2id second recommended | t=3, p=4, m=2^16 KiB (64 MiB), 128-bit salt, 256-bit tag | RFC 9106 section 4 | https://www.rfc-editor.org/rfc/rfc9106.txt |
| P8 | Argon2 salt | 16 bytes recommended for password hashing | RFC 9106 | https://www.rfc-editor.org/rfc/rfc9106.txt |
| P9 | Password salt | at least 32 bits | NIST SP 800-63B-4 section 3.1.1.2 | https://pages.nist.gov/800-63-4/sp800-63b.html |
| P10 | Password length | NIST: 15 minimum single-factor, 8 minimum inside MFA, 64 maximum supported (SHOULD); OWASP: weak if under 8 (MFA) or under 15 (no MFA), maximum at least 64 | NIST; OWASP Authentication | https://pages.nist.gov/800-63-4/sp800-63b.html ; https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html |
| P11 | Session identifier entropy | at least 64 bits | OWASP Session; NIST session | https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html ; https://pages.nist.gov/800-63-4/sp800-63b/session/ |
| P12 | Session cookie | `SameSite=Strict` (preferred) or `Lax`; `Secure`; `HttpOnly`; `__Host-` recommended for session IDs | OWASP Session; NIST (Secure SHALL, HttpOnly SHOULD, SameSite SHOULD) | https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html ; https://pages.nist.gov/800-63-4/sp800-63b/session/ |
| P13 | Idle timeout | 2-5 minutes high-value, 15-30 minutes low risk | OWASP Session | https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html |
| P14 | Absolute timeout | 4-8 hours (full-day office worker example) | OWASP Session | https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html |
| P15 | Reauthentication limits | AAL1 overall 30 days (SHOULD), AAL2 overall 24 h and inactivity 1 h (SHOULD), AAL3 overall 12 h (SHALL) and inactivity 15 min (SHOULD) | NIST SP 800-63B-4 | https://pages.nist.gov/800-63-4/sp800-63b/aal/ |
| P16 | HMAC secret for JWT | at least the output size (256/384/512 bits for HS256/384/512); at least 160 bits entropy | OWASP JWT cheat sheet | https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_Cheat_Sheet |
| P17 | WebSocket token lifetime | 5-15 minutes (short-lived) | websocket.org | https://websocket.org/guides/authentication/ |
| P18 | WebSocket re-validation | every 30 minutes is common; close on session expiry | OWASP WebSocket | https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html |
| P19 | WebSocket limits | message size typically 64KB or less; 100 messages per minute a common starting point | OWASP WebSocket | https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html |
| P20 | Failed attempts ceiling | no more than 100 consecutive failed attempts per authenticator per account | NIST SP 800-63B-4 section 3.2.2 | https://pages.nist.gov/800-63-4/sp800-63b.html |
| P21 | Lockout parameters | threshold, observation window, duration (no values given) | OWASP Authentication | https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html |
| P22 | Out-of-band secret | valid within 10 minutes; at least six decimal digits | NIST section 3.1.3.2 | https://pages.nist.gov/800-63-4/sp800-63b.html |
| P23 | Look-up secret | at least six decimal digits | NIST section 3.1.2.1 | https://pages.nist.gov/800-63-4/sp800-63b.html |
| P24 | User code entropy (examples) | 20^8 (8 characters of a 20-character set); numeric example 10^9 | RFC 8628 section 6.1 | https://www.rfc-editor.org/rfc/rfc8628.txt |
| P25 | DPoP proof acceptance window | "on the order of seconds or minutes" | RFC 9449 | https://www.rfc-editor.org/rfc/rfc9449.txt |
| P26 | Refresh token expiry | expire if the client has been inactive for some time (no number) | RFC 9700 4.14.2 | https://www.rfc-editor.org/rfc/rfc9700.txt |

Library defaults (not guidance, listed for completeness): `@node-rs/argon2` m=19456 t=2 p=1 outputLen 32 (A10); Node scrypt N=16384 r=8 p=1 maxmem 32 MiB (A8); `@fastify/session` secret length at least 32, cookie defaults (B13); `@fastify/secure-session` expiry default 1 day (B14); `@fastify/rate-limit` max 1000 per 60 s (D3); Better Auth session 7 days, update age 1 day, fresh age 1 day, rate limit 100 per 10 s, sign-in 3 per 10 s, password length 8 to 128 (A14, B17, D5); `rate-limiter-flexible` example 100 per IP per day and 10 per username+IP (D4); `bcryptjs` default rounds 10 (A13).

---

## Not Confirmed and Gaps

1. Node 26 compatibility is not stated by any fetched source for `argon2`, `@node-rs/argon2`, `hash-wasm`, `@noble/hashes`, `bcrypt`, `bcryptjs`, Better Auth, `@fastify/session`, `@fastify/secure-session`, `@fastify/websocket` or `fastify-casbin`. Only `crypto.argon2` (added v24.7.0) is known to precede the host's v26.8.2.
2. `argon2` registry `engines.node >=16.17.0` versus README "tested against Node >=22.0.0": not reconciled. Its option defaults and API signatures are on a wiki page that was not fetched; whether it offers a needs-rehash helper is not confirmed.
3. The official Node docs page for `crypto.scrypt`, `crypto.timingSafeEqual` and the libuv threadpool note was truncated by the fetch tool; scrypt defaults were confirmed from source code; the "128*N*r > maxmem" error sentence and the `timingSafeEqual` equal-length rule are not confirmed from the current docs (search summary only for the first).
4. OWASP scrypt alternative parameter sets, and the OWASP statement "If Argon2id is not available..." remainder, were not captured. PBKDF2 SHA-512 and SHA-1 numbers come from extractions (two agreeing fetches), not a byte-level read.
5. OWASP JWT for Java page (sidejacking fingerprint cookie, token storage in browser) returned HTTP 404 at three URL forms; only a search summary (L) covers it. The generic OWASP JWT page extraction did not contain a client-storage section.
6. MASVS-AUTH control texts not retrieved (index page only). React Native 0.86-specific cookie and WebSocket-header behavior not confirmed; RN docs state "Cookie based authentication is currently unstable" without a version.
7. Secure and `__Host-` cookie behavior on `http://127.0.0.1` specifically (as opposed to `http://localhost`) is not confirmed; the issue table's scope text printed as "http://127.0.1" in the extraction. Browser versions per row not captured.
8. NIST section numbers for the reauthentication timeouts differ between two extractions (5.2 versus 2.x.3) and were not reconciled.
9. Fastify 5 compatibility statements are absent from the extracted READMEs of `@fastify/session`, `@fastify/secure-session`, `@fastify/websocket` and `fastify-casbin`; `npm view` returned no `peerDependencies` or `engines` for the `@fastify/*` plugins listed.
10. Better Auth: hosting model not stated on its docs-introduction page; Fastify version not stated on its Fastify integration page; session table column names not listed on the database page.
11. Cerbos open-source core license and Permify database support not on the fetched pages. The npm package `cerbos` was not identified.
12. Clerk and Oso Cloud exclusion evidence rests partly on web-search summaries (L); the direct pages returned no setup content (Clerk) or HTTP 404 (Oso quickstart).
13. CASL docs page and Casbin docs overview returned no usable content (title only; fetch failure); CASL and Casbin facts come from repository READMEs.
14. `fastify-rbac` README not fetched. Library benchmark figures (A10, A11, A12, A13) are the authors' own, on unlike machines, and are not comparable across libraries.
15. No source was found that specifies a pairing-code or device-credential protocol for a local demo; the closest public texts collected are RFC 8628, RFC 9449 and NIST out-of-band and look-up secrets (C2, C6, C7).

---

## Query Log

### Confidentiality statement

Every search string below is a generic technology query. None contains a project name, product name, person name, file content or text from the project's design documents. Fetch prompts contained only technical extraction instructions about the named public page.

### Web search strings (exact), in order

| # | Query string | Notes |
|---|---|---|
| 1 | `Node.js crypto.argon2 built-in Argon2id added in version release notes` | The search tool ran one extra internal query ("more specifically for Node.js built-in Argon2 support in the official Node.js release notes"); its exact string is not visible |
| 2 | `Node.js crypto.scrypt options cost blockSize parallelization maxmem default 32 MiB documentation` | |
| 3 | `nodejs.org api crypto.scrypt maxmem default cost power of two 128*N*r` | domain filter: nodejs.org |
| 4 | `OWASP cheat sheet JSON Web Token token sidejacking revocation denylist fingerprint cookie` | |
| 5 | `RFC 9700 refresh token rotation replay of rotated refresh token authorization server revoke active refresh token public clients` | |
| 6 | `OWASP MASVS-AUTH mobile app authentication token storage remote server session revoke guidance` | |
| 7 | `browser WebSocket API cannot set Authorization header custom headers authenticate handshake cookie or ticket` | |
| 8 | `React Native fetch cookies credentials include Android iOS native cookie jar session cookie handling` | |
| 9 | `Secure cookie over http://127.0.0.1 versus http://localhost Chrome Firefox Safari browser behavior` | |
| 10 | `Fastify role based access control plugin permission guard preHandler hook example npm` | |
| 11 | `Clerk authentication hosted service dashboard publishable key secret key Fastify SDK` | |
| 12 | `Oso Cloud authorization service API key sign up local development server` | |

### Fetched URLs (WebFetch; status as returned)

| # | URL | Status |
|---|---|---|
| 1 | https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html | OK |
| 2 | https://nodejs.org/api/crypto.html | OK, truncated (argon2, scrypt entries not received) |
| 3 | https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html | OK |
| 4 | https://raw.githubusercontent.com/nodejs/node/main/doc/api/crypto.md | OK, argon2 section not received |
| 5 | https://nodejs.org/en/blog/release/v24.7.0 | OK |
| 6 | https://nodejs.org/api/crypto.json (twice) | First OK for argon2; second did not reach scrypt, timingSafeEqual |
| 7 | https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html | OK |
| 8 | https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html | OK |
| 9 | https://pages.nist.gov/800-63-4/sp800-63b.html | OK |
| 10 | https://pages.nist.gov/800-63-4/sp800-63b/session/ | OK |
| 11 | https://github.com/ranisalt/node-argon2 | OK |
| 12 | https://github.com/napi-rs/node-rs/tree/main/packages/argon2 | OK |
| 13 | https://github.com/Daninet/hash-wasm | OK |
| 14 | https://github.com/paulmillr/noble-hashes | OK |
| 15 | https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html | HTTP 404 |
| 16 | https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html | OK |
| 17 | https://www.rfc-editor.org/rfc/rfc9700 | OK, truncated before 4.14 |
| 18 | https://www.rfc-editor.org/rfc/rfc8252 | OK |
| 19 | https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie | OK |
| 20 | https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS | OK |
| 21 | https://github.com/fastify/fastify-rate-limit | OK |
| 22 | https://github.com/fastify/fastify-auth | OK |
| 23 | https://github.com/fastify/session | OK |
| 24 | https://github.com/fastify/fastify-secure-session | OK |
| 25 | https://github.com/fastify/fastify-jwt | OK |
| 26 | https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_Cheat_Sheet | OK (no sidejacking or storage section returned) |
| 27 | https://www.rfc-editor.org/rfc/rfc9700.txt | OK (4.14.2 received) |
| 28 | https://casl.js.org/v6/en/guide/intro | Redirect (301), not followed automatically |
| 29 | https://casbin.org/docs/overview | Redirect (301), not followed automatically |
| 30 | https://github.com/onury/accesscontrol | OK |
| 31 | https://github.com/nearform/fastify-casbin | OK |
| 32 | https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet | HTTP 404 |
| 33 | https://casl.js.org/v6/en/guide/intro/ | OK, title only |
| 34 | https://casbin.apache.org/docs/overview | Failed, no output |
| 35 | https://www.better-auth.com/docs/introduction | OK, thin |
| 36 | https://www.better-auth.com/docs/concepts/session-management | OK |
| 37 | https://www.better-auth.com/docs/plugins/bearer | OK |
| 38 | https://www.better-auth.com/docs/concepts/rate-limit | OK |
| 39 | https://docs.cerbos.dev/cerbos/latest/ | OK |
| 40 | https://raw.githubusercontent.com/OWASP/CheatSheetSeries/master/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.md | HTTP 404 |
| 41 | https://github.com/stalniy/casl | OK |
| 42 | https://github.com/casbin/node-casbin | OK |
| 43 | https://github.com/better-auth/better-auth | OK |
| 44 | https://www.better-auth.com/docs/plugins/admin | OK |
| 45 | https://www.better-auth.com/docs/integrations/expo | OK |
| 46 | https://www.rfc-editor.org/rfc/rfc8628.txt | OK |
| 47 | https://www.rfc-editor.org/rfc/rfc9449.txt | OK |
| 48 | https://raw.githubusercontent.com/nodejs/node/main/lib/internal/crypto/scrypt.js | OK |
| 49 | https://www.rfc-editor.org/rfc/rfc9106.txt | OK |
| 50 | https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html | OK |
| 51 | https://github.com/animir/node-rate-limiter-flexible | OK |
| 52 | https://github.com/animir/node-rate-limiter-flexible/wiki/Overall-example | OK |
| 53 | https://openfga.dev/docs/getting-started/setup-openfga/overview | OK, thin |
| 54 | https://www.osohq.com/docs | OK, thin |
| 55 | https://lucia-auth.com/ | OK |
| 56 | https://raw.githubusercontent.com/OWASP/CheatSheetSeries/master/cheatsheets/Password_Storage_Cheat_Sheet.md | OK |
| 57 | https://raw.githubusercontent.com/OWASP/CheatSheetSeries/master/cheatsheets/Session_Management_Cheat_Sheet.md | OK |
| 58 | https://raw.githubusercontent.com/OWASP/CheatSheetSeries/master/cheatsheets/Authentication_Cheat_Sheet.md | OK |
| 59 | https://pages.nist.gov/800-63-4/sp800-63b/aal/ | OK |
| 60 | https://web.dev/articles/same-site-same-origin | OK |
| 61 | https://fastify.dev/docs/latest/Reference/Hooks/ | OK |
| 62 | https://mas.owasp.org/MASVS/07-MASVS-AUTH/ | OK, index only |
| 63 | https://websocket.org/guides/authentication/ | OK |
| 64 | https://fastify.dev/docs/latest/Reference/Routes/ | OK |
| 65 | https://github.com/fastify/fastify-cookie | OK |
| 66 | https://github.com/fastify/fastify-websocket | OK |
| 67 | https://github.com/openfga/openfga | OK |
| 68 | https://www.rfc-editor.org/rfc/rfc6265.txt | OK |
| 69 | https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts | OK |
| 70 | https://reactnative.dev/docs/network | OK |
| 71 | https://github.com/kelektiv/node.bcrypt.js | OK |
| 72 | https://github.com/dcodeIO/bcrypt.js | OK |
| 73 | https://www.better-auth.com/docs/integrations/fastify | OK |
| 74 | https://www.better-auth.com/docs/authentication/email-password | OK |
| 75 | https://www.better-auth.com/docs/concepts/database | OK |
| 76 | https://github.com/permify/permify | OK |
| 77 | https://www.rfc-editor.org/rfc/rfc7009.txt | OK |
| 78 | https://www.npmjs.com/package/fastify-guard | HTTP 403 |
| 79 | https://github.com/fastify/fastify-bearer-auth | OK |
| 80 | https://cdn.jsdelivr.net/npm/fastify-guard@3.0.1/README.md | OK |
| 81 | https://www.osohq.com/docs/getting-started/quickstart | HTTP 404 |
| 82 | https://auth0.com/blog/auth0-fastify-sdk/ | OK |
| 83 | https://clerk.com/docs/references/fastify/overview | OK, no setup content |
| 84 | https://www.permit.io/blog/how-to-create-an-authorization-middleware-for-fastify | OK |
| 85 | https://github.com/httpwg/http-extensions/issues/2605 | OK |
| 86 | https://bugs.webkit.org/show_bug.cgi?id=276313 | OK |

(87 fetch calls over 86 distinct URLs: item 6 was fetched twice. Search-engine calls are listed separately above.)

### npm commands

`npm view <pkg> version license time.modified --cache $TMPDIR/npmcache` for the packages in "Package Metadata"; `npm view <pkg> engines peerDependencies --json --cache $TMPDIR/npmcache` for argon2, @node-rs/argon2, bcrypt, bcryptjs, @fastify/rate-limit, @fastify/session, @fastify/secure-session, @fastify/cookie, @fastify/jwt, @fastify/auth, @casl/ability, better-auth, @better-auth/expo. The first, cache-less attempt failed with EPERM and was discarded.

---

## Collection Log

| Step | Action | Result |
|---|---|---|
| 1 | Read `identification/02_structured.md` row 10, `01_translated.md` | Scope fixed to five topics; design-book terms noted as forbidden in queries |
| 2 | `node --version` | v26.8.2 |
| 3 | npm metadata lookups | Registry data for 34 package names (2 names returned 404, 1 not re-run after the EPERM attempt); first attempt EPERM, retried with a temp cache |
| 4 | Primary standards and guidance fetches | OWASP (Password Storage, Session, Authentication, Authorization, CSRF, WebSocket), NIST SP 800-63B-4 (three pages), RFC 9106, 9700, 9449, 7009, 8628, 8252, 6265 |
| 5 | Node platform evidence | `crypto.argon2` entry (docs JSON), release blog, scrypt defaults (source file) |
| 6 | Library documentation fetches | Hashing libraries, Fastify plugins, auth framework, RBAC libraries and services |
| 7 | Cross-checks | OWASP Password, Session, Authentication fetched twice (HTML and raw markdown) |
| 8 | Exclusion evidence | Auth0, Permit.io, Cerbos Hub, Permify Cloud, Oso, Clerk (partly search summaries) |
| 9 | Wrote this file | `research/02e_collection_identity_security.md` |

---
*Generated: 2026-10-04*
*Last Updated: 2026-10-04*
