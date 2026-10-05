// W57 device check: issue ONE pairing code on the lane backend as the seeded SUPERVISOR, type it
// into the APP's code slots with `adb shell input text`, submit it with the keypad's own "go" key,
// wait for the redeem, and then count where that code can be found. One process from the issue to
// the count, so the code is handed to nothing. Run on the host, inside the device session, from
// the repository root:
//
//   node --import tsx .cache/w57/issue_and_type.mts <serial> <host port> <out folder> <server log> <device time T0>
//
// RULES OF THIS FILE (plan section 5.2; brief "SECRETS"):
// - The demo password is read from the shared dataset constant and is never printed.
// - The pairing code exists in this process's memory and in the argument of the one
//   `adb shell input text` call. It is never written to stdout, to a file, to the repository or to
//   a document. No session cookie is kept either: each use signs in and signs out.
// - What is printed: status codes, the code's ID (`codeId` is not the code), device IDs, counts.
// - The typing goes into the app only: it is refused unless the focused window is the app's and no
//   keyguard is showing. Nothing is ever typed into a lock screen.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { DEMO_OPERATOR_PASSWORD, OPERATORS } from '../../packages/shared/src/sim/dataset';

const [serial, hostPort, out, serverLog, t0] = process.argv.slice(2);
if (!serial || !hostPort || !out || !serverLog || !t0) {
  console.error('usage: issue_and_type.mts <serial> <host port> <out folder> <server log> <device time T0>');
  process.exit(64);
}
const APP = 'com.dems.demo.tablet';
const BASE = `http://127.0.0.1:${hostPort}`;
// The web console's origin of this lane (lane k: backend 4420 + k, console 5175 + k). Only the
// header is sent: nothing listens on, or is asked of, that port.
const ORIGIN = `http://127.0.0.1:${5175 + (Number(hostPort) - 4420)}`;
const BIG = { encoding: 'utf8' as const, maxBuffer: 256 * 1024 * 1024 };
const adb = (...args: string[]): string => execFileSync('adb', ['-s', serial, ...args], BIG);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const jsLog = (): string => adb('logcat', '-d', '-T', t0, '-s', 'ReactNativeJS:V');

/** Runs `use` inside one session of the seeded SUPERVISOR; the session is signed out afterwards. */
async function asSupervisor<T>(use: (headers: Record<string, string>) => Promise<T>): Promise<T> {
  const operator = OPERATORS.find((entry) => entry.role === 'SUPERVISOR');
  if (!operator) throw new Error('the dataset has no SUPERVISOR');
  const answer = await fetch(`${BASE}/api/v1/auth/sign-in`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ORIGIN },
    body: JSON.stringify({ username: operator.username, password: DEMO_OPERATOR_PASSWORD }),
  });
  console.log(`-- sign-in as the seeded SUPERVISOR (${operator.id}): ${answer.status}`);
  if (answer.status !== 200) throw new Error(`sign-in answered ${answer.status}`);
  const cookie = (answer.headers.getSetCookie()[0] ?? '').split(';')[0] ?? '';
  if (!cookie.includes('=')) throw new Error('the sign-in answer set no cookie');
  try {
    return await use({ origin: ORIGIN, cookie });
  } finally {
    const out = await fetch(`${BASE}/api/v1/auth/sign-out`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ORIGIN, cookie },
      body: JSON.stringify({ reason: 'USER' }),
    });
    console.log(`-- sign-out of the SUPERVISOR: ${out.status}`);
  }
}

function focusIsTheApp(when: string): boolean {
  const window = adb('shell', 'dumpsys', 'window');
  const keyguard = /isKeyguardShowing=(\w+)/.exec(window)?.[1];
  const focus = /mCurrentFocus=.*$/m.exec(window)?.[0] ?? '';
  console.log(`-- ${when}: isKeyguardShowing=${keyguard}; ${focus.trim().slice(0, 110)}`);
  return keyguard === 'false' && focus.includes(APP);
}

