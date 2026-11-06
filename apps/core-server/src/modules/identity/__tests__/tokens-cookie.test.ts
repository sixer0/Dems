// Session tokens and the session cookie (plan row W24; spec §5.1 ID-P6, ID-P7, §5.2 ID-9;
// SR-09, SR-18; AC-B-23 in unit form). No database. Every token here is a made-up example.
import { createHash } from 'node:crypto';
import { SESSION_TOKEN_PATTERN } from '@dems/shared/api';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../../app';
import { createFakePool, unitTestConfig } from '../../../../test/support/config';
import { SESSION_COOKIE_ATTRIBUTES, clearSessionCookie, setSessionCookie } from '../cookie';
import { SESSION_TOKEN_BYTES, isSessionToken, newSessionToken, sessionTokenHash } from '../tokens';

describe('session tokens (ID-P6, SR-09)', () => {
  it('are 32 random bytes as base64url behind the prefix ses_: 47 characters of the contract\'s form', () => {
    const token = newSessionToken();
    expect(token).toMatch(SESSION_TOKEN_PATTERN);
    expect(token).toHaveLength(47);
    expect(isSessionToken(token)).toBe(true);
    expect(SESSION_TOKEN_BYTES).toBe(32);
  });

  it('take exactly 32 bytes from the random source, and nothing else decides the value', () => {
    const asked: number[] = [];
    const bytes = Buffer.from(Array.from({ length: 32 }, (_, index) => index * 7 + 3));
    const token = newSessionToken((size) => {
      asked.push(size);
      return bytes;
    });
    expect(asked).toEqual([32]);
    expect(token).toBe(`ses_${bytes.toString('base64url')}`);
  });

  it('1,000 tokens are 1,000 different values', () => {
    expect(new Set(Array.from({ length: 1_000 }, () => newSessionToken())).size).toBe(1_000);
  });

  it('the stored form is the SHA-256 of the whole value, prefix included: 32 bytes', () => {
    const token = `ses_${'A'.repeat(43)}`;
    const hash = sessionTokenHash(token);
    expect(hash).toHaveLength(32);
    expect(hash.equals(createHash('sha256').update(token, 'utf8').digest())).toBe(true);
    expect(hash.equals(createHash('sha256').update('A'.repeat(43), 'utf8').digest())).toBe(false);
    expect(sessionTokenHash(`ses_${'B'.repeat(43)}`).equals(hash)).toBe(false);
  });

  // The names say what is wrong with each value; the values themselves stay out of the test names.
  it.each([
    ['empty', ''],
    ['the prefix alone', 'ses_'],
    ['one character too short', `ses_${'A'.repeat(42)}`],
    ['one character too long', `ses_${'A'.repeat(44)}`],
    ['the prefix of a device credential', `dvc_${'A'.repeat(43)}`],
    ['an upper-case prefix', `SES_${'A'.repeat(43)}`],
    ['a leading space', ` ses_${'A'.repeat(43)}`],
    ['a character outside base64url', `ses_${'A'.repeat(42)}=`],
  ])('a value of another form is not a session token: %s', (_name, value) => {
    expect(isSessionToken(value)).toBe(false);
  });
});

describe('the session cookie (ID-P7, SR-18)', () => {
  let app: FastifyInstance;
  let lane: FastifyInstance;
  const TOKEN = `ses_${'C'.repeat(43)}`;

  beforeAll(async () => {
    const build = async (port: 4420 | 4422): Promise<FastifyInstance> => {
      const instance = buildApp({ config: unitTestConfig({ port }), createPool: () => createFakePool().pool });
      instance.get('/api/v1/scratch/set', async (_request, reply) => {
        setSessionCookie(reply, instance.config.sessionCookieName, TOKEN);
        return {};
      });
      instance.get('/api/v1/scratch/clear', async (_request, reply) => {
        clearSessionCookie(reply, instance.config.sessionCookieName);
        return {};
      });
      await instance.ready();
      // By-design change (plan row W28): the scratch routes are no registry operations.
      instance.stages.replace('accessRule', () => {});
      instance.readiness.set('database', true);
      instance.readiness.set('engine', true);
      return instance;
    };
    app = await build(4420);
    lane = await build(4422);
  });

  afterAll(async () => {
    await app.close();
    await lane.close();
  });

  it('has exactly the attributes HttpOnly, SameSite=Strict and Path=/', () => {
    expect(SESSION_COOKIE_ATTRIBUTES).toEqual({ httpOnly: true, sameSite: 'strict', path: '/' });
    expect(Object.isFrozen(SESSION_COOKIE_ATTRIBUTES)).toBe(true);
  });

  it('is set as dems_session_<listen port>=<token> with those three attributes and nothing else', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/scratch/set' });
    expect(response.headers['set-cookie']).toBe(`dems_session_4420=${TOKEN}; Path=/; HttpOnly; SameSite=Strict`);
    const onLane = await lane.inject({ method: 'GET', url: '/api/v1/scratch/set' });
    expect(onLane.headers['set-cookie']).toBe(`dems_session_4422=${TOKEN}; Path=/; HttpOnly; SameSite=Strict`);
    for (const header of [response.headers['set-cookie'], onLane.headers['set-cookie']]) {
      expect(String(header)).not.toMatch(/secure|domain|max-age|expires|partitioned|priority|__host-|__secure-/i);
    }
  });

  it('is cleared with the same name and attributes and Max-Age=0', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/scratch/clear' });
    expect(response.headers['set-cookie']).toBe('dems_session_4420=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict');
  });
});
