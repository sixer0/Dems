// Closing pass F-X, item 7 (review 21, question 11): ONE `exportJobIdOf` in the shared contract,
// used by the simulator, the Live binding and both clients. Written RED: the shared package had no
// such export, and the simulator and the two client models each held a function of that name.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as api from '../src/api';

const exportJobIdOf = (api as unknown as { exportJobIdOf?: (exportId: string, answered?: unknown) => string | null }).exportJobIdOf;

describe('exportJobIdOf — the one rule (C3 §3 ops 42 / 87; ruling D140)', () => {
  it('derives the job from the export ID: the same six digits; null for a text that is no export ID', () => {
    expect(exportJobIdOf).toBeTypeOf('function');
    expect(exportJobIdOf!('EXP-000032')).toBe('EXPJ-000032');
    for (const id of ['EXPJ-000032', 'EXP-32', 'exp-000032', '']) expect(exportJobIdOf!(id)).toBeNull();
  });

  it('prefers the job ID the 202 answered, when it is one', () => {
    expect(exportJobIdOf!('EXP-000032', 'EXPJ-000777')).toBe('EXPJ-000777');
    for (const answered of [undefined, null, 'EXP-000777', 'EXPJ-7', 7]) expect(exportJobIdOf!('EXP-000032', answered)).toBe('EXPJ-000032');
    // Without an export ID only an answered job ID is one (the Live binding's and the clients' read of the 202).
    expect(exportJobIdOf!('', 'EXPJ-000777')).toBe('EXPJ-000777');
    expect(exportJobIdOf!('', 'EXP-000777')).toBeNull();
  });

  it('is DEFINED once in the shared package and in neither client (control: the scan finds the one definition)', () => {
    const root = join(__dirname, '..', '..', '..');
    const files = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        if (name === 'node_modules' || name === 'dist') return [];
        const path = join(dir, name);
        return statSync(path).isDirectory() ? files(path) : /\.tsx?$/.test(name) ? [path] : [];
      });
    const defined = ['packages/shared/src', 'apps/core-web/src', 'apps/mobile/src']
      .flatMap((dir) => files(join(root, dir)))
      .filter((path) => /function exportJobIdOf\w*\s*\(/.test(readFileSync(path, 'utf8')))
      .map((path) => path.slice(root.length + 1));
    expect(defined).toEqual(['packages/shared/src/api/patterns.ts']);
  });
});
