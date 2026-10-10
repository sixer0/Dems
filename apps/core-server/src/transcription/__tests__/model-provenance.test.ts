// The provenance of a session's STT model: manifest fields 84 to 87 (integration pass D8).
//
// Every model file here is a few bytes written by the test: a ggml HEADER as whisper.cpp reads it
// and filler. No model exists, none is loaded, no server is asked.
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { ModelProvenanceCode, createModelProvenanceProvider, quantisationOfGgmlHeader, readTranscriberHost, TranscriberHostError } from '../index';
import { provenanceFitsBackend } from '../model-provenance';
import { CPU_MODEL, SERVER_MODEL, fullHost, ggmlBytes, makeDataDir } from './support';

const dirs: string[] = [];
afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

function modelFile(bytes: Buffer): string {
  const dir = mkdtempSync(join(tmpdir(), 'dems-d8-model-'));
  dirs.push(dir);
  const path = join(dir, `${CPU_MODEL}.bin`);
  writeFileSync(path, bytes);
  return path;
}

const sha256 = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');
const stated = (versions: Record<string, string>) => createModelProvenanceProvider({ statedVersions: () => versions });

describe('fields 84 to 87 of a cpu-local session: each member from its own source', () => {
  it('name = the adapter identifier, version = the host statement, quantisation = the file header, sha256 = the hash of the file', async () => {
    const bytes = ggmlBytes(8, 'weights-a');
    const path = modelFile(bytes);
    const answer = await stated({ [CPU_MODEL]: 'v3-turbo 2024-10' }).of({ backend: 'cpu-local', model: CPU_MODEL, modelPath: path });
    expect(answer).toEqual({ name: CPU_MODEL, version: 'v3-turbo 2024-10', quantisation: 'q5_0', sha256: sha256(bytes) });
  });

  it('CONTROL: other bytes give another hash and another header another quantisation - nothing is a constant', async () => {
    const provider = stated({ [CPU_MODEL]: '1' });
    const first = ggmlBytes(1, 'weights-a');
    const path = modelFile(first);
    expect(await provider.of({ backend: 'cpu-local', model: CPU_MODEL, modelPath: path })).toMatchObject({ quantisation: 'f16', sha256: sha256(first) });
    // The same path, replaced: the kept hash is not answered for a file that changed.
    const second = ggmlBytes(7, 'weights-b-longer');
    writeFileSync(path, second);
    utimesSync(path, new Date(2_000_000_000_000), new Date(2_000_000_000_000));
    expect(await provider.of({ backend: 'cpu-local', model: CPU_MODEL, modelPath: path })).toMatchObject({ quantisation: 'q8_0', sha256: sha256(second) });
  });

  it('the quantisation format version in the thousands of ftype is not part of the name', () => {
    expect(quantisationOfGgmlHeader(ggmlBytes(2008))).toEqual({ ok: true, quantisation: 'q5_0' });
  });
});

