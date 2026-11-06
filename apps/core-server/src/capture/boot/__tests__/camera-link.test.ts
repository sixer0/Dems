// The source of the camera link (audit 2026-11-05 blueprint row 101; DF-24; decision D23 (1)).
//
// THE DOUBLE. The reader is given a directory of fixed files that this test writes below the system's
// directory for scratch files, in the layout of the kernel's network class (`/sys/class/net/<interface>/`),
// with synthetic interface names. What this proves: which two files are read, how each answer is judged,
// that an absent interface, an unreadable file and a text of another form are told apart and never taken
// for a link that is down, and that no name of another form becomes a path. That the kernel of the
// installed host flips `carrier` on a replug is the live proof of row 47.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { CAMERA_LINK_ROOT, CAMERA_LINK_TEXT_LIMIT, CameraLinkState, cameraLinkReadingOf, createCameraLinkSource, type CameraLinkSource } from '../camera-link';
import { createCameraLinkSource as fromBoot } from '..';

const root = mkdtempSync(join(tmpdir(), 'dems-net-class-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));
const iface = (name: string, files: Record<string, string>): void => {
  mkdirSync(join(root, name), { recursive: true });
  for (const [file, text] of Object.entries(files)) writeFileSync(join(root, name, file), text);
};
iface('enp1s0', { carrier: '1\n', operstate: 'up\n' });
iface('enp2s0', { carrier: '0\n', operstate: 'down\n' });
iface('wg0', { operstate: 'unknown\n' }); // no carrier file, operstate says nothing plain
iface('tun0', { operstate: 'lowerlayerdown\n' });
iface('br0', { operstate: 'up\n' });
iface('odd0', { carrier: '2\n', operstate: 'sideways\n' });
iface('long0', { carrier: `${'1'.repeat(CAMERA_LINK_TEXT_LIMIT + 1)}`, operstate: 'up\n' });
// A carrier "file" that is a directory: opened, but the read fails with the system's code (EISDIR).
iface('dir0', { operstate: 'up\n' });
mkdirSync(join(root, 'dir0', 'carrier'));

const read = (name: string) => createCameraLinkSource(name, root).read();

describe('the source of the camera link over a fake network class', () => {
  it('a carrier of 1 is UP and of 0 is DOWN, with the operational word reported', async () => {
    expect(await read('enp1s0')).toEqual({ state: CameraLinkState.UP, operstate: 'up', reason: null });
    expect(await read('enp2s0')).toEqual({ state: CameraLinkState.DOWN, operstate: 'down', reason: null });
  });

  it('an interface the kernel does not have is ABSENT, not DOWN', async () => {
    expect(await read('eth9')).toEqual({ state: CameraLinkState.ABSENT, operstate: null, reason: null });
    expect(await createCameraLinkSource('enp1s0', join(root, 'nothing-here')).read()).toEqual({ state: CameraLinkState.ABSENT, operstate: null, reason: null });
  });

  it('without a carrier file the plain operational words decide; any other word is UNKNOWN', async () => {
    expect(await read('br0')).toEqual({ state: CameraLinkState.UP, operstate: 'up', reason: null });
    expect(await read('tun0')).toEqual({ state: CameraLinkState.DOWN, operstate: 'lowerlayerdown', reason: null });
    expect(await read('wg0')).toEqual({ state: CameraLinkState.UNKNOWN, operstate: 'unknown', reason: 'UNCLEAR' });
  });

  it('a text of another form, an over-long text and an unreadable file are UNKNOWN with a short reason, never DOWN', async () => {
    expect(await read('odd0')).toEqual({ state: CameraLinkState.UNKNOWN, operstate: null, reason: 'UNCLEAR' });
    expect(await read('long0')).toEqual({ state: CameraLinkState.UNKNOWN, operstate: 'up', reason: 'UNCLEAR' });
    const dir = await read('dir0');
    expect(dir.state).toBe(CameraLinkState.UNKNOWN);
    expect(dir.reason).toMatch(/^[A-Z0-9_]{1,32}$/);
  });

  it('reads again on every call: a replug between two readings is seen', async () => {
    iface('enp3s0', { carrier: '0\n', operstate: 'down\n' });
    const source = createCameraLinkSource('enp3s0', root);
    expect((await source.read()).state).toBe(CameraLinkState.DOWN);
    iface('enp3s0', { carrier: '1\n', operstate: 'up\n' });
    expect((await source.read()).state).toBe(CameraLinkState.UP);
    expect(source.interfaceName).toBe('enp3s0');
  });

  it('refuses a name of any other form before a path is made', () => {
    for (const name of ['', '.', '..', '../etc', 'enp1s0/carrier', 'a'.repeat(16), '-x', 'eth 0']) {
      expect(() => createCameraLinkSource(name, root), JSON.stringify(name)).toThrow(RangeError);
    }
    expect(() => createCameraLinkSource('a'.repeat(15), root)).not.toThrow();
  });

  it('is the kernel network class by default and reaches callers through the boot barrel', () => {
    expect(CAMERA_LINK_ROOT).toBe('/sys/class/net');
    expect(fromBoot).toBe(createCameraLinkSource);
    // The seam is injectable: any object of the shape stands in for the kernel.
    const fake: CameraLinkSource = { interfaceName: 'cam0', read: async () => ({ state: CameraLinkState.DOWN, operstate: 'down', reason: null }) };
    expect(fake.interfaceName).toBe('cam0');
  });
});

describe('the judgement of the two file facts', () => {
  it('EINVAL on the carrier (administratively down) is DOWN', () => {
    expect(cameraLinkReadingOf({ missing: 'REFUSED_WHILE_DOWN' }, { text: 'down' })).toEqual({ state: CameraLinkState.DOWN, operstate: 'down', reason: null });
  });

  it('the carrier decides over the operational word', () => {
    expect(cameraLinkReadingOf({ text: '1' }, { text: 'dormant' }).state).toBe(CameraLinkState.UP);
    expect(cameraLinkReadingOf({ text: '0' }, { text: 'up' }).state).toBe(CameraLinkState.DOWN);
  });

  it('a carrier that cannot be read is UNKNOWN with its code, whatever the operational word says', () => {
    expect(cameraLinkReadingOf({ failed: 'EACCES' }, { text: 'up' })).toEqual({ state: CameraLinkState.UNKNOWN, operstate: 'up', reason: 'EACCES' });
    expect(cameraLinkReadingOf({ missing: 'ABSENT' }, { failed: 'EACCES' })).toEqual({ state: CameraLinkState.UNKNOWN, operstate: null, reason: 'EACCES' });
  });

  it('every reading is frozen', () => {
    expect(Object.isFrozen(cameraLinkReadingOf({ text: '1' }, { text: 'up' }))).toBe(true);
  });
});
