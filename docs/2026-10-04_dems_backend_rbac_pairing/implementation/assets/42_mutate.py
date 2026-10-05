#!/usr/bin/env python3
"""Mutation check of plan row W42: one text of one production file is replaced in memory
(vitest transform, configuration outside the repository), the tests run, and the run must fail."""
import base64, json, os, subprocess, sys, time

ROOT = '/Users/gsp-budi/Documents/DEMS'
WS = ROOT + '/apps/core-server'
CONFIG = os.path.dirname(os.path.abspath(__file__)) + '/vitest.mutation.config.ts'
VITEST = ROOT + '/node_modules/vitest/vitest.mjs'
R = 'src/realtime/'
UNIT = ['--project', 'unit', 'src/realtime']
def db(*files): return ['--project', 'db'] + [R + '__tests__/' + f for f in files]

M = [
 # ── admission.ts: the socket decision table, the caps, the topics ──
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
 # ── hub.ts: admission into the hub ──
 ('H1', 'hub.ts', "    connection.counted = false;\n    if (!connection.present", "    if (!connection.present", UNIT),
 ('H2', 'hub.ts', "    dependencies.presence()?.socketClosed(connection.deviceId);\n", "", UNIT),
 ('H3', 'hub.ts', "if (buffered <= limits.hardBufferBytes) return;", "if (buffered < limits.hardBufferBytes) return;", UNIT),
 ('H4', 'hub.ts', "close(connection, RealtimeCloseCode.SLOW_CONSUMER, CLOSE_REASON.SLOW_CONSUMER);", "close(connection, RealtimeCloseCode.POLICY_VIOLATION, CLOSE_REASON.SLOW_CONSUMER);", UNIT),
 ('H5', 'hub.ts', "delta.epoch === position.epoch && delta.revision <= position.revision) return;", "delta.epoch === position.epoch && delta.revision < position.revision) return;", UNIT),
 ('H6', 'hub.ts', "if (position === null || delta.epoch !== position.epoch || delta.revision !== position.revision + 1) {", "if (position === null) {", UNIT),
 ('H7', 'hub.ts', "    connection.position = { epoch: delta.epoch, revision: delta.revision };\n", "", UNIT),
 ('H8', 'hub.ts', "      held = [];\n      publishedRoles.clear();", "      publishedRoles.clear();", UNIT),
 ('H9', 'hub.ts', "if (change.cause === 'tick' && !change.records) {", "if (change.cause === 'tick') {", UNIT),
 ('H10', 'hub.ts', "if (change.cause === 'tick' && !change.records) {", "if (!change.records) {", UNIT),
 ('H11', 'hub.ts', "    flushHeld(now);\n    for (const connection of receivers) sendDelta(connection, delta, now);", "    for (const connection of receivers) sendDelta(connection, delta, now);", UNIT),
 ('H12', 'hub.ts', "      held.push(delta);\n      return;", "      return;", UNIT),
 ('H13', 'hub.ts', "if (connection.transport.bufferedAmount > limits.meterSkipBytes) {", "if (connection.transport.bufferedAmount >= limits.meterSkipBytes) {", UNIT),
 ('H14', 'hub.ts', "if (!connection.meters || !live(connection)) continue;", "if (!live(connection)) continue;", UNIT),
 ('H15', 'hub.ts', "if (meterWindowCount >= limits.meterWireRateHz) {", "if (meterWindowCount > limits.meterWireRateHz) {", UNIT),
 ('H16', 'hub.ts', "    if (frame.seq <= lastEngineMeterSeq) meterBase = lastWireMeterSeq;\n", "", UNIT),
 ('H17', 'hub.ts', "      connection.permissions = permissions;\n", "", UNIT),
 ('H18', 'hub.ts', "close(connection, RealtimeCloseCode.SESSION_ENDED, CLOSE_REASON.SESSION_ENDED);", "close(connection, RealtimeCloseCode.DEVICE_REVOKED, CLOSE_REASON.SESSION_ENDED);", UNIT),
 ('H19', 'hub.ts', "      deliver(connection, text);\n      close(connection, RealtimeCloseCode.SESSION_ENDED, CLOSE_REASON.SESSION_ENDED);", "      close(connection, RealtimeCloseCode.SESSION_ENDED, CLOSE_REASON.SESSION_ENDED);", UNIT),
 ('H20', 'hub.ts', "    for (const sessionId of ended) endedSessions.set(sessionId, now);\n", "", UNIT),
 ('H21', 'hub.ts', "if (connection.deviceId !== deviceId || !live(connection)) continue;", "if (connection.deviceId !== deviceId || connection.kind !== RealtimePrincipal.DEVICE || !live(connection)) continue;", UNIT),
 ('H22', 'hub.ts', "    retiredDevices.set(deviceId, clock.now());\n", "", UNIT),
 ('H23', 'hub.ts', "    tabletLink.deviceRetired();\n", "", UNIT),
 ('H24', 'hub.ts', "      if (!connection.permissions.includes(permission)) continue;\n", "", UNIT),
 ('H26', 'hub.ts', "if (connection.inbound.length > limits.clientMessageLimit.count) return refuse(connection, ClientMessageRefusal.RATE);", "if (connection.inbound.length >= limits.clientMessageLimit.count) return refuse(connection, ClientMessageRefusal.RATE);", UNIT),
 ('H27', 'hub.ts', "    if (isBinary) return refuse(connection, ClientMessageRefusal.NOT_TEXT);\n", "", UNIT),
 ('H28', 'hub.ts', "if (!canSendRealtimeMessage(connection.kind, message.type)) return refuse(connection, ClientMessageRefusal.NOT_ALLOWED);", "", UNIT),
 ('H29', 'hub.ts', "if (last !== null && now - last < limits.resyncMinIntervalMs) {", "if (last !== null && now - last <= limits.resyncMinIntervalMs) {", UNIT),
 ('H30', 'hub.ts', "connection.resyncDueAt = last + limits.resyncMinIntervalMs;", "connection.resyncDueAt = now + limits.resyncMinIntervalMs;", UNIT),
 ('H31', 'hub.ts', "return sessionInvalid(requested.deviceId === null ? 'COOKIE' : 'BEARER');", "return sessionInvalid(requested.deviceId === null ? 'BEARER' : 'COOKIE');", UNIT),
 ('H32', 'hub.ts', "return published === undefined ? requested : { ...requested, role: published.role, permissions: published.permissions };", "return requested;", UNIT),
 ('H33', 'hub.ts', "      deliver(connection, hello);\n      log.info({ connectionId: connection.id, code: admission.closeCode", "      log.info({ connectionId: connection.id, code: admission.closeCode", UNIT),
 ('H34', 'hub.ts', "if (beyondCap(admission, open, limits)) {", "if (false) {", UNIT),
 ('H35', 'hub.ts', "    if (connection.kind === RealtimePrincipal.OPERATOR) sendSnapshot(connection, now);\n    heartbeat(connection, now, open.total + 1);", "    sendSnapshot(connection, now);\n    heartbeat(connection, now, open.total + 1);", UNIT),
 ('H36', 'hub.ts', "    if (connection.kind !== RealtimePrincipal.OPERATOR) return null;\n    const engine = dependencies.engine();\n    return engine.running", "    const engine = dependencies.engine();\n    return engine.running", UNIT),
 ('H37', 'hub.ts', "if (!closing.terminated && now >= closing.deadline) {", "if (!closing.terminated && now > closing.deadline) {", UNIT),
 ('H38', 'hub.ts', "      if (!connection.alive) {\n        log.info({ connectionId: connection.id }, 'socket destroyed: no answer to the last ping');", "      if (connection.alive) {\n        log.info({ connectionId: connection.id }, 'socket destroyed: no answer to the last ping');", UNIT),
 ('H39', 'hub.ts', "      held = [];\n      publishedRoles.clear();", "      held = [];", UNIT),
 ('H40', 'hub.ts', "    forget(endedSessions, now - limits.endedMemoryMs);\n", "", UNIT),
 ('H41', 'hub.ts', "if (connection.kind === RealtimePrincipal.OPERATOR && live(connection)) found.push(connection);", "if (live(connection)) found.push(connection);", UNIT),
 ('H42', 'hub.ts', "    connection.position = { epoch: snapshot.epoch, revision: snapshot.revision };\n", "", UNIT),
 ('H43', 'hub.ts', "    connection.closing = { code, deadline: clock.now() + limits.closeGraceMs, terminated: false };\n    depart(connection);", "    connection.closing = { code, deadline: clock.now() + limits.closeGraceMs, terminated: false };", UNIT),
 ('H44', 'hub.ts', "connection.resyncDueAt !== null && now >= connection.resyncDueAt) answerResync(connection, now);", "connection.resyncDueAt !== null && now > connection.resyncDueAt) answerResync(connection, now);", UNIT),
 ('H45', 'hub.ts', "      if (connection.operatorId !== operatorId || !live(connection)) continue;", "      if (!live(connection)) continue;", UNIT),
 ('H46', 'hub.ts', "if (connection.sessionId === null || !ended.has(connection.sessionId) || !live(connection)) continue;", "if (connection.sessionId === null || !live(connection)) continue;", UNIT),
 ('H47', 'hub.ts', "    if (connection.closing !== null) return false;\n    try {\n      connection.transport.send(text);", "    try {\n      connection.transport.send(text);", UNIT),
 ('H48', 'hub.ts', "      if (connection.kind !== RealtimePrincipal.OPERATOR) continue;\n      enforceBuffer(connection);", "      enforceBuffer(connection);", UNIT),
 ('H49', 'hub.ts', "    if (now - meterWindowStart >= SECOND_MS || now < meterWindowStart) {", "    if (now - meterWindowStart > SECOND_MS || now < meterWindowStart) {", UNIT),
 ('H50', 'hub.ts', "      if (at <= before) memory.delete(id);", "      if (at < before) memory.delete(id);", UNIT),
 ('H51', 'hub.ts', "connection.inbound = connection.inbound.filter((at) => at > oldest);", "connection.inbound = connection.inbound.filter((at) => at >= oldest);", UNIT),
 ('H52', 'hub.ts', "      stopped = true;\n", "", UNIT),
 # ── tablet-link.ts ──
 ('T1', 'tablet-link.ts', "if (offlineFrom !== null && now < offlineFrom) return null;", "if (offlineFrom !== null && now <= offlineFrom) return null;", UNIT),
 ('T2', 'tablet-link.ts', "if (open === 0) offlineFrom = clock.now() + limits.tabletLinkDebounceMs;", "if (open === 0) offlineFrom = clock.now();", UNIT),
 ('T3', 'tablet-link.ts', "      open += 1;\n      step();", "      open += 1;", UNIT),
 ('T4', 'tablet-link.ts', "      offlineFrom = clock.now();\n      step();", "      step();", UNIT),
 ('T5', 'tablet-link.ts', "    if (now < retryFrom) return;\n", "", UNIT),
 ('T6', 'tablet-link.ts', "          if (failing) return;\n", "", UNIT),
 ('T7', 'tablet-link.ts', "    if (!engine.running) return;\n", "", UNIT),
 ('T8', 'tablet-link.ts', "      open -= 1;\n      if (open === 0) offlineFrom", "      if (open === 0) offlineFrom", UNIT),
 ('H53', 'hub.ts', "if (connection.deviceId !== null && live(connection)) {\n      connection.present = true;", "if (connection.deviceId !== null) {\n      connection.present = true;", UNIT),
 ('H54', 'hub.ts', "if (!connection.present || connection.deviceId === null) return;", "if (connection.deviceId === null) return;", UNIT),
 ('H55', 'hub.ts', "      connection.present = true;\n", "", UNIT),
 # ── messages.ts ──
 ('M1', 'messages.ts', "...(input.reason === null ? {} : { reason: input.reason }),", "", UNIT),
 ('M2', 'messages.ts', "    sessionState: input.sessionState,", "    sessionState: null,", UNIT),
 ('M3', 'messages.ts', "    serverTime: change.at,", "    serverTime: change.revision,", UNIT),
 ('M4', 'messages.ts', "return pickReplicatedState(state as unknown as ReplicatedState);", "return state as unknown as ReplicatedState;", UNIT),
 ('M5', 'messages.ts', "    serverTime: new Date(input.now).toISOString(),", "    serverTime: new Date(input.now + 1).toISOString(),", UNIT),
 # ── index.ts: the plugin (real sockets) ──
 ('I1', 'index.ts', "      perMessageDeflate: false,", "      perMessageDeflate: true,", db('upgrade.db.test.ts')),
 ('I2', 'index.ts', "      handleProtocols: () => false,\n", "", db('upgrade.db.test.ts')),
 ('I3', 'index.ts', "    handedOver.delete(request.raw);\n    held.socket.destroy();", "    handedOver.delete(request.raw);", db('upgrade.db.test.ts')),
 ('I4', 'index.ts', "    socket.on('error', drop);\n", "", db('upgrade.db.test.ts')),
 ('I5', 'index.ts', "    socket.once('end', drop);\n", "", db('upgrade.db.test.ts')),
 ('I6', 'index.ts', "    if (request.routeOptions.url === WS_PATH) return;\n    throw notFound();", "    if (request.routeOptions.url === WS_PATH) return;", db('upgrade.db.test.ts')),
 ('I7', 'index.ts', "      maxPayload: REALTIME_CLIENT_MESSAGE_MAX_BYTES,", "      maxPayload: REALTIME_CLIENT_MESSAGE_MAX_BYTES * 2,", db('upgrade.db.test.ts')),
 ('I8', 'index.ts', "      stopTimers();\n      hub.shutdown();\n      await drained();", "      stopTimers();\n      await drained();", ['--project', 'unit', R + '__tests__/plugin.test.ts']),
 ('I16', 'index.ts', "      stopTimers();\n      hub.shutdown();", "      hub.shutdown();", db('shutdown.db.test.ts')),
 ('I9', 'index.ts', "      timer.every(REALTIME_DELTA_PACE_MS, () => hub.pace()),\n", "", db('state.db.test.ts')),
 ('I10', 'index.ts', "      timer.every(HEARTBEAT_INTERVAL_MS, () => hub.beat()),\n", "", db('state.db.test.ts')),
 ('I11', 'index.ts', "      timer.every(REALTIME_PING_INTERVAL_MS, () => hub.ping()),\n", "", db('backpressure.db.test.ts')),
 ('I12', 'index.ts', "    socket.on('pong', () => handle.pong());\n", "", db('backpressure.db.test.ts')),
 ('I13', 'index.ts', "    presence: () => presenceOf(app),", "    presence: () => null,", db('control.db.test.ts')),
 ('I14', 'index.ts', "    send: (text) => socket.send(text, { binary: false, compress: false }),", "    send: (text) => socket.send(text, { binary: true, compress: false }),", db('state.db.test.ts')),
 ('I15', 'index.ts', "    socket.on('close', (code: number) => handle.closed(code));\n", "", db('upgrade.db.test.ts')),
]

