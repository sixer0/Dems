// Operations 104 and 105 on their seams (task 4 row 106b; decisions C74 D-1, U10; contract of row 102).
//
// Everything is a double of this file: the plain read, the session state, the lifecycle. No helper,
// no socket, no database, no address of any host. The lifecycle itself is proven in
// `capture/host-alias/__tests__`, and the two together on a booted production Core in
// `src/__tests__/capture-composition.db.test.ts` (block "row 106b").
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CAPTURE_COMMISSIONING_REFUSAL_SENTENCES, HostAliasStateSchema, type HostAlias } from '@dems/shared/api';
import { describe, expect, it } from 'vitest';
import { ApiFailure } from '../../../../plugins/error-envelope';
import { HostAliasLifecycleRefusal } from '../../../../capture/fence';
import { ALIAS_REFUSED_SESSION, ALIAS_REMOVAL_CAUSE_UNNAMED, readHostAlias, removeHostAlias, type HostAliasRemoval, type HostAliasRouteSeams } from '../index';

const HERE = dirname(fileURLToPath(import.meta.url));
const CALLER = { operatorId: 'OP-0003', deviceId: null };
const IN_PLACE: HostAlias = { aliasId: '00000000-0000-4000-8000-0000000000a1', address: '192.168.1.253', reason: 'FACTORY_SCAN', addedAt: 1_760_000_000_000, expiresAt: 1_760_001_800_000, removeError: null };
/** A text no refusal may carry. */
const CANARY = 'eth9 /run/secret hunter2';

function rig(options: { session?: boolean; available?: boolean; provided?: boolean; job?: boolean; removal?: HostAliasRemoval; state?: HostAlias | null } = {}) {
  const releases: unknown[] = [];
  const seams: HostAliasRouteSeams = {
    sessionOpen: () => options.session ?? false,
    state: async () => options.state ?? null,
    available: () => options.available ?? true,
    remover: () =>
      options.provided === false
        ? null
        : {
            release: async (request) => {
              releases.push(request);
              return options.removal ?? { ok: true, removed: true };
            },
            shutdown: async () => undefined,
          },
    jobRunning: () => options.job ?? false,
  };
  return { seams, releases };
}

async function refusalOf(work: Promise<unknown>): Promise<[number, string, unknown, unknown, string]> {
  try {
    await work;
  } catch (error) {
    if (!(error instanceof ApiFailure)) throw error;
    return [error.statusCode, error.code, error.details?.['reason'] ?? null, error.details?.['cause'] ?? null, error.message];
  }
  throw new Error('expected a refusal');
}

describe('operation 104: the alias state is a plain read', () => {
  it('answers what the journal\'s open row says, or none - on every Core, with a session open, with no lifecycle handed in', async () => {
    for (const options of [{}, { session: true }, { available: false }, { provided: false }, { job: true }]) {
      expect(await readHostAlias(rig({ ...options, state: IN_PLACE }).seams)).toEqual({ alias: IN_PLACE });
      expect(await readHostAlias(rig(options).seams)).toEqual({ alias: null });
    }
    expect(HostAliasStateSchema.safeParse(await readHostAlias(rig({ state: IN_PLACE }).seams)).success).toBe(true);
    // No helper and no lifecycle is asked by a read.
    const scene = rig({ state: IN_PLACE });
    await readHostAlias(scene.seams);
    expect(scene.releases).toEqual([]);
  });
});

