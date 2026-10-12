/*
 * The capture relay: the parts that read text and bytes and touch nothing else (relay.h has the whole picture;
 * task 4 blueprint row 41). No socket, no descriptor, no clock, no output: `make relay-unit` checks this file
 * alone (test/relay_unit_test.c). The library is used for three computations only: MD5, SHA-256, base64.
 *
 * Everything here reads data that came from OUTSIDE (the camera: a challenge, a description, RTP packets) or
 * from the Core (the start message). Every length is checked against a bound of relay.h before a byte is
 * copied, a value beyond its bound is a refusal, and no text of what was read is ever returned as a message.
 */
#include "relay.h"

#include <libavutil/base64.h>
#include <libavutil/md5.h>
#include <libavutil/mem.h>
#include <libavutil/sha.h>

#include <arpa/inet.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <strings.h>

const char *relay_code_name(RelayCode code) {
    switch (code) {
    case RELAY_STOPPED: return "STOPPED";
    case RELAY_STOP_ASKED: return "STOPPED";
    case RELAY_USAGE: return "USAGE";
    case RELAY_START_MESSAGE_INVALID: return "START_MESSAGE_INVALID";
    case RELAY_START_MESSAGE_TIMEOUT: return "START_MESSAGE_TIMEOUT";
    case RELAY_LIBAVFORMAT_VERSION_MISMATCH: return "LIBAVFORMAT_VERSION_MISMATCH";
    case RELAY_HYGIENE_FAILED: return "HYGIENE_FAILED";
    case RELAY_CAMERA_UNREACHABLE: return "CAMERA_UNREACHABLE";
    case RELAY_CAMERA_PROTOCOL: return "CAMERA_PROTOCOL";
    case RELAY_AUTH_SCHEME_NOT_ALLOWED: return "AUTH_SCHEME_NOT_ALLOWED";
    case RELAY_AUTH_REFUSED: return "AUTH_REFUSED";
    case RELAY_LOCATOR_NOT_FOUND: return "LOCATOR_NOT_FOUND";
    case RELAY_REDIRECT_REFUSED: return "REDIRECT_REFUSED";
    case RELAY_CONTROL_ADDRESS_REFUSED: return "CONTROL_ADDRESS_REFUSED";
    case RELAY_DESCRIPTION_INVALID: return "DESCRIPTION_INVALID";
    case RELAY_CODEC_NOT_SUPPORTED: return "CODEC_NOT_SUPPORTED";
    case RELAY_TRANSPORT_REFUSED: return "TRANSPORT_REFUSED";
    case RELAY_KEYFRAME_TIMEOUT: return "KEYFRAME_TIMEOUT";
    case RELAY_CAMERA_STALLED: return "CAMERA_STALLED";
    case RELAY_CAMERA_LOST: return "CAMERA_LOST";
    case RELAY_STREAM_INVALID: return "STREAM_INVALID";
    case RELAY_INGEST_REFUSED: return "INGEST_REFUSED";
    case RELAY_INGEST_LOST: return "INGEST_LOST";
    case RELAY_SOCKET_RULE: return "SOCKET_RULE";
    case RELAY_INTERNAL: break;
    }
    return "INTERNAL";
}

void relay_wipe(void *memory, size_t bytes) {
    volatile unsigned char *p = memory;
    while (bytes--) *p++ = 0;
}

/* ================================================================ the start message */
typedef struct Cursor { const char *p, *end; } Cursor;

static void blank(Cursor *c) {
    while (c->p < c->end && (*c->p == ' ' || *c->p == '\t' || *c->p == '\r' || *c->p == '\n')) c->p++;
}
static int sign(Cursor *c, char wanted) {
    blank(c);
    if (c->p < c->end && *c->p == wanted) { c->p++; return 1; }
    return 0;
}
static int hex4(Cursor *c, unsigned *out) {
    unsigned v = 0;
    if (c->end - c->p < 4) return -1;
    for (int i = 0; i < 4; i++) {
        char h = *c->p++;
        v <<= 4;
        if (h >= '0' && h <= '9') v |= (unsigned)(h - '0');
        else if (h >= 'a' && h <= 'f') v |= (unsigned)(h - 'a' + 10);
        else if (h >= 'A' && h <= 'F') v |= (unsigned)(h - 'A' + 10);
        else return -1;
    }
    *out = v;
    return 0;
}
/* One JSON string into `out` (at most cap - 1 bytes and a 0). A string that would hold a 0 byte is refused. */
static int text(Cursor *c, char *out, size_t cap) {
    size_t n = 0;
    if (!sign(c, '"')) return -1;
    for (;;) {
        if (c->p >= c->end) return -1;
        unsigned char ch = (unsigned char)*c->p++;
        unsigned point = ch;
        if (ch == '"') break;
        if (ch < 0x20) return -1;
        if (ch == '\\') {
            if (c->p >= c->end) return -1;
            char e = *c->p++;
            switch (e) {
            case '"': point = '"'; break;
            case '\\': point = '\\'; break;
            case '/': point = '/'; break;
            case 'b': point = 8; break;
            case 'f': point = 12; break;
            case 'n': point = 10; break;
            case 'r': point = 13; break;
            case 't': point = 9; break;
            case 'u': {
                unsigned low;
                if (hex4(c, &point)) return -1;
                if (point >= 0xDC00 && point <= 0xDFFF) return -1;
                if (point >= 0xD800 && point <= 0xDBFF) {
                    if (c->end - c->p < 2 || c->p[0] != '\\' || c->p[1] != 'u') return -1;
                    c->p += 2;
                    if (hex4(c, &low) || low < 0xDC00 || low > 0xDFFF) return -1;
                    point = 0x10000 + ((point - 0xD800) << 10) + (low - 0xDC00);
                }
                break;
            }
            default: return -1;
            }
            if (!point) return -1;
            if (point >= 0x80) {
                /* UTF-8 of an escaped character */
                unsigned char u[4];
                size_t k;
                if (point < 0x800) { u[0] = (unsigned char)(0xC0 | (point >> 6)); u[1] = (unsigned char)(0x80 | (point & 0x3F)); k = 2; }
                else if (point < 0x10000) { u[0] = (unsigned char)(0xE0 | (point >> 12)); u[1] = (unsigned char)(0x80 | ((point >> 6) & 0x3F)); u[2] = (unsigned char)(0x80 | (point & 0x3F)); k = 3; }
                else { u[0] = (unsigned char)(0xF0 | (point >> 18)); u[1] = (unsigned char)(0x80 | ((point >> 12) & 0x3F)); u[2] = (unsigned char)(0x80 | ((point >> 6) & 0x3F)); u[3] = (unsigned char)(0x80 | (point & 0x3F)); k = 4; }
                if (n + k >= cap) return -1;
                memcpy(out + n, u, k);
                n += k;
                continue;
            }
        }
        if (n + 1 >= cap) return -1;
        out[n++] = (char)point;
    }
    out[n] = 0;
    return (int)n;
}

