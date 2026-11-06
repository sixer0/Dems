#!/usr/bin/env node
// @ts-check
'use strict';
/**
 * DEMS Web Demo launcher (masterplan/06_packaging_spec.md §3.3, PK-11; step 95).
 *
 * One dependency-free CommonJS file, Node built-ins only. It serves the built Core web app,
 * `GET /api/v1/health` and the `/ws` RFC 6455 heartbeat from ONE loopback origin
 * (http://127.0.0.1:<port>), so the packaged web build (VITE_DEMS_CORE_ORIGIN=same-origin,
 * step 100) can sign in without the Fastify mock-core.
 *
 * Packaging: embedded unchanged as the Node SEA main script (macOS arm64, Windows x64,
 * Linux x64), or run by the official Node runtime (macOS x64, Windows signed-runtime, any-OS
 * zip). In a SEA the web files are SEA assets; otherwise they are read from ./web next to
 * this file. Requests are looked up in an in-memory map, never mapped to a filesystem path.
 *
 * Hard rules: `require` only `node:*`; no outbound network except the loopback self-test and
 * the single-instance probe; no files written; no environment-variable configuration.
 *
 * The health and heartbeat builders duplicate the mock-core contract on purpose (review 64);
 * apps/mock-core/test/standalone-launcher.test.ts guards them against @dems/shared/api.
 */

const http = require('node:http');
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const childProcess = require('node:child_process');

// Build marker (static SEA proof, 06 §3.2). Keep the literal on one line.
const BUILD_MARKER = 'DEMS_WEB_LAUNCHER_BUILD=0.1.0';
const VERSION = '0.1.0';
const PRODUCT = 'DEMS Web Demo';

// Shared contract (@dems/shared/api constants; F-43).
const HEALTH_PATH = '/api/v1/health';
const WS_PATH = '/ws';
const HEARTBEAT_INTERVAL_MS = 1000;
const SERVICE_NAME = 'dems-mock-core';
const API_VERSION = 'v1';

const HOST = '127.0.0.1';
const DEFAULT_PORT = 4410;
const FALLBACK_PORTS = [4411, 4412, 4413, 4414, 4415, 4416, 4417, 4418, 4419];
const MAX_WS_CLIENTS = 32;
const MAX_WS_PAYLOAD = 65536;
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const PROBE_TIMEOUT_MS = 1000;
const SHUTDOWN_TIMEOUT_MS = 2000;

/** @type {Record<string, string>} */
const MIME = {
  html: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  json: 'application/json',
  sig: 'application/json',
  jsonl: 'application/x-ndjson',
  svg: 'image/svg+xml',
  woff2: 'font/woff2',
  woff: 'font/woff',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  ico: 'image/x-icon',
  mp4: 'video/mp4',
  m4a: 'audio/mp4',
  zip: 'application/zip',
  wasm: 'application/wasm',
  txt: 'text/plain; charset=utf-8',
};

/** @param {string} p */
function mimeFor(p) {
  const dot = p.lastIndexOf('.');
  const ext = dot >= 0 ? p.slice(dot + 1).toLowerCase() : '';
  return MIME[ext] || 'application/octet-stream';
}

/**
 * Header CSP. Must stay byte-equal to packagedCsp({ delivery: 'header', port }) in
 * apps/core-web/src/lib/packaged-csp.ts (asserted by the launcher test).
 * @param {number} port
 */
