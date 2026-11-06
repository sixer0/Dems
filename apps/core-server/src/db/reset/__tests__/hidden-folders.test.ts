// Fix pass F-M7c (item 3 (i); ruling D180): the transcriber scratch lives in a HIDDEN folder of the
// media store root (`.transcriber/`). Hidden folders are no packages: the store scan the reset
// guard reads lists `SESSION-*` folders and the quarantine, and nothing else.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readEvidenceStore } from '../../commands/evidence-store';

const base = mkdtempSync(join(tmpdir(), 'dems-fm7c-hidden-'));
afterAll(() => rmSync(base, { recursive: true, force: true }));

describe('the store scan and the hidden folders of the media store root', () => {
  it('`.transcriber/sessions/<id>`, `.sealing/<id>` and `.capture-session/<id>.json` are not packages and do not block; a quarantined session (control) is listed', () => {
    const root = join(base, 'store');
    mkdirSync(join(root, '.transcriber', 'sessions', 'SES-20261010-0001'), { recursive: true });
    writeFileSync(join(root, '.transcriber', 'sessions', 'SES-20261010-0001', 'tap.pcm'), 'raw audio');
    mkdirSync(join(root, '.sealing', 'SES-20261010-0001'), { recursive: true });
    mkdirSync(join(root, '.capture-session'), { recursive: true });
    writeFileSync(join(root, '.capture-session', 'SES-20261010-0001.json'), '{}');
    const scan = readEvidenceStore(root);
    expect(scan).toMatchObject({ present: true, packages: [], unreadable: null, quarantined: [] });
    // CONTROL: the scan does see what it is meant to see.
    mkdirSync(join(root, '.quarantine', 'SES-20261010-0002'), { recursive: true });
    mkdirSync(join(root, 'SESSION-20261010-0003'), { recursive: true });
    const again = readEvidenceStore(root);
    expect(again.quarantined).toEqual(['SES-20261010-0002']);
    expect(again.packages.map((entry) => entry.directory)).toEqual(['SESSION-20261010-0003']);
  });
});