only = set(sys.argv[1:])
results = []
start = time.time()
for (mid, file, frm, to, scope) in M:
    if only and mid not in only: continue
    if mid in set(os.environ.get('SKIP', '').split(',')): continue
    if os.environ.get('SCOPE') == 'unit' and scope[1] != 'unit': continue
    if os.environ.get('SCOPE') == 'db' and scope[1] != 'db': continue
    path = WS + '/' + R + file
    src = open(path).read()
    n = src.count(frm)
    if n != 1:
        results.append((mid, file, 'INVALID', f'text occurs {n} times'))
        print(f'{mid:5} INVALID: text occurs {n} times in {file}', flush=True)
        continue
    env = dict(os.environ, MUT_FILE=R + file, MUT_FROM_B64=base64.b64encode(frm.encode()).decode(), MUT_TO_B64=base64.b64encode(to.encode()).decode(), DEMS_TEST_STEP='64m')
    t0 = time.time()
    run = subprocess.run(['node', VITEST, 'run', '--config', CONFIG, '--maxWorkers=2', '--hookTimeout=20000', '--testTimeout=20000'] + scope, cwd=ROOT, env=env, capture_output=True, text=True)
    out = run.stdout + run.stderr
    if mid in set(os.environ.get('KEEP', '').split(',')): open(os.path.dirname(os.path.abspath(__file__)) + '/out_' + mid + '.log', 'w').write(out)
    failed = [l.strip() for l in out.splitlines() if l.strip().startswith('×') or ' × ' in l][:2]
    tests_line = next((l.strip() for l in out.splitlines() if l.strip().startswith('Tests ')), '')
    verdict = 'detected' if run.returncode != 0 else 'SURVIVED'
    if run.returncode != 0 and 'failed' not in tests_line and 'Hook timed out' not in out and 'Unhandled' not in out and 'Error' not in out:
        verdict = 'UNCLEAR'
    results.append((mid, file, verdict, tests_line))
    print(f'{mid:5} {verdict:9} {file:15} {time.time()-t0:5.1f}s  {tests_line}  {failed[0][:150] if failed else ""}', flush=True)

detected = sum(1 for r in results if r[2] == 'detected')
print(f'\n{detected} of {len(results)} mutations detected in {time.time()-start:.0f} s; not detected: {[r[0] for r in results if r[2] != "detected"]}')