/* The worker's own grammar of an ingest address (../capture_worker.c, parse_listen_url). */
static int ingest_ok(RelayStart *s) {
    static const char pre[] = "rtsp://127.0.0.1:";
    const char *u = s->ingest;
    if (strncmp(u, pre, sizeof pre - 1)) return 0;
    const char *digits = u + sizeof pre - 1;
    if (*digits < '1' || *digits > '9') return 0;
    char *end;
    long port = strtol(digits, &end, 10);
    if (port < RELAY_INGEST_PORT_MIN || port > RELAY_INGEST_PORT_MAX || *end != '/' || !end[1]) return 0;
    for (const char *q = end + 1; *q; q++) {
        int ok = (*q >= 'A' && *q <= 'Z') || (*q >= 'a' && *q <= 'z') || (*q >= '0' && *q <= '9') || *q == '.' || *q == '_' || *q == '~' || *q == '-';
        if (*q == '/') { if (q[-1] == '/' || !q[1]) return 0; }
        else if (!ok) return 0;
    }
    s->ingest_port = (int)port;
    return 1;
}

static int port_of(const char **at, int *port) {
    const char *q = *at;
    long v = 0;
    int digits = 0;
    if (*q < '1' || *q > '9') return -1;
    while (*q >= '0' && *q <= '9' && digits < 6) { v = v * 10 + (*q - '0'); q++; digits++; }
    if (digits > 5 || v < 1 || v > 65535) return -1;
    *at = q;
    *port = (int)v;
    return 0;
}

static int printable(const char *s) {
    for (; *s; s++) {
        unsigned char ch = (unsigned char)*s;
        if (ch <= 0x20 || ch >= 0x7F || ch == '"' || ch == '\\') return 0;
    }
    return 1;
}

/* rtsp://<IPv4 in digits>[:port]/path. No name (a name would need a resolver: a datagram socket and files, RC-6),
 * no user part (the account is never part of an address in this program), no other scheme. */
static int locator_ok(RelayStart *s) {
    const char *u = s->locator;
    if (strncmp(u, "rtsp://", 7)) return 0;
    const char *h = u + 7;
    size_t n = strspn(h, "0123456789.");
    struct in_addr address;
    if (!n || n >= sizeof s->host) return 0;
    memcpy(s->host, h, n);
    s->host[n] = 0;
    if (inet_pton(AF_INET, s->host, &address) != 1) return 0;
    const char *q = h + n;
    s->port = 554;
    if (*q == ':') { q++; if (port_of(&q, &s->port)) return 0; }
    if (*q != '/') return 0;
    return printable(q);
}

RelayCode relay_start_parse(const char *line, size_t length, RelayStart *out) {
    char key[16], word[16];
    int seen = 0, inner = 0;
    memset(out, 0, sizeof *out);
    if (!line || length < 2 || length > RELAY_LINE_MAX || line[length - 1] != '\n') return RELAY_START_MESSAGE_INVALID;
    Cursor c = { line, line + length - 1 };
    if (!sign(&c, '{')) goto refused;
    for (;;) {
        int bit;
        if (text(&c, key, sizeof key) < 0 || !sign(&c, ':')) goto refused;
        if (!strcmp(key, "type")) { bit = 1; if (text(&c, word, sizeof word) < 0 || strcmp(word, "start")) goto refused; }
        else if (!strcmp(key, "mode")) { bit = 2; if (text(&c, word, sizeof word) < 0 || strcmp(word, "record")) goto refused; }
        else if (!strcmp(key, "ingest")) { bit = 4; if (text(&c, out->ingest, sizeof out->ingest) < 0) goto refused; }
        else if (!strcmp(key, "access")) {
            bit = 8;
            if (!sign(&c, '{')) goto refused;
            for (;;) {
                int part;
                if (text(&c, key, sizeof key) < 0 || !sign(&c, ':')) goto refused;
                if (!strcmp(key, "locator")) { part = 1; if (text(&c, out->locator, sizeof out->locator) < 0) goto refused; }
                else if (!strcmp(key, "username")) { part = 2; if (text(&c, out->account, sizeof out->account) < 1) goto refused; }
                else if (!strcmp(key, "secret")) { part = 4; if (text(&c, out->secret, sizeof out->secret) < 0) goto refused; }
                else goto refused;
                if (inner & part) goto refused;
                inner |= part;
                if (sign(&c, ',')) continue;
                if (sign(&c, '}')) break;
                goto refused;
            }
        }
        else goto refused;
        if (seen & bit) goto refused;
        seen |= bit;
        if (sign(&c, ',')) continue;
        if (sign(&c, '}')) break;
        goto refused;
    }
    blank(&c);
    if (c.p != c.end || seen != 15 || inner != 7) goto refused;
    if (!ingest_ok(out) || !locator_ok(out)) goto refused;
    /* The account name is written into a header: no control character may be in it. The password is only hashed. */
    for (const char *a = out->account; *a; a++) if ((unsigned char)*a < 0x20 || *a == 0x7F) goto refused;
    relay_wipe(key, sizeof key);
    return RELAY_STOPPED;
refused:
    relay_wipe(out, sizeof *out);
    relay_wipe(key, sizeof key);
    return RELAY_START_MESSAGE_INVALID;
}

