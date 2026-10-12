/*
 * Unit checks of the capture relay's pure part, src/relay/relay_core.c (task 4 blueprint row 41): the start
 * message, the address rules, the Digest computation against the published examples of RFC 2617 and RFC 7616,
 * the challenge reader (Basic is never "a Digest challenge"), the stream description, pictures out of RTP.
 * No process. Every text here is synthetic or a published example. `make relay-unit`.
 *
 * ROW 186 (security review verification/06_security_relay_client.md, finding H-1): THE 34 NAMED MALFORMED-INPUT
 * CASES, table-driven, one table per reader of camera-controlled bytes, each row asserting the named refusal:
 *    1 -  5  status line and headers      6 -  9  Content-Length      10 - 17  the Digest challenge
 *   18 - 22  the stream description      23 - 26  interleaved framing 27 - 29  the RTP header
 *   30 - 34  pictures out of RTP (H.264 and HEVC)
 * The pure readers are called on heap copies of the EXACT length of the input, so that the sanitizer build
 * (`make relay-asan`) sees a read one byte past it. The camera leg itself (src/relay/relay_rtsp.c) is driven
 * through a socket pair this test makes (relay_camera_adopt, test builds only): the bytes a camera would send
 * are written into one end, and the code the real client ends with is asserted. `--cases` prints the table.
 */
#include "../src/relay/relay.h"

#include <fcntl.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <unistd.h>

#define CASES 34
static int failed, checks, current_case, case_failed[CASES + 1], case_checks[CASES + 1];
static const char *case_name[CASES + 1];
#define CHECK(what, cond) do { checks++; case_checks[current_case]++; if (!(cond)) { failed++; case_failed[current_case]++; printf("relay_unit_test: FAILED: %s (line %d)\n", what, __LINE__); } } while (0)
#define CASE(number, name) do { current_case = (number); case_name[number] = (name); } while (0)
/* A row of a table: `what` is built from the table's own text. */
static void row(const char *table, const char *what, int ok) {
    checks++;
    case_checks[current_case]++;
    if (!ok) { failed++; case_failed[current_case]++; printf("relay_unit_test: FAILED: case %d (%s), %s: %s\n", current_case, case_name[current_case] ? case_name[current_case] : "-", table, what); }
}
/* A heap copy of exactly `n` bytes (never a byte more: the sanitizer build guards its end). */
static void *exact(const void *data, size_t n) {
    void *copy = malloc(n ? n : 1);
    if (!copy) abort();
    memcpy(copy, data, n);
    return copy;
}

static RelayCode parse(const char *line, RelayStart *s) { return relay_start_parse(line, strlen(line), s); }

/* Written in pieces: the repository's secret scan counts the FORM of an ingest address and of an address with a user part. */
#define INGEST "rtsp://127.0.0.1:8559/S-1/video-01/AbCdEfGhIjK" "lMnOpQrStUv"
#define RTSP "rtsp:/" "/"
#define GOOD "{\"type\":\"start\",\"mode\":\"record\",\"ingest\":\"" INGEST "\",\"access\":{\"locator\":\"rtsp://192.0.2.10:8554/media/video1\",\"username\":\"unit\",\"secret\":\"unit-placeholder\"}}\n"

static void start_message(void) {
    RelayStart s;
    CHECK("the door's line is taken", parse(GOOD, &s) == RELAY_STOPPED);
    CHECK("ingest handed on unchanged", !strcmp(s.ingest, INGEST) && s.ingest_port == 8559);
    CHECK("locator, host and port", !strcmp(s.locator, "rtsp://192.0.2.10:8554/media/video1") && !strcmp(s.host, "192.0.2.10") && s.port == 8554);
    CHECK("account and secret", !strcmp(s.account, "unit") && !strcmp(s.secret, "unit-placeholder"));
    CHECK("default port 554", parse("{\"type\":\"start\",\"mode\":\"record\",\"ingest\":\"" INGEST "\",\"access\":{\"locator\":\"rtsp://192.0.2.10/a\",\"username\":\"u\",\"secret\":\"\"}}\n", &s) == RELAY_STOPPED && s.port == 554);
    CHECK("escapes of the serialiser are decoded", parse("{\"type\":\"start\",\"mode\":\"record\",\"ingest\":\"" INGEST "\",\"access\":{\"locator\":\"rtsp://192.0.2.10/a\",\"username\":\"a \\\"b\\\\ \\u00e9\",\"secret\":\"p\\u0009q\\ud83d\\ude00\"}}\n", &s) == RELAY_STOPPED
          && !strcmp(s.account, "a \"b\\ \xc3\xa9") && !strcmp(s.secret, "p\tq\xf0\x9f\x98\x80"));
    static const char *const refused[] = {
        "{\"type\":\"start\",\"mode\":\"record\",\"ingest\":\"" INGEST "\",\"access\":{\"locator\":\"rtsp://192.0.2.10/a\",\"username\":\"u\",\"secret\":\"s\"}}",      /* no line feed */
        "{\"type\":\"start\",\"mode\":\"record\",\"ingest\":\"" INGEST "\",\"slot\":1,\"access\":{\"locator\":\"rtsp://192.0.2.10/a\",\"username\":\"u\",\"secret\":\"s\"}}\n",
        "{\"type\":\"start\",\"mode\":\"probe\",\"ingest\":\"" INGEST "\",\"access\":{\"locator\":\"rtsp://192.0.2.10/a\",\"username\":\"u\",\"secret\":\"s\"}}\n",
        "{\"type\":\"start\",\"mode\":\"record\",\"ingest\":\"" INGEST "\",\"access\":{\"locator\":\"" RTSP "u:s@192.0.2.10/a\",\"username\":\"u\",\"secret\":\"s\"}}\n",
        "{\"type\":\"start\",\"mode\":\"record\",\"ingest\":\"" INGEST "\",\"access\":{\"locator\":\"rtsp://camera.example/a\",\"username\":\"u\",\"secret\":\"s\"}}\n",
        "{\"type\":\"start\",\"mode\":\"record\",\"ingest\":\"" INGEST "\",\"access\":{\"locator\":\"rtsps://192.0.2.10/a\",\"username\":\"u\",\"secret\":\"s\"}}\n",
        "{\"type\":\"start\",\"mode\":\"record\",\"ingest\":\"" INGEST "\",\"access\":{\"locator\":\"rtsp://192.0.2.10/a b\",\"username\":\"u\",\"secret\":\"s\"}}\n",
        "{\"type\":\"start\",\"mode\":\"record\",\"ingest\":\"" INGEST "\",\"access\":{\"locator\":\"rtsp://192.0.2.10\",\"username\":\"u\",\"secret\":\"s\"}}\n",
        "{\"type\":\"start\",\"mode\":\"record\",\"ingest\":\"" INGEST "/\",\"access\":{\"locator\":\"rtsp://192.0.2.10/a\",\"username\":\"u\",\"secret\":\"s\"}}\n",
        "{\"type\":\"start\",\"mode\":\"record\",\"ingest\":\"rtsp://127.0.0.1:8565/x\",\"access\":{\"locator\":\"rtsp://192.0.2.10/a\",\"username\":\"u\",\"secret\":\"s\"}}\n",
        "{\"type\":\"start\",\"mode\":\"record\",\"ingest\":\"rtsp://192.0.2.1:8559/x\",\"access\":{\"locator\":\"rtsp://192.0.2.10/a\",\"username\":\"u\",\"secret\":\"s\"}}\n",
        "{\"type\":\"start\",\"mode\":\"record\",\"ingest\":\"" INGEST "\",\"access\":{\"locator\":\"rtsp://192.0.2.10/a\",\"username\":\"u\\r\\nX: y\",\"secret\":\"s\"}}\n",
        "{\"type\":\"start\",\"mode\":\"record\",\"ingest\":\"" INGEST "\",\"access\":{\"locator\":\"rtsp://192.0.2.10/a\",\"username\":\"u\",\"secret\":\"s\\u0000t\"}}\n",
        "{\"type\":\"start\",\"mode\":\"record\",\"ingest\":\"" INGEST "\",\"access\":{\"locator\":\"rtsp://192.0.2.10/a\",\"username\":\"\",\"secret\":\"s\"}}\n",
        "{\"type\":\"start\",\"mode\":\"record\",\"ingest\":\"" INGEST "\",\"access\":{\"locator\":\"rtsp://192.0.2.10/a\",\"username\":\"u\"}}\n",
        "{\"type\":\"start\",\"mode\":\"record\",\"ingest\":\"" INGEST "\",\"access\":{\"locator\":\"rtsp://192.0.2.10/a\",\"username\":\"u\",\"secret\":\"s\",\"secret\":\"t\"}}\n",
        "{\"type\":\"start\",\"mode\":\"record\",\"access\":{\"locator\":\"rtsp://192.0.2.10/a\",\"username\":\"u\",\"secret\":\"s\"}}\n",
        "{\"type\":\"start\",\"mode\":\"record\",\"ingest\":\"" INGEST "\",\"access\":\"[credential]\"}\n",
        "{\"type\":\"start\",\"mode\":\"record\",\"ingest\":\"" INGEST "\",\"access\":{\"locator\":\"rtsp://192.0.2.10/a\",\"username\":\"u\",\"secret\":\"s\"}} x\n",
        "[]\n", "\n",
    };
    for (size_t i = 0; i < sizeof refused / sizeof *refused; i++) {
        RelayCode r = parse(refused[i], &s);
        static const RelayStart empty;
        checks++;
        if (r != RELAY_START_MESSAGE_INVALID || memcmp(&s, &empty, sizeof s)) { failed++; printf("relay_unit_test: FAILED: start message %zu is not refused, or something of it was kept\n", i); }
    }
}

static void addresses(void) {
    RelayStart s;
    char out[256];
    parse(GOOD, &s);
    CHECK("same authority", relay_same_authority("rtsp://192.0.2.10:8554/x", "192.0.2.10", 8554) != NULL);
    CHECK("default port is 554", relay_same_authority("rtsp://192.0.2.10/x", "192.0.2.10", 554) && !relay_same_authority("rtsp://192.0.2.10/x", "192.0.2.10", 8554));
    CHECK("a longer host is another host", !relay_same_authority("rtsp://192.0.2.100:8554/x", "192.0.2.10", 8554));
    CHECK("a user part is refused", !relay_same_authority("rtsp://a@192.0.2.10:8554/x", "192.0.2.10", 8554) && !relay_same_authority(RTSP "192.0.2.10:8554@198.51.100.1/x", "192.0.2.10", 8554));
    CHECK("a relative control is joined to the base", relay_control_address(&s, "rtsp://192.0.2.10:8554/media/video1/", "track1", out, sizeof out) == RELAY_STOPPED && !strcmp(out, "rtsp://192.0.2.10:8554/media/video1/track1"));
    CHECK("without a base: the locator", relay_control_address(&s, "", "track1", out, sizeof out) == RELAY_STOPPED && !strcmp(out, "rtsp://192.0.2.10:8554/media/video1/track1"));
    CHECK("the star is the base", relay_control_address(&s, "", "*", out, sizeof out) == RELAY_STOPPED && !strcmp(out, s.locator));
    CHECK("an absolute control of the same host", relay_control_address(&s, "", "rtsp://192.0.2.10:8554/other/t", out, sizeof out) == RELAY_STOPPED);
    CHECK("an absolute control of another host is refused", relay_control_address(&s, "", "rtsp://198.51.100.1:8554/media/video1/track1", out, sizeof out) == RELAY_CONTROL_ADDRESS_REFUSED);
    CHECK("another port is another target", relay_control_address(&s, "", "rtsp://192.0.2.10:9000/t", out, sizeof out) == RELAY_CONTROL_ADDRESS_REFUSED);
    CHECK("a base of another host is refused", relay_control_address(&s, "rtsp://198.51.100.1:8554/media/", "track1", out, sizeof out) == RELAY_CONTROL_ADDRESS_REFUSED);
    CHECK("a control with a blank is refused", relay_control_address(&s, "", "track 1", out, sizeof out) == RELAY_CONTROL_ADDRESS_REFUSED);
}

