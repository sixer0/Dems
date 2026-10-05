/**
 * Public surface of the configuration loader (plan row W08). The constants, the types and the
 * pure `createConfig` live in `src/config.ts`; this folder adds the two parts that read from
 * outside the process: the environment values and the runtime connection file.
 *
 * The app factory receives the finished object (`buildApp({ config })`) and exposes it as
 * `app.config`. Nothing else in the server reads the environment.
 */
export { DEFAULT_DATA_DIR, loadConfig, type LoadConfigOptions } from './load-config';
export { readConnectionFile, type ConnectionFileFields } from './connection-file';