const char *relay_same_authority(const char *address, const char *host, int port) {
    if (!address || strncmp(address, "rtsp://", 7)) return NULL;
    const char *h = address + 7;
    size_t n = strlen(host);
    int named = 554;
    if (!n || strncmp(h, host, n)) return NULL;
    const char *q = h + n;
    if (*q == ':') { q++; if (port_of(&q, &named)) return NULL; }
    if (*q && *q != '/') return NULL;
    return named == port ? q : NULL;
}

RelayCode relay_control_address(const RelayStart *start, const char *base, const char *control, char *out, size_t cap) {
    const char *b = base && *base ? base : start->locator;
    const char *path = relay_same_authority(b, start->host, start->port);
    int n;
    if (!path) return RELAY_CONTROL_ADDRESS_REFUSED;
    if (!control || !*control || !strcmp(control, "*")) n = snprintf(out, cap, "%s", b);
    else if (strstr(control, "://")) {
        if (!relay_same_authority(control, start->host, start->port)) return RELAY_CONTROL_ADDRESS_REFUSED;
        n = snprintf(out, cap, "%s", control);
    }
    else if (control[0] == '/') n = snprintf(out, cap, "%.*s%s", (int)(path - b), b, control);
    else {
        size_t length = strlen(b);
        n = snprintf(out, cap, "%s%s%s", b, length && b[length - 1] == '/' ? "" : "/", control);
    }
    if (n <= 0 || (size_t)n >= cap || !printable(out)) return RELAY_CONTROL_ADDRESS_REFUSED;
    return RELAY_STOPPED;
}

/* ================================================================ Digest */
static int listed(const char *list, const char *word) {
    size_t n = strlen(word);
    for (const char *p = list; *p;) {
        while (*p == ' ' || *p == ',' || *p == '\t') p++;
        const char *e = p;
        while (*e && *e != ' ' && *e != ',' && *e != '\t') e++;
        if ((size_t)(e - p) == n && !strncasecmp(p, word, n)) return 1;
        p = e;
    }
    return 0;
}

int relay_challenge_parse(const char *v, DigestChallenge *out) {
    int have_realm = 0, have_nonce = 0, have_qop = 0, unanswerable = 0, seen = 0;
    memset(out, 0, sizeof *out);
    if (!v) return -1;
    while (*v == ' ' || *v == '\t') v++;
    if (strncasecmp(v, "Digest", 6) || (v[6] != ' ' && v[6] != '\t')) return 0;
    v += 6;
    out->hash = DIGEST_HASH_MD5;                    /* a challenge that names no hash is MD5 (RFC 7616) */
    for (;;) {
        char name[32], value[RELAY_FIELD_CHARS + 1];
        size_t n = 0, m = 0;
        while (*v == ' ' || *v == '\t' || *v == ',') v++;
        if (!*v) break;
        while (*v && *v != '=' && *v != ' ' && *v != '\t' && *v != ',') { if (n + 1 >= sizeof name) return -1; name[n++] = *v++; }
        name[n] = 0;
        while (*v == ' ' || *v == '\t') v++;
        if (*v != '=') return -1;
        v++;
        while (*v == ' ' || *v == '\t') v++;
        if (*v == '"') {
            v++;
            while (*v && *v != '"') {
                if (*v == '\\' && v[1]) v++;
                if ((unsigned char)*v < 0x20 || *v == 0x7F || m >= RELAY_FIELD_CHARS) return -1;
                value[m++] = *v++;
            }
            if (*v != '"') return -1;
            v++;
        } else {
            while (*v && *v != ',' && *v != ' ' && *v != '\t') {
                if ((unsigned char)*v < 0x20 || *v == 0x7F || m >= RELAY_FIELD_CHARS) return -1;
                value[m++] = *v++;
            }
        }
        value[m] = 0;
        /* A parameter the relay reads may stand ONCE (RFC 7616, 3.3): of two realms or two nonces the relay would
         * otherwise answer the one the camera wrote last. */
        int bit = !strcasecmp(name, "realm") ? 1 : !strcasecmp(name, "nonce") ? 2 : !strcasecmp(name, "opaque") ? 4
                  : !strcasecmp(name, "stale") ? 8 : !strcasecmp(name, "algorithm") ? 16 : !strcasecmp(name, "qop") ? 32 : 0;
        if (seen & bit) return -1;
        seen |= bit;
        if (bit == 1) { memcpy(out->realm, value, m + 1); have_realm = 1; }
        else if (bit == 2) { memcpy(out->nonce, value, m + 1); have_nonce = 1; }
        else if (bit == 4) { memcpy(out->opaque, value, m + 1); out->has_opaque = 1; }
        else if (bit == 8) out->stale = !strcasecmp(value, "true");
        else if (bit == 16) {
            if (!strcasecmp(value, "MD5")) out->hash = DIGEST_HASH_MD5;
            else if (!strcasecmp(value, "SHA-256")) out->hash = DIGEST_HASH_SHA256;
            else unanswerable = 1;              /* a session variant would need the password again and again */
        }
        else if (bit == 32) { have_qop = 1; out->qop_auth = listed(value, "auth"); }
    }
    if (!have_realm || !have_nonce || !out->nonce[0]) return -1;
    if (unanswerable || (have_qop && !out->qop_auth)) return 0;
    return 1;
}

typedef struct Hasher { DigestHash hash; struct AVMD5 *md5; struct AVSHA *sha; } Hasher;

static int hasher_open(Hasher *h, DigestHash hash) {
    h->hash = hash;
    h->md5 = NULL;
    h->sha = NULL;
    if (hash == DIGEST_HASH_MD5) { if (!(h->md5 = av_md5_alloc())) return -1; av_md5_init(h->md5); return 0; }
    if (hash == DIGEST_HASH_SHA256) { if (!(h->sha = av_sha_alloc())) return -1; return av_sha_init(h->sha, 256); }
    return -1;
}
static void hasher_add(Hasher *h, const char *s) {
    size_t n = strlen(s);
    if (h->md5) av_md5_update(h->md5, (const uint8_t *)s, n);
    else av_sha_update(h->sha, (const uint8_t *)s, n);
}
/* The digest in lower-case hexadecimal; the context, which may hold a tail of what was hashed, is overwritten. */
static void hasher_close(Hasher *h, char out[65]) {
    static const char hex[] = "0123456789abcdef";
    uint8_t digest[32];
    int n = h->md5 ? 16 : 32;
    if (h->md5) { av_md5_final(h->md5, digest); relay_wipe(h->md5, (size_t)av_md5_size); av_freep(&h->md5); }
    else { av_sha_final(h->sha, digest); relay_wipe(h->sha, (size_t)av_sha_size); av_freep(&h->sha); }
    for (int i = 0; i < n; i++) { out[2 * i] = hex[digest[i] >> 4]; out[2 * i + 1] = hex[digest[i] & 15]; }
    out[2 * n] = 0;
    relay_wipe(digest, sizeof digest);
}