describe('operation 105: the technician\'s removal', () => {
  it('removed: 200 `alias: null`; the lifecycle is asked ONCE, with MANUAL and the technician as the actor of `removeHostAlias`', async () => {
    const scene = rig();
    expect(await removeHostAlias(scene.seams, CALLER)).toEqual({ alias: null });
    expect(scene.releases).toEqual([{ removeReason: 'MANUAL', actor: { operatorId: 'OP-0003', deviceId: null, operationId: 'removeHostAlias', permission: 'CAPTURE_COMMISSION' } }]);
  });

  it('A SESSION IS OPEN (decision C74 D-1): 409 CAPTURE_CONFIG_LOCKED before anything - the lifecycle is not asked', async () => {
    const scene = rig({ session: true });
    expect((await refusalOf(removeHostAlias(scene.seams, CALLER))).slice(0, 3)).toEqual([409, 'CAPTURE_CONFIG_LOCKED', null]);
    expect(scene.releases).toEqual([]);
    // A session that opened after the look: the lifecycle (or the unit of its intent) saw it. The same answer.
    expect(ALIAS_REFUSED_SESSION).toBe(HostAliasLifecycleRefusal.SESSION_OPEN);
    const late = rig({ removal: { ok: false, refusal: HostAliasLifecycleRefusal.SESSION_OPEN, stillInPlace: true } });
    expect((await refusalOf(removeHostAlias(late.seams, CALLER))).slice(0, 3)).toEqual([409, 'CAPTURE_CONFIG_LOCKED', null]);
  });

  it.each([
    ['not a production Core', { available: false }],
    ['no lifecycle was handed in', { provided: false }],
  ])('%s: 409 COMMISSIONING_NOT_AVAILABLE, nothing asked', async (_name, options) => {
    const scene = rig(options);
    expect((await refusalOf(removeHostAlias(scene.seams, CALLER))).slice(0, 3)).toEqual([409, 'INVALID_STATE', 'COMMISSIONING_NOT_AVAILABLE']);
    expect(scene.releases).toEqual([]);
  });

  it('a scan runs: 409 COMMISSIONING_JOB_IN_PROGRESS, nothing asked', async () => {
    const scene = rig({ job: true });
    expect((await refusalOf(removeHostAlias(scene.seams, CALLER))).slice(0, 3)).toEqual([409, 'INVALID_STATE', 'COMMISSIONING_JOB_IN_PROGRESS']);
    expect(scene.releases).toEqual([]);
  });

  it.each([
    [{ ok: true, removed: false } as const, 'HOST_ALIAS_NOT_PRESENT', null],
    [{ ok: false, refusal: 'NOT_AVAILABLE_ON_THIS_PLATFORM', stillInPlace: true } as const, 'COMMISSIONING_NOT_AVAILABLE', null],
    [{ ok: false, refusal: 'HELPER_NOT_CONFIGURED', stillInPlace: true } as const, 'COMMISSIONING_HELPER_NOT_CONFIGURED', null],
    [{ ok: false, refusal: 'HELPER_NOT_INSTALLED', stillInPlace: true } as const, 'COMMISSIONING_HELPER_NOT_CONFIGURED', null],
    [{ ok: false, refusal: 'HELPER_SOCKET_UNSAFE', stillInPlace: true } as const, 'COMMISSIONING_HELPER_NOT_CONFIGURED', null],
    [{ ok: false, refusal: 'HELPER_TIMED_OUT', stillInPlace: true } as const, 'HOST_ALIAS_REMOVE_FAILED', 'HELPER_TIMED_OUT'],
    [{ ok: false, refusal: 'HELPER_DEL_FAILED', stillInPlace: true } as const, 'HOST_ALIAS_REMOVE_FAILED', 'HELPER_DEL_FAILED'],
    [{ ok: false, refusal: 'STATE_UNREADABLE', stillInPlace: true } as const, 'HOST_ALIAS_REMOVE_FAILED', 'STATE_UNREADABLE'],
    [{ ok: false, refusal: 'INTENT_NOT_RECORDED', stillInPlace: true } as const, 'HOST_ALIAS_REMOVE_FAILED', 'INTENT_NOT_RECORDED'],
    // A word that is no code never travels: the fallback does.
    [{ ok: false, refusal: CANARY, stillInPlace: true } as const, 'HOST_ALIAS_REMOVE_FAILED', ALIAS_REMOVAL_CAUSE_UNNAMED],
  ])('the lifecycle answered %j: 409 INVALID_STATE %s (cause %s), with the contract\'s sentence and nothing of the helper', async (removal, reason, cause) => {
    const refused = await refusalOf(removeHostAlias(rig({ removal }).seams, CALLER));
    expect(refused.slice(0, 4)).toEqual([409, 'INVALID_STATE', reason, cause]);
    expect(refused[4]).toBe(CAPTURE_COMMISSIONING_REFUSAL_SENTENCES[reason as keyof typeof CAPTURE_COMMISSIONING_REFUSAL_SENTENCES]);
    expect(JSON.stringify(refused)).not.toContain('hunter2');
  });
});

