---
task: 2026-10-12_input_av_core_adapter_plan
row: 95
milestone: M8 / WP-19c
agent: coder-execution
date: 2026-10-12
tier: T3
status: complete
---

# Row 95 - the one destination rule (S13-11)

## What was built

| File | Kind | Content |
|---|---|---|
| `apps/core-server/src/capture/destination-rule.ts` | new | `decideDestination`, `decideNewCameraAddress`, `scanSizeRefusal`, `spacingAllowance`, the refusal vocabulary and the bounds |
| `apps/core-server/src/capture/__tests__/destination-rule.test.ts` | new | the target table (counted together with the folder's static rules: 199 tests) |

No existing file was changed. The file is not yet imported by anything: rows 96, 107, 111 (S13-11) and 143, 144 (AD-02) are its callers.

## The rule, bound by bound

| Source | Bound | Refusal code(s) |
|---|---|---|
| S13-11 (1) | IPv4 literal only, no name | `NOT_AN_ADDRESS`, `HOST_NAME`, `MALFORMED_IPV4` (leading zero, hexadecimal or octal part, bare integer, 2/3/5 parts, part above 255, glued port or prefix, white space), `IPV6_LITERAL`, `IPV4_MAPPED_IPV6` (mapped, compatible and `64:ff9b::` forms, dotted or hexadecimal, bracketed) |
| S13-11 (1), AD-02 (1) | never loopback, unspecified, link-local, multicast, broadcast | `LOOPBACK` (127.0.0.0/8, `::1`), `UNSPECIFIED` (0.0.0.0/8, `::`), `LINK_LOCAL`, `MULTICAST`, `BROADCAST` (240.0.0.0/4) |
| S13-11 (1) | private ranges only | `PUBLIC_ADDRESS` |
| S13-11 (1) | not the network or broadcast address of its /24 (and of its subnet) | `NETWORK_ADDRESS`, `SUBNET_BROADCAST` |
| S13-11 (1), AD-02 (1) | not an address of the Core host | `HOST_ADDRESS` (camera-interface and alias addresses are counted even if the caller's list forgot them) |
| S13-11 (2), DR-4 | not inside the subnet of another interface | `OTHER_INTERFACE_SUBNET` |
| S13-11 (2) | from the camera interface only; no fallback route | `OUTSIDE_CAMERA_SUBNET`, `NO_CAMERA_SOURCE`, `NOT_CONFIGURED`; an allowed answer names `sourceAddress` |
| S13-11 (3) | port from the short stored list, default 80 | `PORT_OUT_OF_RANGE`, `PORT_NOT_LISTED`, `PORT_LIST_INVALID` (list of 1 to 8 ports) |
| S13-11 (4) | scan of at most 32 stored + 1 typed; minimum spacings | `scanSizeRefusal`; `spacingAllowance` with SCAN 10 s, TYPED_PROBE 10 s, HOST 5 s |
| S13-11 set-IP | new address inside the camera subnet, not the Core's, gateway's or a registered camera's; prefix from configuration; gateway inside the subnet; no DHCP | `decideNewCameraAddress`: `DHCP_NOT_CARRIED`, `GATEWAY_ADDRESS`, `REGISTERED_CAMERA_ADDRESS`, `GATEWAY_OUTSIDE_SUBNET` plus the codes above |
| S13-08 (2) | an alias is RFC 1918 and a /24 | an alias source reaches its own /24 only; a public alias makes the context `NOT_CONFIGURED` |
| AD-02 (2) | no permissive value under `src/` | the file holds none; a context that names a loopback camera subnet is `NOT_CONFIGURED` and a loopback target stays `LOOPBACK` |

The class of the address is decided before the host's facts are read, so a loopback, mapped or public address keeps its own code on an unconfigured Core (the named codes AD-02 asks for).

"Refused before any packet is built": the function is pure. Its only import is `@dems/shared/api` (two existing constants); it opens nothing, resolves no name, reads no clock and logs nothing; a refusal is `{ allowed: false, refusal }` and carries no text of the caller. The test file asserts the import list and the absence of those calls.

## Checks run

| Check | Command (in `apps/core-server`) | Result |
|---|---|---|
| Target table + the capture folder's static rules | `npx vitest run --project unit --maxWorkers=2 src/capture/__tests__/destination-rule.test.ts src/capture/__tests__/static.test.ts` | `Test Files 2 passed (2)`, `Tests 199 passed (199)`, one run |
| Lint of the two files | `npx oxlint <the two files>` | exit 0, no finding |
| Workspace typecheck | `npx tsc --noEmit` | exit 2 with 2 errors, 0 in this row's files: `src/modules/devices/status.ts(127,3)` and `packages/shared/src/sim/api.ts(344,3)`, both from the uncommitted change in progress in `packages/shared/src/api/state-slices.ts` (another row). A first run during that edit also showed three missing names in `state-slices.ts`; they were gone in the second run. |

The capture static rules (`__tests__/static.test.ts`) pass with the new file in the folder unchanged: no request in `file_requests.md`.

## What the double is, and what stays unproven

Everything is decided on values the caller passes (`DestinationContext`); no interface of this Mac was read. Unproven until the hardware package: that the caller's reading of the host's interfaces, subnets and aliases is right on the Linux host, and that the socket is really bound to `sourceAddress` so the route cannot leave by another interface (the callers' half of S13-11 (2); rows 107, 111, 143).

Not in this row (their own rows): single flight of the scan and of the commissioning job (107, 111); redirects, answer size and time, fixed service path (S13-11 (3) rest, the connection files); parsing of the answer (S13-11 (5)).

## DRIVER DECISIONS (for the controller to confirm)

1. **Purposes and the alias.** `COMMISSIONING_SCAN` and `SET_IP` may reach a target outside the camera subnet from an alias whose /24 holds it; `TYPED_PROBE` and `STORED_CAMERA` are held to the configured camera subnet. S13-11 does not state this split; it is the narrower reading (a stored or search-typed address has no reason to lie in a factory network).
2. **Spacing values.** No new number: scan and typed probe use `CAPTURE_DISCOVERY_MIN_INTERVAL_MS` (10 s), per host `CAPTURE_CONNECTION_TEST_MIN_INTERVAL_MS` (5 s). S13-11 says "a stated minimum spacing" without a value.
3. **Port list length.** "A short stored list" is bounded at 8 entries.
4. **Reserved 240.0.0.0/4 and 0.0.0.0/8** are reported as `BROADCAST` and `UNSPECIFIED`, not as `PUBLIC_ADDRESS`.
5. **Strictness of the literal.** Leading zeros and every non-dotted numeric form are refused rather than normalised; the answer's address is rebuilt from the four numbers.
6. **A context that cannot be read refuses everything** (`NOT_CONFIGURED`), including a registered-camera list with an unreadable entry in set-IP.
7. **Constants live in the rule file**, not in `@dems/shared/api`: the contract package is another row's hot file. If a client must show them, that is a later request.
