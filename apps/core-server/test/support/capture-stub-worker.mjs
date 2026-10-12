// A STAND-IN for the capture worker (blueprint row 57 / M3-W1): a real operating-system process
// that speaks `@dems/capture-protocol` over its standard streams and records NOTHING. It opens no
// port, reads no device and writes no file. The tests of `src/capture/ipc.ts` start it with
// `process.execPath` to prove what only a real process can prove: a killed worker is restarted, a
// frozen one is found by its heartbeat, the environment is not inherited, and the worker ends
// when its input ends. The real worker is `apps/capture-worker` (rows 111 and 58).
//
// THE AUDIO SOURCE, AS THE REAL WORKER SAYS IT (fix pass F-M5, review R74-17; protocol 4, `audio.c`):
//   START                  after its ACK: the record AUDIO_SOURCE_INTERVAL of the start (index 1, sample 0,
//                          reason SESSION_START) for the microphone that holds the plan's active role
//   SWITCH_AUDIO_SOURCE    to another role: the record AUDIO_SOURCE_INTERVAL (reason OPERATOR_SWITCH, the
//                          command's correlation ID) BEFORE the ACK; to the role that feeds the track
//                          already: the ACK alone, no record; a role no microphone of the plan holds:
//                          ACK ok=false NO_SUCH_MIC
//   STOP                   the record AUDIO_TIMELINE_END, then the ACK
// So an operation 81 through this stub runs the real path. `fromSample` is the wall time since the
// start in samples, on the 480-sample input grid: the stub has no audio, only the clock.
//
// Plain JavaScript with no import of the workspace: it is the protocol written by hand, as the C
// worker will write it.
//
// Arguments:
//   --heartbeat-ms=<n>   interval of HEARTBEAT (default 50)
//   --no-hello           never say HELLO
//   --garbage            write a line that is no frame, right after HELLO
//   --flood=<n>          after START is acknowledged, write n PROGRESS frames of n different steps at once
//   --durable            after START is acknowledged, write the record FIRST_DURABLE_FRAGMENT (row 58:
//                        the stub still writes no file; it only says what a recording worker says),
//                        with the sync level the real worker states (F_FULLFSYNC; fix pass F-M3, R63-09)
//   --size-bound         after START is acknowledged, the advisory warning FRAGMENT_SIZE_BOUND_REACHED of
//                        the first camera of the plan, once (ACTIVE, never CLEARED), as `ingest.c` writes it
//   --crash=<code>       after START is acknowledged, give up as the real worker does: ONE CRASH frame with
//                        that code, then exit 70
//   --lavf-mismatch      a worker on another libavformat than it was verified against: ONE frame INSTEAD of
//                        HELLO - CRASH LIBAVFORMAT_VERSION_MISMATCH, sessionId null - then exit 70
//   --ignore-eof         do NOT exit when the input ends, and survive a broken output pipe
//                        (a worker that breaks both rules: only a signal ends it)
import { createInterface } from 'node:readline';

const PROTOCOL_VERSION = 4;
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const found = args.find((arg) => arg.startsWith(`--${name}=`));
  return found === undefined ? fallback : found.slice(name.length + 3);
};
const heartbeatMs = Number(option('heartbeat-ms', '50'));

// A worker learns its session from START: HELLO, HEARTBEAT and ACK carry none.
const write = (message) => process.stdout.write(`${JSON.stringify({ v: PROTOCOL_VERSION, ...message })}\n`);

// Without this, the first heartbeat after the supervisor is gone fails on the broken pipe and ends the process.
if (args.includes('--ignore-eof')) process.stdout.on('error', () => {});

let counter = 0;
let served = 0;
let timer = null;

// The audio source of the one session this process serves.
const SAMPLE_RATE_HZ = 48_000;
const QUANTUM_SAMPLES = 480;
let recordSeq = 0;
let mics = [];
let activeRole = null;
let intervals = 0;
let startedAtMs = 0;
let lastFromSample = 0;
const record = (sessionId, body) => write({ type: 'RECORD', sessionId, seq: (recordSeq += 1), record: body });
const sampleNow = () => Math.max(lastFromSample, Math.floor(((Date.now() - startedAtMs) * SAMPLE_RATE_HZ) / 1000 / QUANTUM_SAMPLES) * QUANTUM_SAMPLES);