describe('a member without a source is NOT stated: the answer is a code and no value', () => {
  it('no version stated for the identifier (also for an identifier that names a member of every object)', async () => {
    const path = modelFile(ggmlBytes(1));
    expect(await stated({}).of({ backend: 'cpu-local', model: CPU_MODEL, modelPath: path })).toEqual({ unknown: ModelProvenanceCode.VERSION_NOT_STATED });
    expect(await stated({ other: '1' }).of({ backend: 'cpu-local', model: 'constructor', modelPath: path })).toEqual({ unknown: ModelProvenanceCode.VERSION_NOT_STATED });
  });

  it('a file that is not ggml, a file type without a name, a file that is not there', async () => {
    const provider = stated({ [CPU_MODEL]: '1' });
    expect(await provider.of({ backend: 'cpu-local', model: CPU_MODEL, modelPath: modelFile(Buffer.from('stand-in model bytes, long enough to hold a header of forty-eight bytes')) })).toEqual({ unknown: ModelProvenanceCode.FILE_NOT_GGML });
    expect(await provider.of({ backend: 'cpu-local', model: CPU_MODEL, modelPath: modelFile(Buffer.from('short')) })).toEqual({ unknown: ModelProvenanceCode.FILE_NOT_GGML });
    expect(await provider.of({ backend: 'cpu-local', model: CPU_MODEL, modelPath: modelFile(ggmlBytes(5)) })).toEqual({ unknown: ModelProvenanceCode.QUANTISATION_UNKNOWN });
    expect(await provider.of({ backend: 'cpu-local', model: CPU_MODEL, modelPath: join(tmpdir(), 'dems-d8-absent', 'none.bin') })).toEqual({ unknown: ModelProvenanceCode.FILE_UNREADABLE });
  });

  it('a SERVER backend (D160): the name the session names and three nulls, whatever the host states; a model path handed in by a careless caller is never opened, read or hashed', async () => {
    const server = { name: SERVER_MODEL, version: null, quantisation: null, sha256: null };
    expect(await stated({ [SERVER_MODEL]: '1' }).of({ backend: 'omlx-server', model: SERVER_MODEL, modelPath: null })).toEqual(server);
    // A real, readable ggml file beside a server backend: its header and its hash stay unread.
    const path = modelFile(ggmlBytes(8, 'a file of another program'));
    expect(await stated({ [SERVER_MODEL]: '1' }).of({ backend: 'omlx-server', model: SERVER_MODEL, modelPath: path })).toEqual(server);
    // CONTROL: the same path under cpu-local IS read - the nulls above come from the backend, not from the file.
    expect(await stated({ [SERVER_MODEL]: '1' }).of({ backend: 'cpu-local', model: SERVER_MODEL, modelPath: path })).toMatchObject({ version: '1', quantisation: 'q5_0', sha256: expect.stringMatching(/^[0-9a-f]{64}$/) });
    // A backend that is neither: nothing has a source.
    expect(await stated({}).of({ backend: 'another-engine', model: SERVER_MODEL, modelPath: path })).toEqual({ unknown: ModelProvenanceCode.NO_SOURCE_FOR_BACKEND });
  });

  it('the gate of the port: a hash, a version or a quantisation for a server is refused; a null for cpu-local is refused; a missing name is refused for both', () => {
    const full = { name: 'm', version: '1', quantisation: 'q5_0', sha256: 'a'.repeat(64) };
    const server = { name: 'm', version: null, quantisation: null, sha256: null };
    expect([provenanceFitsBackend('omlx-server', server), provenanceFitsBackend('cpu-local', full)]).toEqual([true, true]);
    expect(provenanceFitsBackend('omlx-server', full)).toBe(false);
    for (const member of ['version', 'quantisation', 'sha256'] as const) {
      expect(provenanceFitsBackend('omlx-server', { ...server, [member]: full[member] }), member).toBe(false);
      expect(provenanceFitsBackend('cpu-local', { ...full, [member]: null }), member).toBe(false);
    }
    expect(provenanceFitsBackend('cpu-local', server)).toBe(false);
  });
});

describe('the host file states the version of a model identifier', () => {
  it('cpuLocal.modelVersions is read; a host that states none has none; a version that is not printable text is refused by its member name', () => {
    const dir = makeDataDir('d8-host');
    dirs.push(dir.dataDir);
    dir.writeHost(fullHost(dir));
    expect(readTranscriberHost(dir.dataDir, () => 8).modelVersions).toEqual({});
    dir.writeHost({ version: 1, cpuLocal: { binaryPath: dir.binaryPath, modelDir: dir.modelDir, modelVersions: { [CPU_MODEL]: 'v3-turbo' } } });
    expect(readTranscriberHost(dir.dataDir, () => 8).modelVersions).toEqual({ [CPU_MODEL]: 'v3-turbo' });
    dir.writeHost({ version: 1, cpuLocal: { binaryPath: dir.binaryPath, modelDir: dir.modelDir, modelVersions: { [CPU_MODEL]: ' ' } } });
    let reason = '';
    try {
      readTranscriberHost(dir.dataDir, () => 8);
    } catch (error) {
      reason = error instanceof TranscriberHostError ? error.reason : 'OTHER';
    }
    expect(reason).toBe(`FORM:cpuLocal.modelVersions.${CPU_MODEL}`);
  });
});
