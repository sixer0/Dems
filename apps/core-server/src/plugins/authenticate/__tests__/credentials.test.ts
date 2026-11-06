// Which credential a request presents (plan row W24; spec §4.1, §5.2 ID-12; decision D69).
// Pure functions: no app, no database. The values are made-up examples of a FORM.
import { describe, expect, it } from 'vitest';
import { bearerValueOf, readCredential } from '../credentials';

const OWN = 'dems_session_4420';
const SESSION_TOKEN = `ses_${'A'.repeat(43)}`;
const DEVICE_CREDENTIAL = `dvc_${'B'.repeat(43)}`;
const BIOMETRIC_TOKEN = `bio_${'C'.repeat(43)}`;

describe('readCredential', () => {
  it('nothing presented', () => {
    expect(readCredential({}, undefined, OWN)).toEqual({ kind: 'NONE' });
  });

  it('this instance\'s cookie with a session token', () => {
    expect(readCredential({ [OWN]: SESSION_TOKEN }, undefined, OWN)).toEqual({ kind: 'COOKIE', token: SESSION_TOKEN });
  });

  it.each([
    ['empty', ''],
    ['too short', 'ses_short'],
    ['one character too long', `${SESSION_TOKEN}A`],
    ['a device credential', DEVICE_CREDENTIAL],
    ['a biometric token', BIOMETRIC_TOKEN],
    ['a character outside base64url', `ses_${'A'.repeat(42)}+`],
    ['a token inside a longer text', `x${SESSION_TOKEN}`],
  ])('this instance\'s cookie whose value has not the form of a session token (%s) is a cookie that resolves to nothing', (_name, value) => {
    expect(readCredential({ [OWN]: value }, undefined, OWN)).toEqual({ kind: 'COOKIE', token: null });
  });

  it('D69: another instance\'s cookie and a foreign cookie are not credentials', () => {
    const cookies = { dems_session_4421: SESSION_TOKEN, dems_session_442: SESSION_TOKEN, dems_session_44200: SESSION_TOKEN, theme: 'dark', session: SESSION_TOKEN };
    expect(readCredential(cookies, undefined, OWN)).toEqual({ kind: 'NONE' });
    // The lane instance reads its own name, and only that.
    expect(readCredential(cookies, undefined, 'dems_session_4421')).toEqual({ kind: 'COOKIE', token: SESSION_TOKEN });
  });

  it('D69: a bearer value beside other cookies is the bearer credential, not a conflict', () => {
    const cookies = { dems_session_4421: SESSION_TOKEN, theme: 'dark' };
    expect(readCredential(cookies, `Bearer ${SESSION_TOKEN}`, OWN)).toEqual({ kind: 'BEARER_SESSION', token: SESSION_TOKEN });
    expect(readCredential(cookies, `Bearer ${DEVICE_CREDENTIAL}`, OWN)).toEqual({ kind: 'BEARER_DEVICE', credential: DEVICE_CREDENTIAL });
  });

  it.each([
    ['a session token as bearer', `Bearer ${SESSION_TOKEN}`],
    ['a device credential as bearer', `Bearer ${DEVICE_CREDENTIAL}`],
    ['another scheme', 'Basic dXNlcjpwYXNz'],
    ['an empty header', ''],
    ['a value that is no token', 'Bearer nothing'],
  ])('ID-12: this instance\'s cookie together with an Authorization header (%s) is a conflict, by presence alone', (_name, authorization) => {
    expect(readCredential({ [OWN]: SESSION_TOKEN }, authorization, OWN)).toEqual({ kind: 'CONFLICT' });
    expect(readCredential({ [OWN]: '' }, authorization, OWN)).toEqual({ kind: 'CONFLICT' });
    expect(readCredential({ [OWN]: SESSION_TOKEN, dems_session_4421: SESSION_TOKEN }, authorization, OWN)).toEqual({ kind: 'CONFLICT' });
  });

  it('a bearer session token and a bearer device credential are told apart by their prefix', () => {
    expect(readCredential({}, `Bearer ${SESSION_TOKEN}`, OWN)).toEqual({ kind: 'BEARER_SESSION', token: SESSION_TOKEN });
    expect(readCredential({}, `Bearer ${DEVICE_CREDENTIAL}`, OWN)).toEqual({ kind: 'BEARER_DEVICE', credential: DEVICE_CREDENTIAL });
    expect(readCredential({}, `bearer ${SESSION_TOKEN}`, OWN)).toEqual({ kind: 'BEARER_SESSION', token: SESSION_TOKEN });
  });

  it.each([
    ['a biometric token: it never travels in a header', `Bearer ${BIOMETRIC_TOKEN}`],
    ['another scheme', `Basic ${SESSION_TOKEN}`],
    ['no scheme', SESSION_TOKEN],
    ['an empty header', ''],
    ['the scheme alone', 'Bearer'],
    ['the scheme and a space', 'Bearer '],
    ['two values', `Bearer ${SESSION_TOKEN} ${SESSION_TOKEN}`],
    ['a truncated token', `Bearer ${SESSION_TOKEN.slice(0, -1)}`],
    ['a token with a suffix', `Bearer ${SESSION_TOKEN}x`],
    ['an unknown prefix', `Bearer tok_${'A'.repeat(43)}`],
    ['a tab instead of a space', `Bearer\t${SESSION_TOKEN}`],
  ])('an Authorization header that carries no credential of this server (%s) resolves to nothing', (_name, authorization) => {
    expect(readCredential({}, authorization, OWN)).toEqual({ kind: 'BEARER_OTHER' });
  });

  it('a repeated Authorization header is not one bearer value', () => {
    expect(bearerValueOf([`Bearer ${SESSION_TOKEN}`, `Bearer ${DEVICE_CREDENTIAL}`])).toBeNull();
    expect(readCredential({}, [`Bearer ${SESSION_TOKEN}`], OWN)).toEqual({ kind: 'BEARER_OTHER' });
  });
});
