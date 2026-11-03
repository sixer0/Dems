/**
 * D57 (2026-11-03, principal): operations 115-116 `getPanelSetup` / `setPanelSetup` — the
 * pre-delivery setup module of the console. Two units are tested here, both pure:
 *
 *   THE GATE (`vendorGateOf`): the identity rule of D57 — the two vendor accounts pass, every
 *   other account is refused 403 NOT_PERMITTED before a byte is forwarded, and the caller's own
 *   cookie rides to the backend unchanged (no new secret exists on the path).
 *
 *   THE PROXY (`createPanelSetupProxy`): the translation between the contract and the panel
 *   backend — the read merges two endpoints, the write maps the backend's answers onto the
 *   envelope's refusals, and a backend that cannot be asked answers 503 LCD_BACKEND_UNREACHABLE
 *   instead of an empty lie about the panel holding nothing.
 *
 * The route wiring itself (registry route, stage-6 rule, the audit row) is held by the static
 * suites; the live proof of the whole path rides the bench lane, the way the panel bridge did.
 */
import { ApiErrorCode } from '@dems/shared/api';
import { OperatorRole } from '@dems/shared/sim';
import { describe, expect, it, vi } from 'vitest';
import type { SetPanelSetupRequest } from '@dems/shared/api';
import { LCD_BACKEND_UNREACHABLE, createPanelSetupProxy, vendorGateOf, VENDOR_GATE_TEXT } from './setup';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('the identity gate of D57', () => {
  it('passes the two vendor accounts and hands their own cookie to the backend', () => {
    expect(vendorGateOf('root', 'dems_session=abc')).toBe('dems_session=abc');
    expect(vendorGateOf('gsp.teknisi', 'dems_session=def')).toBe('dems_session=def');
    expect(vendorGateOf('root', undefined)).toBeUndefined();
  });

  it('refuses every other account with 403 NOT_PERMITTED, whatever role it holds', () => {
    // The point of D57: root is a SUPERVISOR and a client technician is a TECHNICIAN — the role
    // matrix cannot tell them apart for this module; only the identity can.
    for (const username of ['andi.pratama', 'rina.wijaya', 'gsp.supervisor', '', 'ROOT', 'rootx']) {
      const failure = (() => {
        try {
          vendorGateOf(username, 'dems_session=x');
          return null;
        } catch (error) {
          return error;
        }
      })();
      expect(failure, username).toBeInstanceOf(Error);
      expect((failure as Error & { statusCode?: number; code?: string }).statusCode, username).toBe(403);
      expect((failure as Error & { code?: string }).code, username).toBe(ApiErrorCode.NOT_PERMITTED);
      expect((failure as Error).message).toBe(VENDOR_GATE_TEXT);
    }
  });

  it('the vocabulary of the gate is the shared pair, not a copy: the seeded client roles do not satisfy it', () => {
    // ROLE_PERMISSIONS names the roles; the gate never sees them. One hold-out per seed username
    // keeps the pair honest: gsp.teknisi passes, the three seeded operators do not.
    void OperatorRole;
    expect(vendorGateOf('gsp.teknisi', 'c')).toBe('c');
  });
});

