"""W30 mutation runs: each single change is applied to a COPY of live-socket-client.ts under
.cache/W30/mut (never to the tree), the two realtime-live test files run on the copy, and the
result is recorded. A mutation that leaves every test green is reported as SURVIVED."""
import pathlib, re, subprocess, sys

ROOT = pathlib.Path('/Users/gsp-budi/Documents/DEMS')
COPY = ROOT / '.cache/W30/mut/shared'
TARGET = COPY / 'src/realtime/live-socket-client.ts'
PRISTINE = (ROOT / 'packages/shared/src/realtime/live-socket-client.ts').read_text()

M = [
 ('M01 4401 is not an end (reconnects)',
  "    if (code === RealtimeCloseCode.SESSION_ENDED) kind = 'SESSION_ENDED';\n    else if (code === RealtimeCloseCode.DEVICE_REVOKED) kind = 'DEVICE_REVOKED';",
  "    if (code === RealtimeCloseCode.DEVICE_REVOKED) kind = 'DEVICE_REVOKED';"),
 ('M02 4403 is not an end (reconnects)',
  "    if (code === RealtimeCloseCode.SESSION_ENDED) kind = 'SESSION_ENDED';\n    else if (code === RealtimeCloseCode.DEVICE_REVOKED) kind = 'DEVICE_REVOKED';",
  "    if (code === RealtimeCloseCode.SESSION_ENDED) kind = 'SESSION_ENDED';"),
 ('M03 backoff does not grow', "const delay = reconnectDelayMs(attempt, random);", "const delay = reconnectDelayMs(0, random);"),
 ('M04 no jitter', "const delay = reconnectDelayMs(attempt, random);", "const delay = reconnectDelayMs(attempt, () => 0);"),
 ('M05 no spacing between resyncs',
  "const spaced = lastResyncAt === null || at - lastResyncAt >= REALTIME_RESYNC_MIN_INTERVAL_MS + LIVE_SOCKET_RESYNC_GUARD_MS;",
  "const spaced = true;"),
 ('M06 resync spacing 1.4 s',
  "at - lastResyncAt >= REALTIME_RESYNC_MIN_INTERVAL_MS + LIVE_SOCKET_RESYNC_GUARD_MS;",
  "at - lastResyncAt >= REALTIME_RESYNC_MIN_INTERVAL_MS - 600;"),
 ('M07 a gap is applied', "if (message.epoch === epoch && message.revision === revision + 1) {", "if (message.epoch === epoch && message.revision > revision) {"),
 ('M08 a delta is applied before the snapshot of its connection', "if (!hasSnapshot || epoch === null || revision === null) {", "if (epoch === null || revision === null) {"),
 ('M09 a newer epoch is ignored', "if (message.epoch < epoch || (message.epoch === epoch && message.revision <= revision)) {", "if (message.epoch !== epoch || message.revision <= revision) {"),
 ('M10 deltas are not dropped while a resync is pending',
  "    if (resync !== null) {\n      counters.deltasDropped += 1;\n      return;\n    }\n    if (message.epoch < epoch", "    if (message.epoch < epoch"),
 ('M11 stop() leaves the housekeeping interval', "      if (housekeepingTimer !== null) timers.clearInterval(housekeepingTimer.handle);\n", ""),
 ('M12 stop() leaves the reconnect timer', "      running = false;\n      clearReconnectTimer();", "      running = false;"),
 ('M13 the reported path is the raw path', "path: reportablePath(first.path)", "path: first.path.join('.')"),
 ('M14 a handler exception is not caught by emit',
  "    try {\n      call(options);\n    } catch (cause) {\n      report(LiveSocketErrorCode.HANDLER_FAILED, { handler: name, errorName: errorNameOf(cause), cause });\n    }",
  "    call(options);\n    void name;"),
 ('M15 the socket and timer callbacks are not guarded',
  "    try {\n      run();\n    } catch (caught) {\n      report(LiveSocketErrorCode.INTERNAL_ERROR, { errorName: errorNameOf(caught) });\n    }",
  "    run();"),
 ('M16 an older meter frame is handed on', "(latestMeters !== null && message.seq <= latestMeters.seq)", "false"),
 ('M17 meter frames are handed on when not wanted', "if (!metersWanted || ", "if ("),
 ('M18 a connection that is not OPERATOR sends',
  [("if (phase !== 'OPEN' || hello === null || hello.principal !== RealtimePrincipal.OPERATOR) return;", "if (phase !== 'OPEN' || hello === null) return;"),
   (" || !canSendRealtimeMessage(hello.principal, message.type)) return false;", ") return false;")], None),
 ('M19 a heartbeat does not end the backoff', "      ...(resynced ? { reconnectAttempt: 0 } : {}),\n", ""),
 ('M20 a close without its code after an announced end reconnects',
  "    else if (deviceRevoked !== null || refused === RealtimeHelloReason.DEVICE_REVOKED) kind = 'DEVICE_REVOKED';\n    else if (sessionEnded !== null || refused === RealtimeHelloReason.SESSION_INVALID) kind = 'SESSION_ENDED';\n", ""),
 ('M21 a web SESSION_INVALID hello makes every close an end', "const refused = sentHeaders ? helloReason : null;", "const refused = helloReason;"),
 ('M22 no sync deadline', "if (socket !== null && syncDeadline !== null && at >= syncDeadline) {", "if (socket === undefined) {"),
 ('M23 the headers are not handed to the factory', "next = socketFactory(url, requestHeaders);", "next = socketFactory(url, undefined);"),
 ('M24 no send budget', "return sentAt.length < LIVE_SOCKET_SEND_BUDGET;", "return true;"),
 ('M25 ONLINE before the snapshot', "        if (expectsState && !hasSnapshot) return LINK.CONNECTING;\n", ""),
 ('M26 no URL guard', "if (typeof url !== 'string' || !SOCKET_URL_PATTERN.test(url)) {", "if (typeof url !== 'string') {"),
 ('M27 the link never turns STALE', "if (phase === 'OPEN' && !stale && aliveAt !== null && at - aliveAt >= HEARTBEAT_STALE_AFTER_MS) {", "if (phase === 'NEVER') {"),
 ('M28 the heartbeat view never turns STALE', "if (heartbeat.state === HeartbeatState.LIVE && heartbeat.lastBeatAt !== null && at - heartbeat.lastBeatAt >= HEARTBEAT_STALE_AFTER_MS) {", "if (phase === 'NEVER') {"),
 ('M29 reconnect() keeps the old socket',
  "      if (current !== null) {\n        detach(current);\n        closeQuietly(current, 'client reconnect');\n      }\n", ""),
 ('M30 a second hello is accepted',
  "    if (hello !== null) {\n      invalid(LiveSocketErrorCode.UNEXPECTED_HELLO, { messageType: 'hello' });\n      return;\n    }\n", ""),
 ('M31 no principal check on received messages', "if (!canReceiveRealtimeMessage(hello.principal, message.type)) {", "if (hello === undefined) {"),
 ('M32 the client writes to the console', "    counters.invalid += 1;\n    report(code, detail);", "    counters.invalid += 1;\n    console.warn('dropped', code);\n    report(code, detail);"),
 ('M33 RESYNCED is never reported', "    emit('onResync', (handlers) => handlers.onResync?.({ phase: 'RESYNCED', cause }));\n", ""),
 ('M34 a delta the replica holds sends resync',
  "    if (message.epoch < epoch || (message.epoch === epoch && message.revision <= revision)) {\n      counters.deltasStale += 1;\n      return;\n    }\n", ""),
 ('M35 the ISO time of a heartbeat is not read', "    sampleServerTime(Date.parse(message.serverTime), at, 'heartbeat');\n", ""),
 ('M36 start() keeps the old attempt', "      heartbeat = { ...heartbeat, reconnectAttempt: 0 };\n", ""),
 ('M37 the 2 s rule is per connection', "    deltaBeforeSnapshotReported = false;\n    sentAt = [];", "    deltaBeforeSnapshotReported = false;\n    lastResyncAt = null;\n    sentAt = [];"),
 ('M38 stop() does not close the socket', "        closeQuietly(current, 'client stopped');\n", ""),
 ('M39 an end is followed by a reconnect timer', "    emit('onEnd', (handlers) => handlers.onEnd?.(ended));", "    emit('onEnd', (handlers) => handlers.onEnd?.(ended));\n    scheduleReconnect();"),
 ('M40 the frame text is put into the report', "      invalid(LiveSocketErrorCode.INVALID_JSON);", "      invalid(LiveSocketErrorCode.INVALID_JSON, { issue: data });"),
 ('M41 subscribe is sent before hello (at connect)', "    syncDeadline = now() + syncTimeoutMs;\n  }", "    syncDeadline = now() + syncTimeoutMs;\n    next.send(JSON.stringify({ type: 'subscribe', topic: 'meters' }));\n  }"),
 ('M42 a socket error does not reconnect', "    next.onerror = () => guarded(() => handleClose(next, null, true));", "    next.onerror = null;"),
 ('M43 the kept meter frame survives a lost link', "    metersSubscribed = false;\n    latestMeters = null;\n    sessionEnded = null;", "    metersSubscribed = false;\n    sessionEnded = null;"),
 ('M44 the deadline after hello is not armed for the snapshot', "    syncDeadline = expectsState ? at + syncTimeoutMs : null;", "    syncDeadline = null;"),
]

