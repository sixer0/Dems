/**
 * Task 4 row 89 (caution C-8 of review 086): THE CONFIGURATION LOADER OF A TEST START OF `src/index.ts`, in the place
 * of `src/plugins/config` for the entry file only (`hooks.mjs`). Test support, never imported by a production source.
 *
 * The configuration arrives over the IPC channel of the started process (`fork`): the test sends ONE message when this
 * module asks for it, and the channel is closed at once (it must not hold the process). The runtime credential of the
 * throw-away clone is therefore never in a file, an argument or the environment of the process (the rule of the
 * kill matrix's Core process, `src/sealing/__tests__/kill-matrix/core-child.ts`). The object is built with the product's
 * own `createConfig`; `loadConfig` answers it, whatever environment the entry hands in.
 */
import { createConfig, Secret, type ConfigInput, type CoreServerConfig } from '../../../src/config';

interface EntryConfigMessage {
  readonly type: 'row89-entry-config';
  readonly config: Omit<ConfigInput, 'database'> & { readonly database: { readonly host: '127.0.0.1'; readonly port: number; readonly database: string; readonly user: string; readonly password: string } };
}

const message = await new Promise<EntryConfigMessage>((resolveMessage, rejectMessage) => {
  if (typeof process.send !== 'function') {
    rejectMessage(new Error('the test start of the entry needs an IPC channel'));
    return;
  }
  process.once('message', (received) => resolveMessage(received as EntryConfigMessage));
  process.send({ type: 'row89-entry-ready' });
});
process.disconnect?.();
if (message.type !== 'row89-entry-config') throw new Error('the test start of the entry got no configuration');

const built = createConfig({ ...message.config, database: { ...message.config.database, password: new Secret(message.config.database.password) } });

/** The entry's one call: `loadConfig({ env: process.env })`. The environment is not read: the configuration came over the channel. */
export function loadConfig(_options: { readonly env: NodeJS.ProcessEnv }): CoreServerConfig {
  return built;
}
