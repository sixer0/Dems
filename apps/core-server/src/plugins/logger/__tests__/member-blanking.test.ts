// Integration pass D1a (decision D134): layer 5 of `logger-options.ts`. A credential that IS handed
// to the log is blanked by the member's name, through the shared rule set
// (`@dems/shared/redaction`), in the output of the real logger options.
import { Writable } from 'node:stream';
import { CREDENTIAL_BLANK } from '@dems/shared/redaction';
import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import { sealCredential } from '../../../capture/adapters';
import { REDACTED, REDACT_PATHS, buildLoggerOptions } from '../index';

// Synthetic, built from parts: no real credential.
const CANARY = ['cnry', 'D134', '5e1f', 'Qw7Zp0'].join('-');

function logger(): { log: ReturnType<typeof pino>; lines(): Record<string, unknown>[]; text(): string } {
  let text = '';
  const stream = new Writable({
    write(chunk: Buffer, _encoding, done) {
      text += chunk.toString('utf8');
      done();
    },
  });
  const log = pino(buildLoggerOptions({ level: 'trace', stream }) as Parameters<typeof pino>[0], stream);
  return { log, text: () => text, lines: () => text.split('\n').filter((line) => line !== '').map((line) => JSON.parse(line) as Record<string, unknown>) };
}

describe('layer 5: credential members are blanked by name in the written line', () => {
  it('password, secret, token, the naming form (password and username), nested and in a list: 0 canary in the output', () => {
    const { log, lines, text } = logger();
    log.info({ password: CANARY }, 'a');
    log.info({ secret: CANARY }, 'b');
    log.info({ token: CANARY }, 'c');
    log.info({ field: 'credential.password', value: CANARY }, 'd');
    log.info({ field: 'credential.username', value: CANARY }, 'e');
    log.warn({ deviceId: 'CAM-01', form: { errors: [{ field: 'label', value: 'Lobby' }, { field: 'credential.password', value: CANARY }] }, request: { apiKey: CANARY, credential: { username: CANARY, secret: CANARY } } }, 'f');
    log.info({ note: `{"field":"credential.password","value":"${CANARY}"}`, sent: `Bearer ses_${CANARY}` }, 'g');
    log.info({ credential: sealCredential({ username: CANARY, secret: CANARY }), at: new Date(0) }, 'h');
    expect(text()).not.toContain(CANARY);
    const written = lines();
    expect(written).toHaveLength(8);
    expect(written.slice(0, 5).map((line) => [line['password'], line['secret'], line['token'], line['value']].find((member) => member !== undefined))).toEqual(Array.from({ length: 5 }, () => CREDENTIAL_BLANK));
    // What is not a credential is written as it was: the line stays useful.
    expect(written[5]).toMatchObject({ msg: 'f', deviceId: 'CAM-01', form: { errors: [{ field: 'label', value: 'Lobby' }, { field: 'credential.password', value: CREDENTIAL_BLANK }] } });
    expect(written[7]).toMatchObject({ msg: 'h', at: '1970-01-01T00:00:00.000Z' });
  });

  it('negative control: the same canary under ordinary member names IS written; the three header paths answer as before', () => {
    const { log, lines, text } = logger();
    log.info({ outcome: CANARY, field: 'label', value: CANARY, username: CANARY, credentialSet: true }, 'ordinary');
    log.info({ headers: { authorization: `Basic ${CANARY}`, cookie: CANARY, 'x-request-id': 'r-1' } }, 'headers');
    const [ordinary, headers] = lines();
    expect(ordinary).toMatchObject({ outcome: CANARY, field: 'label', value: CANARY, username: CANARY, credentialSet: true });
    expect(headers?.['headers']).toEqual({ authorization: REDACTED, cookie: REDACTED, 'x-request-id': 'r-1' });
    expect(text().split(CANARY).length - 1).toBe(3);
    expect(REDACT_PATHS).toHaveLength(9);
  });
});