int relay_digest_key(DigestHash hash, const char *account, const char *realm, const char *secret, DigestKey *out) {
    Hasher h;
    memset(out, 0, sizeof *out);
    if (strlen(realm) > RELAY_FIELD_CHARS || hasher_open(&h, hash)) return -1;
    hasher_add(&h, account);
    hasher_add(&h, ":");
    hasher_add(&h, realm);
    hasher_add(&h, ":");
    hasher_add(&h, secret);
    hasher_close(&h, out->ha1);
    out->hash = hash;
    memcpy(out->realm, realm, strlen(realm) + 1);
    return 0;
}

/* `s` inside double quotes: a quote and a backslash are escaped. */
static int quoted(char *out, size_t cap, size_t *at, const char *s) {
    size_t n = *at;
    for (; *s; s++) {
        if (*s == '"' || *s == '\\') { if (n + 1 >= cap) return -1; out[n++] = '\\'; }
        if (n + 1 >= cap) return -1;
        out[n++] = *s;
    }
    out[n] = 0;
    *at = n;
    return 0;
}
static int plain(char *out, size_t cap, size_t *at, const char *s) {
    size_t n = strlen(s);
    if (*at + n + 1 > cap) return -1;
    memcpy(out + *at, s, n + 1);
    *at += n;
    return 0;
}

int relay_digest_answer(const DigestKey *key, const char *account, const DigestChallenge *challenge, const char *method,
                        const char *address, unsigned count, const char *client_nonce, char *out, size_t cap) {
    Hasher h;
    char ha2[65], response[65], nc[16];
    size_t at = 0;
    if (key->hash != challenge->hash || strcmp(key->realm, challenge->realm)) return -1;
    if (hasher_open(&h, key->hash)) return -1;
    hasher_add(&h, method);
    hasher_add(&h, ":");
    hasher_add(&h, address);
    hasher_close(&h, ha2);
    snprintf(nc, sizeof nc, "%08x", count);
    if (hasher_open(&h, key->hash)) return -1;
    hasher_add(&h, key->ha1);
    hasher_add(&h, ":");
    hasher_add(&h, challenge->nonce);
    hasher_add(&h, ":");
    if (challenge->qop_auth) {
        hasher_add(&h, nc);
        hasher_add(&h, ":");
        hasher_add(&h, client_nonce);
        hasher_add(&h, ":auth:");
    }
    hasher_add(&h, ha2);
    hasher_close(&h, response);
    if (plain(out, cap, &at, "Digest username=\"") || quoted(out, cap, &at, account)
        || plain(out, cap, &at, "\", realm=\"") || quoted(out, cap, &at, challenge->realm)
        || plain(out, cap, &at, "\", nonce=\"") || quoted(out, cap, &at, challenge->nonce)
        || plain(out, cap, &at, "\", uri=\"") || quoted(out, cap, &at, address)
        || plain(out, cap, &at, "\", response=\"") || plain(out, cap, &at, response) || plain(out, cap, &at, "\"")) return -1;
    if (key->hash == DIGEST_HASH_SHA256 && plain(out, cap, &at, ", algorithm=SHA-256")) return -1;
    if (challenge->has_opaque && (plain(out, cap, &at, ", opaque=\"") || quoted(out, cap, &at, challenge->opaque) || plain(out, cap, &at, "\""))) return -1;
    if (challenge->qop_auth && (plain(out, cap, &at, ", qop=auth, nc=") || plain(out, cap, &at, nc)
                                || plain(out, cap, &at, ", cnonce=\"") || quoted(out, cap, &at, client_nonce) || plain(out, cap, &at, "\""))) return -1;
    return 0;
}

/* ================================================================ the stream description */
int relay_sets_complete(RelayCodec codec, const ParamSets *sets) {
    if (codec == RELAY_CODEC_H264) return sets->sps_len > 0 && sets->pps_len > 0;
    if (codec == RELAY_CODEC_HEVC) return sets->vps_len > 0 && sets->sps_len > 0 && sets->pps_len > 0;
    return 0;
}

typedef struct Line { const char *p; size_t n; } Line;

static int begins(Line l, const char *word) {
    size_t n = strlen(word);
    return l.n >= n && !strncasecmp(l.p, word, n);
}

int relay_set_valid(RelayCodec codec, int kind, const uint8_t *unit, size_t length) {
    if (!unit || kind < 0 || kind > 2 || length > RELAY_PSET_MAX) return 0;
    if (codec == RELAY_CODEC_H264) {
        /* one header byte: forbidden bit, importance, type; an SPS holds at least profile, flags and level after it */
        if (kind == 0 || length < (kind == 1 ? 4u : 2u) || (unit[0] & 0x80)) return 0;
        return (unit[0] & 0x1F) == (kind == 1 ? 7 : 8);
    }
    if (codec == RELAY_CODEC_HEVC) {
        /* two header bytes: forbidden bit, type, layer, temporal identifier (never 0) */
        if (length < 3 || (unit[0] & 0x80) || !(unit[1] & 0x07)) return 0;
        return ((unit[0] >> 1) & 0x3F) == 32 + kind;
    }
    return 0;
}

int relay_sets_valid(RelayCodec codec, const ParamSets *sets) {
    if (!relay_sets_complete(codec, sets)) return 0;
    if (codec == RELAY_CODEC_HEVC && !relay_set_valid(codec, 0, sets->vps, (size_t)sets->vps_len)) return 0;
    return relay_set_valid(codec, 1, sets->sps, (size_t)sets->sps_len) && relay_set_valid(codec, 2, sets->pps, (size_t)sets->pps_len);
}