static void digest(void) {
    DigestChallenge c;
    DigestKey key;
    char out[2048];
    CHECK("Basic is not a Digest challenge", relay_challenge_parse("Basic realm=\"x\"", &c) == 0);
    CHECK("another scheme is not one either", relay_challenge_parse("Negotiate", &c) == 0 && relay_challenge_parse("DigestX realm=\"x\", nonce=\"n\"", &c) == 0);
    CHECK("a session hash is not answered", relay_challenge_parse("Digest realm=\"x\", nonce=\"n\", algorithm=MD5-sess", &c) == 0);
    CHECK("integrity protection alone is not answered", relay_challenge_parse("Digest realm=\"x\", nonce=\"n\", qop=\"auth-int\"", &c) == 0);
    CHECK("no nonce: not readable", relay_challenge_parse("Digest realm=\"x\"", &c) == -1);
    CHECK("a plain challenge", relay_challenge_parse("Digest realm=\"DEMS test camera\", nonce=\"abc\"", &c) == 1 && c.hash == DIGEST_HASH_MD5 && !c.qop_auth && !strcmp(c.realm, "DEMS test camera"));
    CHECK("stale and SHA-256", relay_challenge_parse("digest realm=\"r\", nonce=\"n\", algorithm=SHA-256, stale=TRUE, qop=\"auth, auth-int\", opaque=\"o\"", &c) == 1 && c.hash == DIGEST_HASH_SHA256 && c.stale && c.qop_auth && c.has_opaque);

    /* RFC 2617, section 3.5 */
    relay_challenge_parse("Digest realm=\"testrealm@host.com\", qop=\"auth,auth-int\", nonce=\"dcd98b7102dd2f0e8b11d0f600bfb0c093\", opaque=\"5ccc069c403ebaf9f0171e9517f40e41\"", &c);
    CHECK("key (RFC 2617)", relay_digest_key(c.hash, "Mufasa", c.realm, "Circle Of Life", &key) == 0);
    CHECK("answer (RFC 2617)", relay_digest_answer(&key, "Mufasa", &c, "GET", "/dir/index.html", 1, "0a4f113b", out, sizeof out) == 0 && strstr(out, "response=\"6629fae49393a05397450978507c4ef1\"")
          && strstr(out, "qop=auth, nc=00000001, cnonce=\"0a4f113b\"") && strstr(out, "opaque=\"5ccc069c403ebaf9f0171e9517f40e41\"") && !strncmp(out, "Digest username=\"Mufasa\", realm=\"testrealm@host.com\"", 52));
    /* RFC 7616, section 3.9.1: the same exchange with MD5 and with SHA-256 */
    relay_challenge_parse("Digest realm=\"http-auth@example.org\", qop=\"auth, auth-int\", algorithm=MD5, nonce=\"7ypf/xlj9XXwfDPEoM4URrv/xwf94BcCAzFZH4GiTo0v\", opaque=\"FQhe/qaU925kfnzjCev0ciny7QMkPqMAFRtzCUYo5tdS\"", &c);
    relay_digest_key(c.hash, "Mufasa", c.realm, "Circle of Life", &key);
    CHECK("answer (RFC 7616, MD5)", relay_digest_answer(&key, "Mufasa", &c, "GET", "/dir/index.html", 1, "f2/wE4q74E6zIJEtWaHKaf5wv/H5QzzpXusqGemxURZJ", out, sizeof out) == 0 && strstr(out, "response=\"8ca523f5e9506fed4657c9700eebdbec\""));
    relay_challenge_parse("Digest realm=\"http-auth@example.org\", qop=\"auth, auth-int\", algorithm=SHA-256, nonce=\"7ypf/xlj9XXwfDPEoM4URrv/xwf94BcCAzFZH4GiTo0v\", opaque=\"FQhe/qaU925kfnzjCev0ciny7QMkPqMAFRtzCUYo5tdS\"", &c);
    relay_digest_key(c.hash, "Mufasa", c.realm, "Circle of Life", &key);
    CHECK("answer (RFC 7616, SHA-256)", relay_digest_answer(&key, "Mufasa", &c, "GET", "/dir/index.html", 1, "f2/wE4q74E6zIJEtWaHKaf5wv/H5QzzpXusqGemxURZJ", out, sizeof out) == 0
          && strstr(out, "response=\"753927fa0e85d155564e2e272a28d1802ca10daf4496794697cf8db5856cb6c1\"") && strstr(out, "algorithm=SHA-256"));
    /* The key of one realm answers no other realm and no other hash: the password is gone by then. */
    relay_challenge_parse("Digest realm=\"another\", nonce=\"n\", algorithm=SHA-256", &c);
    CHECK("another realm is not answered", relay_digest_answer(&key, "Mufasa", &c, "GET", "/", 1, "", out, sizeof out) != 0);
    relay_challenge_parse("Digest realm=\"http-auth@example.org\", nonce=\"n\"", &c);
    CHECK("another hash is not answered", relay_digest_answer(&key, "Mufasa", &c, "GET", "/", 1, "", out, sizeof out) != 0);
    /* A quote in the account name cannot end the quoted value. */
    relay_challenge_parse("Digest realm=\"r\", nonce=\"n\"", &c);
    relay_digest_key(c.hash, "a\"b", c.realm, "x", &key);
    CHECK("the account name is escaped", relay_digest_answer(&key, "a\"b", &c, "DESCRIBE", "rtsp://192.0.2.10/a", 1, "", out, sizeof out) == 0 && strstr(out, "username=\"a\\\"b\", realm=") && !strstr(out, "qop"));
}

static void description(void) {
    RelayDescription d;
    static const char h264[] = "v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=x\r\na=control:*\r\nm=audio 0 RTP/AVP 0\r\na=control:audio\r\nm=video 0 RTP/AVP 96\r\na=rtpmap:96 H264/90000\r\n"
                               "a=fmtp:96 packetization-mode=1; profile-level-id=42C01F; sprop-parameter-sets=Z0LAH9oBQBbsBEAAAAMAQAAADIPGDKg=,aM4PyA==\r\na=control:track1\r\nm=video 0 RTP/AVP 97\r\na=rtpmap:97 H265/90000\r\na=control:second\r\n";
    static const char hevc[] = "v=0\nm=video 0 RTP/AVP 98\na=rtpmap:98 H265/90000\na=fmtp:98 sprop-vps=QAEMAf//AWAAAAMAAAMAAAMAAAMAlqwJ; sprop-sps=QgEBAWAAAAMAAAMAAAMAAAMAlqADwIAQ5Y2uSTK+A=; sprop-pps=RAHA8vA8kA==\na=control:rtsp://192.0.2.10:8554/media/video1/track1\n";
    CHECK("H.264 description", relay_description_parse(h264, sizeof h264 - 1, &d) == RELAY_STOPPED && d.codec == RELAY_CODEC_H264 && d.payload_type == 96 && !strcmp(d.control, "track1"));
    CHECK("H.264 sets from the description", d.sets.sps_len > 4 && (d.sets.sps[0] & 0x1F) == 7 && d.sets.pps_len == 4 && (d.sets.pps[0] & 0x1F) == 8 && relay_sets_complete(d.codec, &d.sets));
    CHECK("HEVC description", relay_description_parse(hevc, sizeof hevc - 1, &d) == RELAY_STOPPED && d.codec == RELAY_CODEC_HEVC && d.payload_type == 98 && d.sets.vps_len > 0 && ((d.sets.vps[0] >> 1) & 0x3F) == 32 && d.sets.pps_len > 0);
    static const char bare[] = "v=0\r\nm=video 0 RTP/AVP 96\r\na=rtpmap:96 H265/90000\r\na=control:t\r\n";
    CHECK("no sets in the description is a description", relay_description_parse(bare, sizeof bare - 1, &d) == RELAY_STOPPED && !relay_sets_complete(d.codec, &d.sets));
    static const char other[] = "v=0\r\nm=video 0 RTP/AVP 26\r\na=rtpmap:26 JPEG/90000\r\n";
    CHECK("another codec is named", relay_description_parse(other, sizeof other - 1, &d) == RELAY_CODEC_NOT_SUPPORTED);
    static const char audio[] = "v=0\r\nm=audio 0 RTP/AVP 0\r\n";
    CHECK("no video section", relay_description_parse(audio, sizeof audio - 1, &d) == RELAY_DESCRIPTION_INVALID);
    CHECK("a 0 byte inside is refused", relay_description_parse("v=0\0m=video", 11, &d) == RELAY_DESCRIPTION_INVALID);
}

static size_t rtp(uint8_t *out, int marker, int type, uint16_t sequence, uint32_t stamp, const uint8_t *payload, size_t n) {
    out[0] = 0x80; out[1] = (uint8_t)((marker ? 0x80 : 0) | type);
    out[2] = (uint8_t)(sequence >> 8); out[3] = (uint8_t)sequence;
    out[4] = (uint8_t)(stamp >> 24); out[5] = (uint8_t)(stamp >> 16); out[6] = (uint8_t)(stamp >> 8); out[7] = (uint8_t)stamp;
    out[8] = out[9] = out[10] = out[11] = 1;
    memcpy(out + 12, payload, n);
    return 12 + n;
}

static void pictures(void) {
    RelayPicture p;
    uint8_t k[256];
    size_t n;
    CHECK("init", relay_picture_init(&p, RELAY_CODEC_H264, 96) == 0);
    /* sets and a keyframe slice together (STAP-A), then the slice fragmented (FU-A) with the mark on the last */
    static const uint8_t stap[] = { 24, 0, 4, 0x67, 0x42, 0x00, 0x1F, 0, 2, 0x68, 0xCE };
    n = rtp(k, 0, 96, 10, 9000, stap, sizeof stap);
    CHECK("STAP-A: no picture yet", relay_picture_add(&p, k, n) == 0 && p.seen.sps_len == 4 && p.seen.pps_len == 2);
    static const uint8_t fu1[] = { 0x7C, 0x85, 0xAA, 0xBB }, fu2[] = { 0x7C, 0x45, 0xCC };
    n = rtp(k, 0, 96, 11, 9000, fu1, sizeof fu1);
    CHECK("FU-A start", relay_picture_add(&p, k, n) == 0 && p.keyframe);
    n = rtp(k, 1, 96, 12, 9000, fu2, sizeof fu2);
    CHECK("FU-A end with the mark: a picture", relay_picture_add(&p, k, n) == 1);
    static const uint8_t want[] = { 0, 0, 0, 1, 0x67, 0x42, 0x00, 0x1F, 0, 0, 0, 1, 0x68, 0xCE, 0, 0, 0, 1, 0x65, 0xAA, 0xBB, 0xCC };
    CHECK("the picture is the units after start codes, unchanged", p.length == sizeof want && !memcmp(p.unit, want, sizeof want) && p.keyframe && p.stamp == 9000);
    relay_picture_taken(&p);
    /* a picture without its mark is ended by the next stamp, and the packet is given again */
    static const uint8_t slice[] = { 0x41, 0x01 };
    n = rtp(k, 0, 96, 13, 12600, slice, sizeof slice);
    CHECK("single unit, no mark", relay_picture_add(&p, k, n) == 0);
    n = rtp(k, 1, 96, 14, 16200, slice, sizeof slice);
    CHECK("the next stamp ends it", relay_picture_add(&p, k, n) == 2 && p.length == 6 && !p.keyframe && p.stamp == 12600);
    relay_picture_taken(&p);
    CHECK("the packet again: its own picture", relay_picture_add(&p, k, n) == 1 && p.stamp == 16200);
    relay_picture_taken(&p);
    /* a gap: the picture is dropped and counted */
    n = rtp(k, 1, 96, 16, 19800, slice, sizeof slice);
    CHECK("a gap drops the picture and counts", relay_picture_add(&p, k, n) == 0 && p.gaps == 1 && p.length == 0);
    n = rtp(k, 1, 97, 17, 19800, slice, sizeof slice);
    CHECK("another payload type is not video", relay_picture_add(&p, k, n) == 0 && p.foreign == 1);
    n = rtp(k, 1, 96, 17, 23400, fu2, sizeof fu2);
    CHECK("a fragment without its start is not a picture", relay_picture_add(&p, k, n) == 0 && p.length == 0);
    k[0] = 0x40;
    CHECK("not RTP", relay_picture_add(&p, k, 20) == -(int)RELAY_STREAM_INVALID && relay_picture_add(&p, k, 5) == -(int)RELAY_STREAM_INVALID);
    relay_picture_free(&p);

    /* HEVC: a VPS as one unit, an IDR slice fragmented */
    CHECK("init HEVC", relay_picture_init(&p, RELAY_CODEC_HEVC, 98) == 0);
    static const uint8_t vps[] = { 0x40, 0x01, 0x0C };
    n = rtp(k, 0, 98, 1, 100, vps, sizeof vps);
    CHECK("VPS kept", relay_picture_add(&p, k, n) == 0 && p.seen.vps_len == 3);
    static const uint8_t h1[] = { 0x62, 0x01, 0x93, 0x11 }, h2[] = { 0x62, 0x01, 0x53, 0x22 };
    n = rtp(k, 0, 98, 2, 100, h1, sizeof h1);
    relay_picture_add(&p, k, n);
    n = rtp(k, 1, 98, 3, 100, h2, sizeof h2);
    CHECK("HEVC fragments: a keyframe", relay_picture_add(&p, k, n) == 1 && p.keyframe);
    static const uint8_t hwant[] = { 0, 0, 0, 1, 0x40, 0x01, 0x0C, 0, 0, 0, 1, 0x26, 0x01, 0x11, 0x22 };
    CHECK("HEVC picture bytes", p.length == sizeof hwant && !memcmp(p.unit, hwant, sizeof hwant));
    relay_picture_free(&p);

    ParamSets sets;
    uint8_t extra[64];
    memset(&sets, 0, sizeof sets);
    sets.sps[0] = 0x67; sets.sps_len = 1; sets.pps[0] = 0x68; sets.pps_len = 1;
    static const uint8_t ewant[] = { 0, 0, 0, 1, 0x67, 0, 0, 0, 1, 0x68 };
    CHECK("extradata: SPS then PPS after start codes", relay_extradata(RELAY_CODEC_H264, &sets, extra, sizeof extra) == 10 && !memcmp(extra, ewant, 10));
    CHECK("HEVC needs its VPS", relay_extradata(RELAY_CODEC_HEVC, &sets, extra, sizeof extra) < 0);
}

/* ================================================================ row 186: the 34 named malformed-input cases */
#define B(text) text, sizeof text - 1
#define REFUSED (-1L)

static long head(const char *bytes, size_t n, RelayAnswer *a) {
    char *copy = exact(bytes, n);
    long r = relay_head_parse(copy, n, a);
    free(copy);
    return r;
}

static int front(const void *bytes, size_t n, RelayWire *w) {
    uint8_t *copy = exact(bytes, n);
    int r = relay_wire_front(copy, n, w);
    free(copy);
    return r;
}

/* `before`, then `count` times `ch`, then `after`: the long values of the tables. */
static size_t long_text(char *out, size_t cap, const char *before, char ch, size_t count, const char *after) {
    size_t a = strlen(before), b = strlen(after);
    if (a + count + b + 1 > cap) abort();
    memcpy(out, before, a);
    memset(out + a, ch, count);
    memcpy(out + a + count, after, b + 1);
    return a + count + b;
}

typedef struct HeadRow { int id; const char *what; const char *bytes; size_t n; long want; int status; } HeadRow;

