/**
 * Persistent error log: one JSON object per line in apps/mock-core/logs/errors.log
 * (git-ignored by the root `*.log` rule). Complements Fastify's stdout JSON logger so that
 * failures survive a closed terminal. Never throws.
 */
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ERROR_LOG_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'logs',
  'errors.log',
);

export interface ErrorLogEntry {
  level: 'fatal' | 'error' | 'warn';
  /** Module and function, e.g. "mock-core.ws". */
  source: string;
  message: string;
  stackTrace?: string | undefined;
  /** Request ID, route, client ID etc. Never payloads or secrets. */
  context?: Record<string, unknown>;
}

export function toErrorFields(error: unknown): { message: string; stackTrace?: string } {
  if (error instanceof Error) {
    return error.stack === undefined
      ? { message: error.message }
      : { message: error.message, stackTrace: error.stack };
  }
  return { message: String(error) };
}

export function appendErrorLog(entry: ErrorLogEntry): void {
  try {
    mkdirSync(dirname(ERROR_LOG_PATH), { recursive: true });
    appendFileSync(
      ERROR_LOG_PATH,
      `${JSON.stringify({ timestamp: new Date().toISOString(), service: 'dems-mock-core', ...entry })}\n`,
    );
  } catch {
    // The error log must never take the service down; stdout logging still has the event.
  }
}