function cspHeader(port) {
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "font-src 'self' data:",
    "worker-src 'self' blob:",
    `connect-src 'self' ws://127.0.0.1:${port} ws://localhost:${port}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

/** @param {number} port */
function securityHeaders(port) {
  return {
    'Content-Security-Policy': cspHeader(port),
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  };
}

// ---------------------------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------------------------

/** @typedef {{ size: number, sha256: string, type?: string }} ManifestEntry */
/** @typedef {{ body: Buffer, size: number, sha256: string, type: string }} Asset */
/** @typedef {{ mode: 'sea' | 'runtime', assets: Map<string, Asset>, bytes: number, manifestSha256: string }} AssetStore */

/** @returns {any} */
function seaModule() {
  try {
    const sea = require('node:sea');
    return sea && typeof sea.isSea === 'function' && sea.isSea() ? sea : null;
  } catch {
    return null;
  }
}

/**
 * @param {Buffer} manifestBuf
 * @returns {Record<string, ManifestEntry>}
 */
function parseManifest(manifestBuf) {
  const parsed = JSON.parse(manifestBuf.toString('utf8'));
  const files = parsed && typeof parsed === 'object' ? parsed.files : null;
  if (!files || typeof files !== 'object') throw new Error('web-manifest.json has no "files" map');
  return files;
}

/**
 * Walk a directory: regular files only, symlinks skipped.
 * @param {string} root
 * @returns {Map<string, string>} relative posix path -> absolute path
 */
function walkFiles(root) {
  /** @type {Map<string, string>} */
  const out = new Map();
  /** @param {string} dir @param {string} rel */
  const visit = (dir, rel) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '.DS_Store') continue;
      const abs = path.join(dir, entry.name);
      const r = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) visit(abs, r);
      else if (entry.isFile()) out.set(r, abs);
    }
  };
  visit(root, '');
  return out;
}

/** @returns {AssetStore} */
function loadAssets() {
  const sea = seaModule();
  /** @type {Map<string, Asset>} */
  const assets = new Map();
  let bytes = 0;
  /** @type {Buffer} */
  let manifestBuf;
  /** @type {(rel: string) => Buffer | null} */
  let read;
  if (sea) {
    manifestBuf = Buffer.from(sea.getRawAsset('web-manifest.json'));
    const keys = new Set(sea.getAssetKeys());
    read = (rel) => (keys.has(`web/${rel}`) ? Buffer.from(sea.getRawAsset(`web/${rel}`)) : null);
  } else {
    const baseDir = __dirname;
    manifestBuf = fs.readFileSync(path.join(baseDir, 'web-manifest.json'));
    const files = walkFiles(path.join(baseDir, 'web'));
    read = (rel) => {
      const abs = files.get(rel);
      return abs ? fs.readFileSync(abs) : null;
    };
  }
  const manifest = parseManifest(manifestBuf);
  for (const [rel, entry] of Object.entries(manifest)) {
    const body = read(rel);
    if (!body) throw new Error(`web file missing: ${rel}`);
    if (body.length !== entry.size) throw new Error(`web file size mismatch: ${rel}`);
    assets.set(`/${rel}`, { body, size: entry.size, sha256: entry.sha256, type: entry.type || mimeFor(rel) });
    bytes += entry.size;
  }
  if (!assets.has('/index.html')) throw new Error('web/index.html missing');
  const manifestSha256 = crypto.createHash('sha256').update(manifestBuf).digest('hex');
  return { mode: sea ? 'sea' : 'runtime', assets, bytes, manifestSha256 };
}

/** @param {AssetStore} store */
function verifyAssetHashes(store) {
  /** @type {string[]} */
  const mismatches = [];
  for (const [p, a] of store.assets) {
    const h = crypto.createHash('sha256').update(a.body).digest('hex');
    if (h !== a.sha256) mismatches.push(p);
  }
  return mismatches;
}

// ---------------------------------------------------------------------------------------------
// WebSocket (RFC 6455, server side, text frames only)
// ---------------------------------------------------------------------------------------------

/**
 * @param {number} opcode
 * @param {Buffer} payload
 */
function encodeFrame(opcode, payload) {
  const len = payload.length;
  /** @type {Buffer} */
  let header;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  header[0] = 0x80 | opcode; // FIN + opcode; server frames are never masked
  return Buffer.concat([header, payload]);
}

/** @param {number} code */
function closePayload(code) {
  const b = Buffer.alloc(2);
  b.writeUInt16BE(code, 0);
  return b;
}

class WsClient {
  /**
   * @param {net.Socket} socket
   * @param {(c: WsClient) => void} onGone
   */
  constructor(socket, onGone) {
    this.socket = socket;
    /** @type {Buffer} */
    this.buf = Buffer.alloc(0);
    this.closing = false;
    this.gone = false;
    this.onGone = onGone;
    socket.setNoDelay(true);
    socket.on('data', (/** @type {Buffer} */ d) => this.onData(d));
    socket.on('error', () => this.destroy());
    socket.on('close', () => this.destroy());
  }

  /** @param {string} text */
  sendText(text) {
    if (this.closing || this.gone) return;
    this.socket.write(encodeFrame(0x1, Buffer.from(text, 'utf8')));
  }

  /** @param {number} code */
  close(code) {
    if (this.gone) return;
    if (!this.closing) {
      this.closing = true;
      try {
        this.socket.write(encodeFrame(0x8, closePayload(code)));
        this.socket.end();
      } catch {
        /* socket already gone */
      }
    }
    setTimeout(() => this.destroy(), 1000).unref();
  }

  destroy() {
    if (this.gone) return;
    this.gone = true;
    this.socket.destroy();
    this.onGone(this);
  }

  /** @param {Buffer} data */
  onData(data) {
    if (this.gone) return;
    /** @type {Buffer} */
    const merged = this.buf.length ? Buffer.concat([this.buf, data]) : data;
    this.buf = merged;
    for (;;) {
      if (this.closing && !this.gone) {
        // After our close, only wait for the peer's close; drop everything else.
        this.buf = Buffer.alloc(0);
        return;
      }
      const b = this.buf;
      if (b.length < 2) return;
      const fin = (b[0] & 0x80) !== 0;
      const rsv = b[0] & 0x70;
      const opcode = b[0] & 0x0f;
      const masked = (b[1] & 0x80) !== 0;
      let len = b[1] & 0x7f;
      let offset = 2;
      if (len === 126) {
        if (b.length < 4) return;
        len = b.readUInt16BE(2);
        offset = 4;
      } else if (len === 127) {
        if (b.length < 10) return;
        const big = b.readBigUInt64BE(2);
        len = big > BigInt(Number.MAX_SAFE_INTEGER) ? Number.MAX_SAFE_INTEGER : Number(big);
        offset = 10;
      }
      if (!masked || rsv !== 0) return this.close(1002); // client frames MUST be masked; no extensions
      const isControl = (opcode & 0x08) !== 0;
      if (isControl) {
        if (len > 125 || !fin) return this.close(1002);
        if (opcode !== 0x8 && opcode !== 0x9 && opcode !== 0xa) return this.close(1002);
      } else {
        if (opcode !== 0x0 && opcode !== 0x1 && opcode !== 0x2) return this.close(1002);
        if (!fin || opcode === 0x0) return this.close(1003); // fragmentation is not supported
        if (len > MAX_WS_PAYLOAD) return this.close(1009);
      }
      if (b.length < offset + 4 + len) return; // wait for the full frame
      const mask = b.subarray(offset, offset + 4);
      const payload = Buffer.from(b.subarray(offset + 4, offset + 4 + len));
      for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
      this.buf = b.subarray(offset + 4 + len);
      if (opcode === 0x8) {
        // Echo the close (same code when present), then end.
        try {
          this.socket.write(encodeFrame(0x8, payload.length >= 2 ? payload.subarray(0, 2) : Buffer.alloc(0)));
          this.socket.end();
        } catch {
          /* ignore */
        }
        this.closing = true;
        setTimeout(() => this.destroy(), 1000).unref();
        return;
      }
      if (opcode === 0x9) {
        this.socket.write(encodeFrame(0xa, payload));
      }
      // Pong, text and binary data are ignored (no client messages are defined).
    }
  }
}

// ---------------------------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------------------------

/**
 * @param {AssetStore} store
 */
function createLauncherServer(store) {
  const startedAt = Date.now();
  /** @type {Set<WsClient>} */
  const clients = new Set();
  let seq = 0;
  let port = 0;

  const uptimeMs = () => Math.max(0, Math.floor(Date.now() - startedAt));

  const healthBody = () =>
    JSON.stringify({
      status: 'ok',
      service: SERVICE_NAME,
      version: VERSION,
      apiVersion: API_VERSION,
      serverTime: new Date().toISOString(),
      uptimeMs: uptimeMs(),
      ws: { path: WS_PATH, heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS, clients: clients.size },
    });

  const heartbeat = () =>
    JSON.stringify({
      type: 'heartbeat',
      v: 1,
      seq,
      serverTime: new Date().toISOString(),
      uptimeMs: uptimeMs(),
      intervalMs: HEARTBEAT_INTERVAL_MS,
      clients: clients.size,
      sessionState: null,
    });

  const ticker = setInterval(() => {
    seq += 1;
    if (clients.size === 0) return;
    const msg = heartbeat();
    for (const c of clients) c.sendText(msg);
  }, HEARTBEAT_INTERVAL_MS);
  ticker.unref();

  /** @param {string | undefined} host */
  const hostAllowed = (host) => host === `127.0.0.1:${port}` || host === `localhost:${port}`;
  /** @param {string | undefined} origin */
  const originAllowed = (origin) =>
    origin === undefined || origin === `http://127.0.0.1:${port}` || origin === `http://localhost:${port}`;

  /**
   * @param {http.ServerResponse} res
   * @param {number} status
   * @param {Record<string, string | number>} headers
   * @param {Buffer | string | null} body
   * @param {boolean} head
   */
  const send = (res, status, headers, body, head) => {
    /** @type {Record<string, string | number>} */
    const all = { ...securityHeaders(port), ...headers };
    if (body !== null && all['Content-Length'] === undefined) {
      all['Content-Length'] = Buffer.byteLength(body);
    }
    res.writeHead(status, all);
    if (head || body === null) res.end();
    else res.end(body);
  };

  /**
   * @param {http.IncomingMessage} req
   * @param {http.ServerResponse} res
   */
  const handle = (req, res) => {
    const head = req.method === 'HEAD';
    if (!hostAllowed(req.headers.host)) {
      return send(res, 421, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Misdirected Request\n', head);
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return send(res, 405, { Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8' }, 'Method Not Allowed\n', head);
    }
    const rawPath = (req.url || '/').split('?')[0].split('#')[0];
    /** @type {string} */
    let p;
    try {
      p = decodeURIComponent(rawPath);
    } catch {
      return send(res, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Not Found\n', head);
    }
    const segments = p.split('/');
    if (!p.startsWith('/') || p.includes('\\') || p.includes('\0') || segments.some((s) => s === '..' || s === '.')) {
      return send(res, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Not Found\n', head);
    }

    if (p === HEALTH_PATH) {
      return send(
        res,
        200,
        { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-DEMS-Launcher': VERSION },
        healthBody(),
        head,
      );
    }
    if (p === WS_PATH) {
      return send(res, 426, { 'Content-Type': 'text/plain; charset=utf-8', Upgrade: 'websocket' }, 'Upgrade Required\n', head);
    }
    if (p === '/api' || p.startsWith('/api/')) {
      return send(res, 404, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, '{"error":"not_found"}', head);
    }

    const asset = store.assets.get(p === '/' ? '/index.html' : p);
    if (asset) return serveAsset(req, res, p === '/' ? '/index.html' : p, asset, head);

    const last = segments[segments.length - 1] || '';
    if (!last.includes('.')) {
      const index = /** @type {Asset} */ (store.assets.get('/index.html'));
      return serveAsset(req, res, '/index.html', index, head);
    }
    return send(res, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Not Found\n', head);
  };

  /**
   * @param {http.IncomingMessage} req
   * @param {http.ServerResponse} res
   * @param {string} key
   * @param {Asset} asset
   * @param {boolean} head
   */
  const serveAsset = (req, res, key, asset, head) => {
    const etag = `"${asset.sha256}"`;
    const cache = key.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache';
    /** @type {Record<string, string | number>} */
    const base = { 'Content-Type': asset.type, ETag: etag, 'Cache-Control': cache, 'Accept-Ranges': 'bytes' };
    const inm = req.headers['if-none-match'];
    if (inm && inm.split(',').some((t) => t.trim() === etag || t.trim() === '*')) {
      return send(res, 304, base, null, true);
    }
    const range = req.headers.range;
    if (range && !range.includes(',')) {
      const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
      if (m && (m[1] !== '' || m[2] !== '')) {
        const size = asset.size;
        let start;
        let end;
        if (m[1] === '') {
          const n = Number(m[2]);
          start = Math.max(0, size - n);
          end = size - 1;
          if (n === 0) start = size; // unsatisfiable
        } else {
          start = Number(m[1]);
          end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
        }
        if (start >= size || start > end) {
          return send(res, 416, { ...base, 'Content-Range': `bytes */${size}`, 'Content-Type': 'text/plain; charset=utf-8' }, '', head);
        }
        const chunk = asset.body.subarray(start, end + 1);
        return send(res, 206, { ...base, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': chunk.length }, chunk, head);
      }
    }
    // Multi-range or malformed Range: full 200 response.
    return send(res, 200, { ...base, 'Content-Length': asset.size }, asset.body, head);
  };

  const server = http.createServer((req, res) => {
    try {
      handle(req, res);
    } catch (err) {
      process.stderr.write(`[dems-web-launcher] request error: ${err instanceof Error ? err.message : String(err)}\n`);
      if (!res.headersSent) send(res, 500, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Internal Server Error\n', false);
      else res.destroy();
    }
  });
  server.keepAliveTimeout = 5000;

  /**
   * @param {net.Socket} socket
   * @param {number} status
   * @param {string} reason
   * @param {Record<string, string>} [extra]
   */
  const rejectUpgrade = (socket, status, reason, extra = {}) => {
    const headers = { ...securityHeaders(port), 'Content-Type': 'text/plain; charset=utf-8', 'Content-Length': String(reason.length + 1), Connection: 'close', ...extra };
    const lines = Object.entries(headers).map(([k, v]) => `${k}: ${v}`);
    socket.end(`HTTP/1.1 ${status} ${http.STATUS_CODES[status] || ''}\r\n${lines.join('\r\n')}\r\n\r\n${reason}\n`);
  };

  server.on('upgrade', (req, socket, headBuf) => {
    const sock = /** @type {net.Socket} */ (socket);
    sock.on('error', () => sock.destroy());
    if (!hostAllowed(req.headers.host)) return rejectUpgrade(sock, 421, 'Misdirected Request');
    const p = (req.url || '').split('?')[0];
    if (p !== WS_PATH) return rejectUpgrade(sock, 404, 'Not Found');
    if (req.method !== 'GET') return rejectUpgrade(sock, 405, 'Method Not Allowed', { Allow: 'GET, HEAD' });
    if (String(req.headers.upgrade || '').toLowerCase() !== 'websocket') return rejectUpgrade(sock, 426, 'Upgrade Required', { Upgrade: 'websocket' });
    if (!originAllowed(req.headers.origin)) return rejectUpgrade(sock, 403, 'Forbidden');
    if (req.headers['sec-websocket-version'] !== '13') {
      return rejectUpgrade(sock, 426, 'Upgrade Required', { 'Sec-WebSocket-Version': '13' });
    }
    const key = req.headers['sec-websocket-key'];
    if (typeof key !== 'string' || Buffer.from(key, 'base64').length !== 16) return rejectUpgrade(sock, 400, 'Bad Request');
    if (clients.size >= MAX_WS_CLIENTS) return rejectUpgrade(sock, 503, 'Service Unavailable');

    const accept = crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
    sock.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
        'Upgrade: websocket\r\n' +
        'Connection: Upgrade\r\n' +
        `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
    );
    const client = new WsClient(sock, (c) => clients.delete(c));
    clients.add(client);
    if (headBuf && headBuf.length) client.onData(Buffer.from(headBuf));
    client.sendText(heartbeat()); // immediate heartbeat on connect
  });

  return {
    server,
    clients,
    /** @param {number} p */
    setPort(p) {
      port = p;
    },
    /** Close 1001 to every WS client and stop the ticker. */
    closeClients() {
      clearInterval(ticker);
      for (const c of clients) c.close(1001);
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Ports, single instance, browser
// ---------------------------------------------------------------------------------------------

/**
 * @param {http.Server} server
 * @param {number} port
 * @returns {Promise<number>}
 */
function listenOn(server, port) {
  return new Promise((resolve, reject) => {
    /** @param {Error} err */
    const onError = (err) => {
      server.removeListener('listening', onListening);
      reject(err);
    };
    const onListening = () => {
      server.removeListener('error', onError);
      const addr = /** @type {net.AddressInfo} */ (server.address());
      resolve(addr.port);
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen({ host: HOST, port, exclusive: true });
  });
}

/**
 * True when a DEMS launcher answers health on this loopback port.
 * @param {number} port
 * @returns {Promise<boolean>}
 */
function probeLauncher(port) {
  return new Promise((resolve) => {
    const req = http.get(
      { host: HOST, port, path: HEALTH_PATH, headers: { Host: `127.0.0.1:${port}` }, timeout: PROBE_TIMEOUT_MS },
      (res) => {
        res.resume();
        resolve(res.statusCode === 200 && typeof res.headers['x-dems-launcher'] === 'string');
      },
    );
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.on('error', () => resolve(false));
  });
}

/** @param {string} url */
function openBrowser(url) {
  if (!/^[0-9a-z.:/]+$/.test(url)) return;
  const fallback = () => process.stdout.write(` Open this address in Chrome or Edge: ${url}\n`);
  try {
    /** @type {import('node:child_process').ChildProcess} */
    let child;
    const opts = { detached: true, stdio: /** @type {'ignore'} */ ('ignore') };
    if (process.platform === 'darwin') child = childProcess.spawn('open', [url], opts);
    else if (process.platform === 'win32') {
      child = childProcess.spawn('cmd.exe', ['/d', '/s', '/c', `start "" "${url}"`], { ...opts, windowsVerbatimArguments: true, windowsHide: true });
    } else child = childProcess.spawn('xdg-open', [url], opts);
    child.on('error', fallback);
    child.unref();
  } catch {
    fallback();
  }
}

/** @param {string} url */
function banner(url) {
  const line = '='.repeat(66);
  return [
    line,
    ` ${PRODUCT} ${VERSION}  -  DEMO, simulated data, works offline`,
    ` Open in Chrome or Edge:  ${url}`,
    ` Core health:  ${HEALTH_PATH} (LIVE)   Heartbeat:  ${WS_PATH} (1 per second)`,
    ' Listening on 127.0.0.1 only - other computers cannot connect.',
    ' To stop: press Ctrl+C or close this window.',
    ' Untuk berhenti: tekan Ctrl+C atau tutup jendela ini.',
    line,
    '',
  ].join('\n');
}

function versionLine() {
  const mode = seaModule() ? 'sea' : 'runtime';
  return `${PRODUCT} ${VERSION} (node ${process.version}, ${mode}, ${process.platform}-${process.arch})`;
}

const HELP = `${PRODUCT} ${VERSION}

Usage: run the program (double-click), then use the browser page it opens.

Options:
  --no-open      do not open the browser
  --port <n>     use exactly this port (fails if it is busy)
  --self-test    check the files, health, page and heartbeat on a free port; prints JSON
  --version      print the version
  --help         print this help

Default port 4410 (then 4411-4419, then any free port). Listens on 127.0.0.1 only.
`;

// ---------------------------------------------------------------------------------------------
// Self-test
// ---------------------------------------------------------------------------------------------

/**
 * @param {number} port
 * @param {string} p
 * @returns {Promise<{ status: number, headers: http.IncomingHttpHeaders, body: Buffer }>}
 */
function httpGet(port, p) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: HOST, port, path: p, headers: { Host: `127.0.0.1:${port}` }, timeout: 5000 }, (res) => {
      /** @type {Buffer[]} */
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode || 0, headers: res.headers, body: Buffer.concat(chunks) }));
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error(`GET ${p} timed out`)));
    req.on('error', reject);
  });
}

/**
 * Raw RFC 6455 handshake (no Origin) and the first heartbeat frame.
 * @param {number} port
 * @returns {Promise<{ accept: boolean, heartbeat: any }>}
 */
function wsProbe(port) {
  return new Promise((resolve, reject) => {
    const key = crypto.randomBytes(16).toString('base64');
    const expected = crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
    const sock = net.connect({ host: HOST, port });
    const timer = setTimeout(() => {
      sock.destroy();
      reject(new Error('WS probe timed out'));
    }, 5000);
    /** @type {Buffer} */
    let buf = Buffer.alloc(0);
    let headerDone = false;
    let accept = false;
    sock.on('connect', () => {
      sock.write(
        `GET ${WS_PATH} HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n` +
          `Sec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`,
      );
    });
    sock.on('data', (/** @type {Buffer} */ d) => {
      buf = Buffer.concat([buf, d]);
      if (!headerDone) {
        const end = buf.indexOf('\r\n\r\n');
        if (end < 0) return;
        const head = buf.subarray(0, end).toString('latin1');
        if (!head.startsWith('HTTP/1.1 101 ')) {
          clearTimeout(timer);
          sock.destroy();
          return reject(new Error(`WS handshake failed: ${head.split('\r\n')[0]}`));
        }
        const m = /\r\nsec-websocket-accept:\s*(\S+)/i.exec(head);
        accept = !!m && m[1] === expected;
        headerDone = true;
        buf = buf.subarray(end + 4);
      }
      if (buf.length < 2) return;
      let len = buf[1] & 0x7f;
      let off = 2;
      if (len === 126) {
        if (buf.length < 4) return;
        len = buf.readUInt16BE(2);
        off = 4;
      }
      if (buf.length < off + len) return;
      clearTimeout(timer);
      const text = buf.subarray(off, off + len).toString('utf8');
      // Masked close frame (1000), then hang up.
      const mask = crypto.randomBytes(4);
      const payload = closePayload(1000);
      for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
      sock.end(Buffer.concat([Buffer.from([0x88, 0x80 | payload.length]), mask, payload]));
      try {
        resolve({ accept, heartbeat: JSON.parse(text) });
      } catch (err) {
        reject(err);
      }
    });
    sock.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/** @param {any} h */
function healthShapeOk(h) {
  return (
    !!h &&
    h.status === 'ok' &&
    h.service === SERVICE_NAME &&
    typeof h.version === 'string' &&
    h.version.length > 0 &&
    h.apiVersion === API_VERSION &&
    typeof h.serverTime === 'string' &&
    !Number.isNaN(Date.parse(h.serverTime)) &&
    Number.isInteger(h.uptimeMs) &&
    h.uptimeMs >= 0 &&
    !!h.ws &&
    h.ws.path === WS_PATH &&
    h.ws.heartbeatIntervalMs === HEARTBEAT_INTERVAL_MS &&
    Number.isInteger(h.ws.clients)
  );
}

/** @param {any} b */
function heartbeatShapeOk(b) {
  return (
    !!b &&
    b.type === 'heartbeat' &&
    b.v === 1 &&
    Number.isInteger(b.seq) &&
    typeof b.serverTime === 'string' &&
    !Number.isNaN(Date.parse(b.serverTime)) &&
    Number.isInteger(b.uptimeMs) &&
    b.intervalMs === HEARTBEAT_INTERVAL_MS &&
    Number.isInteger(b.clients) &&
    b.sessionState === null
  );
}

async function selfTest() {
  /** @type {Record<string, any>} */
  const summary = { ok: false, product: PRODUCT, version: VERSION, node: process.version, platform: `${process.platform}-${process.arch}` };
  const hard = setTimeout(() => {
    summary.error = 'self-test timed out';
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    process.exit(1);
  }, 20000);
  /** @type {ReturnType<typeof createLauncherServer> | null} */
  let launcher = null;
  try {
    const store = loadAssets();
    summary.mode = store.mode;
    const mismatches = verifyAssetHashes(store);
    summary.assets = { files: store.assets.size, bytes: store.bytes, manifestSha256: store.manifestSha256, hashMismatches: mismatches.length };
    if (mismatches.length) summary.assets.mismatched = mismatches.slice(0, 10);

    launcher = createLauncherServer(store);
    const port = await listenOn(launcher.server, 0);
    launcher.setPort(port);
    summary.port = port;

    const health = await httpGet(port, HEALTH_PATH);
    const healthJson = JSON.parse(health.body.toString('utf8'));
    summary.health = { status: health.status, launcherHeader: health.headers['x-dems-launcher'] || null, shapeOk: healthShapeOk(healthJson) };

    const index = await httpGet(port, '/');
    const indexAsset = /** @type {Asset} */ (store.assets.get('/index.html'));
    summary.index = {
      status: index.status,
      contentType: index.headers['content-type'] || null,
      bytes: index.body.length,
      matches: index.body.equals(indexAsset.body),
      csp: typeof index.headers['content-security-policy'] === 'string',
    };

    const ws = await wsProbe(port);
    summary.ws = { acceptOk: ws.accept, heartbeatShapeOk: heartbeatShapeOk(ws.heartbeat), seq: ws.heartbeat && ws.heartbeat.seq };

    summary.ok =
      mismatches.length === 0 &&
      health.status === 200 &&
      summary.health.shapeOk &&
      summary.health.launcherHeader === VERSION &&
      index.status === 200 &&
      summary.index.matches &&
      ws.accept &&
      summary.ws.heartbeatShapeOk;
  } catch (err) {
    summary.error = err instanceof Error ? err.message : String(err);
  }
  if (launcher) {
    launcher.closeClients();
    launcher.server.closeAllConnections();
    launcher.server.close();
  }
  clearTimeout(hard);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  process.exit(summary.ok ? 0 : 1);
}

// ---------------------------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------------------------

/** @param {string} message */
function fatal(message) {
  process.stderr.write(`\n ${PRODUCT}: ${message}\n`);
  if (process.stdin.isTTY) {
    process.stderr.write(' Press Enter to close.\n');
    process.stdin.resume();
    process.stdin.once('data', () => process.exit(1));
  } else {
    process.exit(1);
  }
}

/** @param {string[]} argv */
function parseArgs(argv) {
  /** @type {{ open: boolean, port: number | null, selfTest: boolean, version: boolean, help: boolean }} */
  const opts = { open: true, port: null, selfTest: false, version: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--no-open') opts.open = false;
    else if (a === '--self-test') opts.selfTest = true;
    else if (a === '--version' || a === '-v') opts.version = true;
    else if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--port' || a.startsWith('--port=')) {
      const v = a === '--port' ? argv[++i] : a.slice('--port='.length);
      const n = Number(v);
      if (!Number.isInteger(n) || n < 0 || n > 65535) throw new Error(`invalid --port value: ${String(v)}`);
      opts.port = n;
    } else throw new Error(`unknown option: ${a} (see --help)`);
  }
  return opts;
}

async function main() {
  /** @type {ReturnType<typeof parseArgs>} */
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    return fatal(err instanceof Error ? err.message : String(err));
  }
  if (opts.help) return void process.stdout.write(HELP);
  if (opts.version) return void process.stdout.write(`${versionLine()}\n`);
  if (opts.selfTest) return selfTest();

  /** @type {AssetStore} */
  let store;
  try {
    store = loadAssets();
  } catch (err) {
    return fatal(`the web files could not be loaded (${err instanceof Error ? err.message : String(err)}). Re-copy the package.`);
  }
  const launcher = createLauncherServer(store);
  /** @type {number} */
  let port = -1;

  if (opts.port !== null) {
    try {
      port = await listenOn(launcher.server, opts.port);
    } catch (err) {
      const code = /** @type {NodeJS.ErrnoException} */ (err).code;
      return fatal(code === 'EADDRINUSE' ? `port ${opts.port} is already in use. Close the other program or choose another --port.` : `cannot listen on port ${opts.port} (${code || String(err)}).`);
    }
  } else {
    for (const candidate of [DEFAULT_PORT, ...FALLBACK_PORTS, 0]) {
      try {
        port = await listenOn(launcher.server, candidate);
        break;
      } catch (err) {
        const code = /** @type {NodeJS.ErrnoException} */ (err).code;
        if (candidate !== 0 && code === 'EADDRINUSE' && (await probeLauncher(candidate))) {
          const url = `http://127.0.0.1:${candidate}/`;
          process.stdout.write(`\n ${PRODUCT} is already running: ${url}\n Sudah berjalan: ${url}\n`);
          if (opts.open) openBrowser(url);
          launcher.closeClients();
          return void setTimeout(() => process.exit(0), 300);
        }
        if (candidate === 0) return fatal(`cannot listen on 127.0.0.1 (${code || String(err)}).`);
      }
    }
  }
  launcher.setPort(port);
  const url = `http://127.0.0.1:${port}/`;
  process.stdout.write(banner(url));
  launcher.server.on('error', (err) => process.stderr.write(`[dems-web-launcher] server error: ${err.message}\n`));
  if (opts.open) openBrowser(url);

  let stopping = false;
  const stop = () => {
    if (stopping) process.exit(0); // second Ctrl+C: exit now
    stopping = true;
    process.stdout.write('\n Stopping... / Menghentikan...\n');
    setTimeout(() => process.exit(0), SHUTDOWN_TIMEOUT_MS).unref();
    launcher.closeClients();
    launcher.server.close(() => process.exit(0));
    // Browser keep-alive connections would hold close() open; idle ones go now, the rest
    // after the WS close frames are flushed.
    launcher.server.closeIdleConnections();
    setTimeout(() => launcher.server.closeAllConnections(), 200).unref();
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  process.on('SIGHUP', stop);
  if (process.platform === 'win32') process.on('SIGBREAK', stop);
}

module.exports = {
  BUILD_MARKER,
  VERSION,
  HEALTH_PATH,
  WS_PATH,
  HEARTBEAT_INTERVAL_MS,
  SERVICE_NAME,
  API_VERSION,
  DEFAULT_PORT,
  FALLBACK_PORTS,
  MAX_WS_CLIENTS,
  MAX_WS_PAYLOAD,
  cspHeader,
  securityHeaders,
  mimeFor,
};

if (seaModule() || require.main === module) {
  main().catch((err) => fatal(err instanceof Error ? err.message : String(err)));
}