static void heads(void) {
    static const HeadRow rows[] = {
        { 0, "an answer", B("RTSP/1.0 200 OK\r\nCSeq: 7\r\nContent-Length: 12  \r\n\r\n"), 12, 200 },
        { 0, "an answer without a reason", B("RTSP/1.0 401\r\nCSeq: 1\r\n\r\n"), 0, 401 },
        { 0, "a request of the camera is a message, not an answer", B("OPTIONS rtsp://192.0.2.10/a RTSP/1.0\r\nCSeq: 3\r\n\r\n"), 0, 0 },
        { 1, "HTTP", B("HTTP/1.1 200 OK\r\nCSeq: 1\r\n\r\n"), REFUSED, 0 },
        { 1, "another version", B("RTSP/2.0 200 OK\r\nCSeq: 1\r\n\r\n"), REFUSED, 0 },
        { 1, "lower case", B("rtsp/1.0 200 OK\r\nCSeq: 1\r\n\r\n"), REFUSED, 0 },
        { 1, "a word", B("ICY 200 OK\r\n\r\n"), REFUSED, 0 },
        { 1, "an empty first line", B("\r\n\r\n"), REFUSED, 0 },
        { 1, "a header where the status line belongs", B("CSeq: 1\r\nContent-Length: 0\r\n\r\n"), REFUSED, 0 },
        { 1, "no line at all", B("RTSP/1.0 200 OK"), REFUSED, 0 },
        { 2, "a letter among the digits", B("RTSP/1.0 2x0 OK\r\n\r\n"), REFUSED, 0 },
        { 2, "two digits", B("RTSP/1.0 20\r\n\r\n"), REFUSED, 0 },
        { 2, "four digits", B("RTSP/1.0 2000 OK\r\n\r\n"), REFUSED, 0 },
        { 2, "a class that does not exist (9xx)", B("RTSP/1.0 999 X\r\n\r\n"), REFUSED, 0 },
        { 2, "a class that does not exist (0xx)", B("RTSP/1.0 099 X\r\n\r\n"), REFUSED, 0 },
        { 2, "two blanks before the status", B("RTSP/1.0  200 OK\r\n\r\n"), REFUSED, 0 },
        { 2, "a sign", B("RTSP/1.0 -20 OK\r\n\r\n"), REFUSED, 0 },
        { 2, "nothing after the version", B("RTSP/1.0 \r\n\r\n"), REFUSED, 0 },
        { 4, "a 0 byte in a header line", B("RTSP/1.0 200 OK\r\nCSeq: 1\0\r\nContent-Length: 5\r\n\r\n"), REFUSED, 0 },
        { 4, "a 0 byte in the status line", B("RTSP/1.0 200\0OK\r\nCSeq: 1\r\n\r\n"), REFUSED, 0 },
        { 4, "a 0 byte as the first byte", B("\0RTSP/1.0 200 OK\r\n\r\n"), REFUSED, 0 },
        { 5, "an empty session identifier", B("RTSP/1.0 200 OK\r\nSession: ;timeout=60\r\n\r\n"), REFUSED, 0 },
        { 5, "a control byte in the session identifier", B("RTSP/1.0 200 OK\r\nSession: ab\x01" "cd\r\n\r\n"), REFUSED, 0 },
        { 5, "a byte beyond ASCII in the session identifier", B("RTSP/1.0 200 OK\r\nSession: ab\xC3\xA9\r\n\r\n"), REFUSED, 0 },
        { 6, "minus one", B("RTSP/1.0 200 OK\r\nContent-Length: -1\r\n\r\n"), REFUSED, 0 },
        { 6, "minus zero", B("RTSP/1.0 200 OK\r\nContent-Length: -0\r\n\r\n"), REFUSED, 0 },
        { 6, "a large negative number", B("RTSP/1.0 200 OK\r\nContent-Length: -4294967296\r\n\r\n"), REFUSED, 0 },
        { 7, "one beyond the bound", B("RTSP/1.0 200 OK\r\nContent-Length: 65537\r\n\r\n"), REFUSED, 0 },
        { 0, "exactly the bound", B("RTSP/1.0 200 OK\r\nContent-Length: 65536\r\n\r\n"), 65536, 200 },
        { 7, "2 to the 32 and 5 (a 32-bit reader sees 5)", B("RTSP/1.0 200 OK\r\nContent-Length: 4294967301\r\n\r\n"), REFUSED, 0 },
        { 7, "a number no integer holds", B("RTSP/1.0 200 OK\r\nContent-Length: 99999999999999999999999999\r\n\r\n"), REFUSED, 0 },
        { 7, "zeros in front beyond the digits allowed", B("RTSP/1.0 200 OK\r\nContent-Length: 0000012\r\n\r\n"), REFUSED, 0 },
        { 8, "empty", B("RTSP/1.0 200 OK\r\nContent-Length:\r\n\r\n"), REFUSED, 0 },
        { 8, "a word", B("RTSP/1.0 200 OK\r\nContent-Length: abc\r\n\r\n"), REFUSED, 0 },
        { 8, "text after the number", B("RTSP/1.0 200 OK\r\nContent-Length: 12abc\r\n\r\n"), REFUSED, 0 },
        { 8, "hexadecimal", B("RTSP/1.0 200 OK\r\nContent-Length: 0x10\r\n\r\n"), REFUSED, 0 },
        { 8, "two numbers", B("RTSP/1.0 200 OK\r\nContent-Length: 1 2\r\n\r\n"), REFUSED, 0 },
        { 8, "a plus sign", B("RTSP/1.0 200 OK\r\nContent-Length: +5\r\n\r\n"), REFUSED, 0 },
        { 8, "a list", B("RTSP/1.0 200 OK\r\nContent-Length: 5, 5\r\n\r\n"), REFUSED, 0 },
        { 9, "two different lengths", B("RTSP/1.0 200 OK\r\nContent-Length: 5\r\nContent-Length: 50\r\n\r\n"), REFUSED, 0 },
        { 9, "the same length twice", B("RTSP/1.0 200 OK\r\nContent-Length: 5\r\nCSeq: 1\r\ncontent-length: 5\r\n\r\n"), REFUSED, 0 },
    };
    static char text[RELAY_HEAD_MAX + 4096];
    RelayAnswer a;
    RelayWire w;
    size_t n;
    case_name[1] = "status line that is not RTSP/1.0";
    case_name[2] = "status that is not three digits of 100 to 599";
    case_name[4] = "0 byte inside the head";
    case_name[5] = "session identifier or Content-Base beyond its bound, or not printable";
    case_name[6] = "Content-Length negative";
    case_name[7] = "Content-Length beyond 65,536, or a number too long for any integer";
    case_name[8] = "Content-Length that is no number, or text after the number";
    case_name[9] = "Content-Length stated twice";
    for (size_t i = 0; i < sizeof rows / sizeof *rows; i++) {
        current_case = rows[i].id;
        long r = head(rows[i].bytes, rows[i].n, &a);
        row("head", rows[i].what, r == rows[i].want && (r < 0 || a.status == rows[i].status));
    }
    current_case = 0;
    CHECK("the members of an answer", head(B("RTSP/1.0 200 OK\r\ncseq: 12\r\nSession: 0A1b;timeout=30\r\nContent-Base: rtsp://192.0.2.10/a/\r\nTransport: RTP/AVP/TCP;unicast;interleaved=2-3\r\n\r\n"), &a) == 0
          && a.cseq == 12 && !strcmp(a.session, "0A1b") && a.timeout_s == 30 && !strcmp(a.base, "rtsp://192.0.2.10/a/") && a.interleaved && a.rtp_channel == 2 && a.rtcp_channel == 3 && !a.datagram);
    CHECK("a time that is no number is 0, never undefined", head(B("RTSP/1.0 200 OK\r\nSession: s;timeout=99999999999999999999\r\n\r\n"), &a) == 0 && a.timeout_s == 999999
          && head(B("RTSP/1.0 200 OK\r\nSession: s;timeout=-5\r\n\r\n"), &a) == 0 && a.timeout_s == 0);
    CHECK("a CSeq that is no number matches no request", head(B("RTSP/1.0 200 OK\r\nCSeq: 1x\r\n\r\n"), &a) == 0 && a.cseq == -1 && head(B("RTSP/1.0 200 OK\r\nCSeq: 99999999999\r\n\r\n"), &a) == 0 && a.cseq == -1);
    CHECK("a datagram transport is seen", head(B("RTSP/1.0 200 OK\r\nTransport: RTP/AVP;unicast;client_port=5000-5001\r\n\r\n"), &a) == 0 && a.datagram && !a.interleaved);
    CHECK("a channel beyond 255 is no channel", head(B("RTSP/1.0 200 OK\r\nTransport: RTP/AVP/TCP;interleaved=256-257\r\n\r\n"), &a) == 0 && !a.interleaved
          && head(B("RTSP/1.0 200 OK\r\nTransport: RTP/AVP/TCP;interleaved=x\r\n\r\n"), &a) == 0 && !a.interleaved);
    /* FOUND BY THE FUZZ BUILD (row 186, seed 186, entry `head`, input 252,307): a channel number too long for an
     * integer made the reader add 1 to the largest one - undefined, reported by UndefinedBehaviorSanitizer. */
    CHECK("regression, fuzz finding 1: a channel number no integer holds is no channel", head(B("RTSP/1.0 200 OK\r\nTransport: RTP/AVP/TCP;unicast;interleaved=6559999999999999999999999999999999\r\n\r\n"), &a) == 0 && !a.interleaved
          && head(B("RTSP/1.0 200 OK\r\nTransport: RTP/AVP/TCP;interleaved=9223372036854775807\r\n\r\n"), &a) == 0 && !a.interleaved
          && head(B("RTSP/1.0 200 OK\r\nTransport: RTP/AVP/TCP;interleaved=0-9223372036854775808\r\n\r\n"), &a) == 0 && !a.interleaved
          && head(B("RTSP/1.0 200 OK\r\nTransport: RTP/AVP/TCP;interleaved=255\r\n\r\n"), &a) == 0 && !a.interleaved
          && head(B("RTSP/1.0 200 OK\r\nTransport: RTP/AVP/TCP;interleaved=254\r\n\r\n"), &a) == 0 && a.interleaved && a.rtp_channel == 254 && a.rtcp_channel == 255
          && head(B("RTSP/1.0 200 OK\r\nTransport: RTP/AVP/TCP;interleaved=-1\r\n\r\n"), &a) == 0 && !a.interleaved);
    CHECK("Basic beside Digest: Digest is taken, the other counted", head(B("RTSP/1.0 401 U\r\nWWW-Authenticate: Basic realm=\"x\"\r\nWWW-Authenticate: Digest realm=\"x\", nonce=\"n\"\r\n\r\n"), &a) == 0 && a.have_digest && a.other_challenges == 1);
    CHECK("of two Digest challenges the stronger hash", head(B("RTSP/1.0 401 U\r\nWWW-Authenticate: Digest realm=\"x\", nonce=\"n\", algorithm=SHA-256\r\nWWW-Authenticate: Digest realm=\"x\", nonce=\"m\"\r\n\r\n"), &a) == 0 && a.digest.hash == DIGEST_HASH_SHA256);

    CASE(5, case_name[5]);
    n = long_text(text, sizeof text, "RTSP/1.0 200 OK\r\nSession: ", 's', RELAY_SESSION_CHARS, "\r\n\r\n");
    row("head", "a session identifier of exactly the bound", head(text, n, &a) == 0 && strlen(a.session) == RELAY_SESSION_CHARS);
    n = long_text(text, sizeof text, "RTSP/1.0 200 OK\r\nSession: ", 's', RELAY_SESSION_CHARS + 1, "\r\n\r\n");
    row("head", "a session identifier one beyond the bound", head(text, n, &a) == REFUSED);
    n = long_text(text, sizeof text, "RTSP/1.0 200 OK\r\nContent-Base: rtsp://192.0.2.10/", 'b', RELAY_LOCATOR_CHARS - 18, "\r\n\r\n");
    row("head", "a Content-Base of exactly the bound", head(text, n, &a) == 0 && strlen(a.base) == RELAY_LOCATOR_CHARS);
    n = long_text(text, sizeof text, "RTSP/1.0 200 OK\r\nContent-Base: rtsp://192.0.2.10/", 'b', RELAY_LOCATOR_CHARS - 17, "\r\n\r\n");
    row("head", "a Content-Base one beyond the bound", head(text, n, &a) == REFUSED);

    CASE(3, "head with no end inside 8,192 bytes (also one ended by bare line feeds)");
    n = long_text(text, sizeof text, "RTSP/1.0 200 OK\r\nX: ", 'a', RELAY_HEAD_MAX, "\r\n\r\n");
    row("front", "8,192 bytes and no empty line", front(text, RELAY_HEAD_MAX, &w) == -(int)RELAY_CAMERA_PROTOCOL);
    row("front", "the empty line after the bound is not looked for", front(text, n, &w) == -(int)RELAY_CAMERA_PROTOCOL);
    row("front", "one byte less: more is asked for, nothing is read", front(text, RELAY_HEAD_MAX - 1, &w) == RELAY_FRONT_MORE);
    n = long_text(text, sizeof text, "RTSP/1.0 200 OK\nCSeq: 1\n\n", ' ', RELAY_HEAD_MAX, "");
    row("front", "bare line feeds never end a head", front(text, 25, &w) == RELAY_FRONT_MORE && front(text, n, &w) == -(int)RELAY_CAMERA_PROTOCOL);
    n = long_text(text, sizeof text, "RTSP/1.0 200 OK\r\nX: ", 'a', RELAY_HEAD_MAX - 24, "\r\n\r\n");
    row("front", "a head of exactly the bound is a head", n == RELAY_HEAD_MAX && front(text, n, &w) == RELAY_FRONT_MESSAGE && w.total == RELAY_HEAD_MAX && head(text, n, &a) == 0);
    row("head", "a head beyond the bound is not read", head(text, RELAY_HEAD_MAX + 1, &a) == REFUSED);
    current_case = 0;
}

