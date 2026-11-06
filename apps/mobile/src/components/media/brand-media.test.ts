// Step 72 asset wiring (05 M-05; MA-24; D46, D48, D50, D53, D61): the bundled brand PNGs, the hero
// still and the demo media are byte copies of their shared sources, the static require map covers
// exactly the bundled media, and app.json points the launcher icon and splash at the brand PNGs.
import { describe, expect, it } from '@jest/globals';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { TOPO_SVG, emblem } from '@dems/shared/brand';
import { palette } from '@dems/shared/tokens';
import { EMBLEM_SHARED, HERO_FOCUS, TOPO_XML } from './brand-assets';
import { DEMO_EVIDENCE_SUFFIXES, DEMO_MEDIA_EVIDENCE, DEMO_MEDIA_LIVE, demoMediaForEvidence } from './demo-media';

const APP = path.resolve(__dirname, '../../..');
const SHARED = path.dirname(require.resolve('@dems/shared/package.json'));
const MEDIA_DIR = path.join(APP, 'assets/media');
const SHARED_MEDIA_DIR = path.join(SHARED, 'assets/demo-media/mobile');

const sha256 = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
const listFiles = (dir: string) => readdirSync(dir).filter((f) => !f.startsWith('.')).sort();

describe('brand data (SCR-03, SCR-06)', () => {
  it('adapts the shared emblem module without changing it (D48 stroke widths, one gradient ramp)', () => {
    expect(EMBLEM_SHARED).toEqual({
      viewBox: { width: 128, height: 128 },
      shield: { outer: emblem.shield },
      arcs: emblem.arcs,
      stops: emblem.gradient.stops,
      strokeWidth: { shield: 3.2, arc: 2.6 },
      gradient: { x1: 0, y1: 6, x2: 0, y2: 122 },
      source: 'shared',
    });
  });

  it('uses the shared topographic texture as is, and D46 framing for the still', () => {
    expect(TOPO_XML).toBe(TOPO_SVG);
    expect(HERO_FOCUS).toEqual({ left: '62%', top: '45%' });
  });
});

describe('bundled files are byte copies of their shared sources', () => {
  it('brand PNGs (step 28) and the hero still (step 29; MA-24)', () => {
    for (const name of ['icon-foreground-1024.png', 'icon-monochrome-1024.png', 'splash-1024.png']) {
      expect(sha256(path.join(APP, 'assets/images/brand', name))).toBe(sha256(path.join(SHARED, 'assets/brand', name)));
    }
    expect(sha256(path.join(APP, 'assets/images/hero/room-1600.jpg'))).toBe(
      sha256(path.join(SHARED, 'assets/hero/room-1600.jpg')),
    );
  });

  it('the demo media: the same 84 files as the step-92 mobile subset, byte for byte', () => {
    const bundled = listFiles(MEDIA_DIR);
    expect(bundled).toEqual(listFiles(SHARED_MEDIA_DIR));
    expect(bundled).toHaveLength(84);
    for (const name of bundled) {
      expect(`${name} ${sha256(path.join(MEDIA_DIR, name))}`).toBe(`${name} ${sha256(path.join(SHARED_MEDIA_DIR, name))}`);
    }
  });
});

