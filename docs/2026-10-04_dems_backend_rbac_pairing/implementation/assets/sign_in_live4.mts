// W60 device check (D138 evidence, v3): sign in on the PAIRED phone in LIVE mode, robust against the
// emulator's one-time handwriting coach that steals the first field's focus. Dismisses the coach with
// BACK, then types into the app's own fields and submits with the keypad's go key.
//   node --import tsx .cache/w60/sign_in_live4.mts <serial> <port> <out> <serverLog> <T0> "<u x y>" "<p x y>" "<s x y>"
// Rules (P19): the demo password is read from the shared dataset constant and never printed; it is
// only ever an argument of one `adb shell input text`. Nothing typed unless the app is focused and no
// keyguard shows.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { DEMO_OPERATOR_PASSWORD, OPERATORS } from '../../packages/shared/src/sim/dataset';

const [serial, hostPort, out, serverLog, t0, userAt, passAt, submitAt] = process.argv.slice(2);
if (!serial || !hostPort || !out || !serverLog || !t0 || !userAt || !passAt || !submitAt) { console.error('usage: sign_in_live4.mts ...'); process.exit(64); }
const APP = 'com.dems.demo.tablet';
const BIG = { encoding: 'utf8' as const, maxBuffer: 256 * 1024 * 1024 };
const adb = (...a: string[]): string => execFileSync('adb', ['-s', serial, ...a], BIG);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const jsLog = (): string => adb('logcat', '-d', '-T', t0, '-s', 'ReactNativeJS:V');
const xy = (at: string): [string, string] => at.trim().split(/\s+/) as [string, string];
const tap = (at: string): void => { const [x, y] = xy(at); adb('shell', 'input', 'tap', x, y); };
function focused(): boolean {
  const w = adb('shell', 'dumpsys', 'window');
  return /isKeyguardShowing=false/.test(w) && /mCurrentFocus=.*com\.dems\.demo\.tablet/.test(w);
}

async function main(): Promise<number> {
  const operator = OPERATORS.find((e) => e.role === 'SUPERVISOR');
  if (!operator) throw new Error('no SUPERVISOR');
  if (!focused()) { console.log('-- app not focused / keyguard: nothing typed'); return 77; }

  // Dismiss the one-time handwriting coach by tapping its Cancel button (a no-op on empty space if
  // no coach is up). Never KEYCODE_BACK: that leaves the app.
  tap(userAt); await sleep(1200);
  adb('shell', 'input', 'tap', '540', '2338'); // the coach's Cancel button (phone portrait)
  await sleep(800);
  tap(userAt); await sleep(600);
  if (!focused()) return 77;
  adb('shell', 'input', 'text', operator.username);
  console.log(`-- typed the operator username (${operator.username})`);
  await sleep(400);
  tap(passAt); await sleep(600);
  if (!focused()) return 77;
  adb('shell', 'input', 'text', DEMO_OPERATOR_PASSWORD); // never printed
  console.log("-- typed the demo password (not shown)");
  await sleep(400);

  const prefill = execFileSync('adb', ['-s', serial, 'exec-out', 'screencap', '-p'], { encoding: 'buffer', maxBuffer: BIG.maxBuffer });
  writeFileSync(`${out}/60_phone_prefill.png`, prefill);
  if (!focused()) return 77;
  adb('shell', 'input', 'keyevent', '66'); // go key submits
  console.log("-- pressed the keypad's go key (KEYCODE_ENTER)");
  let line: string | undefined;
  for (let waited = 0; waited < 40 && line === undefined; waited += 1) {
    await sleep(1000);
    line = jsLog().split('\n').find((e) => e.includes('DEMS-LIVE] POST /api/v1/auth/sign-in'));
    if (line === undefined && waited === 12) { tap(submitAt); console.log('-- no request yet; tapped Sign In'); }
  }
  const status = line === undefined ? null : (/sign-in (\S+) (\S+)/.exec(line) ?? null);
  console.log(`-- the app's sign-in request: ${status === null ? 'NOT SEEN in 40 s' : `status ${status[1]}, request ID ${status[2]}`}`);
  await sleep(6000);

  const logcat = jsLog();
  const server = existsSync(serverLog) ? readFileSync(serverLog, 'utf8') : '';
  const secret = /dvc_|ses_|bio_/;
  const lines = (t: string): number => t.split('\n').filter((e) => secret.test(e)).length;
  console.log(`-- credential/token lines: device JS log ${lines(logcat)}; backend log ${lines(server)}`);
  console.log(`-- session probe 200 after sign-in: ${logcat.split('\n').filter((l) => /auth\/session 200/.test(l)).length}`);
  if (status === null || status[1] !== '200') return 2;
  return lines(logcat) + lines(server) === 0 ? 0 : 1;
}
main().then((s) => process.exit(s), (e: unknown) => { console.error(`-- failed: ${e instanceof Error ? e.message : 'unknown'}`); process.exit(1); });