describe('static: the folder opens nothing itself', () => {
  const strip = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const sources = ['index.ts', 'routes.ts', 'service.ts'].map((name) => ({ name, text: strip(readFileSync(join(HERE, '..', name), 'utf8')) }));

  it('no socket, file system, process, timer or clock; the capture unit is reached through the fence\'s index; no address is written', () => {
    const forbidden = /node:|require\(|\b(?:spawn|exec|execFile|fork)\s*\(|\b(?:set|clear)(?:Timeout|Interval|Immediate)\b|\bDate\b|\bprocess\b|\bconsole\b|\b\d{1,3}(?:\.\d{1,3}){3}\b/;
    for (const file of sources) expect(forbidden.exec(file.text)?.[0], file.name).toBeUndefined();
    const imports = sources.flatMap((file) => [...file.text.matchAll(/from\s+'([^']+)'/g)].map((match) => match[1] ?? ''));
    expect(imports.filter((specifier) => specifier.includes('/capture/'))).toEqual(['../../../capture/fence']);
    // ONE call of the lifecycle's removal, with the literal reason; no body is read by either route.
    const all = sources.map((file) => file.text).join('\n');
    expect(all.match(/\.release\s*\(/g)).toHaveLength(1);
    expect(all).toMatch(/removeReason: 'MANUAL',/);
    expect(all).not.toMatch(/request\s*\.\s*body/);
  });

  // Review 120, F-11 and survivor C-1 (row H4). The service TYPES four words of the capture unit, and the table of
  // refusals above types them again: a rename in the unit left both agreeing with each other and with nothing else.
  // Here the words are read from the service's own text and each must be a VALUE of the unit's refusal set, read from
  // the unit's own file (a text read: the folder may not import the unit but through the fence, which does not carry
  // the set). SEEN RED on `HELPER_NOT_INSTALLED: 'HELPER_IS_NOT_INSTALLED'` in `capture/host-alias/caller.ts` (in memory).
  it('the four words of the capture unit that the service types are values of the unit\'s own refusal set (the fifth, the session word, is compared above)', () => {
    const service = strip(readFileSync(join(HERE, '..', 'service.ts'), 'utf8'));
    const platform = /const NOT_THIS_PLATFORM = '([A-Z_]+)';/.exec(service)?.[1];
    const installed = /const HELPER_NOT_AS_INSTALLED: readonly string\[\] = \[([^\]]+)\];/.exec(service)?.[1]?.split(',').map((word) => word.trim().replace(/^'|'$/g, '')) ?? [];
    const typed = [platform, ...installed];
    expect(typed).toEqual(['NOT_AVAILABLE_ON_THIS_PLATFORM', 'HELPER_NOT_CONFIGURED', 'HELPER_NOT_INSTALLED', 'HELPER_SOCKET_UNSAFE']);

    const unit = readFileSync(join(HERE, '..', '..', '..', '..', 'capture', 'host-alias', 'caller.ts'), 'utf8');
    const set = /export const HostAliasCoreRefusal = \{([\s\S]*?)\n\} as const;/.exec(unit)?.[1] ?? '';
    const values = [...set.matchAll(/^\s*[A-Z][A-Z0-9_]*: '([A-Z][A-Z0-9_]*)',$/gm)].map((match) => match[1]);
    expect(values.length).toBeGreaterThanOrEqual(20);
    for (const word of typed) expect(values, `${String(word)} is a refusal of the capture unit`).toContain(word);
    // The control: a word the unit does not have is not found by this read.
    expect(values).not.toContain('HELPER_IS_NOT_INSTALLED');
  });
});
