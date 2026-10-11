// Row 118: static guards over the production files of `features/transcription/`. The status block is
// READ-ONLY (ux §8a: tablet and phone have no action; the credential is "never received").
import { describe, expect, it } from '@jest/globals';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expectScanIsTheFolder } from '@/runtime/testing/static-scan';

const FOLDER = __dirname;
/** Code without its comments and without the text inside quotes. */
const uncommented = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(?<!:)\/\/.*$/gm, '');
const code = (text: string): string => uncommented(text).replace(/'[^'\n]*'|"[^"\n]*"|`[^`\n]*`/g, "''");
const production = readdirSync(FOLDER)
  .filter((name) => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name))
  .sort()
  .map((name) => ({ name, text: code(readFileSync(join(FOLDER, name), 'utf8')) }));
const matching = (pattern: RegExp): string[] => production.filter((file) => pattern.test(file.text)).map((file) => file.name);

describe('the transcription status is read-only on the tablet and the phone', () => {
  it('reads the folder: the production files of the block', () => {
    // Rule R1 (`@/runtime/testing/static-scan`): the scan is the folder's production sources, by a second walk; not a list.
    expectScanIsTheFolder(production.map((file) => file.name), FOLDER);
  });

  it('the only Core operation it names is getSttConfig (op 90); never 91 or 92', () => {
    const texts = readdirSync(FOLDER)
      .filter((name) => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name))
      .map((name) => uncommented(readFileSync(join(FOLDER, name), 'utf8')));
    const named = texts.flatMap((text) => [...text.matchAll(/\b(getSttConfig|updateSttConfig|testSttConnection|SttConfigUpdate\w*|SttConnectionTest\w*|planSttConfigUpdate)\b/g)].map((m) => m[1]!));
    expect([...new Set(named)]).toEqual(['getSttConfig']);
    // The only request path is op 90's GET (through the client or the simulator); no POST anywhere.
    expect(texts.filter((text) => /config\/test|method:\s*'POST'/.test(text))).toEqual([]);
    expect(texts.filter((text) => /method:\s*'GET'/.test(text))).toHaveLength(1);
  });

  it('draws no control: no switch, field, picker, slider or tab, and no Core action hook', () => {
    expect(matching(/\b(?:Switch|TextInput|TextField|Input|Slider|Tabs|Select|Checkbox|RadioGroup|SegmentRow|SwitchRow)\b/)).toEqual([]);
    expect(matching(/\buseCoreActions\b|\bsettle\(|\bactions\./)).toEqual([]);
    // The one button is the retry of a failed read; there is no other pressable.
    expect(matching(/\bonPress\b/)).toEqual(['stt-status-section.tsx']);
    const presses = [...production.find((file) => file.name === 'stt-status-section.tsx')!.text.matchAll(/onPress=\{([^}]*)\}/g)].map((m) => m[1]);
    expect(presses).toEqual(['retry.run']);
  });

  it('never reads or draws an endpoint, a credential kind, a reference or a revision', () => {
    const view = production.filter((file) => file.name !== 'use-stt-config.ts' && file.name !== 'i18n.ts');
    const reads = view.flatMap((file) => [...file.text.matchAll(/\.(endpoint|credentialKind|credential|revision|updatedBy|ref|value)\b/g)].map((m) => `${file.name}: ${m[0]}`));
    // `view.credentialSet` (a flag) is the only credential member; `value:` keys of kit rows are not reads.
    expect(reads.filter((read) => !read.endsWith('.value'))).toEqual([]);
    expect(matching(/\bfetch\s*\(|\bnew\s+WebSocket\b/)).toEqual([]);
  });
});
