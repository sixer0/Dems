// The writer of the shared-capture configuration (task 4 blueprint row 65, WP-08; decision text
// SR-1, entry 2: "for writing under the Core's run directory only").
//
// THE DOUBLE. The run directory is a directory this test makes below the system's temporary
// directory. What this proves: which one file is written, its mode and its directory's mode,
// that the replacement is whole, and what a foreign path, a link and an open directory give.
// That the target's file system and the service account behave the same is proven on hardware
// (record `implementation/065_alsa_config_generator.md`, check 9A/H-08).
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { alsaConfigPath, alsaConfigText, ensureAlsaConfig } from '../alsa-config';
import { ALSA_CONFIG_TEXT_MAX, ALSA_CONFIG_WRITE_FAILED, AlsaConfigWriteError, createAlsaConfigWriter } from '../alsa-config-writer';

const root = mkdtempSync(join(tmpdir(), 'dems-alsa-config-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));

let serial = 0;
const runDirectory = (): string => {
  serial += 1;
  const path = join(root, `run-${String(serial)}`);
  mkdirSync(path, { mode: 0o700 });
  return path;
};
const modeOf = (path: string): number => lstatSync(path).mode & 0o777;
const reasonOf = async (work: Promise<unknown>): Promise<string> => {
  try {
    await work;
  } catch (error) {
    if (error instanceof AlsaConfigWriteError) return `${error.code}:${error.reason}`;
    throw error;
  }
  return 'written';
};

const TEXT = alsaConfigText([{ cardIndex: 1, deviceIndex: 0, channelCount: 2, rateHz: 48_000, format: 'S24_3LE' }]);

describe('the one file, whole and for the owner only', () => {
  it('writes <run>/alsa/dems-alsa.conf with mode 0600 in a directory of mode 0700 and leaves no other name', async () => {
    const run = runDirectory();
    const target = alsaConfigPath(run);
    await createAlsaConfigWriter(run).replace(target, TEXT);
    expect(readFileSync(target, 'utf8')).toBe(TEXT);
    expect([modeOf(target), modeOf(join(run, 'alsa'))]).toEqual([0o600, 0o700]);
    expect(readdirSync(run)).toEqual(['alsa']);
    expect(readdirSync(join(run, 'alsa'))).toEqual(['dems-alsa.conf']);
  });

  it('replaces the file of an earlier listing as a whole, and the same text twice gives the same bytes', async () => {
    const run = runDirectory();
    const target = alsaConfigPath(run);
    const writer = createAlsaConfigWriter(run);
    await writer.replace(target, `${TEXT}# an earlier, longer text\n`.repeat(4));
    await writer.replace(target, TEXT);
    const first = readFileSync(target);
    await writer.replace(target, TEXT);
    expect(readFileSync(target).equals(first)).toBe(true);
    expect(first.toString('utf8')).toBe(TEXT);
    expect(readdirSync(join(run, 'alsa'))).toEqual(['dems-alsa.conf']);
  });

  it('through the generator: the bytes on the disk are the generated text', async () => {
    const run = runDirectory();
    const result = await ensureAlsaConfig(createAlsaConfigWriter(run), run, [{ cardIndex: 2, deviceIndex: 0, channelCount: 8, rateHz: 48_000, format: 'S32_LE' }]);
    expect(result.path).toBe(join(run, 'alsa', 'dems-alsa.conf'));
    expect(readFileSync(result.path, 'utf8')).toBe(result.text);
  });

  it('a leftover temporary file is replaced; a link at the temporary name is removed and never followed', async () => {
    const run = runDirectory();
    const target = alsaConfigPath(run);
    mkdirSync(join(run, 'alsa'), { mode: 0o700 });
    writeFileSync(join(run, 'alsa', 'dems-alsa.tmp'), 'half a text');
    await createAlsaConfigWriter(run).replace(target, TEXT);
    expect(readFileSync(target, 'utf8')).toBe(TEXT);

    const elsewhere = join(run, 'elsewhere.txt');
    writeFileSync(elsewhere, 'untouched');
    symlinkSync(elsewhere, join(run, 'alsa', 'dems-alsa.tmp'));
    await createAlsaConfigWriter(run).replace(target, TEXT);
    expect(readFileSync(elsewhere, 'utf8')).toBe('untouched');
    expect(lstatSync(target).isFile()).toBe(true);
    expect(readdirSync(join(run, 'alsa'))).toEqual(['dems-alsa.conf']);
  });
});

describe('refusals: nothing is written anywhere else', () => {
  it('a path that is not the one file of this run directory', async () => {
    const run = runDirectory();
    const other = runDirectory();
    const writer = createAlsaConfigWriter(run);
    for (const path of [alsaConfigPath(other), join(run, 'alsa', 'other.conf'), join(run, 'dems-alsa.conf'), '/etc/asound.conf', `${alsaConfigPath(run)}/`, 'alsa/dems-alsa.conf']) {
      expect(await reasonOf(writer.replace(path, TEXT)), path).toBe(`${ALSA_CONFIG_WRITE_FAILED}:PATH`);
    }
    expect([readdirSync(run), readdirSync(other)]).toEqual([[], []]);
  });

  it('an empty text and a text beyond the bound', async () => {
    const run = runDirectory();
    const writer = createAlsaConfigWriter(run);
    expect(await reasonOf(writer.replace(alsaConfigPath(run), ''))).toBe(`${ALSA_CONFIG_WRITE_FAILED}:TEXT`);
    expect(await reasonOf(writer.replace(alsaConfigPath(run), 'x'.repeat(ALSA_CONFIG_TEXT_MAX + 1)))).toBe(`${ALSA_CONFIG_WRITE_FAILED}:TEXT`);
    expect(readdirSync(run)).toEqual([]);
  });

  it('a directory open to group or others', async () => {
    const run = runDirectory();
    mkdirSync(join(run, 'alsa'));
    chmodSync(join(run, 'alsa'), 0o750);
    expect(await reasonOf(createAlsaConfigWriter(run).replace(alsaConfigPath(run), TEXT))).toBe(`${ALSA_CONFIG_WRITE_FAILED}:DIRECTORY`);
    expect(readdirSync(join(run, 'alsa'))).toEqual([]);
  });

  it('a directory that is a link: nothing is written or removed where it points', async () => {
    const run = runDirectory();
    const outside = runDirectory();
    writeFileSync(join(outside, 'dems-alsa.tmp'), 'not ours');
    symlinkSync(outside, join(run, 'alsa'));
    expect(await reasonOf(createAlsaConfigWriter(run).replace(alsaConfigPath(run), TEXT))).toBe(`${ALSA_CONFIG_WRITE_FAILED}:DIRECTORY`);
    expect(readdirSync(outside)).toEqual(['dems-alsa.tmp']);
    expect(readFileSync(join(outside, 'dems-alsa.tmp'), 'utf8')).toBe('not ours');
  });

  it('a directory of another account', async () => {
    const run = runDirectory();
    const notThisAccount = (process.getuid?.() ?? 0) + 1;
    expect(await reasonOf(createAlsaConfigWriter(run, notThisAccount).replace(alsaConfigPath(run), TEXT))).toBe(`${ALSA_CONFIG_WRITE_FAILED}:DIRECTORY`);
    expect(existsSync(alsaConfigPath(run))).toBe(false);
  });

  it('a file where the directory should be: the system\'s short code, and no path in the error', async () => {
    const run = runDirectory();
    writeFileSync(join(run, 'alsa'), 'a file');
    const writer = createAlsaConfigWriter(run);
    const error = await writer.replace(alsaConfigPath(run), TEXT).then(
      () => null,
      (raised: unknown) => raised,
    );
    expect(error).toBeInstanceOf(AlsaConfigWriteError);
    expect((error as AlsaConfigWriteError).reason).toMatch(/^E[A-Z]+$/);
    expect((error as AlsaConfigWriteError).message).toBe('the shared-capture configuration could not be written');
    expect(JSON.stringify({ ...(error as AlsaConfigWriteError) })).not.toContain(run);
  });

  it('a run directory that is not of its shape makes no writer', () => {
    expect(() => createAlsaConfigWriter('run/capture')).toThrow('a value of the shared-capture configuration is not of its shape');
  });
});