/* One base64 value of `n` characters into a parameter set. The bytes it holds; 0 when it is empty or not
 * readable (the set is then not taken: it must come in the stream); -1 when it is beyond the bound of a
 * parameter set (the description is refused: a value beyond its bound is never cut, relay.h). */
static int decoded(const char *p, size_t n, uint8_t *out) {
    char copy[RELAY_PSET_MAX * 2];
    uint8_t raw[RELAY_PSET_MAX + 3];
    if (!n) return 0;
    if (n >= sizeof copy) return -1;
    memcpy(copy, p, n);
    copy[n] = 0;
    int got = av_base64_decode(raw, copy, (int)sizeof raw);
    if (got > RELAY_PSET_MAX) return -1;
    if (got <= 0) return 0;
    memcpy(out, raw, (size_t)got);
    return got;
}

/* The parameter sets of one `a=fmtp` line. A set is taken only when it is valid for its kind (relay_set_valid);
 * -1 when one is beyond the bound. */
static int sets_of_fmtp(RelayCodec codec, const char *p, size_t n, ParamSets *sets) {
    const char *end = p + n;
    while (p < end) {
        const char *stop = memchr(p, ';', (size_t)(end - p));
        const char *item_end = stop ? stop : end;
        while (p < item_end && (*p == ' ' || *p == '\t')) p++;
        const char *eq = memchr(p, '=', (size_t)(item_end - p));
        if (eq) {
            size_t name = (size_t)(eq - p);
            const char *v = eq + 1;
            const char *v_end = item_end;
            while (v_end > v && (v_end[-1] == ' ' || v_end[-1] == '\t')) v_end--;
            if (codec == RELAY_CODEC_H264 && name == 20 && !strncasecmp(p, "sprop-parameter-sets", 20)) {
                while (v < v_end) {
                    const char *comma = memchr(v, ',', (size_t)(v_end - v));
                    const char *e = comma ? comma : v_end;
                    uint8_t one[RELAY_PSET_MAX];
                    int got = decoded(v, (size_t)(e - v), one);
                    if (got < 0) return -1;
                    if (!sets->sps_len && relay_set_valid(codec, 1, one, (size_t)got)) { memcpy(sets->sps, one, (size_t)got); sets->sps_len = got; }
                    else if (!sets->pps_len && relay_set_valid(codec, 2, one, (size_t)got)) { memcpy(sets->pps, one, (size_t)got); sets->pps_len = got; }
                    v = comma ? comma + 1 : v_end;
                }
            } else if (codec == RELAY_CODEC_HEVC && name == 9 && !strncasecmp(p, "sprop-", 6)) {
                const char *comma = memchr(v, ',', (size_t)(v_end - v));
                size_t length = (size_t)((comma ? comma : v_end) - v);
                int kind = !strncasecmp(p + 6, "vps", 3) ? 0 : !strncasecmp(p + 6, "sps", 3) ? 1 : !strncasecmp(p + 6, "pps", 3) ? 2 : -1;
                if (kind >= 0) {
                    uint8_t one[RELAY_PSET_MAX];
                    uint8_t *to = kind == 0 ? sets->vps : kind == 1 ? sets->sps : sets->pps;
                    int *to_len = kind == 0 ? &sets->vps_len : kind == 1 ? &sets->sps_len : &sets->pps_len;
                    int got = decoded(v, length, one);
                    if (got < 0) return -1;
                    if (!*to_len && relay_set_valid(codec, kind, one, (size_t)got)) { memcpy(to, one, (size_t)got); *to_len = got; }
                }
            }
        }
        p = stop ? stop + 1 : end;
    }
    return 0;
}

RelayCode relay_description_parse(const char *textp, size_t length, RelayDescription *out) {
    /* Beyond either bound the description is REFUSED, not cut (review M-6): a cut one would be read differently
     * here and by whoever reads it whole. */
    enum { LINES = RELAY_SDP_LINES, TYPES = RELAY_SDP_TYPES };
    Line video[LINES];
    int types[TYPES], n_types = 0, n_video = 0, section = 0;
    memset(out, 0, sizeof *out);
    if (!textp || !length || length > RELAY_SDP_MAX || memchr(textp, 0, length)) return RELAY_DESCRIPTION_INVALID;
    for (const char *p = textp, *end = textp + length; p < end;) {
        const char *nl = memchr(p, '\n', (size_t)(end - p));
        Line l = { p, (size_t)((nl ? nl : end) - p) };
        if (l.n && l.p[l.n - 1] == '\r') l.n--;
        p = nl ? nl + 1 : end;
        if (begins(l, "m=")) {
            if (section == 0 && begins(l, "m=video ")) {
                /* m=video <port> <protocol> <payload type> ... */
                const char *q = l.p + 8, *stop = l.p + l.n;
                int word = 0;
                section = 1;
                while (q < stop) {
                    while (q < stop && *q == ' ') q++;
                    const char *e = q;
                    while (e < stop && *e != ' ') e++;
                    if (e > q && ++word >= 3) {
                        int v = 0, digits = 0;
                        if (n_types >= TYPES) return RELAY_DESCRIPTION_INVALID;
                        for (const char *d = q; d < e && *d >= '0' && *d <= '9' && digits < 4; d++, digits++) v = v * 10 + (*d - '0');
                        if (digits == e - q && v <= 127) types[n_types++] = v;
                    }
                    q = e;
                }
            } else if (section == 1) section = 2;           /* the first video section only */
            continue;
        }
        if (section == 1) {
            if (n_video >= LINES) return RELAY_DESCRIPTION_INVALID;
            video[n_video++] = l;
        }
    }
    if (section == 0) return RELAY_DESCRIPTION_INVALID;
    for (int t = 0; t < n_types && !out->codec; t++) {
        char head[24];
        int n = snprintf(head, sizeof head, "a=rtpmap:%d ", types[t]);
        for (int i = 0; i < n_video; i++) {
            if (!begins(video[i], head)) continue;
            Line name = { video[i].p + n, video[i].n - (size_t)n };
            if (begins(name, "H264/90000")) out->codec = RELAY_CODEC_H264;
            else if (begins(name, "H265/90000") || begins(name, "HEVC/90000")) out->codec = RELAY_CODEC_HEVC;
            if (out->codec) { out->payload_type = types[t]; break; }
        }
    }
    if (!out->codec) return RELAY_CODEC_NOT_SUPPORTED;
    {
        char head[24];
        int n = snprintf(head, sizeof head, "a=fmtp:%d ", out->payload_type);
        for (int i = 0; i < n_video; i++) {
            if (begins(video[i], head)) {
                if (sets_of_fmtp(out->codec, video[i].p + n, video[i].n - (size_t)n, &out->sets)) return RELAY_DESCRIPTION_INVALID;
            }
            else if (begins(video[i], "a=control:")) {
                size_t c = video[i].n - 10;
                if (c > RELAY_LOCATOR_CHARS) return RELAY_DESCRIPTION_INVALID;
                memcpy(out->control, video[i].p + 10, c);
                out->control[c] = 0;
            }
        }
    }
    return RELAY_STOPPED;
}