typedef struct TextRow { int id; const char *what; const char *text; int want; } TextRow;

static void challenges(void) {
    static const TextRow rows[] = {
        { 10, "no nonce", "Digest realm=\"x\"", -1 },
        { 10, "an empty nonce", "Digest realm=\"x\", nonce=\"\"", -1 },
        { 10, "no realm", "Digest nonce=\"n\"", -1 },
        { 10, "the scheme and nothing", "Digest ", -1 },
        { 11, "MD5-sess", "Digest realm=\"x\", nonce=\"n\", algorithm=MD5-sess", 0 },
        { 11, "SHA-256-sess", "Digest realm=\"x\", nonce=\"n\", algorithm=\"SHA-256-sess\"", 0 },
        { 11, "a hash the relay does not compute", "Digest realm=\"x\", nonce=\"n\", algorithm=SHA-512-256", 0 },
        { 11, "an empty hash name", "Digest realm=\"x\", nonce=\"n\", algorithm=", 0 },
        { 12, "auth-int alone", "Digest realm=\"x\", nonce=\"n\", qop=\"auth-int\"", 0 },
        { 12, "an unknown protection alone", "Digest realm=\"x\", nonce=\"n\", qop=\"authx\"", 0 },
        { 12, "an empty protection", "Digest realm=\"x\", nonce=\"n\", qop=\"\"", 0 },
        { 13, "a backslash before the end of the text", "Digest realm=\"abc\\", -1 },
        { 13, "an escaped quote that was the closing one", "Digest realm=\"x\\\", nonce=\"n", -1 },
        { 14, "a realm that never ends", "Digest realm=\"x, nonce=n", -1 },
        { 14, "a nonce that never ends", "Digest realm=\"x\", nonce=\"abc", -1 },
        { 14, "a lone quote", "Digest realm=\"", -1 },
        { 15, "two realms", "Digest realm=\"a\", nonce=\"n\", realm=\"b\"", -1 },
        { 15, "two nonces", "Digest realm=\"a\", nonce=\"n\", nonce=\"m\"", -1 },
        { 15, "two hashes", "Digest realm=\"a\", nonce=\"n\", algorithm=SHA-256, algorithm=MD5", -1 },
        { 15, "two protections", "Digest realm=\"a\", nonce=\"n\", qop=\"auth-int\", qop=\"auth\"", -1 },
        { 15, "two opaque values", "Digest realm=\"a\", nonce=\"n\", opaque=\"1\", opaque=\"2\"", -1 },
        { 15, "stale twice, in another case of letters", "Digest realm=\"a\", nonce=\"n\", stale=false, STALE=true", -1 },
        { 17, "a control byte in a quoted value", "Digest realm=\"a\x01" "b\", nonce=\"n\"", -1 },
        { 17, "a line feed in a quoted value", "Digest realm=\"a\nb\", nonce=\"n\"", -1 },
        { 17, "the delete byte in a token", "Digest realm=x\x7F, nonce=n", -1 },
        { 17, "a name of 32 bytes", "Digest realm=\"a\", nonce=\"n\", abcdefghijklmnopqrstuvwxyzabcdef=1", -1 },
        { 17, "a name without an equals sign", "Digest realm", -1 },
        { 17, "a second scheme on the same line (fails closed)", "Digest realm=\"a\", nonce=\"n\", Basic realm=\"b\"", -1 },
        { 0, "a name of 31 bytes is read past", "Digest realm=\"a\", nonce=\"n\", abcdefghijklmnopqrstuvwxyzabcde=1", 1 },
        { 0, "tokens without quotes", "Digest realm=a, nonce=n, qop=auth", 1 },
    };
    static char text[4 * RELAY_FIELD_CHARS];
    DigestChallenge c;
    char *copy;
    case_name[10] = "challenge without a nonce or a realm";
    case_name[11] = "session variant of a hash, or a hash the relay does not answer";
    case_name[12] = "integrity protection alone";
    case_name[13] = "escapes in a quoted value";
    case_name[14] = "quote that never ends";
    case_name[15] = "parameter stated twice";
    case_name[16] = "field of 513 bytes";
    case_name[17] = "control byte in a value, name beyond 31 bytes, no equals sign";
    for (size_t i = 0; i < sizeof rows / sizeof *rows; i++) {
        current_case = rows[i].id;
        copy = exact(rows[i].text, strlen(rows[i].text) + 1);
        row("challenge", rows[i].what, relay_challenge_parse(copy, &c) == rows[i].want);
        free(copy);
    }
    current_case = 13;
    row("challenge", "an escaped quote and an escaped backslash are the characters themselves", relay_challenge_parse("Digest realm=\"a\\\"b\\\\c\", nonce=\"n\"", &c) == 1 && !strcmp(c.realm, "a\"b\\c"));
    row("challenge", "a comma inside quotes belongs to the value", relay_challenge_parse("Digest realm=\"a, nonce=x\", nonce=\"n\"", &c) == 1 && !strcmp(c.realm, "a, nonce=x") && !strcmp(c.nonce, "n"));
    current_case = 16;
    static const char *const names[] = { "realm", "nonce", "opaque" };
    for (int f = 0; f < 3; f++)
        for (int quoted = 0; quoted < 2; quoted++)
            for (int extra = 0; extra < 2; extra++) {
                char before[64], what[96];
                snprintf(before, sizeof before, "Digest %s%s=%s", f == 0 ? "nonce=n, " : f == 1 ? "realm=r, " : "realm=r, nonce=n, ", names[f], quoted ? "\"" : "");
                snprintf(what, sizeof what, "%s of %d bytes, %s", names[f], RELAY_FIELD_CHARS + extra, quoted ? "quoted" : "a token");
                size_t n = long_text(text, sizeof text, before, 'z', RELAY_FIELD_CHARS + (size_t)extra, quoted ? "\"" : "");
                copy = exact(text, n + 1);
                int r = relay_challenge_parse(copy, &c);
                row("challenge", what, extra ? r == -1 : r == 1 && strlen(f == 0 ? c.realm : f == 1 ? c.nonce : c.opaque) == RELAY_FIELD_CHARS);
                free(copy);
            }
    current_case = 0;
    /* What a field at its bound, every character to be escaped, makes of the answer: it fits (review L-2). */
    {
        static char out[2 * (3 * RELAY_FIELD_CHARS + RELAY_ACCOUNT_CHARS) + RELAY_LOCATOR_CHARS + 1024];
        static char account[RELAY_ACCOUNT_CHARS + 1];
        DigestKey key;
        memset(&c, 0, sizeof c);
        c.hash = DIGEST_HASH_SHA256;
        c.qop_auth = c.has_opaque = 1;
        memset(c.realm, '"', RELAY_FIELD_CHARS);
        memset(c.nonce, '\\', RELAY_FIELD_CHARS);
        memset(c.opaque, '"', RELAY_FIELD_CHARS);
        memset(account, '"', RELAY_ACCOUNT_CHARS);
        long_text(text, sizeof text, "rtsp://192.0.2.10/", 'a', RELAY_LOCATOR_CHARS - 18, "");
        CHECK("every field at its bound and escaped: the answer fits the buffer of the camera leg", relay_digest_key(c.hash, account, c.realm, "x", &key) == 0
              && relay_digest_answer(&key, account, &c, "GET_PARAMETER", text, 0xFFFFFFFFu, "0123456789abcdef0123456789abcdef", out, sizeof out) == 0 && strlen(out) < sizeof out - 512);
        for (size_t cap = 1; cap <= 4096; cap = cap * 2 + 1) {
            char *small = malloc(cap);              /* exactly `cap` bytes: the sanitizer build guards its end */
            if (!small) abort();
            CHECK("a buffer too small is refused, nothing is written past it", relay_digest_answer(&key, account, &c, "DESCRIBE", text, 1, "c", small, cap) != 0);
            free(small);
        }
    }
}

