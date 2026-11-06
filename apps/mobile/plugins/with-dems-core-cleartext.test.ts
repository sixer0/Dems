// Row 237 (D263; supersedes row 176's loopback-only config, RT-2/D163): the release build permits cleartext
// http/ws in base-config so the user-configured LAN Core is reachable (Android cannot scope cleartext by IP
// range; row 236 restricts the address in the app). The loopback domain-config is kept, the plugin never
// sets `usesCleartextTraffic`, adds no debug-overrides or trust-anchor change, refuses a foreign config, and
// is idempotent through its marker (the style of brand-media.test.ts for the library-patch guard).
import { describe, expect, it } from '@jest/globals';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const APP = path.resolve(__dirname, '..');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const plugin = require('./with-dems-core-cleartext') as {
  applyCoreCleartextManifest: (manifest: unknown) => ManifestShape;
  networkSecurityXmlFor: (existing: string | null) => string;
  writeNetworkSecurityXml: (platformProjectRoot: string) => string;
  MARKER: string;
  LEGACY_MARKERS: readonly string[];
  XML_RESOURCE: string;
  XML_RELATIVE_PATH: string;
  LOOPBACK_DOMAINS: readonly string[];
  NETWORK_SECURITY_XML: string;
};

type ManifestShape = { manifest: { application: { $: Record<string, string> }[] } };
const manifestOf = (attrs: Record<string, string> = {}): ManifestShape => ({
  manifest: { application: [{ $: { 'android:name': '.MainApplication', ...attrs } }] },
});

describe('LAN Core cleartext plugin (row 237, D263)', () => {
  const xml = plugin.NETWORK_SECURITY_XML;

  it('the base config permits cleartext (LAN Core) and the loopback domain-config is kept', () => {
    expect(xml.match(/<base-config\b[^>]*>/g)).toEqual(['<base-config cleartextTrafficPermitted="true" />']);
    expect(plugin.LOOPBACK_DOMAINS).toEqual(['127.0.0.1', 'localhost']);
    expect(xml.match(/<domain-config\b[^>]*>/g)).toEqual(['<domain-config cleartextTrafficPermitted="true">']);
    expect([...xml.matchAll(/<domain includeSubdomains="false">([^<]+)<\/domain>/g)].map((m) => m[1])).toEqual(['127.0.0.1', 'localhost']);
    expect(xml.match(/<domain[\s>]/g)).toHaveLength(2);
    // No wildcard, no subdomains, no debug-overrides, no trust-anchor change, no manifest switch.
    expect(xml).not.toMatch(/\*|includeSubdomains="true"|debug-overrides|trust-anchors|usesCleartextTraffic/);
    expect(xml).not.toMatch(/cleartextTrafficPermitted="false"/);
    expect(xml).toContain(plugin.MARKER);
  });

  it('the manifest points <application> at the config, never sets usesCleartextTraffic, and is idempotent', () => {
    const once = plugin.applyCoreCleartextManifest(manifestOf());
    const app = once.manifest.application[0].$;
    expect(plugin.XML_RESOURCE).toBe('@xml/network_security_config');
    expect(app['android:networkSecurityConfig']).toBe('@xml/network_security_config');
    expect(app['android:usesCleartextTraffic']).toBeUndefined();
    expect(Object.keys(app).filter((k) => /cleartext/i.test(k))).toEqual([]);
    const snapshot = JSON.stringify(once);
    expect(JSON.stringify(plugin.applyCoreCleartextManifest(once))).toBe(snapshot);
  });

  it('refuses a foreign network config and a manifest-wide usesCleartextTraffic', () => {
    expect(() => plugin.applyCoreCleartextManifest(manifestOf({ 'android:networkSecurityConfig': '@xml/other' }))).toThrow(/refusing to replace/);
    expect(() => plugin.applyCoreCleartextManifest(manifestOf({ 'android:usesCleartextTraffic': 'true' }))).toThrow(/usesCleartextTraffic/);
  });

  it('writes the XML once under the generated tree, rewrites nothing on a second run, replaces row 176 output, and refuses an unmarked file', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'r237-nsc-'));
    const foreign = mkdtempSync(path.join(os.tmpdir(), 'r237-nsc-foreign-'));
    const legacy = mkdtempSync(path.join(os.tmpdir(), 'r237-nsc-legacy-'));
    try {
      const file = plugin.writeNetworkSecurityXml(root);
      expect(file).toBe(path.join(root, 'app/src/main/res/xml/network_security_config.xml'));
      expect(readFileSync(file, 'utf8')).toBe(xml);
      const firstWrite = statSync(file).mtimeMs;
      plugin.writeNetworkSecurityXml(root);
      expect(statSync(file).mtimeMs).toBe(firstWrite);
      expect(readFileSync(file, 'utf8').split(plugin.MARKER).length - 1).toBe(1);
      expect(plugin.networkSecurityXmlFor(xml)).toBe(xml);

      // A file written by row 176 (old marker) is ours: replaced by the new config.
      expect(plugin.LEGACY_MARKERS).toEqual(['@dems-loopback-cleartext']);
      const legacyFile = path.join(legacy, plugin.XML_RELATIVE_PATH);
      mkdirSync(path.dirname(legacyFile), { recursive: true });
      writeFileSync(legacyFile, '<!-- @dems-loopback-cleartext: generated --><network-security-config><base-config cleartextTrafficPermitted="false" /></network-security-config>');
      plugin.writeNetworkSecurityXml(legacy);
      expect(readFileSync(legacyFile, 'utf8')).toBe(xml);

      const foreignFile = path.join(foreign, plugin.XML_RELATIVE_PATH);
      mkdirSync(path.dirname(foreignFile), { recursive: true });
      const foreignXml = '<network-security-config><base-config cleartextTrafficPermitted="true" /></network-security-config>';
      writeFileSync(foreignFile, foreignXml);
      expect(() => plugin.writeNetworkSecurityXml(foreign)).toThrow(/refusing to overwrite/);
      expect(readFileSync(foreignFile, 'utf8')).toBe(foreignXml);
    } finally {
      for (const dir of [root, foreign, legacy]) rmSync(dir, { recursive: true, force: true });
    }
  });

  it('app.json registers the plugin once, last, replaces the loopback-only plugin, and holds no cleartext key', () => {
    const raw = readFileSync(path.join(APP, 'app.json'), 'utf8');
    const names = JSON.parse(raw).expo.plugins.map((p: unknown) => (Array.isArray(p) ? p[0] : p));
    expect(names.filter((n: string) => n === './plugins/with-dems-core-cleartext')).toHaveLength(1);
    expect(names[names.length - 1]).toBe('./plugins/with-dems-core-cleartext');
    expect(names).not.toContain('./plugins/with-dems-loopback-cleartext');
    expect(raw).not.toMatch(/usesCleartextTraffic|cleartextTrafficPermitted|networkSecurityConfig/);
  });
});
