/**
 * Configuration of `drizzle-kit generate` (plan row W17; database contract MG-2).
 *
 * `generate` reads the typed schema and writes SQL files; it opens no database, so this file
 * holds no credential, no address and no connection text. Migrations are APPLIED by
 * `npm run db:migrate` with the Drizzle migrator, as the owner role (MG-9), never by a
 * `drizzle-kit` command.
 *
 * The two paths are relative to the PROCESS directory, not to this file (D38): run the tool with
 * `apps/core-server` as the working directory, which `npm run db:generate -w @dems/core-server`
 * does.
 *
 *   npm run db:generate -w @dems/core-server -- --name=<purpose>            a generated file
 *   npm run db:generate -w @dems/core-server -- --custom --name=<purpose>   a hand-written file
 *
 * Only the migration writer runs it (P16, MG-1).
 */
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  out: './src/db/migrations',
});
