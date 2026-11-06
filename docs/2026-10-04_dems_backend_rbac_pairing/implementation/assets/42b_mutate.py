#!/usr/bin/env python3
"""Mutation check of the follow-up of plan row W42 (review findings CPS1-5 and CPS1-4): one text
of one production file is replaced in memory (vitest transform, configuration outside the
repository, rule M15), the tests run to their teardown, and the run must fail."""
import base64, os, subprocess, sys, time

ROOT = '/Users/gsp-budi/Documents/DEMS'
WS = ROOT + '/apps/core-server'
HERE = os.path.dirname(os.path.abspath(__file__))
CONFIG = HERE + '/vitest.mutation.config.ts'
VITEST = ROOT + '/node_modules/vitest/vitest.mjs'
R = 'src/realtime/'
UNIT = ['--project', 'unit', 'src/realtime']
def db(*files): return ['--project', 'db'] + [R + '__tests__/' + f for f in files]

CAP_SLICE = "own.slice(0, displacedBy(own.length, principalCapOf(key, limits)))"
M = [
 # ── admission.ts: the socket decision table, the caps shared by everybody, the topics (as in the row) ──
 ('A1', 'admission.ts', "return retired ? deviceRetired() : sessionInvalid('BEARER');", "return retired ? sessionInvalid('BEARER') : deviceRetired();", UNIT),
 ('A2', 'admission.ts', "if (authentication.presented === 'BEARER') {", "if (authentication.presented === 'COOKIE') {", UNIT),
 ('A3', 'admission.ts', "if (authentication.presented === 'COOKIE') return sessionInvalid('COOKIE');", "if (authentication.presented === 'COOKIE') return sessionInvalid('BEARER');", UNIT),
 ('A4', 'admission.ts', "  if (transport === 'COOKIE') {", "  if (transport === 'BEARER') {", UNIT),
 ('A5', 'admission.ts', "principal.retiredDeviceId !== null || authentication.failure === 'DEVICE_RETIRED'", "principal.retiredDeviceId !== null && authentication.failure === 'DEVICE_RETIRED'", UNIT),
 ('A6', 'admission.ts', "if (open.total >= caps.maxConnections) return true;", "if (open.total > caps.maxConnections) return true;", UNIT),
 ('A7', 'admission.ts', "open.anonymous >= caps.maxAnonymous", "open.anonymous > caps.maxAnonymous", UNIT),
 ('A8', 'admission.ts', "return admission.kind === RealtimePrincipal.ANONYMOUS && open.anonymous >= caps.maxAnonymous;", "return open.anonymous >= caps.maxAnonymous;", UNIT),
 ('A9', 'admission.ts', "return [RealtimeTopic.HEARTBEAT, RealtimeTopic.CONTROL];", "return [RealtimeTopic.HEARTBEAT];", UNIT),
 ('A10', 'admission.ts', "admission.permissions.some((permission)", "admission.permissions.every((permission)", UNIT),
 ('A11', 'admission.ts', "reason: RealtimeHelloReason.DEVICE_REVOKED, closeCode: RealtimeCloseCode.DEVICE_REVOKED };", "reason: RealtimeHelloReason.DEVICE_REVOKED, closeCode: RealtimeCloseCode.SESSION_ENDED };", UNIT),
 ('A12', 'admission.ts', "if (principal.kind === 'DEVICE') return { kind: RealtimePrincipal.DEVICE, deviceId: principal.deviceId };", "if (principal.kind === 'DEVICE') return OPEN_ANONYMOUS;", UNIT),
 # ── admission.ts: the cap of one principal (CPS1-5) ──
 ('P1', 'admission.ts', "return `device:${admission.deviceId}`;", "return `session:${admission.deviceId}`;", UNIT),
 ('P2', 'admission.ts', "  if (admission.kind === RealtimePrincipal.ANONYMOUS) return null;\n  if (admission.kind === RealtimePrincipal.DEVICE) return `device:", "  if (admission.kind === RealtimePrincipal.DEVICE) return `device:", UNIT),
 ('P3', 'admission.ts', "return `session:${admission.sessionId}`;", "return `session:${admission.operatorId}`;", UNIT),
 ('P4', 'admission.ts', "return `session:${admission.sessionId}`;", "return admission.deviceId === null ? `session:${admission.sessionId}` : `device:${admission.deviceId}`;", UNIT),
 ('P5', 'admission.ts', "return key.startsWith('device:') ? caps.maxPerDevice : caps.maxPerSession;", "return key.startsWith('device:') ? caps.maxPerSession : caps.maxPerDevice;", UNIT),
 ('P6', 'admission.ts', "return Math.max(0, open + 1 - cap);", "return Math.max(0, open - cap);", UNIT),
 ('P7', 'admission.ts', "return Math.max(0, open + 1 - cap);", "return Math.max(0, open + 2 - cap);", UNIT),
 ('P8', 'admission.ts', "return Math.max(0, open + 1 - cap);", "return open + 1 - cap;", UNIT),
 ('P9', 'admission.ts', "return Math.max(0, open + 1 - cap);", "return Math.min(1, Math.max(0, open + 1 - cap));", UNIT),
 # ── limits.ts: the numbers ──
 ('L1', 'limits.ts', "export const REALTIME_MAX_PER_SESSION = 4;", "export const REALTIME_MAX_PER_SESSION = 5;", UNIT),
 ('L2', 'limits.ts', "export const REALTIME_MAX_PER_DEVICE = 2;", "export const REALTIME_MAX_PER_DEVICE = 3;", UNIT),
 ('L3', 'limits.ts', "export const REALTIME_HANDSHAKE_TIMEOUT_MS = 5_000;", "export const REALTIME_HANDSHAKE_TIMEOUT_MS = 4_000;", UNIT),
 ('L4', 'limits.ts', "export const REALTIME_MAX_PENDING_HANDSHAKES = 32;", "export const REALTIME_MAX_PENDING_HANDSHAKES = 16;", UNIT),
 ('L5', 'limits.ts', "REPLACED: 'replaced by a newer connection',", "REPLACED: 'connection cap',", UNIT),
 # ── hub.ts: the displacement ──
 ('D1', 'hub.ts', "    displaceOldest(connection);\n\n    const open = openCounts();", "    const open = openCounts();", UNIT),
 ('D2', 'hub.ts', "if (connection.key === key && live(connection)) own.push(connection);", "if (connection.key === key) own.push(connection);", UNIT),
 ('D3', 'hub.ts', "      counters.displaced += 1;\n", "", UNIT),
 ('D4', 'hub.ts', "close(oldest, RealtimeCloseCode.TRY_AGAIN_LATER, CLOSE_REASON.REPLACED);", "close(oldest, RealtimeCloseCode.TRY_AGAIN_LATER, CLOSE_REASON.CAP);", UNIT),
 ('D5', 'hub.ts', "close(oldest, RealtimeCloseCode.TRY_AGAIN_LATER, CLOSE_REASON.REPLACED);", "close(oldest, RealtimeCloseCode.SESSION_ENDED, CLOSE_REASON.REPLACED);", UNIT),
 ('D6', 'hub.ts', CAP_SLICE, "own.reverse().slice(0, displacedBy(own.length, principalCapOf(key, limits)))", UNIT),
 ('D7', 'hub.ts', "    const key = newcomer.key;\n    if (key === null) return;\n", "    const key = newcomer.key as PrincipalKey;\n", UNIT),
 ('D8', 'hub.ts', "    displaceOldest(connection);\n\n    const open = openCounts();", "    const open = openCounts();\n    displaceOldest(connection);", UNIT),
 ('D9', 'hub.ts', "replacedBy: newcomer.id },", "replacedBy: oldest.id },", UNIT),
 ('D10', 'hub.ts', "      key: principalKeyOf(admission),", "      key: principalKeyOf(requested),", UNIT),
 ('D11', 'hub.ts', "if (connection.key === key && live(connection)) own.push(connection);", "if (live(connection)) own.push(connection);", UNIT),
 ('D12', 'hub.ts', CAP_SLICE, "own.slice(0, displacedBy(own.length, limits.maxPerSession))", UNIT),
 # ── handshake.ts: the sockets of upgrade requests (CPS1-4) ──
 ('G1', 'handshake.ts', "if (waiting.size >= limits.maxPendingHandshakes) {", "if (waiting.size > limits.maxPendingHandshakes) {", UNIT),
 ('G2', 'handshake.ts', "          displaced += 1;\n          destroy(oldest[0], oldest[1]);", "          displaced += 1;", UNIT),
 ('G3', 'handshake.ts', "if (entry.deadline > now) break;", "if (entry.deadline >= now) break;", UNIT),
 ('G4', 'handshake.ts', "deadline: clock.now() + limits.handshakeTimeoutMs,", "deadline: clock.now(),", UNIT),
 ('G5', 'handshake.ts', "      socket.on('error', drop);\n", "", UNIT),
 ('G6', 'handshake.ts', "      socket.once('end', drop);\n", "", UNIT),
 ('G7', 'handshake.ts', "      waiting.delete(request);\n      entry.release();", "      waiting.delete(request);", UNIT),
 ('G8', 'handshake.ts', "      waiting.delete(request);\n      entry.release();", "      entry.release();", UNIT),
 ('G9', 'handshake.ts', "      expired += destroyed;\n", "", UNIT),
 ('G10', 'handshake.ts', "    waiting.delete(request);\n    entry.socket.destroy();", "    waiting.delete(request);", UNIT),
 ('G11', 'handshake.ts', "    waiting.delete(request);\n    entry.socket.destroy();", "    entry.socket.destroy();", UNIT),
 ('G12', 'handshake.ts', "          socket.removeListener('error', drop);\n", "", UNIT),
 ('G13', 'handshake.ts', "          socket.removeListener('end', drop);\n", "", UNIT),
 ('G14', 'handshake.ts', "      for (const [request, entry] of waiting) destroy(request, entry);", "      waiting.clear();", UNIT),
 ('G15', 'handshake.ts', "          displaced += 1;\n", "", UNIT),
 ('G16', 'handshake.ts', "        destroy(request, entry);\n        destroyed += 1;", "        destroyed += 1;", UNIT),
 # ── index.ts: the wiring, against real sockets and a raw TCP client (the text test is not in these runs) ──
 ('W1', 'index.ts', "    const destroyed = handshakes.sweep();", "    const destroyed = 0;", db('upgrade.db.test.ts')),
 ('W2', 'index.ts', "    handshakes.answered(request.raw);\n", "", db('upgrade.db.test.ts')),
 ('W3', 'index.ts', "    handshakes.taken(request.raw);\n", "", db('upgrade.db.test.ts', 'state.db.test.ts')),
 ('W4', 'index.ts', "(rawRequest: IncomingMessage, socket: Duplex): void => handshakes.begin(rawRequest, socket);", "(_rawRequest: IncomingMessage, _socket: Duplex): void => {};", db('upgrade.db.test.ts')),
 ('W5', 'limits.ts', "  maxPerSession: REALTIME_MAX_PER_SESSION,", "  maxPerSession: REALTIME_MAX_CONNECTIONS,", db('upgrade.db.test.ts')),
 ('W6', 'limits.ts', "  maxPerDevice: REALTIME_MAX_PER_DEVICE,", "  maxPerDevice: REALTIME_MAX_CONNECTIONS,", db('upgrade.db.test.ts')),
 # The pace step now also sweeps the handshakes: the hub's part of it is still what the state tests see.
 ('W7', 'index.ts', "      timer.every(REALTIME_DELTA_PACE_MS, pace),\n", "", db('state.db.test.ts')),
 ('W8', 'index.ts', "    hub.pace();\n    const destroyed = handshakes.sweep();", "    const destroyed = handshakes.sweep();", db('state.db.test.ts')),
]

