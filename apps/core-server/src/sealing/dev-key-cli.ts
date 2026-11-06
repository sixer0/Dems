/**
 * `npm run evidence:dev-key -w @dems/core-server [-- --data-dir <dir>]` (blueprint row 82; ruling D138).
 *
 * Provisions the DEVELOPMENT evidence signing key under `<data directory>/signer` (default: the
 * git-ignored `.data/` of the workspace), so that a developer's Core boots in real capture mode
 * and can seal. It refuses when a key is already there, reads no connection file, and prints the
 * certificate's public facts only - never key material. See `signing.ts` for what marks the key
 * as a development key. A production key is not provisioned by this command.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { SignerError } from '../capture';
import { DEFAULT_DATA_DIR } from '../plugins/config';
import { provisionDevelopmentSigningKey, sealingSignerDir } from './signing';

export interface DevKeyRun {
  readonly code: 0 | 1;
  readonly lines: readonly string[];
}

/** The command without a process: arguments in, an exit code and the lines to print out. */
export function runDevKeyCommand(args: readonly string[], now: number): DevKeyRun {
  let dataDir: string;
  try {
    const parsed = parseArgs({ args: [...args], options: { 'data-dir': { type: 'string' } }, strict: true });
    dataDir = resolve(parsed.values['data-dir'] ?? DEFAULT_DATA_DIR);
  } catch {
    return { code: 1, lines: ['evidence:dev-key: usage: evidence:dev-key [--data-dir <directory>]'] };
  }
  try {
    const certificate = provisionDevelopmentSigningKey({ dataDir, now });
    return {
      code: 0,
      lines: [
        'evidence:dev-key: OK, a DEVELOPMENT signing key was provisioned (not for production)',
        `  directory:   ${sealingSignerDir(dataDir)}`,
        `  key id:      ${certificate.keyId}`,
        `  subject:     ${certificate.subject}`,
        `  certificate: sha256 ${certificate.sha256}`,
      ],
    };
  } catch (error) {
    const code = error instanceof SignerError ? error.code : 'UNREADABLE';
    const hint = code === 'KEY_EXISTS' ? ' (a key is already there: it is never replaced)' : '';
    return { code: 1, lines: [`evidence:dev-key: FAILED, ${code}${hint}`] };
  }
}

const started = process.argv[1];
if (started !== undefined && resolve(started) === fileURLToPath(import.meta.url)) {
  const run = runDevKeyCommand(process.argv.slice(2), Date.now());
  for (const line of run.lines) process.stdout.write(`${line}\n`);
  process.exitCode = run.code;
}
