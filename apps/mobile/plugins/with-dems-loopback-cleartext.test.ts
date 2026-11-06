// Row 176 (M3-02 R2, register L10, ruling RT-2, D163): the release build may send cleartext ONLY to the
// loopback Core link. The config plugin adds a domain-scoped network security config (base config false,
// 127.0.0.1 and localhost true), never `usesCleartextTraffic`, and is idempotent through its marker
// (the style of brand-media.test.ts for the library-patch guard).
import { describe, expect, it } from '@jest/globals';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const APP = path.resolve(__dirname, '..');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const plugin = require('./with-dems-loopback-cleartext') as {
  applyLoopbackCleartextManifest: (manifest: unknown) => ManifestShape;
  networkSecurityXmlFor: (existing: string | null) => string;
  writeNetworkSecurityXml: (platformProjectRoot: string) => string;
  MARKER: string;
  XML_RESOURCE: string;
  XML_RELATIVE_PATH: string;
  LOOPBACK_DOMAINS: readonly string[];
  NETWORK_SECURITY_XML: string;
};

type ManifestShape = { manifest: { application: { $: Record<string, string> }[] } };
const manifestOf = (attrs: Record<string, string> = {}): ManifestShape => ({
  manifest: { application: [{ $: { 'android:name': '.MainApplication', ...attrs } }] },
});

describe('loopback-only cleartext plugin (row 176, L10, RT-2)', () => {
  const xml = plugin.NETWORK_SECURITY_XML;

  it('the config denies cleartext by default and allows it for exactly 127.0.0.1 and localhost', () => {
    expect(plugin.LOOPBACK_DOMAINS).toEqual(['127.0.0.1', 'localhost']);
    expect(xml.match(/<base-config\b[^>]*>/g)).toEqual(['<base-config cleartextTrafficPermitted="false" />']);
    expect(xml.match(/<domain-config\b[^>]*>/g)).toEqual(['<domain-config cleartextTrafficPermitted="true">']);
    expect([...xml.matchAll(/<domain includeSubdomains="false">([^<]+)<\/domain>/g)].map((m) => m[1])).toEqual(['127.0.0.1', 'localhost']);
    expect(xml.match(/<domain[\s>]/g)).toHaveLength(2);
    // No wildcard, no subdomains, no other cleartext switch, no trust-anchor change.
    expect(xml).not.toMatch(/\*|includeSubdomains="true"|debug-overrides|trust-anchors|usesCleartextTraffic/);
    expect(xml.match(/cleartextTrafficPermitted="true"/g)).toHaveLength(1);
    expect(xml).toContain(plugin.MARKER);
  });

  it('the manifest points <application> at the config, never sets usesCleartextTraffic, and is idempotent', () => {
    const once = plugin.applyLoopbackCleartextManifest(manifestOf());
    const app = once.manifest.application[0].$;
    expect(plugin.XML_RESOURCE).toBe('@xml/network_security_config');
    expect(app['android:networkSecurityConfig']).toBe('@xml/network_security_config');
    expect(app['android:usesCleartextTraffic']).toBeUndefined();
    const snapshot = JSON.stringify(once);
    expect(JSON.stringify(plugin.applyLoopbackCleartextManifest(once))).toBe(snapshot);
  });

  it('refuses a foreign network config and an all-hosts cleartext manifest', () => {
    expect(() => plugin.applyLoopbackCleartextManifest(manifestOf({ 'android:networkSecurityConfig': '@xml/other' }))).toThrow(/refusing to replace/);
    expect(() => plugin.applyLoopbackCleartextManifest(manifestOf({ 'android:usesCleartextTraffic': 'true' }))).toThrow(/every host/);
  });

  it('writes the XML once under the generated tree, rewrites nothing on a second run, and refuses an unmarked file', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'r176-nsc-'));
    try {
      const file = plugin.writeNetworkSecurityXml(root);
      expect(file).toBe(path.join(root, 'app/src/main/res/xml/network_security_config.xml'));
      expect(readFileSync(file, 'utf8')).toBe(xml);
      const firstWrite = statSync(file).mtimeMs;
      plugin.writeNetworkSecurityXml(root);
      expect(statSync(file).mtimeMs).toBe(firstWrite);
      expect(readFileSync(file, 'utf8').split(plugin.MARKER).length - 1).toBe(1);
      expect(plugin.networkSecurityXmlFor(xml)).toBe(xml);

      const foreign = mkdtempSync(path.join(os.tmpdir(), 'r176-nsc-foreign-'));
      const foreignFile = path.join(foreign, plugin.XML_RELATIVE_PATH);
      mkdirSync(path.dirname(foreignFile), { recursive: true });
      writeFileSync(foreignFile, '<network-security-config><base-config cleartextTrafficPermitted="true" /></network-security-config>');
      expect(() => plugin.writeNetworkSecurityXml(foreign)).toThrow(/refusing to overwrite/);
      rmSync(foreign, { recursive: true, force: true });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('app.json registers the plugin once, last, and holds no cleartext key', () => {
    const raw = readFileSync(path.join(APP, 'app.json'), 'utf8');
    const names = JSON.parse(raw).expo.plugins.map((p: unknown) => (Array.isArray(p) ? p[0] : p));
    expect(names.filter((n: string) => n === './plugins/with-dems-loopback-cleartext')).toHaveLength(1);
    expect(names[names.length - 1]).toBe('./plugins/with-dems-loopback-cleartext');
    expect(raw).not.toMatch(/usesCleartextTraffic|cleartextTrafficPermitted|networkSecurityConfig/);
  });
});
