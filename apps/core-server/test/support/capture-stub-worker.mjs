// A STAND-IN for the capture worker (blueprint row 57 / M3-W1): a real operating-system process
// that speaks `@dems/capture-protocol` over its standard streams and records NOTHING. It opens no
// port, reads no device and writes no file. The tests of `src/capture/ipc.ts` start it with
// `process.execPath` to prove what only a real process can prove: a killed worker is restarted, a
// frozen one is found by its heartbeat, the environment is not inherited, and the worker ends
// when its input ends. The real worker is `apps/capture-worker` (rows 111 and 58).
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
//                        the stub still writes no file; it only says what a recording worker says)
//   --ignore-eof         do NOT exit when the input ends, and survive a broken output pipe
//                        (a worker that breaks both rules: only a signal ends it)
import { createInterface } from 'node:readline';

const PROTOCOL_VERSION = 3;
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

if (!args.includes('--no-hello')) {
  write({ type: 'HELLO', protocolVersion: PROTOCOL_VERSION, workerVersion: 'stub-worker' });
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
      if (args.includes('--durable')) {
        write({ type: 'RECORD', sessionId: command.sessionId, seq: 1, record: { kind: 'FIRST_DURABLE_FRAGMENT', deviceId: command.plan.cameras[0].deviceId, bytes: 1 } });
      }
      const flood = Number(option('flood', '0'));
      for (let step = 0; step < flood; step += 1) write({ type: 'PROGRESS', sessionId: command.sessionId, step: `S${step}`, progress: 0, etaMs: null });
    }
  } else if (command.type === 'SWITCH_AUDIO_SOURCE') {
    ack(true);
  } else if (command.type === 'STOP') {
    ack(true);
    if (timer !== null) clearInterval(timer);
    process.stdout.write('', () => process.exit(0));
  }
});
// The supervisor is gone (its end of the pipe closed): a worker never outlives it.
lines.on('close', () => {
  if (!args.includes('--ignore-eof')) process.exit(0);
});