/* ================================================================ pictures out of RTP (RFC 6184, RFC 7798) */
int relay_picture_init(RelayPicture *p, RelayCodec codec, int payload_type) {
    memset(p, 0, sizeof *p);
    p->codec = codec;
    p->payload_type = payload_type;
    p->cap = 256 * 1024;
    p->unit = malloc(p->cap);
    return p->unit ? 0 : -1;
}

void relay_picture_free(RelayPicture *p) {
    free(p->unit);
    p->unit = NULL;
    p->cap = p->length = 0;
}

void relay_picture_taken(RelayPicture *p) {
    p->length = 0;
    p->units = 0;
    p->keyframe = p->damaged = p->open_fragment = 0;
}

/* A picture that is not handed on: counted, so that the caller holds back what leans on it. */
static void discard(RelayPicture *p) {
    if (p->length || p->damaged) p->dropped++;
    relay_picture_taken(p);
}

/* Something that is not a unit of the codec came in the place of one (review M-2): counted, the picture is lost. */
static int refuse(RelayPicture *p) {
    p->refused++;
    p->damaged = 1;
    p->open_fragment = 0;
    return 0;
}

/* Is `type` the type of ONE unit of the codec? Not the forms that only RTP knows (several units in one packet,
 * fragments, the reserved numbers), and not H.264's 0. A fragment or a packet of several units that names such
 * a type inside would otherwise become a unit header of the relay's own making. */
static int unit_type(RelayCodec codec, int type) {
    return codec == RELAY_CODEC_H264 ? type >= 1 && type <= 23 : type >= 0 && type <= 47;
}

/* The picture is whole. It is handed on only if it holds exactly the units the relay wrote: a start code INSIDE
 * a unit would be read as one more unit by everything after the relay, a unit the relay never looked at. */
static int sound(RelayPicture *p) {
    long codes = 0;
    for (const uint8_t *q = p->unit + 2, *end = p->unit + p->length; p->length > 2 && q < end && (q = memchr(q, 1, (size_t)(end - q))); q++)
        if (!q[-1] && !q[-2]) codes++;
    if (codes == p->units) return 1;
    p->refused++;
    return 0;
}

static int more(RelayPicture *p, const uint8_t *data, size_t n) {
    if (n > RELAY_UNIT_MAX || p->length + n > RELAY_UNIT_MAX) return -1;
    if (p->length + n > p->cap) {
        size_t cap = p->cap;
        while (cap < p->length + n) cap *= 2;
        uint8_t *grown = realloc(p->unit, cap);
        if (!grown) return -1;
        p->unit = grown;
        p->cap = cap;
    }
    memcpy(p->unit + p->length, data, n);
    p->length += n;
    return 0;
}

/* A parameter set of the stream is kept only when it is valid for its kind (review M-1: the library's stream
 * parser reads what is kept here). */
static void keep(RelayPicture *p, int kind, uint8_t *set, int *length, const uint8_t *unit, size_t n) {
    if (relay_set_valid(p->codec, kind, unit, n)) { memcpy(set, unit, n); *length = (int)n; }
}

/* What a whole unit is: a keyframe slice, a parameter set (kept), or neither. */
static void note(RelayPicture *p, int type, const uint8_t *unit, size_t n) {
    if (p->codec == RELAY_CODEC_H264) {
        if (type == 5) p->keyframe = 1;
        else if (type == 7 && unit) keep(p, 1, p->seen.sps, &p->seen.sps_len, unit, n);
        else if (type == 8 && unit) keep(p, 2, p->seen.pps, &p->seen.pps_len, unit, n);
    } else {
        if (type >= 16 && type <= 21) p->keyframe = 1;
        else if (type == 32 && unit) keep(p, 0, p->seen.vps, &p->seen.vps_len, unit, n);
        else if (type == 33 && unit) keep(p, 1, p->seen.sps, &p->seen.sps_len, unit, n);
        else if (type == 34 && unit) keep(p, 2, p->seen.pps, &p->seen.pps_len, unit, n);
    }
}

/* A start code of the relay's own, counted (sound). */
static int begin_unit(RelayPicture *p) {
    static const uint8_t start[4] = { 0, 0, 0, 1 };
    if (more(p, start, 4)) return -1;
    p->units++;
    return 0;
}

static int whole_unit(RelayPicture *p, const uint8_t *unit, size_t n) {
    size_t head = p->codec == RELAY_CODEC_H264 ? 1 : 2;
    int type;
    if (n < head) return 0;
    type = p->codec == RELAY_CODEC_H264 ? unit[0] & 0x1F : (unit[0] >> 1) & 0x3F;
    if ((unit[0] & 0x80) || !unit_type(p->codec, type)) return refuse(p);
    note(p, type, unit, n);
    return begin_unit(p) || more(p, unit, n) ? -1 : 0;
}

/* Units that travel together in one packet: a 16-bit length before each. */
static int several(RelayPicture *p, const uint8_t *d, size_t n) {
    while (n >= 2) {
        size_t one = ((size_t)d[0] << 8) | d[1];
        d += 2;
        n -= 2;
        if (!one || one > n) { p->damaged = 1; return 0; }
        if (whole_unit(p, d, one)) return -1;
        d += one;
        n -= one;
    }
    return 0;
}