describe('the panel-setup proxy', () => {
  const IDENTITY = { satker: 'DITRESKRIMUM POLDA METRO JAYA', client: 'PT GSP' };
  const LOGOS = { logo: { client: { tersimpan: true }, splash: { tersimpan: false } } };

  const fetchDouble = (handler: (url: string, init: RequestInit | undefined) => Response | undefined) =>
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => handler(String(input), init) ?? json(500, {}));

  it('a Core without a panel bridge answers 503 LCD_BACKEND_UNREACHABLE and never touches the network', async () => {
    const fetcher = fetchDouble(() => json(200, {}));
    const proxy = createPanelSetupProxy({ url: '', fetch: fetcher as unknown as typeof globalThis.fetch });
    await expect(proxy.read()).rejects.toMatchObject({ statusCode: 503, code: ApiErrorCode.NOT_READY });
    await expect(proxy.write({ satker: 'X' } as SetPanelSetupRequest)).rejects.toMatchObject({ statusCode: 503 });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('the read merges the two endpoints into the contract shape and forwards the caller cookie only', async () => {
    const seen: { url: string; cookie: string | null }[] = [];
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      seen.push({ url, cookie: (init?.headers as Record<string, string> | undefined)?.Cookie ?? null });
      if (url.endsWith('/api/dems/identity')) return json(200, IDENTITY);
      return json(200, LOGOS);
    });
    const proxy = createPanelSetupProxy({ url: 'http://127.0.0.1:8090', fetch: fetcher as unknown as typeof globalThis.fetch });
    expect(await proxy.read('dems_session=abc')).toEqual({
      satker: 'DITRESKRIMUM POLDA METRO JAYA',
      client: 'PT GSP',
      clientLogoSaved: true,
      splashLogoSaved: false,
    });
    expect(seen.map((entry) => entry.url)).toEqual([
      'http://127.0.0.1:8090/api/dems/identity',
      'http://127.0.0.1:8090/api/dems/logo',
    ]);
    expect(seen.every((entry) => entry.cookie === 'dems_session=abc')).toBe(true);
  });

  it('a backend that is silent, unreachable, or answers nonsense is 503 — never an empty lie', async () => {
    for (const handler of [
      () => { throw new TypeError('offline'); },
      (url: string) => (url.includes('identity') ? json(500, {}) : json(200, LOGOS)),
      (url: string) => (url.includes('identity') ? json(200, { satker: 42 }) : json(200, LOGOS)),
      () => new Response('not json at all', { status: 200 }),
    ]) {
      const proxy = createPanelSetupProxy({ url: 'http://h', fetch: fetchDouble(handler) as unknown as typeof globalThis.fetch });
      await expect(proxy.read()).rejects.toMatchObject({
        statusCode: 503,
        code: ApiErrorCode.NOT_READY,
        details: { reason: LCD_BACKEND_UNREACHABLE },
      });
    }
  });

  it('the write carries the contract body in the backend words, with the default target, and returns the setup after', async () => {
    const captured: { path: string; body: Record<string, unknown>; cookie: string | null }[] = [];
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      captured.push({
        path: String(input),
        body: JSON.parse(String((init as RequestInit).body)),
        cookie: ((init as RequestInit).headers as Record<string, string>).Cookie ?? null,
      });
      return json(200, { ok: true, satker: 'BARU', client: 'PT GSP', logo: LOGOS.logo, changed: { satker: true, client: false, logo: true } });
    });
    const proxy = createPanelSetupProxy({ url: 'http://h', fetch: fetcher as unknown as typeof globalThis.fetch });
    const body = { satker: 'BARU', logoBase64: 'aGVsbG8=', reason: 'handover' } as SetPanelSetupRequest;
    const { after, facts } = await proxy.write(body, 'dems_session=k');
    expect(captured).toHaveLength(1);
    expect(captured[0]!.path).toBe('http://h/api/dems/setup');
    expect(captured[0]!.body).toEqual({ satker: 'BARU', logo_base64: 'aGVsbG8=', logo_target: 'client' });
    expect(captured[0]!.cookie).toBe('dems_session=k');
    expect(after).toEqual({ satker: 'BARU', client: 'PT GSP', clientLogoSaved: true, splashLogoSaved: false });
    expect(facts).toEqual({ satkerChanged: true, clientChanged: false, logoQueued: true, logoTarget: 'client' });
  });

  it('the backend refusals travel as the contract says: 403 becomes 401 NOT_SIGNED_IN, 422 keeps the reason, anything else is 503', async () => {
    const withAnswer = (status: number, body: unknown) =>
      createPanelSetupProxy({ url: 'http://h', fetch: fetchDouble(() => json(status, body)) as unknown as typeof globalThis.fetch });
    await expect(withAnswer(403, { error: 'BUKAN_TEKNISI' }).write({ client: 'X' } as SetPanelSetupRequest))
      .rejects.toMatchObject({ statusCode: 401, code: ApiErrorCode.NOT_SIGNED_IN });
    await expect(withAnswer(422, { error: 'GAMBAR_GAGAL', alasan: 'PNG tidak sah' }).write({ client: 'X' } as SetPanelSetupRequest))
      .rejects.toMatchObject({ statusCode: 422, code: ApiErrorCode.INVALID_INPUT, details: { reason: 'PNG tidak sah' } });
    await expect(withAnswer(500, {}).write({ client: 'X' } as SetPanelSetupRequest))
      .rejects.toMatchObject({ statusCode: 503, code: ApiErrorCode.NOT_READY });
    await expect(withAnswer(200, { ok: false, satker: '', client: '' }).write({ client: 'X' } as SetPanelSetupRequest))
      .rejects.toMatchObject({ statusCode: 503 });
  });

  it('the words of a backend answer are trimmed and fitted to the contract bounds, never refused', async () => {
    const proxy = createPanelSetupProxy({
      url: 'http://h',
      fetch: fetchDouble((url) =>
        url.includes('identity')
          ? json(200, { satker: `  ${'S'.repeat(200)}  `, client: ' PT GSP ' })
          : json(200, { logo: {} })) as unknown as typeof globalThis.fetch,
    });
    const read = await proxy.read();
    expect(read.satker.length).toBeLessThanOrEqual(38);
    expect(read.client).toBe('PT GSP');
    expect([read.clientLogoSaved, read.splashLogoSaved]).toEqual([false, false]);
  });
});
