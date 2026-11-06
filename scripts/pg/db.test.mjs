// The SCRAM-SHA-256 verifier that RP-3 sends in CREATE ROLE, checked against the published
// example of RFC 7677, section 3 (user "user", password "pencil", salt W22ZaJ0SNY7soEsUEjb6gQ==,
// 4096 iterations). The RFC gives the server signature; it is HMAC(ServerKey, AuthMessage), so
// a correct ServerKey reproduces it, and the client proof checks the StoredKey the same way.

import assert from 'node:assert/strict';
import { createHash, createHmac, pbkdf2Sync } from 'node:crypto';
import { test } from 'node:test';

import { scramVerifier } from './db.mjs';

const SALT = Buffer.from('W22ZaJ0SNY7soEsUEjb6gQ==', 'base64');
const CLIENT_FIRST_BARE = 'n=user,r=rOprNGfwEbeRWgbNEkqO';
const SERVER_FIRST = 'r=rOprNGfwEbeRWgbNEkqO%hvYDpWUa2RaTCAfuxFIlj)hNlF$k0,s=W22ZaJ0SNY7soEsUEjb6gQ==,i=4096';
const CLIENT_FINAL_WITHOUT_PROOF = 'c=biws,r=rOprNGfwEbeRWgbNEkqO%hvYDpWUa2RaTCAfuxFIlj)hNlF$k0';
const AUTH_MESSAGE = `${CLIENT_FIRST_BARE},${SERVER_FIRST},${CLIENT_FINAL_WITHOUT_PROOF}`;

test('the verifier has the stored form of PostgreSQL and matches the RFC 7677 example', () => {
  const verifier = scramVerifier('pencil', SALT, 4096);
  const match = /^SCRAM-SHA-256\$4096:W22ZaJ0SNY7soEsUEjb6gQ==\$([A-Za-z0-9+/]{43}=):([A-Za-z0-9+/]{43}=)$/.exec(verifier);
  assert.ok(match, verifier);
  const storedKey = Buffer.from(match[1], 'base64');
  const serverKey = Buffer.from(match[2], 'base64');

  const serverSignature = createHmac('sha256', serverKey).update(AUTH_MESSAGE).digest('base64');
  assert.equal(serverSignature, '6rriTRBi23WpRR/wtup+mMhUZUn/dB5nLTJRsjl95G4=');

  // ClientProof = ClientKey XOR HMAC(StoredKey, AuthMessage); the RFC's proof must hash back to StoredKey.
  const proof = Buffer.from('dHzbZapWIk4jUhN+Ute9ytag9zjfMHgsqmmiz7AndVQ=', 'base64');
  const clientSignature = createHmac('sha256', storedKey).update(AUTH_MESSAGE).digest();
  const clientKey = Buffer.from(proof.map((byte, i) => byte ^ clientSignature[i]));
  assert.deepEqual(createHash('sha256').update(clientKey).digest(), storedKey);
  assert.deepEqual(clientKey, createHmac('sha256', pbkdf2Sync('pencil', SALT, 4096, 32, 'sha256')).update('Client Key').digest());
});

test('each verifier gets its own random salt and never contains the password', () => {
  const a = scramVerifier('a-password-of-the-test');
  const b = scramVerifier('a-password-of-the-test');
  assert.notEqual(a, b);
  assert.doesNotMatch(a, /a-password-of-the-test/);
  assert.match(a, /^SCRAM-SHA-256\$4096:[A-Za-z0-9+/]{22}==\$[A-Za-z0-9+/]{43}=:[A-Za-z0-9+/]{43}=$/);
});