/* A unit begins while a fragmented one has not ended: that one is cut short, the picture is not handed on. */
static void cut(RelayPicture *p) {
    if (p->open_fragment) { p->damaged = 1; p->open_fragment = 0; }
}

static int payload(RelayPicture *p, const uint8_t *d, size_t n) {
    /* The forbidden bit of the packet's own header: it would be copied into the header of a rebuilt unit. */
    if (d[0] & 0x80) return refuse(p);
    if (p->codec == RELAY_CODEC_H264) {
        int type = d[0] & 0x1F;
        if (type >= 1 && type <= 23) { cut(p); return whole_unit(p, d, n); }
        if (type == 24) { cut(p); return several(p, d + 1, n - 1); }
        if (type == 28 && n >= 2) {
            int first = d[1] & 0x80, last = d[1] & 0x40, inner = d[1] & 0x1F;
            uint8_t head = (uint8_t)((d[0] & 0x60) | inner);
            if (!unit_type(p->codec, inner)) return refuse(p);
            if (first) {
                cut(p);
                note(p, inner, NULL, 0);
                if (begin_unit(p) || more(p, &head, 1)) return -1;
                p->open_fragment = 1;
            } else if (!p->open_fragment) { p->damaged = 1; return 0; }
            if (more(p, d + 2, n - 2)) return -1;
            if (last) p->open_fragment = 0;
            return 0;
        }
    } else {
        int type = (d[0] >> 1) & 0x3F;
        if (n < 2) { p->damaged = 1; return 0; }
        if (type < 48) { cut(p); return whole_unit(p, d, n); }
        if (type == 48) { cut(p); return several(p, d + 2, n - 2); }
        if (type == 49 && n >= 3) {
            int first = d[2] & 0x80, last = d[2] & 0x40, inner = d[2] & 0x3F;
            uint8_t head[2] = { (uint8_t)((d[0] & 0x01) | (inner << 1)), d[1] };
            if (!unit_type(p->codec, inner)) return refuse(p);
            if (first) {
                cut(p);
                note(p, inner, NULL, 0);
                if (begin_unit(p) || more(p, head, 2)) return -1;
                p->open_fragment = 1;
            } else if (!p->open_fragment) { p->damaged = 1; return 0; }
            if (more(p, d + 3, n - 3)) return -1;
            if (last) p->open_fragment = 0;
            return 0;
        }
    }
    /* A form of packet this relay does not take (interleaved modes, a reserved type): the picture is not forwarded. */
    p->unsupported++;
    p->damaged = 1;
    return 0;
}

int relay_picture_add(RelayPicture *p, const uint8_t *k, size_t n) {
    if (n < 12 || (k[0] >> 6) != 2) return -(int)RELAY_STREAM_INVALID;
    int padded = k[0] & 0x20, extended = k[0] & 0x10, sources = k[0] & 0x0F, marker = k[1] >> 7, type = k[1] & 0x7F;
    uint16_t sequence = (uint16_t)((k[2] << 8) | k[3]);
    uint32_t stamp = ((uint32_t)k[4] << 24) | ((uint32_t)k[5] << 16) | ((uint32_t)k[6] << 8) | k[7];
    size_t at = 12 + 4 * (size_t)sources;
    if (at > n) return -(int)RELAY_STREAM_INVALID;
    if (extended) {
        if (at + 4 > n) return -(int)RELAY_STREAM_INVALID;
        at += 4 + 4 * (((size_t)k[at + 2] << 8) | k[at + 3]);
        if (at > n) return -(int)RELAY_STREAM_INVALID;
    }
    if (padded) {
        if (n <= at || !k[n - 1] || k[n - 1] > n - at) return -(int)RELAY_STREAM_INVALID;
        n -= k[n - 1];
    }
    if (type != p->payload_type) { p->foreign++; return 0; }
    /* A picture that ended without its mark: the next stamp ends it. The packet is given again by the caller. */
    if ((p->length || p->damaged) && stamp != p->stamp) {
        if (p->length && !p->damaged && !p->open_fragment && sound(p)) return 2;
        discard(p);
    }
    if (p->have_sequence && sequence != (uint16_t)(p->sequence + 1)) { p->gaps++; p->damaged = 1; p->open_fragment = 0; }
    p->have_sequence = 1;
    p->sequence = sequence;
    p->stamp = stamp;
    if (n > at && payload(p, k + at, n - at)) return -(int)RELAY_STREAM_INVALID;
    if (!marker) return 0;
    if (p->damaged || p->open_fragment || !p->length || !sound(p)) { discard(p); return 0; }
    return 1;
}

int relay_step_plausible(int64_t step_ticks, int64_t since_last_us, int64_t total_ticks, int64_t since_first_us) {
    /* 90,000 ticks a second: 9 ticks in 100 microseconds. A clock of this host that stood still counts as 0. */
    int64_t last = since_last_us > 0 ? since_last_us / 100 * 9 : 0, first = since_first_us > 0 ? since_first_us / 100 * 9 : 0;
    if (step_ticks > last + RELAY_STEP_TICKS) return 0;
    return total_ticks <= first + first / 100 + RELAY_STEP_TICKS;
}

/* ================================================================ what the camera sends on the RTSP connection */
/* The value of a header line that begins with `name` (and a colon), blanks removed; NULL when it is another. */
static const char *value_of(char *line, const char *name) {
    size_t n = strlen(name);
    if (strncasecmp(line, name, n) || line[n] != ':') return NULL;
    line += n + 1;
    while (*line == ' ' || *line == '\t') line++;
    return line;
}

/* A number written in digits, at most `most` of them, with nothing but blanks after it; -1 otherwise. */
static long number_of(const char *v, int most) {
    long n = 0;
    int digits = 0;
    while (*v >= '0' && *v <= '9') { if (++digits > most) return -1; n = n * 10 + (*v++ - '0'); }
    while (*v == ' ' || *v == '\t') v++;
    return digits && !*v ? n : -1;
}