describe('static require map (demo-media.ts)', () => {
  const source = readFileSync(path.join(__dirname, 'demo-media.ts'), 'utf8');
  const required = [...source.matchAll(/require\('\.\.\/\.\.\/\.\.\/assets\/media\/([^']+)'\)/g)].map((m) => m[1]);

  it('requires every bundled file exactly once and nothing else', () => {
    expect([...required].sort()).toEqual(listFiles(MEDIA_DIR));
    expect(new Set(required).size).toBe(required.length);
    for (const name of required) expect(existsSync(path.join(MEDIA_DIR, name))).toBe(true);
  });

  it('keys each file by evidence suffix and track, in the step-92 naming', () => {
    // Walk the map's source in order: every entry's key and file name must agree.
    const entries = [...source.matchAll(/'(VIDEO|AUDIO)-0([12])': require\('\.\.\/\.\.\/\.\.\/assets\/media\/([^']+)'\)/g)];
    expect(entries).toHaveLength(84);
    for (const [, kind, n, file] of entries) {
      expect(file).toMatch(new RegExp(`_${kind.toLowerCase()}_0${n}(_loop\\.(mp4|m4a)|_poster\\.jpg|\\.(mp4|m4a))$`));
    }
    const blocks = source.split(/\n  '(\d{4})': \{/).slice(1);
    for (let i = 0; i < blocks.length; i += 2) {
      const suffix = blocks[i];
      const files = [...blocks[i + 1].matchAll(/assets\/media\/([^']+)'/g)].map((m) => m[1]);
      expect(files).toHaveLength(6);
      for (const file of files) expect(file.startsWith(`evidence_${suffix}_`)).toBe(true);
    }
  });

  it('covers EV 0001–0013 plus the live loops (D61 join by evidence number)', () => {
    expect(DEMO_EVIDENCE_SUFFIXES).toEqual(
      Array.from({ length: 13 }, (_, i) => String(i + 1).padStart(4, '0')),
    );
    expect(Object.keys(DEMO_MEDIA_EVIDENCE)).toEqual([...DEMO_EVIDENCE_SUFFIXES]);
    expect(Object.keys(DEMO_MEDIA_LIVE)).toEqual(['video', 'audio', 'poster']);
    expect(demoMediaForEvidence('0007')).toBe(DEMO_MEDIA_EVIDENCE['0007']);
    expect(demoMediaForEvidence('0014')).toBeUndefined();
    expect(demoMediaForEvidence('')).toBeUndefined();
  });
});

describe('app.json launcher icon and splash (05 M-05; D48 background = the canvas black token)', () => {
  const app = JSON.parse(readFileSync(path.join(APP, 'app.json'), 'utf8')).expo;
  const splash = app.plugins.find((p: unknown) => Array.isArray(p) && p[0] === 'expo-splash-screen')[1];

  it('points every icon and splash key at the bundled brand PNGs', () => {
    expect(app.icon).toBe('./assets/images/brand/icon-foreground-1024.png');
    expect(app.android.adaptiveIcon).toEqual({
      backgroundColor: palette.black,
      foregroundImage: './assets/images/brand/icon-foreground-1024.png',
      monochromeImage: './assets/images/brand/icon-monochrome-1024.png',
    });
    expect(splash).toEqual({ backgroundColor: palette.black, image: './assets/images/brand/splash-1024.png', imageWidth: 288 });
    for (const file of [app.icon, app.android.adaptiveIcon.foregroundImage, app.android.adaptiveIcon.monochromeImage, splash.image]) {
      expect(existsSync(path.join(APP, file))).toBe(true);
    }
  });

  it('keeps step 67 plugins, including expo-video for the feed', () => {
    const names = app.plugins.map((p: unknown) => (Array.isArray(p) ? p[0] : p));
    // Step 94 (06_packaging_spec §2.2) appends the local DEMO release-signing plugin.
    // Decision D247 appends the guard that refuses an Android build with an unpatched library.
    // Row 176 (M3-02 R2, RT-2, D163) appends the loopback-only cleartext network config.
    expect(names).toEqual(['expo-router', 'expo-splash-screen', 'expo-video', 'expo-font', 'expo-status-bar', 'expo-local-authentication', './plugins/with-dems-release-signing', './plugins/with-dems-library-patches', './plugins/with-dems-loopback-cleartext']);
  });
});

describe('library source patches (decision D247: Reanimated 4.5.1, the unmounted-view retry)', () => {
  const VERSION = '4.5.1';
  const PATCH_MARKER = `DEMS-PATCH react-native-reanimated+${VERSION}`;
  const patchFile = path.join(APP, 'patches', `react-native-reanimated+${VERSION}.patch`);
  const script = readFileSync(path.join(APP, 'scripts/apply-patches.sh'), 'utf8');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const plugin = require('../../../plugins/with-dems-library-patches') as {
    applyDemsLibraryPatchGuard: (contents: string) => string;
    MARKER: string;
    LIB_VERSION: string;
    PATCH_MARKER: string;
  };

  it('the patch file exists, is a unified diff of one Android file and writes the marker the guards look for', () => {
    expect(existsSync(patchFile)).toBe(true);
    const patch = readFileSync(patchFile, 'utf8');
    expect(patch.match(/^\+\+\+ .*$/gm)).toEqual(['+++ b/android/src/main/java/com/swmansion/reanimated/NativeProxy.kt']);
    expect(patch).toContain(`+    // ${PATCH_MARKER}`);
    // The stack is what cost the UI thread: the patched line logs no throwable argument.
    expect(patch).toMatch(/^-\s+Log\.w\("Reanimated", "synchronouslyUpdateUIProps failed for tag \$viewTag", e\)$/m);
    expect(patch).toMatch(/^\+\s+if \(viewExistsMethod\?\.invoke\(mountingManager, viewTag\) == false\) \{$/m);
  });

  it('the script names the exact version, the marker and the system patch tool, and both fail loudly', () => {
    expect(script.startsWith('#!/bin/sh\n')).toBe(true);
    expect(script).toContain(`LIB_VERSION="${VERSION}"`);
    expect(script).toContain(`MARKER="${PATCH_MARKER}"`);
    expect(script).toContain('and the patch is for exactly $LIB_VERSION');
    expect(script).toContain('patch -p1 -N -f -s --dry-run');
    expect(script).toContain('is NOT patched');
    expect(script).not.toMatch(/patch-package|npx|npm i/);
  });

  it('the package the app depends on is exactly the patched version, and the root install runs the script', () => {
    const mobilePackage = JSON.parse(readFileSync(path.join(APP, 'package.json'), 'utf8'));
    const rootPackage = JSON.parse(readFileSync(path.join(APP, '../../package.json'), 'utf8'));
    expect(mobilePackage.dependencies['react-native-reanimated']).toBe(VERSION);
    expect(rootPackage.scripts.postinstall).toBe('sh apps/mobile/scripts/apply-patches.sh');
    expect(mobilePackage.devDependencies['patch-package']).toBeUndefined();
    expect(rootPackage.devDependencies?.['patch-package']).toBeUndefined();
  });

  it('the Gradle guard: one marked block, preBuild depends on it, same version and marker as the script', () => {
    expect(plugin.LIB_VERSION).toBe(VERSION);
    expect(plugin.PATCH_MARKER).toBe(PATCH_MARKER);
    const once = plugin.applyDemsLibraryPatchGuard('android {\n}\n');
    expect(once.split(plugin.MARKER).length - 1).toBe(1);
    expect(once).toContain('tasks.named("preBuild").configure { dependsOn(demsCheckLibraryPatches) }');
    expect(once).toContain(`contains("${PATCH_MARKER}")`);
    expect(once).toContain(`is NOT patched. Run apps/mobile/scripts/apply-patches.sh; an unpatched library must not be packaged.`);
    expect(once).toContain(`and the patch is for exactly ${VERSION}`);
    expect(plugin.applyDemsLibraryPatchGuard(once)).toBe(once);
  });
});