def run():
    out = subprocess.run(['npx', 'vitest', 'run', '--root', str(COPY), 'test/realtime-live-socket.test.ts', 'test/realtime-live-platform-neutral.test.ts', '--maxWorkers=2'],
                         cwd=ROOT, capture_output=True, text=True)
    text = re.sub(r'\x1b\[[0-9;]*m', '', out.stdout + out.stderr)
    tests = re.search(r'^\s*Tests\s+(.*)$', text, re.M)
    failed = re.findall(r'^\s*[×✗]\s+(.*?)(?:\s+\d+ms)?$', text, re.M)
    return out.returncode, (tests.group(1).strip() if tests else 'no summary'), failed

import shutil
shutil.rmtree(COPY / 'src')
shutil.copytree(ROOT / 'packages/shared/src', COPY / 'src')
for name in ('realtime-live-socket.test.ts', 'realtime-live-platform-neutral.test.ts'):
    shutil.copy(ROOT / 'packages/shared/test' / name, COPY / 'test' / name)
TARGET.write_text(PRISTINE)
code, summary, _ = run()
print(f'M00 no change | exit {code} | {summary}')
assert code == 0, 'the copy must be green before a mutation'
survived = []
for name, old, new in M:
    text = PRISTINE
    pairs = old if isinstance(old, list) else [(old, new)]
    for o, n in pairs:
        assert text.count(o) == 1, f'{name}: the text to change occurs {text.count(o)} times'
        text = text.replace(o, n)
    TARGET.write_text(text)
    code, summary, failed = run()
    verdict = 'KILLED' if code != 0 else 'SURVIVED'
    if code == 0: survived.append(name)
    first = failed[0] if failed else ''
    print(f'{name} | {verdict} | {summary} | first: {first}')
TARGET.write_text(PRISTINE)
print(f'mutations: {len(M)}, killed: {len(M) - len(survived)}, survived: {len(survived)} {survived}')