/* A channel number at *at: one to three digits (0 to 999), and *at moves past them; -1 otherwise. */
static int channel_of(const char **at) {
    const char *v = *at;
    int n = 0, digits = 0;
    while (*v >= '0' && *v <= '9' && digits < 4) { n = n * 10 + (*v++ - '0'); digits++; }
    if (!digits || digits > 3) return -1;
    *at = v;
    return n;
}

long relay_head_parse(char *head, size_t n, RelayAnswer *a) {
    long body = 0;
    int first = 1, lengths = 0;
    memset(a, 0, sizeof *a);
    a->cseq = -1;
    /* A 0 byte would end a line early for every reader below: the head is refused, not read to that byte. */
    if (!head || n < 4 || n > RELAY_HEAD_MAX || memchr(head, 0, n)) return -1;
    for (char *line = head, *end = head + n; line < end;) {
        char *stop = memchr(line, '\n', (size_t)(end - line));
        if (!stop) break;
        if (stop > line && stop[-1] == '\r') stop[-1] = 0;
        *stop = 0;
        const char *v;
        if (first) {
            /* An answer, `RTSP/1.0 <three digits>`, or a request of the camera, `<METHOD> <address> RTSP/1.0`. */
            size_t length = strlen(line);
            first = 0;
            if (!strncmp(line, "RTSP/1.0 ", 9)) {
                if (!(line[9] >= '1' && line[9] <= '5' && line[10] >= '0' && line[10] <= '9' && line[11] >= '0' && line[11] <= '9' && (line[12] == ' ' || !line[12]))) return -1;
                a->status = (line[9] - '0') * 100 + (line[10] - '0') * 10 + (line[11] - '0');
            } else if (!(length > 10 && line[0] >= 'A' && line[0] <= 'Z' && !strcmp(line + length - 9, " RTSP/1.0"))) return -1;
        }
        else if ((v = value_of(line, "CSeq"))) a->cseq = number_of(v, 9);
        else if ((v = value_of(line, "Content-Length"))) {
            /* Stated once, in digits, inside the bound: of two statements another reader could take the other. */
            if (lengths++) return -1;
            body = number_of(v, 6);
            if (body < 0 || body > RELAY_SDP_MAX) return -1;
        }
        else if ((v = value_of(line, "Content-Base"))) { if (strlen(v) > RELAY_LOCATOR_CHARS) return -1; memcpy(a->base, v, strlen(v) + 1); }
        else if ((v = value_of(line, "Session"))) {
            size_t k = strcspn(v, "; \t");
            if (!k || k > RELAY_SESSION_CHARS) return -1;
            for (size_t i = 0; i < k; i++) if ((unsigned char)v[i] <= 0x20 || (unsigned char)v[i] >= 0x7F) return -1;
            memcpy(a->session, v, k);
            a->session[k] = 0;
            const char *t = strstr(v + k, "timeout=");
            if (t) {
                int seconds = 0, digits = 0;
                for (t += 8; *t >= '0' && *t <= '9' && digits < 6; t++, digits++) seconds = seconds * 10 + (*t - '0');
                a->timeout_s = seconds;
            }
        }
        else if ((v = value_of(line, "Transport"))) {
            const char *i = strstr(v, "interleaved=");
            a->datagram = strstr(v, "client_port") || strstr(v, "server_port") || strstr(v, "multicast");
            if (i) {
                /* One to three digits each. Never a library conversion: the number is the camera's, and the
                 * largest one a conversion returns plus 1 is undefined (found by the fuzz build, row 186). */
                const char *e = i + 12;
                int rtp = channel_of(&e), rtcp = rtp + 1;
                if (*e == '-') { e++; rtcp = channel_of(&e); }
                if (rtp >= 0 && rtp <= 255 && rtcp >= 0 && rtcp <= 255) { a->interleaved = 1; a->rtp_channel = rtp; a->rtcp_channel = rtcp; }
            }
        }
        else if ((v = value_of(line, "WWW-Authenticate"))) {
            DigestChallenge one;
            if (relay_challenge_parse(v, &one) == 1) {
                if (!a->have_digest || one.hash > a->digest.hash) a->digest = one;
                a->have_digest = 1;
            } else a->other_challenges++;
        }
        line = stop + 1;
    }
    return first ? -1 : body;
}

int relay_wire_front(const uint8_t *b, size_t have, RelayWire *out) {
    out->total = 0;
    out->channel = -1;
    if (!have) return RELAY_FRONT_MORE;
    if (b[0] == '$') {
        /* The length is 16 bit: a frame is at most 4 + 65,535 bytes, whatever the camera writes there. */
        if (have < 4) return RELAY_FRONT_MORE;
        out->channel = b[1];
        out->total = 4 + (((size_t)b[2] << 8) | b[3]);
        return have >= out->total ? RELAY_FRONT_FRAME : RELAY_FRONT_MORE;
    }
    if (!((b[0] >= 'A' && b[0] <= 'Z') || (b[0] >= 'a' && b[0] <= 'z'))) return -(int)RELAY_STREAM_INVALID;
    for (size_t i = 3; i < have && i < RELAY_HEAD_MAX; i++)
        if (b[i] == '\n' && b[i - 1] == '\r' && b[i - 2] == '\n' && b[i - 3] == '\r') { out->total = i + 1; return RELAY_FRONT_MESSAGE; }
    return have >= RELAY_HEAD_MAX ? -(int)RELAY_CAMERA_PROTOCOL : RELAY_FRONT_MORE;
}

int relay_extradata(RelayCodec codec, const ParamSets *sets, uint8_t *out, size_t cap) {
    static const uint8_t start[4] = { 0, 0, 0, 1 };
    const uint8_t *part[3] = { sets->vps, sets->sps, sets->pps };
    const int length[3] = { codec == RELAY_CODEC_HEVC ? sets->vps_len : 0, sets->sps_len, sets->pps_len };
    size_t n = 0;
    if (!relay_sets_complete(codec, sets)) return -1;
    for (int i = 0; i < 3; i++) {
        if (!length[i]) continue;
        if (n + 4 + (size_t)length[i] > cap) return -1;
        memcpy(out + n, start, 4);
        memcpy(out + n + 4, part[i], (size_t)length[i]);
        n += 4 + (size_t)length[i];
    }
    return (int)n;
}