only = set(sys.argv[1:])
results = []
start = time.time()
for (mid, file, frm, to, scope) in M:
    if only and mid not in only: continue
    if mid in set(os.environ.get('SKIP', '').split(',')): continue
    if os.environ.get('SCOPE') == 'unit' and scope[1] != 'unit': continue
    if os.environ.get('SCOPE') == 'db' and scope[1] != 'db': continue
    src = open(WS + '/' + R + file).read()
    n = src.count(frm)
    if n != 1:
        results.append((mid, file, 'INVALID', f'text occurs {n} times'))
        print(f'{mid:5} INVALID: text occurs {n} times in {file}', flush=True)
        continue
    if os.environ.get('CHECK') == '1':
        results.append((mid, file, 'valid', ''))
        continue
    env = dict(os.environ, MUT_FILE=R + file, MUT_FROM_B64=base64.b64encode(frm.encode()).decode(), MUT_TO_B64=base64.b64encode(to.encode()).decode(), DEMS_TEST_STEP='64b')
    t0 = time.time()
    # Never interrupted: every run reaches its own teardown (rule of the follow-up).
    run = subprocess.run(['node', VITEST, 'run', '--config', CONFIG, '--maxWorkers=2', '--hookTimeout=20000', '--testTimeout=20000'] + scope, cwd=ROOT, env=env, capture_output=True, text=True)
    out = run.stdout + run.stderr
    if mid in set(os.environ.get('KEEP', '').split(',')): open(HERE + '/outb_' + mid + '.log', 'w').write(out)
    failed = [l.strip() for l in out.splitlines() if l.strip().startswith('×') or ' × ' in l][:2]
    tests_line = next((l.strip() for l in out.splitlines() if l.strip().startswith('Tests ')), '')
    teardown = next((l.strip() for l in out.splitlines() if 'teardown: dropped' in l), '')
    verdict = 'detected' if run.returncode != 0 else 'SURVIVED'
    if run.returncode != 0 and 'failed' not in tests_line and 'Hook timed out' not in out and 'Unhandled' not in out and 'Error' not in out:
        verdict = 'UNCLEAR'
    results.append((mid, file, verdict, tests_line))
    print(f'{mid:5} {verdict:9} {file:15} {time.time()-t0:5.1f}s  {tests_line}  {failed[0][:140] if failed else ""}  {teardown[-60:] if teardown else ""}', flush=True)

detected = sum(1 for r in results if r[2] == 'detected')
print(f'\n{detected} of {len(results)} mutations detected in {time.time()-start:.0f} s; not detected: {[r[0] for r in results if r[2] not in ("detected", "valid")]}')