if (args.includes('--lavf-mismatch')) {
  write({ type: 'CRASH', sessionId: null, code: 'LIBAVFORMAT_VERSION_MISMATCH', signal: null, exitCode: 70 });
  process.stdout.write('', () => process.exit(70));
} else if (!args.includes('--no-hello')) {
  // The release word of the worker of this tree (`apps/capture-worker/src/worker.h`), as the fake worker of
  // `capture.ts` says it: the supervisor holds EVERY HELLO to the version rule of the boot check since fix
  // pass F-M3 (review R63-04) and ends a worker that says another. `tidy-fy.test.ts` holds the word equal.
  write({ type: 'HELLO', protocolVersion: PROTOCOL_VERSION, workerVersion: 'capture-worker/0.6.0' });
  if (args.includes('--garbage')) process.stdout.write('this line is no frame\n');
  timer = setInterval(() => write({ type: 'HEARTBEAT', counter: (counter += 1) }), heartbeatMs);
}

const lines = createInterface({ input: process.stdin });
lines.on('line', (line) => {
  let command;
  try {
    command = JSON.parse(line);
  } catch {
    return;
  }
  const ack = (ok, code) => write({ type: 'ACK', correlationId: command.correlationId, ok, ...(code === undefined ? {} : { code }) });
  if (command.type === 'START') {
    served += 1;
    // The environment of the server must not reach a worker: the test plants this variable in its
    // own environment and the stub refuses to start when it can see it.
    if (process.env.DEMS_ROW57_ENV_MARKER !== undefined) ack(false, 'ENV_LEAK');
    else if (served > 1) ack(false, 'SESSION_ALREADY_SERVED');
    else {
      ack(true);
      // T0: the interval of the start, before any camera record can exist.
      mics = Array.isArray(command.plan.mics) ? command.plan.mics : [];
      activeRole = command.plan.activeMic ?? 'PRIMARY';
      startedAtMs = Date.now();
      const first = mics.find((mic) => mic.role === activeRole);
      if (first !== undefined) {
        intervals = 1;
        record(command.sessionId, { kind: 'AUDIO_SOURCE_INTERVAL', deviceId: first.deviceId, role: first.role, index: 1, fromSample: 0, sampleRateHz: SAMPLE_RATE_HZ, capturedAtMs: startedAtMs, reason: 'SESSION_START', correlationId: null, appliedDelayUs: null });
      }
      if (args.includes('--durable')) {
        record(command.sessionId, { kind: 'FIRST_DURABLE_FRAGMENT', deviceId: command.plan.cameras[0].deviceId, bytes: 1, syncLevel: 'F_FULLFSYNC' });
      }
      if (args.includes('--size-bound')) {
        write({ type: 'WARNING', sessionId: command.sessionId, code: 'CAPTURE_FAULT', reason: 'FRAGMENT_SIZE_BOUND_REACHED', state: 'ACTIVE', subject: command.plan.cameras[0].deviceId });
      }
      const crash = option('crash', '');
      if (crash !== '') {
        write({ type: 'CRASH', sessionId: command.sessionId, code: crash, signal: null, exitCode: 70 });
        if (timer !== null) clearInterval(timer);
        process.stdout.write('', () => process.exit(70));
        return;
      }
      const flood = Number(option('flood', '0'));
      for (let step = 0; step < flood; step += 1) write({ type: 'PROGRESS', sessionId: command.sessionId, step: `S${step}`, progress: 0, etaMs: null });
    }
  } else if (command.type === 'SWITCH_AUDIO_SOURCE') {
    const to = mics.find((mic) => mic.role === command.to);
    if (to === undefined) ack(false, 'NO_SUCH_MIC');
    else if (command.to === activeRole) ack(true);
    else {
      // The record of the switch is written BEFORE its ACK, as the worker writes it.
      activeRole = command.to;
      intervals += 1;
      lastFromSample = sampleNow();
      record(command.sessionId, { kind: 'AUDIO_SOURCE_INTERVAL', deviceId: to.deviceId, role: to.role, index: intervals, fromSample: lastFromSample, sampleRateHz: SAMPLE_RATE_HZ, capturedAtMs: startedAtMs + Math.floor((lastFromSample * 1000) / SAMPLE_RATE_HZ), reason: 'OPERATOR_SWITCH', correlationId: command.correlationId, appliedDelayUs: 0 });
      ack(true);
    }
  } else if (command.type === 'STOP') {
    if (intervals > 0) record(command.sessionId, { kind: 'AUDIO_TIMELINE_END', samples: sampleNow(), sampleRateHz: SAMPLE_RATE_HZ, intervals });
    ack(true);
    if (timer !== null) clearInterval(timer);
    process.stdout.write('', () => process.exit(0));
  }
});
// The supervisor is gone (its end of the pipe closed): a worker never outlives it.
lines.on('close', () => {
  if (!args.includes('--ignore-eof')) process.exit(0);
});