static size_t base64(char *out, const uint8_t *in, size_t n) {
    static const char set[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    size_t at = 0;
    for (size_t i = 0; i < n; i += 3) {
        unsigned v = (unsigned)in[i] << 16 | (i + 1 < n ? (unsigned)in[i + 1] << 8 : 0) | (i + 2 < n ? in[i + 2] : 0);
        out[at++] = set[v >> 18];
        out[at++] = set[(v >> 12) & 63];
        out[at++] = i + 1 < n ? set[(v >> 6) & 63] : '=';
        out[at++] = i + 2 < n ? set[v & 63] : '=';
    }
    out[at] = 0;
    return at;
}

static RelayCode described(const char *text, size_t n, RelayDescription *d) {
    char *copy = exact(text, n);
    RelayCode r = relay_description_parse(copy, n, d);
    free(copy);
    return r;
}

static void descriptions(void) {
    static char text[RELAY_SDP_MAX + 4096], set[4 * RELAY_PSET_MAX];
    static uint8_t raw[RELAY_PSET_MAX + 8];
    RelayDescription d;
    size_t n;
    #define SDP_H264 "v=0\r\nm=video 0 RTP/AVP 96\r\na=rtpmap:96 H264/90000\r\n"
    #define SDP_HEVC "v=0\r\nm=video 0 RTP/AVP 98\r\na=rtpmap:98 H265/90000\r\n"
    CASE(18, "0 byte inside the description");
    row("description", "a 0 byte in the middle", described(B("v=0\r\nm=video 0 RTP/AVP 96\r\na=rtpmap:96 H264/90000\0\r\na=control:t\r\n"), &d) == RELAY_DESCRIPTION_INVALID);
    row("description", "a 0 byte as the last byte", described(B(SDP_H264 "\0"), &d) == RELAY_DESCRIPTION_INVALID);
    row("description", "a 0 byte as the first byte", described(B("\0" SDP_H264), &d) == RELAY_DESCRIPTION_INVALID);
    CASE(19, "no video section, an empty description, one beyond 65,536 bytes");
    row("description", "audio only", described(B("v=0\r\nm=audio 0 RTP/AVP 0\r\na=rtpmap:0 PCMU/8000\r\n"), &d) == RELAY_DESCRIPTION_INVALID);
    row("description", "no media line", described(B("v=0\r\ns=x\r\n"), &d) == RELAY_DESCRIPTION_INVALID);
    row("description", "empty", described("", 0, &d) == RELAY_DESCRIPTION_INVALID);
    row("description", "a word that only begins like the video line", described(B("v=0\r\nm=videoconference 0 RTP/AVP 96\r\na=rtpmap:96 H264/90000\r\n"), &d) == RELAY_DESCRIPTION_INVALID);
    n = long_text(text, sizeof text, SDP_H264 "a=x:", 'x', RELAY_SDP_MAX, "\r\n");
    row("description", "one byte beyond the bound", described(text, RELAY_SDP_MAX + 1, &d) == RELAY_DESCRIPTION_INVALID && n > RELAY_SDP_MAX);
    row("description", "exactly the bound", described(text, RELAY_SDP_MAX, &d) == RELAY_STOPPED && d.codec == RELAY_CODEC_H264);

    CASE(20, "parameter set beyond its bound in the description");
    memset(raw, 0x55, sizeof raw);
    raw[0] = 0x67;
    base64(set, raw, RELAY_PSET_MAX);
    n = (size_t)snprintf(text, sizeof text, SDP_H264 "a=fmtp:96 packetization-mode=1; sprop-parameter-sets=%s,aM4PyA==\r\n", set);
    row("description", "a set of exactly 1,024 bytes is taken whole", described(text, n, &d) == RELAY_STOPPED && d.sets.sps_len == RELAY_PSET_MAX && d.sets.sps[RELAY_PSET_MAX - 1] == 0x55 && d.sets.pps_len == 4);
    base64(set, raw, RELAY_PSET_MAX + 1);
    n = (size_t)snprintf(text, sizeof text, SDP_H264 "a=fmtp:96 sprop-parameter-sets=%s,aM4PyA==\r\n", set);
    row("description", "a set of 1,025 bytes: refused, not cut", described(text, n, &d) == RELAY_DESCRIPTION_INVALID);
    n = long_text(text, sizeof text, SDP_H264 "a=fmtp:96 sprop-parameter-sets=", 'A', 2 * RELAY_PSET_MAX, "\r\n");
    row("description", "2,048 characters of base64", described(text, n, &d) == RELAY_DESCRIPTION_INVALID);
    n = long_text(text, sizeof text, SDP_H264 "a=fmtp:96 sprop-parameter-sets=Z0LAHw==,", 'A', 60000, "\r\n");
    row("description", "60,000 characters after a good set", described(text, n, &d) == RELAY_DESCRIPTION_INVALID);
    raw[0] = 0x40; raw[1] = 0x01;
    base64(set, raw, RELAY_PSET_MAX + 1);
    n = (size_t)snprintf(text, sizeof text, SDP_HEVC "a=fmtp:98 sprop-vps=%s; sprop-sps=QgEBAWAAAAMAAAMAAAMAAAMAlqADwIAQ5Y2uSTK+A=\r\n", set);
    row("description", "HEVC: a VPS of 1,025 bytes", described(text, n, &d) == RELAY_DESCRIPTION_INVALID);
    row("description", "characters that are no base64: the set is not taken, nothing else is",
        described(B(SDP_H264 "a=fmtp:96 sprop-parameter-sets=!!!!,aM4PyA==\r\n"), &d) == RELAY_STOPPED && d.sets.sps_len == 0 && d.sets.pps_len == 4);
    row("description", "an empty value and a lone comma", described(B(SDP_H264 "a=fmtp:96 sprop-parameter-sets=,\r\n"), &d) == RELAY_STOPPED && !relay_sets_complete(d.codec, &d.sets));
    row("description", "a set whose header says another kind is not taken (H.264: a slice)", described(B(SDP_H264 "a=fmtp:96 sprop-parameter-sets=ZQAAAA==,aM4PyA==\r\n"), &d) == RELAY_STOPPED && d.sets.sps_len == 0);
    row("description", "a set with the forbidden bit is not taken", described(B(SDP_H264 "a=fmtp:96 sprop-parameter-sets=50LAHw==,6M4PyA==\r\n"), &d) == RELAY_STOPPED && d.sets.sps_len == 0 && d.sets.pps_len == 0);
    row("description", "HEVC: a PPS where the VPS belongs is not taken (review M-2)", described(B(SDP_HEVC "a=fmtp:98 sprop-vps=RAHA8vA8kA==; sprop-sps=RAHA8vA8kA==; sprop-pps=RAHA8vA8kA==\r\n"), &d) == RELAY_STOPPED
        && d.sets.vps_len == 0 && d.sets.sps_len == 0 && d.sets.pps_len > 0);

    CASE(21, "control value beyond 1,024 bytes");
    n = long_text(text, sizeof text, SDP_H264 "a=control:", 'c', RELAY_LOCATOR_CHARS + 1, "\r\n");
    row("description", "1,025 bytes", described(text, n, &d) == RELAY_DESCRIPTION_INVALID);
    n = long_text(text, sizeof text, SDP_H264 "a=control:", 'c', RELAY_LOCATOR_CHARS, "\r\n");
    row("description", "exactly 1,024 bytes", described(text, n, &d) == RELAY_STOPPED && strlen(d.control) == RELAY_LOCATOR_CHARS);
    n = long_text(text, sizeof text, SDP_H264 "a=control:", 'c', 60000, "");
    row("description", "60,000 bytes and no line end", described(text, n, &d) == RELAY_DESCRIPTION_INVALID);

    CASE(22, "missing fields: no payload type, no rtpmap for it, a type that is no number");
    row("description", "a video line without a payload type", described(B("v=0\r\nm=video 0 RTP/AVP\r\na=rtpmap:96 H264/90000\r\n"), &d) == RELAY_CODEC_NOT_SUPPORTED);
    row("description", "a video line and nothing else", described(B("m=video "), &d) == RELAY_CODEC_NOT_SUPPORTED);
    row("description", "no rtpmap for the payload type", described(B("v=0\r\nm=video 0 RTP/AVP 96\r\na=rtpmap:97 H264/90000\r\n"), &d) == RELAY_CODEC_NOT_SUPPORTED);
    row("description", "a payload type that is a word", described(B("v=0\r\nm=video 0 RTP/AVP abc\r\na=rtpmap:abc H264/90000\r\n"), &d) == RELAY_CODEC_NOT_SUPPORTED);
    row("description", "a payload type beyond 127", described(B("v=0\r\nm=video 0 RTP/AVP 128\r\na=rtpmap:128 H264/90000\r\n"), &d) == RELAY_CODEC_NOT_SUPPORTED);
    row("description", "a payload type of five digits", described(B("v=0\r\nm=video 0 RTP/AVP 00096\r\na=rtpmap:96 H264/90000\r\n"), &d) == RELAY_CODEC_NOT_SUPPORTED);
    row("description", "an rtpmap with no name", described(B("v=0\r\nm=video 0 RTP/AVP 96\r\na=rtpmap:96 \r\n"), &d) == RELAY_CODEC_NOT_SUPPORTED);
    row("description", "the rtpmap of the audio section does not count", described(B("v=0\r\nm=audio 0 RTP/AVP 96\r\na=rtpmap:96 H264/90000\r\nm=video 0 RTP/AVP 96\r\n"), &d) == RELAY_CODEC_NOT_SUPPORTED);
    current_case = 0;

    /* Review M-6: beyond a bound the description is refused, never cut. */
    n = (size_t)snprintf(text, sizeof text, "v=0\r\nm=video 0 RTP/AVP 96\r\n");
    for (int i = 0; i < RELAY_SDP_LINES - 1; i++) n += (size_t)snprintf(text + n, sizeof text - n, "a=x:%d\r\n", i);
    size_t full = n + (size_t)snprintf(text + n, sizeof text - n, "a=rtpmap:96 H264/90000\r\n");
    CHECK("a video section of exactly 96 lines is read to its last line", described(text, full, &d) == RELAY_STOPPED && d.codec == RELAY_CODEC_H264);
    full = n + (size_t)snprintf(text + n, sizeof text - n, "a=x:last\r\na=rtpmap:96 H264/90000\r\n");
    CHECK("a video section of 97 lines is refused, not cut (M-6)", described(text, full, &d) == RELAY_DESCRIPTION_INVALID);
    CHECK("16 payload types are read, the last one counts", described(B("m=video 0 RTP/AVP 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 96\r\na=rtpmap:96 H265/90000\r\n"), &d) == RELAY_STOPPED && d.payload_type == 96);
    CHECK("17 payload types are refused, not cut (M-6)", described(B("m=video 0 RTP/AVP 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 96\r\na=rtpmap:96 H265/90000\r\n"), &d) == RELAY_DESCRIPTION_INVALID);
}

/* One RTP packet from its parts, given to the collector as a heap copy of its exact length. */
static int feed(RelayPicture *p, int marker, int type, uint16_t sequence, uint32_t stamp, const uint8_t *payload, size_t n) {
    uint8_t *k = malloc(12 + n);
    if (!k) abort();
    size_t length = rtp(k, marker, type, sequence, stamp, payload, n);
    int r = relay_picture_add(p, k, length);
    free(k);
    return r;
}

static int raw_packet(RelayPicture *p, const uint8_t *bytes, size_t n) {
    uint8_t *k = exact(bytes, n);
    int r = relay_picture_add(p, k, n);
    free(k);
    return r;
}

typedef struct PacketRow { int id; const char *what; uint8_t bytes[40]; size_t n; int want; } PacketRow;

static void rtp_headers(void) {
    enum { BAD = -(int)RELAY_STREAM_INVALID };
    static const PacketRow rows[] = {
        { 27, "no byte", { 0 }, 0, BAD },
        { 27, "5 bytes", { 0x80, 96, 0, 1, 0 }, 5, BAD },
        { 27, "11 bytes", { 0x80, 96, 0, 1, 0, 0, 0, 1, 1, 1, 1 }, 11, BAD },
        { 27, "version 0", { 0x00, 96, 0, 1, 0, 0, 0, 1, 1, 1, 1, 1, 0x41 }, 13, BAD },
        { 27, "version 1", { 0x40, 96, 0, 1, 0, 0, 0, 1, 1, 1, 1, 1, 0x41 }, 13, BAD },
        { 27, "version 3", { 0xC0, 96, 0, 1, 0, 0, 0, 1, 1, 1, 1, 1, 0x41 }, 13, BAD },
        { 27, "the first byte of a frame of the connection, not of RTP", { '$', 0, 0, 12, 0, 0, 0, 1, 1, 1, 1, 1, 0x41 }, 13, BAD },
        { 0, "12 bytes: a header and no payload", { 0x80, 96, 0, 1, 0, 0, 0, 1, 1, 1, 1, 1 }, 12, 0 },
        { 28, "15 sources named, none there", { 0x8F, 96, 0, 1, 0, 0, 0, 1, 1, 1, 1, 1 }, 12, BAD },
        { 28, "1 source named, 3 of its 4 bytes there", { 0x81, 96, 0, 1, 0, 0, 0, 1, 1, 1, 1, 1, 9, 9, 9 }, 15, BAD },
        { 0, "1 source named and there", { 0x81, 96, 0, 1, 0, 0, 0, 1, 1, 1, 1, 1, 9, 9, 9, 9 }, 16, 0 },
        { 28, "an extension named, its 4 bytes not there", { 0x90, 96, 0, 1, 0, 0, 0, 1, 1, 1, 1, 1, 0xBE, 0xDE, 0 }, 15, BAD },
        { 28, "an extension of 65,535 words", { 0x90, 96, 0, 1, 0, 0, 0, 1, 1, 1, 1, 1, 0xBE, 0xDE, 0xFF, 0xFF, 1, 2, 3, 4 }, 20, BAD },
        { 28, "an extension one word longer than the packet", { 0x90, 96, 0, 1, 0, 0, 0, 1, 1, 1, 1, 1, 0xBE, 0xDE, 0, 2, 1, 2, 3, 4 }, 20, BAD },
        { 28, "sources and an extension that together pass the end", { 0x92, 96, 0, 1, 0, 0, 0, 1, 1, 1, 1, 1, 9, 9, 9, 9, 8, 8, 8, 8, 0xBE, 0xDE, 0, 1 }, 24, BAD },
        { 0, "an extension that ends with the packet", { 0x90, 96, 0, 1, 0, 0, 0, 1, 1, 1, 1, 1, 0xBE, 0xDE, 0, 1, 1, 2, 3, 4 }, 20, 0 },
        { 29, "padding of 0 bytes", { 0xA0, 96, 0, 1, 0, 0, 0, 1, 1, 1, 1, 1, 0x41, 0 }, 14, BAD },
        { 29, "padding longer than what follows the header", { 0xA0, 96, 0, 1, 0, 0, 0, 1, 1, 1, 1, 1, 0x41, 3 }, 14, BAD },
        { 29, "padding of 255 bytes in a packet of 13", { 0xA0, 96, 0, 1, 0, 0, 0, 1, 1, 1, 1, 1, 0xFF }, 13, BAD },
        { 29, "padding named and no byte after the header", { 0xA0, 96, 0, 1, 0, 0, 0, 1, 1, 1, 1, 1 }, 12, BAD },
        { 29, "padding that would reach into the extension", { 0xB0, 96, 0, 1, 0, 0, 0, 1, 1, 1, 1, 1, 0xBE, 0xDE, 0, 0, 0x41, 6 }, 18, BAD },
        { 0, "padding that is all there is after the header", { 0xA0, 96, 0, 1, 0, 0, 0, 1, 1, 1, 1, 1, 0, 2 }, 14, 0 },
    };
    case_name[27] = "packet shorter than 12 bytes, or not version 2";
    case_name[28] = "source count or extension length beyond the packet";
    case_name[29] = "padding count 0, or beyond the packet";
    for (size_t i = 0; i < sizeof rows / sizeof *rows; i++) {
        RelayPicture p;
        if (relay_picture_init(&p, RELAY_CODEC_H264, 96)) abort();
        current_case = rows[i].id;
        row("RTP header", rows[i].what, raw_packet(&p, rows[i].bytes, rows[i].n) == rows[i].want && p.length == 0);
        relay_picture_free(&p);
    }
    current_case = 0;
    /* A packet with sources, an extension and padding around ONE unit: exactly that unit comes out. */
    {
        static const uint8_t k[] = { 0xB1, 0x80 | 96, 0, 1, 0, 0, 0, 1, 1, 1, 1, 1, 9, 9, 9, 9, 0xBE, 0xDE, 0, 1, 7, 7, 7, 7, 0x41, 0x9A, 0, 0, 3 };
        static const uint8_t want[] = { 0, 0, 0, 1, 0x41, 0x9A };
        RelayPicture p;
        if (relay_picture_init(&p, RELAY_CODEC_H264, 96)) abort();
        CHECK("sources, extension and padding are skipped, the unit is whole", raw_packet(&p, k, sizeof k) == 1 && p.length == sizeof want && !memcmp(p.unit, want, sizeof want));
        relay_picture_free(&p);
    }
}

static void depacketiser(void) {
    static uint8_t big[60000];
    RelayPicture p;
    static const uint8_t slice[] = { 0x41, 0x9A }, idr[] = { 0x65, 0x88 };

    CASE(30, "fragment without its start");
    if (relay_picture_init(&p, RELAY_CODEC_H264, 96)) abort();
    static const uint8_t middle[] = { 0x7C, 0x05, 0xAA }, end[] = { 0x7C, 0x45, 0xBB };
    row("H.264", "a middle fragment first", feed(&p, 0, 96, 1, 100, middle, sizeof middle) == 0 && p.damaged);
    row("H.264", "its end with the mark: no picture, counted as lost", feed(&p, 1, 96, 2, 100, end, sizeof end) == 0 && p.length == 0 && p.dropped == 1 && !p.keyframe);
    row("H.264", "the next picture is whole again", feed(&p, 1, 96, 3, 200, slice, sizeof slice) == 1 && p.length == 6);
    relay_picture_free(&p);
    if (relay_picture_init(&p, RELAY_CODEC_HEVC, 98)) abort();
    static const uint8_t h_end[] = { 0x62, 0x01, 0x53, 0x22 };
    row("HEVC", "an end fragment first, with the mark", feed(&p, 1, 98, 1, 100, h_end, sizeof h_end) == 0 && p.length == 0 && p.dropped == 1);
    relay_picture_free(&p);

    CASE(31, "fragment start without its end");
    if (relay_picture_init(&p, RELAY_CODEC_H264, 96)) abort();
    static const uint8_t begin[] = { 0x7C, 0x85, 0xAA, 0xBB };
    row("H.264", "a start, then the mark without the end bit: no picture", feed(&p, 0, 96, 1, 100, begin, sizeof begin) == 0 && feed(&p, 1, 96, 2, 100, middle, sizeof middle) == 0 && p.length == 0 && p.dropped == 1);
    row("H.264", "a start, then the next stamp: the open picture is dropped, the new one stands alone",
        feed(&p, 0, 96, 3, 200, begin, sizeof begin) == 0 && feed(&p, 1, 96, 4, 300, slice, sizeof slice) == 1 && p.length == 6 && p.dropped == 2 && !p.keyframe && p.stamp == 300);
    relay_picture_taken(&p);
    row("H.264", "a start, then a whole unit in its place: the cut unit is not handed on", feed(&p, 0, 96, 5, 400, begin, sizeof begin) == 0 && feed(&p, 1, 96, 6, 400, slice, sizeof slice) == 0 && p.dropped == 3);
    row("H.264", "a start, then a second start: the first is cut", feed(&p, 0, 96, 7, 500, begin, sizeof begin) == 0 && feed(&p, 0, 96, 8, 500, begin, sizeof begin) == 0 && feed(&p, 1, 96, 9, 500, end, sizeof end) == 0 && p.dropped == 4);
    relay_picture_free(&p);
    if (relay_picture_init(&p, RELAY_CODEC_HEVC, 98)) abort();
    static const uint8_t h_begin[] = { 0x62, 0x01, 0x93, 0x11 }, h_slice[] = { 0x02, 0x01, 0x80 };
    row("HEVC", "a start, then the next stamp", feed(&p, 0, 98, 1, 100, h_begin, sizeof h_begin) == 0 && feed(&p, 1, 98, 2, 200, h_slice, sizeof h_slice) == 1 && p.length == 7 && p.dropped == 1 && !p.keyframe);
    relay_picture_free(&p);

    CASE(32, "aggregation size beyond the packet, or 0");
    if (relay_picture_init(&p, RELAY_CODEC_H264, 96)) abort();
    static const uint8_t over[] = { 24, 0, 2, 0x41, 0x9A, 0, 9, 0x65, 0x88 }, none[] = { 24, 0, 0, 0x65, 0x88 }, most[] = { 24, 0xFF, 0xFF, 0x65 }, half[] = { 24, 0 };
    row("H.264", "the second size passes the end: the first unit is not handed on either", feed(&p, 1, 96, 1, 100, over, sizeof over) == 0 && p.length == 0 && p.dropped == 1);
    row("H.264", "a size of 0", feed(&p, 1, 96, 2, 200, none, sizeof none) == 0 && p.length == 0 && p.dropped == 2 && !p.keyframe);
    row("H.264", "a size of 65,535 in a packet of 4", feed(&p, 1, 96, 3, 300, most, sizeof most) == 0 && p.dropped == 3);
    row("H.264", "half a size", feed(&p, 1, 96, 4, 400, half, sizeof half) == 0 && p.length == 0);
    static const uint8_t good[] = { 24, 0, 2, 0x41, 0x9A, 0, 2, 0x41, 0x9B };
    row("H.264", "sizes that fit are taken", feed(&p, 1, 96, 5, 500, good, sizeof good) == 1 && p.length == 12 && p.units == 2);
    relay_picture_free(&p);
    if (relay_picture_init(&p, RELAY_CODEC_HEVC, 98)) abort();
    static const uint8_t h_over[] = { 0x60, 0x01, 0, 3, 0x02, 0x01, 0x80, 0, 200, 0x26 };
    row("HEVC", "the second size passes the end", feed(&p, 1, 98, 1, 100, h_over, sizeof h_over) == 0 && p.length == 0 && p.dropped == 1);
    relay_picture_free(&p);

    CASE(33, "reassembly without end: a picture beyond 8 MiB");
    if (relay_picture_init(&p, RELAY_CODEC_H264, 96)) abort();
    memset(big, 0xAB, sizeof big);
    big[0] = 0x7C; big[1] = 0x85;
    int r = feed(&p, 0, 96, 1, 100, big, sizeof big), packets = 1;
    big[1] = 0x05;
    while (r == 0 && packets < 1000) r = feed(&p, 0, 96, (uint16_t)(1 + packets++), 100, big, sizeof big);
    row("H.264", "fragments without an end are refused at the bound, the stream is invalid", r == -(int)RELAY_STREAM_INVALID && p.length <= RELAY_UNIT_MAX && p.length > RELAY_UNIT_MAX - sizeof big && p.cap <= 2 * RELAY_UNIT_MAX);
    relay_picture_free(&p);
    if (relay_picture_init(&p, RELAY_CODEC_HEVC, 98)) abort();
    big[0] = 0x02; big[1] = 0x01;
    for (r = 0, packets = 0; r == 0 && packets < 1000; packets++) r = feed(&p, 0, 98, (uint16_t)packets, 100, big, sizeof big);
    row("HEVC", "whole units of one stamp without a mark: the same bound", r == -(int)RELAY_STREAM_INVALID && p.length <= RELAY_UNIT_MAX && p.cap <= 2 * RELAY_UNIT_MAX);
    relay_picture_free(&p);

    CASE(34, "type that is no unit (in a fragment, among several), forbidden bit, a start code inside a unit");
    static const int h264_none[] = { 0, 24, 25, 26, 27, 28, 29, 30, 31 }, hevc_none[] = { 48, 49, 50, 56, 63 };
    for (size_t i = 0; i < sizeof h264_none / sizeof *h264_none; i++) {
        char what[96];
        uint8_t fu[] = { 0x7C, (uint8_t)(0xC0 | h264_none[i]), 0xAA }, several[] = { 24, 0, 2, (uint8_t)(0x60 | h264_none[i]), 0xAA };
        if (relay_picture_init(&p, RELAY_CODEC_H264, 96)) abort();
        snprintf(what, sizeof what, "a fragment that names type %d inside", h264_none[i]);
        row("H.264", what, feed(&p, 1, 96, 1, 100, fu, sizeof fu) == 0 && p.length == 0 && p.refused == 1 && p.dropped == 1);
        snprintf(what, sizeof what, "a unit of type %d among several", h264_none[i]);
        row("H.264", what, feed(&p, 1, 96, 2, 200, several, sizeof several) == 0 && p.length == 0 && p.refused == 2 && p.dropped == 2);
        relay_picture_free(&p);
    }
    for (size_t i = 0; i < sizeof hevc_none / sizeof *hevc_none; i++) {
        char what[96];
        uint8_t fu[] = { 0x62, 0x01, (uint8_t)(0xC0 | hevc_none[i]), 0xAA }, several[] = { 0x60, 0x01, 0, 3, (uint8_t)(hevc_none[i] << 1), 0x01, 0xAA };
        if (relay_picture_init(&p, RELAY_CODEC_HEVC, 98)) abort();
        snprintf(what, sizeof what, "a fragment that names type %d inside", hevc_none[i]);
        row("HEVC", what, feed(&p, 1, 98, 1, 100, fu, sizeof fu) == 0 && p.length == 0 && p.refused == 1 && p.dropped == 1);
        snprintf(what, sizeof what, "a unit of type %d among several", hevc_none[i]);
        row("HEVC", what, feed(&p, 1, 98, 2, 200, several, sizeof several) == 0 && p.length == 0 && p.refused == 2 && p.dropped == 2);
        relay_picture_free(&p);
    }
    if (relay_picture_init(&p, RELAY_CODEC_H264, 96)) abort();
    static const uint8_t f_single[] = { 0xE5, 0x88 }, f_fu[] = { 0xFC, 0xC5, 0xAA }, f_inside[] = { 24, 0, 2, 0xE5, 0x88 };
    row("H.264", "the forbidden bit on a single unit", feed(&p, 1, 96, 1, 100, f_single, sizeof f_single) == 0 && p.refused == 1 && !p.keyframe);
    row("H.264", "the forbidden bit on a fragment", feed(&p, 1, 96, 2, 200, f_fu, sizeof f_fu) == 0 && p.refused == 2);
    row("H.264", "the forbidden bit on a unit among several", feed(&p, 1, 96, 3, 300, f_inside, sizeof f_inside) == 0 && p.refused == 3 && p.length == 0);
    static const uint8_t hidden[] = { 0x41, 0x9A, 0, 0, 1, 0x65, 0x88 }, hidden4[] = { 0x41, 0, 0, 0, 1, 0x67, 0x42 }, tail[] = { 0x41, 0x9A, 0, 0 }, three[] = { 0x41, 0x9A, 0, 0, 3, 1 };
    row("H.264", "a start code inside a unit: one unit was written, two would be read", feed(&p, 1, 96, 4, 400, hidden, sizeof hidden) == 0 && p.refused == 4 && p.length == 0 && p.dropped == 4);
    row("H.264", "a four-byte start code inside a unit", feed(&p, 1, 96, 5, 500, hidden4, sizeof hidden4) == 0 && p.refused == 5);
    static const uint8_t split1[] = { 0x7C, 0x81, 0x9A, 0, 0 }, split2[] = { 0x7C, 0x41, 1, 0x65, 0x88 };
    row("H.264", "a start code that two fragments make together", feed(&p, 0, 96, 6, 600, split1, sizeof split1) == 0 && feed(&p, 1, 96, 7, 600, split2, sizeof split2) == 0 && p.refused == 6 && p.length == 0);
    row("H.264", "zeros at the end of a unit make no start code with the next one", feed(&p, 0, 96, 8, 700, tail, sizeof tail) == 0 && feed(&p, 1, 96, 9, 700, idr, sizeof idr) == 1 && p.units == 2 && p.refused == 6);
    relay_picture_taken(&p);
    row("H.264", "the escape of the codec (00 00 03) is no start code", feed(&p, 1, 96, 10, 800, three, sizeof three) == 1 && p.refused == 6);
    relay_picture_free(&p);
    if (relay_picture_init(&p, RELAY_CODEC_HEVC, 98)) abort();
    static const uint8_t hf[] = { 0x82, 0x01, 0x80 }, h_hidden[] = { 0x02, 0x01, 0, 0, 1, 0x40, 0x01 };
    row("HEVC", "the forbidden bit", feed(&p, 1, 98, 1, 100, hf, sizeof hf) == 0 && p.refused == 1);
    row("HEVC", "a start code inside a unit", feed(&p, 1, 98, 2, 200, h_hidden, sizeof h_hidden) == 0 && p.refused == 2 && p.length == 0);
    relay_picture_free(&p);
    current_case = 0;

    /* Review M-1, M-2: a parameter set is one only when its header says so. */
    static const uint8_t sps[] = { 0x67, 0x42, 0x00, 0x1F }, pps[] = { 0x68, 0xCE }, vps[] = { 0x40, 0x01, 0x0C }, hsps[] = { 0x42, 0x01, 0x01 }, hpps[] = { 0x44, 0x01, 0xC0 };
    CHECK("H.264 sets by their kind", relay_set_valid(RELAY_CODEC_H264, 1, sps, 4) && relay_set_valid(RELAY_CODEC_H264, 2, pps, 2) && !relay_set_valid(RELAY_CODEC_H264, 1, pps, 2)
          && !relay_set_valid(RELAY_CODEC_H264, 2, sps, 4) && !relay_set_valid(RELAY_CODEC_H264, 0, sps, 4) && !relay_set_valid(RELAY_CODEC_H264, 1, sps, 3) && !relay_set_valid(RELAY_CODEC_H264, 2, pps, 1));
    CHECK("HEVC sets by their kind", relay_set_valid(RELAY_CODEC_HEVC, 0, vps, 3) && relay_set_valid(RELAY_CODEC_HEVC, 1, hsps, 3) && relay_set_valid(RELAY_CODEC_HEVC, 2, hpps, 3)
          && !relay_set_valid(RELAY_CODEC_HEVC, 0, hsps, 3) && !relay_set_valid(RELAY_CODEC_HEVC, 1, hpps, 3) && !relay_set_valid(RELAY_CODEC_HEVC, 2, vps, 3) && !relay_set_valid(RELAY_CODEC_HEVC, 0, vps, 2));
    static const uint8_t f_sps[] = { 0xE7, 0x42, 0x00, 0x1F }, t0_vps[] = { 0x40, 0x00, 0x0C };
    CHECK("forbidden bit, a temporal identifier of 0, no bytes, no codec", !relay_set_valid(RELAY_CODEC_H264, 1, f_sps, 4) && !relay_set_valid(RELAY_CODEC_HEVC, 0, t0_vps, 3)
          && !relay_set_valid(RELAY_CODEC_H264, 1, sps, 0) && !relay_set_valid(RELAY_CODEC_H264, 1, NULL, 4) && !relay_set_valid(RELAY_CODEC_NONE, 1, sps, 4) && !relay_set_valid(RELAY_CODEC_H264, 1, sps, RELAY_PSET_MAX + 1));
    ParamSets sets;
    memset(&sets, 0, sizeof sets);
    memcpy(sets.sps, sps, 4); sets.sps_len = 4; memcpy(sets.pps, pps, 2); sets.pps_len = 2;
    CHECK("the sets the library is given are valid ones", relay_sets_valid(RELAY_CODEC_H264, &sets) && !relay_sets_valid(RELAY_CODEC_HEVC, &sets));
    sets.pps[0] = 0x65;
    CHECK("a slice in the place of a set is not", !relay_sets_valid(RELAY_CODEC_H264, &sets));
    if (relay_picture_init(&p, RELAY_CODEC_H264, 96)) abort();
    static const uint8_t short_sps[] = { 24, 0, 3, 0x67, 0x42, 0x00, 0, 2, 0x68, 0xCE };
    CHECK("a set of the stream that is too short to be one is not kept", feed(&p, 0, 96, 1, 100, short_sps, sizeof short_sps) == 0 && p.seen.sps_len == 0 && p.seen.pps_len == 2);
    relay_picture_free(&p);

    /* Review M-3: recorded time may not run ahead of this host's clock. */
    CHECK("one picture of 25 a second", relay_step_plausible(3600, 40000, 3600, 40000));
    CHECK("a step of 10 s more than the time that passed, and no more", relay_step_plausible(RELAY_STEP_TICKS + 3600, 40000, RELAY_STEP_TICKS + 3600, 40000) && !relay_step_plausible(RELAY_STEP_TICKS + 3601, 40000, RELAY_STEP_TICKS + 3601, 40000));
    CHECK("the largest step a stamp can make (6.6 hours) is refused", !relay_step_plausible(0x7FFFFFFF, 40000, 0x7FFFFFFF, 40000));
    CHECK("a long pause is a long step", relay_step_plausible(90000LL * 3600, 3600LL * 1000000, 90000LL * 3600, 3600LL * 1000000));
    CHECK("many steps that each pass may not sum to more than the bound", !relay_step_plausible(90000, 40000, 20 * 90000LL, 1000000));
    CHECK("a camera clock 1 per cent fast over 8 hours passes, 2 per cent does not", relay_step_plausible(3600, 40000, 90000LL * 28800 / 100 * 101, 28800LL * 1000000)
          && !relay_step_plausible(3600, 40000, 90000LL * 28800 / 100 * 102 + RELAY_STEP_TICKS, 28800LL * 1000000));
    CHECK("a step backwards is not ahead", relay_step_plausible(-90000, 40000, 0, 40000) && relay_step_plausible(0, -5, 0, -5));
}

/* ---------------------------------------------------------------- the camera leg itself, on a socket pair */
typedef struct Wire { RelayCamera *camera; RelayStart start; int peer; } Wire;

static void wire_open(Wire *w, const void *bytes, size_t n) {
    int fd[2], big = 1 << 20;
    if (socketpair(AF_UNIX, SOCK_STREAM, 0, fd)) abort();
    for (int i = 0; i < 2; i++) { setsockopt(fd[i], SOL_SOCKET, SO_SNDBUF, &big, sizeof big); setsockopt(fd[i], SOL_SOCKET, SO_RCVBUF, &big, sizeof big); }
    fcntl(fd[1], F_SETFL, fcntl(fd[1], F_GETFL) | O_NONBLOCK);
    for (size_t at = 0; at < n;) {
        ssize_t k = write(fd[1], (const char *)bytes + at, n - at);
        if (k <= 0) { printf("relay_unit_test: the socket pair does not hold %zu bytes\n", n); abort(); }
        at += (size_t)k;
    }
    shutdown(fd[1], SHUT_WR);                       /* the camera has said everything: the relay then sees its end */
    parse(GOOD, &w->start);
    w->camera = relay_camera_new(&w->start, NULL, NULL);
    if (!w->camera) abort();
    relay_camera_adopt(w->camera, fd[0]);
    w->peer = fd[1];
}

/* What the relay sent to the camera so far, as a text. */
static const char *wire_sent(Wire *w) {
    static char sent[65536];
    size_t n = 0;
    for (;;) {
        ssize_t k = read(w->peer, sent + n, sizeof sent - 1 - n);
        if (k <= 0) break;
        n += (size_t)k;
    }
    sent[n] = 0;
    return sent;
}

static void wire_close(Wire *w) {
    relay_camera_close(w->camera);
    close(w->peer);
}

#define SDP "v=0\r\nm=video 0 RTP/AVP 96\r\na=rtpmap:96 H264/90000\r\na=control:track1\r\n"
#define ANSWER_401 "RTSP/1.0 401 Unauthorized\r\nCSeq: 1\r\nWWW-Authenticate: Digest realm=\"unit\", nonce=\"0a1b2c3d\"\r\n\r\n"
#define ANSWER_DESCRIBE "RTSP/1.0 200 OK\r\nCSeq: 2\r\nContent-Base: rtsp://192.0.2.10:8554/media/video1/\r\nContent-Type: application/sdp\r\nContent-Length: 69\r\n\r\n" SDP
#define ANSWER_SETUP "RTSP/1.0 200 OK\r\nCSeq: 3\r\nTransport: RTP/AVP/TCP;unicast;interleaved=0-1\r\nSession: 12345678;timeout=60\r\n\r\n"
#define ANSWER_PLAY "RTSP/1.0 200 OK\r\nCSeq: 4\r\nSession: 12345678\r\n\r\n"
#define DIALOGUE ANSWER_401 ANSWER_DESCRIBE ANSWER_SETUP ANSWER_PLAY
_Static_assert(sizeof SDP - 1 == 69, "the Content-Length of the unit dialogue is the length of its description");
/* One video packet in a frame of the connection: a slice of two bytes with the mark. */
#define VIDEO "$\x00\x00\x0E\x80\xE0\x00\x01\x00\x00\x00\x64\x01\x01\x01\x01\x41\x9A"

typedef struct OpenRow { int id; const char *what; const char *bytes; size_t n; RelayCode want; } OpenRow;

static void client(void) {
    static const OpenRow rows[] = {
        { 0, "the whole dialogue", B(DIALOGUE), RELAY_STOPPED },
        { 0, "the camera says nothing and ends", B(""), RELAY_CAMERA_LOST },
        { 0, "the answer breaks off in its head", B("RTSP/1.0 200 OK\r\nCSeq: 1\r\nContent-Le"), RELAY_CAMERA_LOST },
        { 0, "the body is shorter than its stated length", B("RTSP/1.0 401 U\r\nCSeq: 1\r\nWWW-Authenticate: Digest realm=\"unit\", nonce=\"n\"\r\n\r\n" "RTSP/1.0 200 OK\r\nCSeq: 2\r\nContent-Length: 500\r\n\r\n" SDP), RELAY_CAMERA_LOST },
        { 1, "an answer of another protocol", B("HTTP/1.1 200 OK\r\nCSeq: 1\r\nContent-Length: 0\r\n\r\n"), RELAY_CAMERA_PROTOCOL },
        { 2, "a status that is none", B("RTSP/1.0 2x0 OK\r\nCSeq: 1\r\n\r\n"), RELAY_CAMERA_PROTOCOL },
        { 4, "a 0 byte in the head", B("RTSP/1.0 200 OK\r\nCSeq: 1\0\r\n\r\n"), RELAY_CAMERA_PROTOCOL },
        { 6, "a negative body length", B("RTSP/1.0 200 OK\r\nCSeq: 1\r\nContent-Length: -1\r\n\r\n"), RELAY_CAMERA_PROTOCOL },
        { 7, "a body length beyond the bound", B("RTSP/1.0 200 OK\r\nCSeq: 1\r\nContent-Length: 65537\r\n\r\n"), RELAY_CAMERA_PROTOCOL },
        { 8, "text after the body length", B("RTSP/1.0 200 OK\r\nCSeq: 1\r\nContent-Length: 69 bytes\r\n\r\n"), RELAY_CAMERA_PROTOCOL },
        { 9, "the body length stated twice", B("RTSP/1.0 200 OK\r\nCSeq: 1\r\nContent-Length: 0\r\nContent-Length: 69\r\n\r\n" SDP), RELAY_CAMERA_PROTOCOL },
        { 26, "a byte that begins neither, in the place of an answer", B("\x01\x02\x03\x04"), RELAY_CAMERA_PROTOCOL },
        { 0, "a status the open does not expect", B("RTSP/1.0 500 Internal\r\nCSeq: 1\r\n\r\n"), RELAY_CAMERA_PROTOCOL },
        { 0, "a redirect is never followed", B("RTSP/1.0 302 Moved\r\nCSeq: 1\r\nLocation: rtsp://198.51.100.1/x\r\n\r\n"), RELAY_REDIRECT_REFUSED },
        { 0, "a missing stream", B("RTSP/1.0 404 Not Found\r\nCSeq: 1\r\n\r\n"), RELAY_LOCATOR_NOT_FOUND },
        { 0, "a Content-Base of another host", B("RTSP/1.0 200 OK\r\nCSeq: 1\r\nContent-Base: rtsp://198.51.100.1:8554/media/video1/\r\nContent-Length: 69\r\n\r\n" SDP), RELAY_CONTROL_ADDRESS_REFUSED },
        { 0, "a description that is none", B("RTSP/1.0 200 OK\r\nCSeq: 1\r\nContent-Length: 5\r\n\r\nhello"), RELAY_DESCRIPTION_INVALID },
        { 0, "a datagram transport in the answer to SETUP", B(ANSWER_401 ANSWER_DESCRIBE "RTSP/1.0 200 OK\r\nCSeq: 3\r\nTransport: RTP/AVP;unicast;client_port=5000-5001;server_port=6000-6001\r\nSession: 1\r\n\r\n"), RELAY_TRANSPORT_REFUSED },
        { 0, "no session in the answer to SETUP", B(ANSWER_401 ANSWER_DESCRIBE "RTSP/1.0 200 OK\r\nCSeq: 3\r\nTransport: RTP/AVP/TCP;interleaved=0-1\r\n\r\n"), RELAY_CAMERA_PROTOCOL },
        { 0, "Digest, then a challenge of another realm: the key answers no second realm", B(ANSWER_401 "RTSP/1.0 401 U\r\nCSeq: 2\r\nWWW-Authenticate: Digest realm=\"other\", nonce=\"n\", stale=true\r\n\r\n"), RELAY_AUTH_REFUSED },
        { 0, "Digest, then a refusal that is not stale", B(ANSWER_401 "RTSP/1.0 401 U\r\nCSeq: 2\r\nWWW-Authenticate: Digest realm=\"unit\", nonce=\"m\"\r\n\r\n"), RELAY_AUTH_REFUSED },
        { 0, "a stale nonce is answered once more, a second stale one is not", B(ANSWER_401 "RTSP/1.0 401 U\r\nCSeq: 2\r\nWWW-Authenticate: Digest realm=\"unit\", nonce=\"m\", stale=true\r\n\r\n"
                                                                              "RTSP/1.0 401 U\r\nCSeq: 3\r\nWWW-Authenticate: Digest realm=\"unit\", nonce=\"k\", stale=true\r\n\r\n"), RELAY_AUTH_REFUSED },
        { 0, "frames before the answer are dropped, the answer is read", B("$\x00\x00\x02\xAA\xBB$\x01\x00\x00" ANSWER_401 "$\x00\x00\x00" ANSWER_DESCRIBE ANSWER_SETUP ANSWER_PLAY), RELAY_STOPPED },
        { 0, "eight messages that are not the answer are read past", B("RTSP/1.0 200 OK\r\nCSeq: 99\r\n\r\n" "RTSP/1.0 200 OK\r\n\r\n" "OPTIONS * RTSP/1.0\r\nCSeq: 1\r\n\r\n" "RTSP/1.0 200 OK\r\nCSeq: 0\r\n\r\n"
                                                                    "RTSP/1.0 200 OK\r\nCSeq: 2\r\n\r\n" "RTSP/1.0 200 OK\r\nCSeq: x\r\n\r\n" "RTSP/1.0 200 OK\r\nCSeq: 11\r\n\r\n" "RTSP/1.0 200 OK\r\nCSeq: 5\r\n\r\n" DIALOGUE), RELAY_STOPPED },
        { 0, "nine are not: the wait for one answer ends by count as well as by the clock", B("RTSP/1.0 200 OK\r\nCSeq: 99\r\n\r\n" "RTSP/1.0 200 OK\r\n\r\n" "OPTIONS * RTSP/1.0\r\nCSeq: 1\r\n\r\n" "RTSP/1.0 200 OK\r\nCSeq: 0\r\n\r\n"
                                                                    "RTSP/1.0 200 OK\r\nCSeq: 2\r\n\r\n" "RTSP/1.0 200 OK\r\nCSeq: x\r\n\r\n" "RTSP/1.0 200 OK\r\nCSeq: 11\r\n\r\n" "RTSP/1.0 200 OK\r\nCSeq: 5\r\n\r\n" "RTSP/1.0 200 OK\r\nCSeq: 6\r\n\r\n" DIALOGUE), RELAY_CAMERA_PROTOCOL },
    };
    static char text[2 * RELAY_HEAD_MAX];
    RelayDescription d;
    Wire w;
    size_t n;
    for (size_t i = 0; i < sizeof rows / sizeof *rows; i++) {
        current_case = rows[i].id;
        wire_open(&w, rows[i].bytes, rows[i].n);
        row("the camera leg, open", rows[i].what, relay_camera_open(w.camera, &d) == rows[i].want);
        wire_close(&w);
    }
    current_case = 3;
    n = long_text(text, sizeof text, "RTSP/1.0 200 OK\r\nCSeq: 1\r\nX: ", 'a', RELAY_HEAD_MAX, "\r\n\r\n");
    wire_open(&w, text, n);
    row("the camera leg, open", "a head with no end inside the bound", relay_camera_open(w.camera, &d) == RELAY_CAMERA_PROTOCOL);
    wire_close(&w);
    current_case = 0;

    /* S13-01 on the real client: a Basic challenge is never answered, with anything. */
    wire_open(&w, B("RTSP/1.0 401 Unauthorized\r\nCSeq: 1\r\nWWW-Authenticate: Basic realm=\"unit\"\r\n\r\n"));
    CHECK("a Basic challenge ends the open", relay_camera_open(w.camera, &d) == RELAY_AUTH_SCHEME_NOT_ALLOWED);
    const char *sent = wire_sent(&w);
    CHECK("one request left, without an Authorization header", strstr(sent, "DESCRIBE ") == sent && !strstr(sent + 1, "DESCRIBE ") && !strstr(sent, "Authorization"));
    CHECK("the password is still there (no key was made of it)", !strcmp(w.start.secret, "unit-placeholder"));
    wire_close(&w);
    wire_open(&w, B(DIALOGUE));
    CHECK("the dialogue opens", relay_camera_open(w.camera, &d) == RELAY_STOPPED && d.codec == RELAY_CODEC_H264);
    sent = wire_sent(&w);
    CHECK("the first request carries no answer, the others a Digest answer to the locator's own host", !strncmp(sent, "DESCRIBE rtsp://192.0.2.10:8554/media/video1 RTSP/1.0\r\nCSeq: 1\r\nUser-Agent: DEMS-capture-relay\r\nAccept:", 96)
          && strstr(sent, "CSeq: 2\r\nUser-Agent: DEMS-capture-relay\r\nAuthorization: Digest username=\"unit\", realm=\"unit\", nonce=\"0a1b2c3d\", uri=\"rtsp://192.0.2.10:8554/media/video1\", response=\"")
          && strstr(sent, "SETUP rtsp://192.0.2.10:8554/media/video1/track1 RTSP/1.0\r\nCSeq: 3\r\n") && strstr(sent, "PLAY rtsp://192.0.2.10:8554/media/video1/ RTSP/1.0\r\nCSeq: 4\r\n"));
    CHECK("the password was overwritten when the key was made", w.start.secret[0] == 0 && relay_camera_counters(w.camera)->auth_answers == 3 && relay_camera_counters(w.camera)->challenges == 1);
    wire_close(&w);
    /* Review L-2: a challenge whose every field is at its bound and full of quotes is ANSWERED (the camera then
     * ends); it does not end the relay with the code of a fault of its own. */
    n = long_text(text, sizeof text, "RTSP/1.0 401 U\r\nCSeq: 1\r\nWWW-Authenticate: Digest qop=\"auth\", realm=\"", '"', 0, "");
    for (int field = 0; field < 3; field++) {
        for (int i = 0; i < RELAY_FIELD_CHARS; i++) { text[n++] = '\\'; text[n++] = '"'; }
        n += (size_t)snprintf(text + n, sizeof text - n, "%s", field == 0 ? "\", nonce=\"" : field == 1 ? "\", opaque=\"" : "\"\r\n\r\n");
    }
    wire_open(&w, text, n);
    CHECK("a challenge full of quotes is answered, not a fault of the relay (L-2)", relay_camera_open(w.camera, &d) == RELAY_CAMERA_LOST && relay_camera_counters(w.camera)->auth_answers == 1);
    sent = wire_sent(&w);
    CHECK("the answer is whole and its request ends as a request", strstr(sent, "Authorization: Digest username=\"unit\", realm=\"\\\"\\\"") && strstr(sent, "qop=auth, nc=00000001, cnonce=\"") && n > 4 && !strcmp(sent + strlen(sent) - 4, "\r\n\r\n"));
    wire_close(&w);

    /* ---- playing: the frames of the connection (cases 23 to 26), through the real read loop */
    const uint8_t *packet;
    size_t length;
    RelayWire f;
    CASE(23, "frame with a length of 0");
    row("front", "four bytes are a whole frame", front("$\x00\x00\x00", 4, &f) == RELAY_FRONT_FRAME && f.total == 4 && f.channel == 0);
    wire_open(&w, B(DIALOGUE "$\x00\x00\x00" "$\x00\x00\x00" VIDEO));
    row("the camera leg, playing", "empty frames of the video channel are dropped, never handed on as a packet",
        relay_camera_open(w.camera, &d) == RELAY_STOPPED && relay_camera_read(w.camera, &packet, &length) == RELAY_STOPPED && length == 14 && packet[12] == 0x41
        && relay_camera_counters(w.camera)->frames_dropped == 2 && relay_camera_counters(w.camera)->packets == 1);
    row("the camera leg, playing", "then the camera's end", relay_camera_read(w.camera, &packet, &length) == RELAY_CAMERA_LOST);
    wire_close(&w);
    CASE(24, "frame of another channel");
    row("front", "the channel is named", front("$\x07\x00\x01\xAA", 5, &f) == RELAY_FRONT_FRAME && f.total == 5 && f.channel == 7);
    wire_open(&w, B(DIALOGUE "$\x01\x00\x04\x80\xC8\x00\x06" "$\x07\x00\x05hello" "$\xFF\xFF\xFF" VIDEO));
    row("the camera leg, playing", "reports and other channels are dropped: the last one keeps its 65,535 bytes waiting, then the camera ends",
        relay_camera_open(w.camera, &d) == RELAY_STOPPED && relay_camera_read(w.camera, &packet, &length) == RELAY_CAMERA_LOST && relay_camera_counters(w.camera)->frames_dropped == 2 && relay_camera_counters(w.camera)->packets == 0);
    wire_close(&w);
    wire_open(&w, B(DIALOGUE "$\x01\x00\x04\x80\xC8\x00\x06" "$\x07\x00\x05hello" VIDEO "$\x02\x00\x00" VIDEO));
    row("the camera leg, playing", "the video between them is handed on, each packet once",
        relay_camera_open(w.camera, &d) == RELAY_STOPPED && relay_camera_read(w.camera, &packet, &length) == RELAY_STOPPED && length == 14
        && relay_camera_read(w.camera, &packet, &length) == RELAY_STOPPED && length == 14 && relay_camera_read(w.camera, &packet, &length) == RELAY_CAMERA_LOST
        && relay_camera_counters(w.camera)->frames_dropped == 3 && relay_camera_counters(w.camera)->packets == 2);
    wire_close(&w);
    CASE(25, "length field beyond what arrives, and the largest length there is");
    row("front", "three bytes: more", front("$\x00\xFF", 3, &f) == RELAY_FRONT_MORE);
    row("front", "a length of 65,535 and 100 bytes: more, nothing is read past them", front("$\x00\xFF\xFF" "0123456789", 14, &f) == RELAY_FRONT_MORE && f.total == 4 + 65535);
    {
        static char stream[sizeof DIALOGUE + 2 * 65539 + 64];
        size_t at = sizeof DIALOGUE - 1;
        memcpy(stream, DIALOGUE, at);
        memcpy(stream + at, "$\x00\xFF\xFF", 4);
        memset(stream + at + 4, 0x55, 65535);
        stream[at + 4] = (char)0x80; stream[at + 5] = 96;
        row("front", "the largest frame, whole", front(stream + at, 4 + 65535, &f) == RELAY_FRONT_FRAME && f.total == 4 + 65535);
        memcpy(stream + at + 4 + 65535, "$\x00\xFF\xFF" "short", 9);
        wire_open(&w, stream, at + 4 + 65535 + 9);
        row("the camera leg, playing", "the largest frame is handed on whole, inside the buffer",
            relay_camera_open(w.camera, &d) == RELAY_STOPPED && relay_camera_read(w.camera, &packet, &length) == RELAY_STOPPED && length == 65535 && packet[0] == 0x80 && packet[65534] == 0x55);
        row("the camera leg, playing", "a frame that says 65,535 and holds 5: the camera's end, nothing handed on", relay_camera_read(w.camera, &packet, &length) == RELAY_CAMERA_LOST);
        wire_close(&w);
        /* 4,000 small frames, 4,000 empty ones and 8 of the largest: more than twice what the buffer holds, so it
         * is read by its index and moved now and then (review H-2: no move of the buffer per frame). */
        static char many[sizeof DIALOGUE + 4000 * 18 + 8 * 65539 + 4000 * 4];
        at = sizeof DIALOGUE - 1;
        memcpy(many, DIALOGUE, at);
        for (int i = 0; i < 4000; i++) {
            memcpy(many + at, VIDEO, 18); at += 18;
            memcpy(many + at, "$\x05\x00\x00", 4); at += 4;
            if (i % 500 == 250) { memcpy(many + at, stream + sizeof DIALOGUE - 1, 4 + 65535); at += 4 + 65535; }
        }
        wire_open(&w, many, at);
        long got = 0, large = 0;
        RelayCode r = relay_camera_open(w.camera, &d);
        while (!r && !(r = relay_camera_read(w.camera, &packet, &length))) { got++; if (length == 65535 && packet[65534] == 0x55) large++; else if (length != 14 || packet[13] != (uint8_t)0x9A) got = -100000; }
        row("the camera leg, playing", "600 KiB of frames through a 256 KiB buffer: every packet once and whole", at > 600000 && r == RELAY_CAMERA_LOST && got == 4008 && large == 8 && relay_camera_counters(w.camera)->frames_dropped == 4000);
        wire_close(&w);
    }
    CASE(26, "byte that begins neither a frame nor a message");
    row("front", "a 0 byte", front("\0abc", 4, &f) == -(int)RELAY_STREAM_INVALID);
    row("front", "a digit, a blank, a line end, a byte beyond ASCII", front("1", 1, &f) == -(int)RELAY_STREAM_INVALID && front(" RTSP", 5, &f) == -(int)RELAY_STREAM_INVALID
        && front("\r\nRTSP", 6, &f) == -(int)RELAY_STREAM_INVALID && front("\xFFx", 2, &f) == -(int)RELAY_STREAM_INVALID);
    row("front", "nothing at all: more", front("", 0, &f) == RELAY_FRONT_MORE);
    wire_open(&w, B(DIALOGUE VIDEO "\x00\x00\x00\x01\x65"));
    row("the camera leg, playing", "bytes that are no frame after a frame: the stream is invalid",
        relay_camera_open(w.camera, &d) == RELAY_STOPPED && relay_camera_read(w.camera, &packet, &length) == RELAY_STOPPED && relay_camera_read(w.camera, &packet, &length) == RELAY_STREAM_INVALID);
    wire_close(&w);
    wire_open(&w, B(DIALOGUE "$\x00\x00\x02\x80" VIDEO));
    row("the camera leg, playing", "a frame one byte shorter than its length: what follows is read as its last byte, then as no frame",
        relay_camera_open(w.camera, &d) == RELAY_STOPPED && relay_camera_read(w.camera, &packet, &length) == RELAY_STOPPED && length == 2 && relay_camera_read(w.camera, &packet, &length) == RELAY_STREAM_INVALID);
    wire_close(&w);
    current_case = 0;

    /* Messages between the frames while playing. */
    wire_open(&w, B(DIALOGUE VIDEO "RTSP/1.0 200 OK\r\nCSeq: 5\r\nContent-Length: 4\r\n\r\nabcd" "OPTIONS * RTSP/1.0\r\nCSeq: 9\r\n\r\n" VIDEO));
    CHECK("an answer with a body and a request of the camera between two frames are read and dropped",
          relay_camera_open(w.camera, &d) == RELAY_STOPPED && relay_camera_read(w.camera, &packet, &length) == RELAY_STOPPED && relay_camera_read(w.camera, &packet, &length) == RELAY_STOPPED && length == 14);
    wire_close(&w);
    wire_open(&w, B(DIALOGUE "RTSP/1.0 200 OK\r\nContent-Length: 99999999\r\n\r\n"));
    CHECK("a message with a body length beyond the bound while playing", relay_camera_open(w.camera, &d) == RELAY_STOPPED && relay_camera_read(w.camera, &packet, &length) == RELAY_CAMERA_PROTOCOL);
    wire_close(&w);
    wire_open(&w, B(DIALOGUE "RTSP/1.0 401 U\r\nCSeq: 5\r\nWWW-Authenticate: Digest realm=\"unit\", nonce=\"fresh\"\r\n\r\n" VIDEO));
    CHECK("a refusal while playing that is not stale ends the leg: no answer to a nonce of the camera's choice (M-4)", relay_camera_open(w.camera, &d) == RELAY_STOPPED && relay_camera_read(w.camera, &packet, &length) == RELAY_AUTH_REFUSED);
    wire_close(&w);
    wire_open(&w, B(DIALOGUE "RTSP/1.0 401 U\r\nCSeq: 5\r\nWWW-Authenticate: Digest realm=\"unit\", nonce=\"fresh\", stale=true\r\n\r\n" VIDEO
                    "RTSP/1.0 401 U\r\nCSeq: 6\r\nWWW-Authenticate: Digest realm=\"unit\", nonce=\"again\", stale=true\r\n\r\n"));
    CHECK("a stale nonce while playing is taken once; the second refusal in a row ends the leg",
          relay_camera_open(w.camera, &d) == RELAY_STOPPED && relay_camera_read(w.camera, &packet, &length) == RELAY_STOPPED && relay_camera_read(w.camera, &packet, &length) == RELAY_AUTH_REFUSED);
    wire_close(&w);
    wire_open(&w, B(DIALOGUE "RTSP/1.0 401 U\r\nCSeq: 5\r\nWWW-Authenticate: Basic realm=\"unit\"\r\n\r\n"));
    CHECK("a Basic challenge while playing ends the leg", relay_camera_open(w.camera, &d) == RELAY_STOPPED && relay_camera_read(w.camera, &packet, &length) == RELAY_AUTH_REFUSED && !strstr(wire_sent(&w), "Basic"));
    wire_close(&w);
}

int main(int argc, char **argv) {
    signal(SIGPIPE, SIG_IGN);
    start_message();
    addresses();
    digest();
    description();
    pictures();
    heads();
    challenges();
    descriptions();
    rtp_headers();
    depacketiser();
    client();
    current_case = 0;
    CHECK("every code has a name of its own word", !strcmp(relay_code_name(RELAY_AUTH_SCHEME_NOT_ALLOWED), "AUTH_SCHEME_NOT_ALLOWED") && !strcmp(relay_code_name((RelayCode)999), "INTERNAL"));
    int named = 0, passed = 0;
    for (int i = 1; i <= CASES; i++) {
        if (case_name[i] && case_checks[i]) named++;
        if (case_name[i] && case_checks[i] && !case_failed[i]) passed++;
        if (argc > 1 && !strcmp(argv[1], "--cases")) printf("case %2d | %-4s | %3d row(s) | %s\n", i, !case_checks[i] ? "NONE" : case_failed[i] ? "FAIL" : "PASS", case_checks[i], case_name[i] ? case_name[i] : "-");
    }
    if (named != CASES) { failed++; printf("relay_unit_test: FAILED: %d of the %d named malformed-input cases have a row\n", named, CASES); }
    if (failed) { printf("relay_unit_test: %d of %d checks FAILED\n", failed, checks); return 1; }
    printf("relay_unit_test: %d checks passed; the %d named malformed-input cases of review 06: %d of %d pass (start message, address rules, Digest against RFC 2617 and RFC 7616, challenge reader, stream description, pictures out of RTP, answer heads, interleaved framing, the camera leg on a socket pair)\n",
           checks, CASES, passed, CASES);
    return 0;
}
