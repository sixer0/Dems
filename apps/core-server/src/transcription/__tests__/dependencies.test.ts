// Integration pass A (decision D109; row 115's request): the production composition imports
// `@dems/transcriber`, so a production install (without dev dependencies) must have it.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const folder = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(resolve(folder, '../../package.json'), 'utf8')) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };

describe('the workspace packages the transcription composition imports at runtime', () => {
  const sources = readdirSync(folder).filter((name) => name.endsWith('.ts'));
  const imported = [...new Set(sources.flatMap((name) => [...readFileSync(join(folder, name), 'utf8').matchAll(/^import (?!type\b)[^;]*?from '(@dems\/[a-z-]+)/gm)].map((match) => match[1] ?? '')))].sort();

  it('are dependencies of the Core server, not dev dependencies', () => {
    // The scan reads something: the composition does import the transcriber and the shared package by value.
    expect(sources.length).toBeGreaterThanOrEqual(8);
    expect(imported).toEqual(['@dems/shared', '@dems/transcriber']);
    for (const name of imported) {
      expect(Object.keys(manifest.dependencies ?? {}), name).toContain(name);
      expect(Object.keys(manifest.devDependencies ?? {}), name).not.toContain(name);
    }
  });
});