async function main(): Promise<number> {
  if (!focusIsTheApp('before the issue')) {
    console.log('-- the app is not the focused window, or a keyguard shows: no code is issued, NOTHING is typed');
    return 77;
  }
  const issued = await asSupervisor(async (headers) => {
    const issue = await fetch(`${BASE}/api/v1/pairing/code`, { method: 'POST', headers });
    console.log(`-- issuePairingCode: ${issue.status}`);
    if (issue.status !== 201) throw new Error(`issuePairingCode answered ${issue.status}`);
    return (await issue.json()) as { codeId: string; code: string; issuedAt: number; expiresAt: number; attemptsAllowed: number };
  });
  const code = issued.code;
  console.log(`-- issued: codeId ${issued.codeId}, valid ${(issued.expiresAt - issued.issuedAt) / 1000} s, ${issued.attemptsAllowed} failed redeems close it; the code has ${code.length} characters, all digits: ${/^\d+$/.test(code)} (not shown)`);
  const count = (text: string): number => text.split(code).length - 1;

  // Checked again right before the keystrokes: they go to the app, never to a lock screen.
  if (!focusIsTheApp('before typing')) {
    console.log('-- the focus changed: NOTHING is typed');
    return 77;
  }
  adb('shell', 'input', 'text', code);
  console.log('-- typed the code into the focused field of the app: adb shell input text <not shown>');
  await sleep(700);
  // The keypad's submit key pairs (`returnKeyType: go`, `onSubmitEditing`), as on a real tablet.
  adb('shell', 'input', 'keyevent', '66');
  console.log('-- pressed the keypad\'s submit key (KEYCODE_ENTER) in the app');

  // The connection steps take 1.8 s before the code leaves the tablet; then the Core answers.
  let line: string | undefined;
  for (let waited = 0; waited < 40 && line === undefined; waited += 1) {
    await sleep(1000);
    line = jsLog()
      .split('\n')
      .find((entry) => entry.includes('DEMS-LIVE] POST /api/v1/pairing/redeem'));
  }
  const redeem = line === undefined ? null : (/redeem (\S+) (\S+)/.exec(line) ?? null);
  console.log(`-- the app's redeem request, from the device log: ${redeem === null ? 'NOT SEEN in 40 s' : `status ${redeem[1]}, request ID ${redeem[2]}`}`);
  // The hand-off (2.4 s after the answer), the new socket, and the runtime log's write (at most 2 s after its last record).
  await sleep(6000);

  // ── Where the issued code can be found ──
  const logcat = jsLog();
  const whole = adb('logcat', '-d');
  const rows = adb('shell', `run-as ${APP} sh -c 'sqlite3 databases/RKStorage "select key || char(1) || value from catalystLocalStorage"'`);
  const keys = rows
    .split('\n')
    .map((row) => row.split('\u0001')[0] ?? '')
    .filter((key) => key.startsWith('dems.'));
  const server = existsSync(serverLog) ? readFileSync(serverLog, 'utf8') : '';
  const written = execFileSync('/bin/sh', ['-c', `cat "${out}"/*.txt "${out}"/*.log "${out}"/*.xml 2>/dev/null || true`], BIG);
  const counts = { 'device JS log': count(logcat), 'whole device log (every tag)': count(whole), 'AsyncStorage values': count(rows), 'backend log': count(server), "this check's output files": count(written) };
  console.log(`-- the issued code, counted (must be 0 everywhere): ${Object.entries(counts).map(([place, found]) => `${place} ${found}`).join('; ')}`);
  console.log(`   searched: ${logcat.split('\n').length} JS log lines, ${whole.split('\n').length} device log lines, AsyncStorage keys [${keys.join(', ')}], ${server.split('\n').length} backend log lines`);
  const secret = /dvc_|ses_|bio_/;
  const lines = (text: string): number => text.split('\n').filter((entry) => secret.test(entry)).length;
  console.log(`-- lines with a credential or a token (dvc_, ses_, bio_): device JS log ${lines(logcat)}; AsyncStorage values ${lines(rows)}; backend log ${lines(server)}`);

  // The registry as the SUPERVISOR sees it: device IDs and states only.
  await asSupervisor(async (headers) => {
    const list = await fetch(`${BASE}/api/v1/pairing/devices`, { headers });
    console.log(`-- listPairedDevices: ${list.status}`);
    if (list.status === 200) {
      const body = (await list.json()) as { devices: { deviceId: string; name: string; state: string; online: boolean; platform?: string; appVersion?: string }[] };
      for (const device of body.devices) {
        console.log(`   device ${device.deviceId}: state ${device.state}, online ${device.online}, name "${device.name}", platform ${device.platform ?? '-'}, app ${device.appVersion ?? '-'}`);
      }
      console.log(`   devices in the registry: ${body.devices.length}`);
    }
    const status = await fetch(`${BASE}/api/v1/pairing/code`, { headers });
    if (status.status === 200) console.log(`-- getPairingCodeStatus: ${((await status.json()) as { active: unknown }).active === null ? 'no code is active (the issued one was redeemed or closed)' : 'a code is still active'}`);
  });

  const found = Object.values(counts).reduce((sum, value) => sum + value, 0);
  if (redeem === null || redeem[1] !== '201') return 2;
  return found === 0 ? 0 : 1;
}

main().then(
  (status) => process.exit(status),
  (error: unknown) => {
    // An error of this file never carries the code or the password in its message.
    console.error(`-- failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    process.exit(1);
  },
);
