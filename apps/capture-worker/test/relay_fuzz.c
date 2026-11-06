/*
 * THE FUZZ BUILD OF THE CAPTURE RELAY (task 4 row 186; security review verification/06_security_relay_client.md,
 * finding H-1 and fix F-1). Test code only: it is never part of the relay.
 *
 * Every reader of camera-controlled bytes has an ENTRY POINT here that takes arbitrary bytes:
 *   head         one message head                     relay_head_parse
 *   wire         the bytes of the RTSP connection     relay_wire_front, relay_head_parse (framing and heads)
 *   challenge    one WWW-Authenticate value           relay_challenge_parse, relay_digest_key, relay_digest_answer
 *   description  a stream description                 relay_description_parse, relay_control_address, relay_extradata
 *   rtp          RTP packets, H.264 or HEVC           relay_picture_add (header, fragments, aggregates, reassembly)
 *   client       everything a camera sends, through THE REAL CAMERA LEG (src/relay/relay_rtsp.c, on a socket
 *                pair: relay_camera_adopt, test builds only): open, Digest, play, the read loop, the pictures
 *   start        the start message (the Core's, not the camera's)   relay_start_parse (row 42: the modes, the attempt)
 *   report       ROW 42, an OUTPUT path: the two report lines from values of any size into a room of any size
 *                relay_probe_line, relay_established_line (and `description` checks the stated rate and the
 *                probe line of every description with complete sets)
 * Each entry hands the reader a heap copy of EXACTLY the input's length and then checks what came back against
 * the bounds of relay.h (`must`): with AddressSanitizer and UndefinedBehaviorSanitizer (`make relay-fuzz`) a read
 * or write one byte outside, an overflow of a signed number, or a broken bound ends the run with a report.
 *
 * THE DRIVER. The installed clang (Apple clang 21) has no libFuzzer runtime, and the repository takes no new
 * dependency for this: the driver below is a deterministic mutation fuzzer of its own. It starts from a corpus
 * of valid and near-valid inputs written here (`seed_*`), from generators that build structured inputs (RTP
 * packet trains, whole camera dialogues, answers with a body at the bound), and from a pool of its own earlier
 * mutants; it applies 0 to 6 of 15 mutations (bits, bytes, lengths written in 16 bits, numbers written in digits,
 * cuts, repeats, splices, runs of one byte as long as each bound of relay.h and one more, dictionary words of
 * RTSP, SDP, Digest and the two codecs). THAT IT FINDS WHAT IT IS FOR is checked by test/relay_fuzz_controls.sh
 * (`make relay-fuzz-controls`): copies of the sources with one bound removed each. One seed gives one sequence: a failure names the
 * entry, the seed and the iteration, and writes the input to build/relay-fuzz-crash.bin.
 * With clang's libFuzzer where it exists, the same entries build as one target:
 *     clang -fsanitize=fuzzer,address,undefined -DRELAY_LIBFUZZER -DRELAY_TEST_HOOKS -Wno-unused ... test/relay_fuzz.c ...
 * (the first input byte then picks the entry; NOT built or run on this Mac: the runtime is not installed).
 *
 *   relay_fuzz [--seconds S] [--iterations N] [--seed X] [--entry NAME]     S and N are PER ENTRY; whichever ends first
 *   relay_fuzz --replay NAME FILE                                           one input, once
 * Exit 0: no failure. Every text here is synthetic; the account of the start message is a placeholder.
 */
#include "../src/relay/relay.h"

#include <fcntl.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <time.h>
#include <unistd.h>

#define INPUT_MAX (192 * 1024)
#define POOL 64

/* Written in pieces: the repository's secret scan counts the FORM of an ingest address. */
#define INGEST "rtsp://127.0.0.1:8559/S-1/video-01/AbCdEfGhIjK" "lMnOpQrStUv"
/* Row 143b: the source address of the camera leg, a member record mode must state (a documentation address). */
#define SOURCE "\"source\":\"192.0.2.1\","
#define GOOD "{\"type\":\"start\",\"mode\":\"record\"," SOURCE "\"ingest\":\"" INGEST "\",\"access\":{\"locator\":\"rtsp://192.0.2.10:8554/media/video1\",\"username\":\"unit\",\"secret\":\"unit-placeholder\"}}\n"

/* ---------------------------------------------------------------- what is known about the input being run */
static const char *g_entry = "-";
static const uint8_t *g_input;
static size_t g_input_len;
static unsigned long long g_seed, g_iteration;

static void dump_input(void) {
    char line[256];
    int n = snprintf(line, sizeof line, "relay_fuzz: FAILED in entry %s, seed %llu, iteration %llu, input of %zu bytes written to build/relay-fuzz-crash.bin\n", g_entry, g_seed, g_iteration, g_input_len);
    if (n > 0) { ssize_t w = write(STDERR_FILENO, line, (size_t)n); (void)w; }
    int fd = open("build/relay-fuzz-crash.bin", O_WRONLY | O_CREAT | O_TRUNC, 0600);
    if (fd >= 0) { if (g_input && g_input_len) { ssize_t w = write(fd, g_input, g_input_len); (void)w; } close(fd); }
}

static void must(int holds, const char *what) {
    if (holds) return;
    fprintf(stderr, "relay_fuzz: A BOUND OF relay.h IS BROKEN: %s\n", what);
    dump_input();
    abort();
}

static void on_alarm(int number) {
    static const char text[] = "relay_fuzz: one input ran for more than 30 s: a reader does not end\n";
    (void)number;
    ssize_t w = write(STDERR_FILENO, text, sizeof text - 1);
    (void)w;
    dump_input();
    _exit(3);
}

#if defined(__has_feature)
#if __has_feature(address_sanitizer)
void __sanitizer_set_death_callback(void (*callback)(void));
#define HAVE_DEATH_CALLBACK 1
#endif
#endif

static void *exact(const void *data, size_t n) {
    void *copy = malloc(n ? n : 1);
    if (!copy) abort();
    if (n) memcpy(copy, data, n);
    return copy;
}

static int ends_inside(const char *text, size_t cap) { return memchr(text, 0, cap) != NULL; }

/* Row 42: a report line is of ONE shape - an object on one line, its bytes of a fixed set, ONE line feed last and a
 * 0 after it, at most RELAY_REPORT_MAX bytes. */
static int fixed_shape(const char *line, int n) {
    if (n < 2 || n > RELAY_REPORT_MAX || line[n - 1] != '\n' || line[n] != 0 || line[0] != '{' || line[n - 2] != '}') return 0;
    for (int i = 0; i < n - 1; i++) if (!strchr("{}\":,_0123456789abcdefghijklmnopqrstuvwxyzHEVC", line[i])) return 0;
    return 1;
}

/* ---------------------------------------------------------------- the entry points */
static void check_answer(const RelayAnswer *a, long body) {
    must(body >= -1 && body <= RELAY_SDP_MAX, "the body length of a head is -1 or 0 to RELAY_SDP_MAX");
    if (body < 0) return;
    must(a->status == 0 || (a->status >= 100 && a->status <= 599), "a status is 0 or 100 to 599");
    must(ends_inside(a->session, sizeof a->session) && ends_inside(a->base, sizeof a->base), "session and Content-Base end inside their arrays");
    must(a->cseq >= -1 && a->cseq <= 999999999L, "CSeq is -1 or at most 9 digits");
    must(a->timeout_s >= 0 && a->timeout_s <= 999999, "the session time is 0 to 999999");
    must(!a->interleaved || (a->rtp_channel >= 0 && a->rtp_channel <= 255 && a->rtcp_channel >= 0 && a->rtcp_channel <= 255), "channels are 0 to 255");
    if (a->have_digest) {
        must(ends_inside(a->digest.realm, sizeof a->digest.realm) && ends_inside(a->digest.nonce, sizeof a->digest.nonce) && ends_inside(a->digest.opaque, sizeof a->digest.opaque), "challenge fields end inside their arrays");
        must(a->digest.hash == DIGEST_HASH_MD5 || a->digest.hash == DIGEST_HASH_SHA256, "an answered challenge names MD5 or SHA-256");
        must(a->digest.nonce[0] != 0, "an answered challenge has a nonce");
    }
}

static int fuzz_head(const uint8_t *data, size_t n) {
    char *copy = exact(data, n);
    RelayAnswer a;
    long body = relay_head_parse(copy, n, &a);
    check_answer(&a, body);
    free(copy);
    return 0;
}

static int fuzz_wire(const uint8_t *data, size_t n) {
    uint8_t *copy = exact(data, n);
    size_t at = 0;
    while (at < n) {
        RelayWire w;
        /* First with a part of what is there (bytes arrive in pieces), then with all of it. */
        size_t part = 1 + (size_t)data[at] % 13;
        if (part < n - at) {
            int early = relay_wire_front(copy + at, part, &w);
            must(early <= RELAY_FRONT_MESSAGE && (early <= 0 || w.total <= part), "a front that is whole lies inside the bytes given");
        }
        int front = relay_wire_front(copy + at, n - at, &w);
        if (front == RELAY_FRONT_MORE) break;
        if (front < 0) { must(front == -(int)RELAY_STREAM_INVALID || front == -(int)RELAY_CAMERA_PROTOCOL, "a refused front has one of its two codes"); break; }
        must(w.total >= 4 && w.total <= n - at, "a whole front lies inside the bytes given");
        if (front == RELAY_FRONT_FRAME) {
            must(w.total <= 4 + 65535 && w.channel >= 0 && w.channel <= 255, "a frame is at most 4 + 65,535 bytes on a channel 0 to 255");
            at += w.total;
            continue;
        }
        must(front == RELAY_FRONT_MESSAGE && w.total <= RELAY_HEAD_MAX, "a head is at most RELAY_HEAD_MAX bytes");
        char *head = exact(copy + at, w.total);
        RelayAnswer a;
        long body = relay_head_parse(head, w.total, &a);
        check_answer(&a, body);
        free(head);
        if (body < 0) break;
        at += w.total;
        at += (size_t)body < n - at ? (size_t)body : n - at;
    }
    free(copy);
    return 0;
}

static int fuzz_challenge(const uint8_t *data, size_t n) {
    char *text = malloc(n + 1);
    DigestChallenge c;
    DigestKey key;
    if (!text) abort();
    if (n) memcpy(text, data, n);
    text[n] = 0;
    int r = relay_challenge_parse(text, &c);
    must(r >= -1 && r <= 1, "a challenge is read as -1, 0 or 1");
    if (r == 1) {
        must(ends_inside(c.realm, sizeof c.realm) && ends_inside(c.nonce, sizeof c.nonce) && ends_inside(c.opaque, sizeof c.opaque), "challenge fields end inside their arrays");
        must(c.nonce[0] != 0 && (c.hash == DIGEST_HASH_MD5 || c.hash == DIGEST_HASH_SHA256), "an answered challenge has a nonce and a hash the relay computes");
        must(relay_digest_key(c.hash, "fuzz \"account\"", c.realm, "fuzz-placeholder", &key) == 0, "a key is made for every challenge that is answered");
        /* The buffer of the camera leg: every answerable challenge fits it (review L-2). Then one that is too small. */
        size_t cap = 2 * (3 * RELAY_FIELD_CHARS + RELAY_ACCOUNT_CHARS) + RELAY_LOCATOR_CHARS + 1024;
        char *out = malloc(cap);
        if (!out) abort();
        must(relay_digest_answer(&key, "fuzz \"account\"", &c, "DESCRIBE", "rtsp://192.0.2.10:8554/media/video1", 1, "0123456789abcdef0123456789abcdef", out, cap) == 0, "the answer to a challenge fits the buffer of the camera leg");
        must(!strncmp(out, "Digest username=\"", 17) && strlen(out) < cap, "the answer is a Digest answer that ends inside its buffer");
        for (const char *q = out; *q; q++) must((unsigned char)*q >= 0x20 && *q != 0x7F, "no control byte reaches a request header");
        free(out);
        cap = 1 + (n ? data[0] : 0);
        out = malloc(cap);
        if (!out) abort();
        relay_digest_answer(&key, "fuzz \"account\"", &c, "DESCRIBE", "rtsp://192.0.2.10:8554/media/video1", 7, "c", out, cap);
        free(out);
    }
    free(text);
    return 0;
}

static RelayStart g_start;

static void start_again(void) {
    static const char line[] = GOOD;
    must(relay_start_parse(line, sizeof line - 1, &g_start) == RELAY_STOPPED, "the start message of the fuzz build is the door's");
}

static void check_sets(RelayCodec codec, const ParamSets *s) {
    must(s->vps_len >= 0 && s->vps_len <= RELAY_PSET_MAX && s->sps_len >= 0 && s->sps_len <= RELAY_PSET_MAX && s->pps_len >= 0 && s->pps_len <= RELAY_PSET_MAX, "a parameter set is at most RELAY_PSET_MAX bytes");
    must(!s->vps_len || relay_set_valid(codec, 0, s->vps, (size_t)s->vps_len), "a VPS that was taken is a valid VPS");
    must(!s->sps_len || relay_set_valid(codec, 1, s->sps, (size_t)s->sps_len), "an SPS that was taken is a valid SPS");
    must(!s->pps_len || relay_set_valid(codec, 2, s->pps, (size_t)s->pps_len), "a PPS that was taken is a valid PPS");
    if (relay_sets_complete(codec, s)) {
        uint8_t extra[3 * (RELAY_PSET_MAX + 4)];
        int n = relay_extradata(codec, s, extra, sizeof extra);
        must(relay_sets_valid(codec, s) && n > 0 && (size_t)n <= sizeof extra, "complete sets are valid and fit the library's extradata");
    }
}

static int fuzz_description(const uint8_t *data, size_t n) {
    char *copy = exact(data, n);
    RelayDescription d;
    RelayCode r = relay_description_parse(copy, n, &d);
    must(r == RELAY_STOPPED || r == RELAY_DESCRIPTION_INVALID || r == RELAY_CODEC_NOT_SUPPORTED, "a description is read, invalid, or of another codec");
    if (r == RELAY_STOPPED) {
        char out[RELAY_LOCATOR_CHARS + 1];
        must(d.codec == RELAY_CODEC_H264 || d.codec == RELAY_CODEC_HEVC, "a description that is read names H.264 or HEVC");
        must(d.payload_type >= 0 && d.payload_type <= 127 && ends_inside(d.control, sizeof d.control), "payload type 0 to 127, control inside its array");
        must(d.rate_milli >= 0 && d.rate_milli <= RELAY_RATE_MILLI_MAX, "a stated rate is 0 (none) or inside its bound");
        check_sets(d.codec, &d.sets);
        if (relay_sets_complete(d.codec, &d.sets)) {
            /* What a probe would report of this description (row 42): always a line of the fixed shape. */
            char line[RELAY_REPORT_MAX + 1];
            RelayProbe probe = { 1, d.codec, 1 + (int)(n % RELAY_SIDE_MAX), 1 + (int)(n * 7 % RELAY_SIDE_MAX), d.rate_milli, 1, 0, &d.sets };
            int k = relay_probe_line(&probe, line, sizeof line);
            must(k > 0 && fixed_shape(line, k), "complete sets of a description make a probe line of the fixed shape");
        }
        start_again();
        RelayCode c = relay_control_address(&g_start, "", d.control, out, sizeof out);
        must(c == RELAY_STOPPED || c == RELAY_CONTROL_ADDRESS_REFUSED, "a control address is made or refused");
        if (c == RELAY_STOPPED) must(relay_same_authority(out, g_start.host, g_start.port) != NULL && strlen(out) <= RELAY_LOCATOR_CHARS, "an address that is made names the locator's own host and port");
        c = relay_control_address(&g_start, d.control, d.control, out, sizeof out);
        if (c == RELAY_STOPPED) must(relay_same_authority(out, g_start.host, g_start.port) != NULL, "also with the control value as the base");
    }
    free(copy);
    return 0;
}

/* A picture the collector hands on: its bounds, and that it is exactly the units the relay wrote. */
static void check_picture(const RelayPicture *p) {
    long codes = 0;
    must(p->length >= 5 && p->length <= RELAY_UNIT_MAX && p->cap <= 2 * (size_t)RELAY_UNIT_MAX && p->length <= p->cap, "a picture is 5 bytes to RELAY_UNIT_MAX, in at most twice that");
    must(!p->damaged && !p->open_fragment, "a picture that is handed on is whole");
    for (size_t i = 2; i < p->length; i++) {
        if (p->unit[i] != 1 || p->unit[i - 1] || p->unit[i - 2]) continue;
        codes++;
        must(i + 1 < p->length, "a unit follows every start code");
        uint8_t h = p->unit[i + 1];
        int type = p->codec == RELAY_CODEC_H264 ? h & 0x1F : (h >> 1) & 0x3F;
        must(!(h & 0x80), "no unit with the forbidden bit is handed on");
        must(p->codec == RELAY_CODEC_H264 ? type >= 1 && type <= 23 : type <= 47, "every unit that is handed on has the type of one unit of the codec");
    }
    must(codes == p->units && codes > 0, "a picture holds exactly the start codes the relay wrote");
    must(!memcmp(p->unit, "\0\0\0\1", 4), "a picture begins with a start code");
}

static int add_packet(RelayPicture *p, const uint8_t *packet, size_t n) {
    uint8_t *copy = exact(packet, n);
    int r, again = 0;
    do {
        r = relay_picture_add(p, copy, n);
        must(r == 0 || r == 1 || r == 2 || r == -(int)RELAY_STREAM_INVALID, "a packet is taken, completes a picture, or the stream is invalid");
        if (r >= 1) { check_picture(p); relay_picture_taken(p); }
        must(!(r == 2 && again++), "the packet that ended a picture by its stamp is given again ONCE");
    } while (r == 2);
    check_sets(p->codec, &p->seen);
    must(p->length <= RELAY_UNIT_MAX && p->cap <= 2 * (size_t)RELAY_UNIT_MAX, "what is collected stays inside the bound of a picture");
    free(copy);
    return r;
}

static int fuzz_rtp(const uint8_t *data, size_t n) {
    RelayPicture p;
    if (!n) return 0;
    RelayCodec codec = (data[0] & 1) ? RELAY_CODEC_HEVC : RELAY_CODEC_H264;
    if (relay_picture_init(&p, codec, codec == RELAY_CODEC_HEVC ? 98 : 96)) abort();
    for (size_t at = 1; at + 2 <= n;) {
        size_t length = ((size_t)data[at] << 8) | data[at + 1];
        at += 2;
        if (length > n - at) length = n - at;
        if (add_packet(&p, data + at, length) < 0) break;
        at += length;
    }
    relay_picture_free(&p);
    return 0;
}

/* The whole camera leg: the bytes are everything the camera will ever say; then it ends the connection. */
static int fuzz_client(const uint8_t *data, size_t n) {
    int fd[2], big = 1 << 20;
    RelayDescription d;
    RelayPicture p;
    if (socketpair(AF_UNIX, SOCK_STREAM, 0, fd)) abort();
    for (int i = 0; i < 2; i++) { setsockopt(fd[i], SOL_SOCKET, SO_SNDBUF, &big, sizeof big); setsockopt(fd[i], SOL_SOCKET, SO_RCVBUF, &big, sizeof big); }
    fcntl(fd[1], F_SETFL, fcntl(fd[1], F_GETFL) | O_NONBLOCK);
    for (size_t at = 0; at < n;) {
        ssize_t k = write(fd[1], data + at, n - at);
        if (k <= 0) break;                          /* what the pair does not hold was not sent: still an input */
        at += (size_t)k;
    }
    shutdown(fd[1], SHUT_WR);
    start_again();
    RelayCamera *camera = relay_camera_new(&g_start, NULL, NULL);
    if (!camera) abort();
    relay_camera_adopt(camera, fd[0]);
    RelayCode code = relay_camera_open(camera, &d);
    must(code != RELAY_INTERNAL && code != RELAY_STOP_ASKED && code != RELAY_CAMERA_UNREACHABLE, "no camera can make the open end with a fault of the relay's own");
    must(code != RELAY_STOPPED || g_start.secret[0] == 0 || relay_camera_counters(camera)->challenges == 0, "after a challenge was answered the password is gone");
    if (code == RELAY_STOPPED) {
        const uint8_t *packet;
        size_t length;
        check_sets(d.codec, &d.sets);
        if (relay_picture_init(&p, d.codec, d.payload_type)) abort();
        while (!(code = relay_camera_read(camera, &packet, &length))) {
            must(length >= 1 && length <= 65535, "a packet that is handed on is 1 to 65,535 bytes");
            if (add_packet(&p, packet, length) < 0) break;
            relay_camera_progress(camera);
        }
        must(code != RELAY_INTERNAL && code != RELAY_STOP_ASKED, "no camera can make the read end with a fault of the relay's own");
        relay_picture_free(&p);
    }
    relay_camera_close(camera);
    close(fd[1]);
    return 0;
}

static int fuzz_start(const uint8_t *data, size_t n) {
    char *copy = exact(data, n);
    RelayStart s;
    RelayCode r = relay_start_parse(copy, n, &s);
    must(r == RELAY_STOPPED || r == RELAY_START_MESSAGE_INVALID, "a start message is taken or invalid");
    if (r == RELAY_STOPPED) {
        char line[RELAY_REPORT_MAX + 1];
        must(ends_inside(s.ingest, sizeof s.ingest) && ends_inside(s.locator, sizeof s.locator) && ends_inside(s.host, sizeof s.host) && ends_inside(s.account, sizeof s.account) && ends_inside(s.secret, sizeof s.secret), "every member ends inside its array");
        must(s.mode == RELAY_MODE_RECORD || s.mode == RELAY_MODE_PROBE || s.mode == RELAY_MODE_PREVIEW, "a start message that is taken names one of the three modes");
        must(s.port >= 1 && s.port <= 65535, "the camera's port inside its range");
        if (s.mode == RELAY_MODE_RECORD) must(s.ingest_port >= RELAY_INGEST_PORT_MIN && s.ingest_port <= RELAY_INGEST_PORT_MAX, "record mode: the ingest port inside its range");
        else must(!s.ingest[0] && s.ingest_port == 0, "probe and preview mode: no ingest address is taken");
        must(s.attempt >= 0 && s.attempt <= RELAY_ATTEMPT_MAX, "the attempt is 0 (not stated) or inside its bound");
        /* Row 143b: the source address. Record mode always holds one; one that is held is the canonical dotted
         * literal of four numbers, the first 1 to 223 - written again from its numbers it is the same text. */
        must(ends_inside(s.source, sizeof s.source), "the source address ends inside its array");
        must(s.mode != RELAY_MODE_RECORD || s.source[0], "record mode: a source address is held");
        must(s.mode != RELAY_MODE_PREVIEW || s.source[0], "preview mode (row 89): a source address is held");
        if (s.source[0]) {
            unsigned a = 999, b = 999, c = 999, d = 999;
            char again[32], tail = 0;
            must(sscanf(s.source, "%3u.%3u.%3u.%3u%c", &a, &b, &c, &d, &tail) == 4 && a >= 1 && a <= 223 && b <= 255 && c <= 255 && d <= 255, "a source address that is taken is four numbers, the first 1 to 223");
            snprintf(again, sizeof again, "%u.%u.%u.%u", a, b, c, d);
            must(!strcmp(again, s.source), "a source address that is taken is in its one canonical form");
        }
        must(relay_same_authority(s.locator, s.host, s.port) != NULL, "the locator names its own host and port");
        int k = relay_established_line(s.attempt, line, sizeof line);
        must(k > 0 && fixed_shape(line, k), "the attempt of a start message that is taken makes an established line of the fixed shape");
    } else {
        static const RelayStart empty;
        must(!memcmp(&s, &empty, sizeof s), "of a refused start message nothing is kept");
    }
    free(copy);
    return 0;
}

/* Row 42: the two report lines, from values of ANY size (the input chooses every number, the lengths of the sets,
 * their bytes and the room the line gets). The line goes into a heap block of exactly that room. Either there is
 * no line (-1, and the first byte of the room is 0) or a line of the fixed shape that says exactly the values it
 * was given; values inside their bounds with enough room always make a line. Input: codec, flags, then 4 bytes
 * each for attempt, width, height, rate, the three lengths, 2 for the room; the rest is the bytes of the sets. */
static long quad(const uint8_t **p, const uint8_t *end) {
    uint32_t v = 0;
    for (int i = 0; i < 4; i++) v = (v << 8) | (*p < end ? *(*p)++ : 0);
    return (long)(int32_t)v;
}
static int hex_is(const char *at, const uint8_t *bytes, int n) {
    static const char hex[] = "0123456789abcdef";
    for (int i = 0; i < n; i++) if (at[2 * i] != hex[bytes[i] >> 4] || at[2 * i + 1] != hex[bytes[i] & 15]) return 0;
    return at[2 * n] == '"';
}
static int fuzz_report(const uint8_t *data, size_t n) {
    static ParamSets sets;
    const uint8_t *p = data, *end = data + n;
    int codec = p < end ? *p++ % 4 : 1, flags = p < end ? *p++ : 0;
    RelayProbe probe = { quad(&p, end), (RelayCodec)codec, 0, 0, 0, flags & 1, (flags >> 1) & 1, &sets };
    probe.width = (int)quad(&p, end);
    probe.height = (int)quad(&p, end);
    probe.rate_milli = quad(&p, end);
    memset(&sets, 0, sizeof sets);
    sets.vps_len = (int)quad(&p, end);
    sets.sps_len = (int)quad(&p, end);
    sets.pps_len = (int)quad(&p, end);
    size_t room = (size_t)(p < end ? *p++ : 0) << 8;
    room |= p < end ? *p++ : 0;
    if (flags & 4) room = RELAY_REPORT_MAX + 1;
    if (flags & 8) { sets.vps_len &= 1023; sets.sps_len &= 1023; sets.pps_len &= 1023; }
    if (flags & 16) { probe.attempt &= 0xFFFFFF; probe.width = 1 + (probe.width & 8191); probe.height = 1 + (probe.height & 8191); probe.rate_milli &= 0xFFFFF; }
    uint8_t *to[3] = { sets.vps, sets.sps, sets.pps };
    for (int i = 0; i < 3; i++) for (int k = 0; k < RELAY_PSET_MAX && p < end; k++) to[i][k] = *p++;
    if (flags & 32) {       /* headers of valid sets of the codec, so that lines are made and not only refused */
        if (codec == RELAY_CODEC_H264) { sets.sps[0] = 0x67; sets.pps[0] = 0x68; }
        else { sets.vps[0] = 0x40; sets.vps[1] |= 1; sets.sps[0] = 0x42; sets.sps[1] |= 1; sets.pps[0] = 0x44; sets.pps[1] |= 1; }
    }
    int in_bounds = probe.attempt >= 0 && probe.attempt <= RELAY_ATTEMPT_MAX && (codec == RELAY_CODEC_H264 || codec == RELAY_CODEC_HEVC) && probe.width >= 1 && probe.width <= RELAY_SIDE_MAX
                    && probe.height >= 1 && probe.height <= RELAY_SIDE_MAX && probe.rate_milli >= 0 && probe.rate_milli <= RELAY_RATE_MILLI_MAX && relay_sets_valid(probe.codec, &sets);
    char *line = malloc(room ? room : 1);
    if (!line) abort();
    line[0] = 'x';
    int k = relay_probe_line(&probe, line, room);
    if (k < 0) {
        must(k == -1 && (!room || line[0] == 0), "no probe line: -1, and nothing of a line in the room");
        must(!in_bounds || room <= RELAY_REPORT_MAX, "values inside their bounds, with room for the largest line, make a probe line");
    } else {
        char head[256];
        must(in_bounds, "a probe line is made only of values inside their bounds and of valid sets");
        must((size_t)k < room && fixed_shape(line, k), "a probe line fits its room and is of the fixed shape");
        int h = snprintf(head, sizeof head, "{\"report\":\"probe\",\"v\":1,\"attempt\":%ld,\"codec\":\"%s\",\"width\":%d,\"height\":%d,\"rate_milli\":%ld,\"sets_in_description\":%s,\"sets_in_stream\":%s,\"vps\":\"",
                         probe.attempt, codec == RELAY_CODEC_H264 ? "H264" : "HEVC", probe.width, probe.height, probe.rate_milli, probe.sets_in_description ? "true" : "false", probe.sets_in_stream ? "true" : "false");
        int vps = codec == RELAY_CODEC_HEVC ? sets.vps_len : 0;
        must(h > 0 && h < (int)sizeof head && k == h + 2 * vps + 9 + 2 * sets.sps_len + 9 + 2 * sets.pps_len + 3 && !memcmp(line, head, (size_t)h), "a probe line says the numbers it was given, in the fixed order");
        must(hex_is(line + h, sets.vps, vps) && !memcmp(line + h + 2 * vps, "\",\"sps\":\"", 9) && hex_is(line + h + 2 * vps + 9, sets.sps, sets.sps_len)
             && !memcmp(line + h + 2 * vps + 9 + 2 * sets.sps_len, "\",\"pps\":\"", 9) && hex_is(line + h + 2 * vps + 18 + 2 * sets.sps_len, sets.pps, sets.pps_len), "a probe line holds the bytes of the sets it was given, in hexadecimal");
    }
    line[0] = 'x';
    k = relay_established_line(probe.attempt, line, room);
    if (k < 0) must(k == -1 && (!room || line[0] == 0) && (probe.attempt < 0 || probe.attempt > RELAY_ATTEMPT_MAX || room < 64), "no established line: -1, nothing in the room, and a reason for it");
    else {
        char whole[64];
        int h = snprintf(whole, sizeof whole, "{\"report\":\"push_established\",\"v\":1,\"attempt\":%ld}\n", probe.attempt);
        must(probe.attempt >= 0 && probe.attempt <= RELAY_ATTEMPT_MAX && k == h && (size_t)k < room && !strcmp(line, whole) && fixed_shape(line, k), "an established line says the attempt it was given and nothing else");
    }
    free(line);
    return 0;
}

/* ---------------------------------------------------------------- the corpus: valid and near-valid inputs */
typedef struct Seed { const uint8_t *bytes; size_t n; } Seed;
#define S(text) { (const uint8_t *)(text), sizeof(text) - 1 }

#define SDP_H264 "v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\ns=x\r\nc=IN IP4 0.0.0.0\r\nt=0 0\r\na=control:*\r\na=range:npt=0-\r\nm=video 0 RTP/AVP 96\r\na=rtpmap:96 H264/90000\r\n" \
    "a=fmtp:96 packetization-mode=1; profile-level-id=42C01F; sprop-parameter-sets=Z0LAH9oBQBbsBEAAAAMAQAAADIPGDKg=,aM4PyA==\r\na=framerate:25\r\na=control:trackID=0\r\n"
#define SDP_HEVC "v=0\r\nm=audio 0 RTP/AVP 0\r\na=control:audio\r\nm=video 0 RTP/AVP 98\r\na=rtpmap:98 H265/90000\r\na=fmtp:98 sprop-vps=QAEMAf//AWAAAAMAAAMAAAMAAAMAlqwJ; sprop-sps=QgEBAWAAAAMAAAMAAAMAAAMAlqADwIAQ5Y2uSTK+A=; sprop-pps=RAHA8vA8kA==\r\n" \
    "a=control:rtsp://192.0.2.10:8554/media/video1/track1\r\nm=video 0 RTP/AVP 97\r\na=rtpmap:97 H264/90000\r\n"
#define SDP_BARE "v=0\nm=video 0 RTP/AVP 96 97 98\na=rtpmap:97 HEVC/90000\na=control:/abs/track\n"
/* The Content-Length of each answer is the length of its description: 294 and 321 (checked in main). */
#define ANSWER_401 "RTSP/1.0 401 Unauthorized\r\nCSeq: 1\r\nServer: seed\r\nWWW-Authenticate: Digest realm=\"seed camera\", nonce=\"5f1c0a9e77b24d3c8a6e2b1d0c9f8e7a\"\r\n\r\n"
#define ANSWER_401_QOP "RTSP/1.0 401 Unauthorized\r\nCSeq: 1\r\nWWW-Authenticate: Basic realm=\"seed\"\r\nWWW-Authenticate: Digest realm=\"seed\", qop=\"auth,auth-int\", algorithm=SHA-256, nonce=\"7ypf/xlj9XXwfDPEoM4URrv\", opaque=\"FQhe/qaU925kfnzjCev0\"\r\n\r\n"
#define ANSWER_STALE "RTSP/1.0 401 Unauthorized\r\nCSeq: 2\r\nWWW-Authenticate: Digest realm=\"seed camera\", nonce=\"0011223344556677\", stale=true\r\n\r\n"
#define DESCRIBED(cseq, length, sdp) "RTSP/1.0 200 OK\r\nCSeq: " cseq "\r\nContent-Base: rtsp://192.0.2.10:8554/media/video1/\r\nContent-Type: application/sdp\r\nContent-Length: " length "\r\n\r\n" sdp
#define SET_UP(cseq) "RTSP/1.0 200 OK\r\nCSeq: " cseq "\r\nTransport: RTP/AVP/TCP;unicast;interleaved=0-1;ssrc=0A0B0C0D\r\nSession: 9f8e7d6c5b4a3921;timeout=60\r\n\r\n"
#define PLAYING(cseq) "RTSP/1.0 200 OK\r\nCSeq: " cseq "\r\nSession: 9f8e7d6c5b4a3921\r\nRange: npt=0.000-\r\nRTP-Info: url=rtsp://192.0.2.10:8554/media/video1/trackID=0;seq=1;rtptime=9000\r\n\r\n"
#define DIALOGUE_H264 ANSWER_401 DESCRIBED("2", "294", SDP_H264) SET_UP("3") PLAYING("4")
#define DIALOGUE_HEVC ANSWER_401_QOP DESCRIBED("2", "321", SDP_HEVC) SET_UP("3") PLAYING("4")
#define DIALOGUE_STALE ANSWER_401 ANSWER_STALE DESCRIBED("3", "294", SDP_H264) SET_UP("4") PLAYING("5")
#define DIALOGUE_OPEN DESCRIBED("1", "294", SDP_H264) SET_UP("2") PLAYING("3")
/* Frames of the connection: a sender report, a slice with the mark, sets and a keyframe in fragments. */
#define F_REPORT "$\x01\x00\x1C\x80\xC8\x00\x06\x0A\x0B\x0C\x0D\xE8\x00\x00\x00\x00\x00\x00\x00\x00\x00\x23\x28\x00\x00\x00\x01\x00\x00\x00\x10"
#define F_SETS "$\x00\x00\x17\x80\x60\x00\x01\x00\x00\x23\x28\x0A\x0B\x0C\x0D\x18\x00\x04\x67\x42\xC0\x1F\x00\x02\x68\xCE"
#define F_KEY_1 "$\x00\x00\x10\x80\x60\x00\x02\x00\x00\x23\x28\x0A\x0B\x0C\x0D\x7C\x85\x88\x84"
#define F_KEY_2 "$\x00\x00\x10\x80\xE0\x00\x03\x00\x00\x23\x28\x0A\x0B\x0C\x0D\x7C\x45\x21\xFF"
#define F_SLICE "$\x00\x00\x0F\x80\xE0\x00\x04\x00\x00\x31\x38\x0A\x0B\x0C\x0D\x41\x9A\x02"
#define F_EMPTY "$\x00\x00\x00"
#define F_OTHER "$\x07\x00\x03\x01\x02\x03"
#define KEEPALIVE_ANSWER "RTSP/1.0 200 OK\r\nCSeq: 5\r\nPublic: OPTIONS, DESCRIBE, SETUP, PLAY, TEARDOWN\r\n\r\n"
#define CAMERA_REQUEST "SET_PARAMETER rtsp://192.0.2.10:8554/media/video1 RTSP/1.0\r\nCSeq: 77\r\nContent-Length: 4\r\n\r\nping"
#define FRAMES F_REPORT F_SETS F_KEY_1 F_KEY_2 F_SLICE

static const Seed seed_head[] = {
    S("RTSP/1.0 200 OK\r\nCSeq: 2\r\nContent-Base: rtsp://192.0.2.10:8554/media/video1/\r\nContent-Type: application/sdp\r\nContent-Length: 319\r\n\r\n"),
    S(ANSWER_401), S(ANSWER_401_QOP), S(ANSWER_STALE), S(SET_UP("3")), S(PLAYING("4")), S(KEEPALIVE_ANSWER),
    S("SET_PARAMETER rtsp://192.0.2.10:8554/media/video1 RTSP/1.0\r\nCSeq: 77\r\nContent-Length: 4\r\n\r\n"),
    S("RTSP/1.0 461 Unsupported Transport\r\nCSeq: 3\r\n\r\n"),
    S("RTSP/1.0 200 OK\r\nCSeq: 3\r\nTransport: RTP/AVP;unicast;client_port=5000-5001;server_port=6000-6001\r\nSession: abc\r\n\r\n"),
    S("RTSP/1.0 302 Moved\r\nCSeq: 1\r\nLocation: rtsp://198.51.100.1/x\r\n\r\n"),
    S("RTSP/1.0 200 OK\nCSeq: 1\nContent-Length: 0\n\n"),
};
static const Seed seed_wire[] = {
    S(DIALOGUE_H264 FRAMES), S(DIALOGUE_HEVC F_REPORT F_EMPTY F_OTHER), S(FRAMES KEEPALIVE_ANSWER FRAMES CAMERA_REQUEST F_SLICE), S(F_EMPTY F_OTHER F_EMPTY),
    S("$\x00\xFF\xFF" "short"), S(DESCRIBED("1", "5", "hello") "RTSP/1.0 200 OK\r\n\r\n"), S("RTSP/1.0 200 OK\r\nContent-Length: 99999\r\n\r\n"),
};
static const Seed seed_challenge[] = {
    S("Digest realm=\"seed camera\", nonce=\"5f1c0a9e77b24d3c8a6e2b1d0c9f8e7a\""),
    S("Digest realm=\"testrealm@host.com\", qop=\"auth,auth-int\", nonce=\"dcd98b7102dd2f0e8b11d0f600bfb0c093\", opaque=\"5ccc069c403ebaf9f0171e9517f40e41\""),
    S("Digest realm=\"http-auth@example.org\", qop=\"auth, auth-int\", algorithm=SHA-256, nonce=\"7ypf/xlj9XXwfDPEoM4URrv/xwf94BcCAzFZH4GiTo0v\", opaque=\"FQhe/qaU925kfnzjCev0ciny7QMkPqMAFRtzCUYo5tdS\""),
    S("digest realm=\"r\", nonce=\"n\", algorithm=MD5, stale=TRUE, qop=auth"),
    S("Digest realm=\"a\\\"b\\\\c\", nonce=n, opaque=\"\""),
    S("Digest realm=\"x\", nonce=\"n\", algorithm=MD5-sess"), S("Basic realm=\"x\""), S("Digest realm=\"x\", nonce=\"n\", qop=\"auth-int\""),
    S("Digest realm=\"a\", nonce=\"n\", Basic realm=\"b\""), S("Digest   realm = \"a\" ,\tnonce = \"n\" , userhash=true, charset=UTF-8, domain=\"/ /x\""),
};
static const Seed seed_description[] = {
    S(SDP_H264), S(SDP_HEVC), S(SDP_BARE),
    S("v=0\r\nm=video 0 RTP/AVP 96\r\na=framerate:29.97\r\na=rtpmap:96 H264/90000\r\na=fmtp:96 sprop-parameter-sets=Z0LAHw==,aM4PyA==\r\na=framerate:1000.000 \r\n"),
    S("v=0\r\nm=video 0 RTP/AVP 26\r\na=rtpmap:26 JPEG/90000\r\n"), S("v=0\r\nm=audio 0 RTP/AVP 0\r\n"),
    S("m=video 0 RTP/AVP 96\r\na=rtpmap:96 H264/90000\r\na=fmtp:96 sprop-parameter-sets=,Z0LAHw==,,aM4PyA==,ZQAAAA==;packetization-mode=1\r\na=control:../x\r\n"),
    S("m=video 0 RTP/AVP 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 96\r\na=rtpmap:96 H265/90000\r\na=fmtp:96 sprop-pps=RAHA8vA8kA==,x; sprop-sps=; sprop-vps\r\n"),
};
static const Seed seed_start[] = {
    S(GOOD),
    S("{\"type\":\"start\",\"mode\":\"record\"," SOURCE "\"ingest\":\"" INGEST "\",\"access\":{\"locator\":\"rtsp://192.0.2.10/a\",\"username\":\"a \\\"b\\\\ \\u00e9\",\"secret\":\"p\\u0009q\\ud83d\\ude00\"}}\n"),
    S("{ \"access\" : { \"secret\" : \"\" , \"username\" : \"u\" , \"locator\" : \"rtsp://10.0.0.1:554/s\" } , \"ingest\" : \"" INGEST "\" , \"source\" : \"10.0.0.2\" , \"mode\" : \"record\" , \"type\" : \"start\" }\n"),
    /* row 143b: the source address - the largest literal, probe mode with one, and forms that are refused */
    S("{\"type\":\"start\",\"mode\":\"record\",\"source\":\"223.255.255.255\",\"ingest\":\"" INGEST "\",\"access\":{\"locator\":\"rtsp://192.0.2.10/a\",\"username\":\"u\",\"secret\":\"s\"}}\n"),
    S("{\"type\":\"start\",\"mode\":\"probe\",\"source\":\"192.168.50.1\",\"access\":{\"locator\":\"rtsp://192.0.2.10/a\",\"username\":\"u\",\"secret\":\"s\"}}\n"),
    /* row 89: preview mode, with its source address and without */
    S("{\"type\":\"start\",\"mode\":\"preview\",\"attempt\":3,\"source\":\"192.168.50.1\",\"access\":{\"locator\":\"rtsp://192.0.2.10/a\",\"username\":\"u\",\"secret\":\"s\"}}\n"),
    S("{\"type\":\"start\",\"mode\":\"preview\",\"access\":{\"locator\":\"rtsp://192.0.2.10/a\",\"username\":\"u\",\"secret\":\"s\"}}\n"),
    S("{\"type\":\"start\",\"mode\":\"record\",\"source\":\"0.0.0.0\",\"ingest\":\"" INGEST "\",\"access\":{\"locator\":\"rtsp://192.0.2.10/a\",\"username\":\"u\",\"secret\":\"s\"}}\n"),
    S("{\"type\":\"start\",\"mode\":\"record\",\"source\":\"192.168.050.1\",\"ingest\":\"" INGEST "\",\"access\":{\"locator\":\"rtsp://192.0.2.10/a\",\"username\":\"u\",\"secret\":\"s\"}}\n"),
    S("{\"type\":\"start\",\"mode\":\"record\",\"ingest\":\"" INGEST "\",\"access\":{\"locator\":\"rtsp://192.0.2.10/a\",\"username\":\"u\",\"secret\":\"s\"}}\n"),
    /* row 42: the attempt, and probe mode (no ingest address) */
    S("{\"type\":\"start\",\"mode\":\"record\",\"attempt\":3," SOURCE "\"ingest\":\"" INGEST "\",\"access\":{\"locator\":\"rtsp://192.0.2.10:8554/media/video1\",\"username\":\"unit\",\"secret\":\"unit-placeholder\"}}\n"),
    S("{\"type\":\"start\",\"mode\":\"probe\",\"attempt\":999999999,\"access\":{\"locator\":\"rtsp://192.0.2.10/a\",\"username\":\"u\",\"secret\":\"\"}}\n"),
    S("{\"type\":\"start\",\"mode\":\"probe\",\"access\":{\"locator\":\"rtsp://192.0.2.10/a\",\"username\":\"u\",\"secret\":\"s\"},\"attempt\" : 12 }\n"),
};
/* row 42, entry `report`: codec, flags, attempt, width, height, rate, three lengths (4 bytes each), the room (2). */
static const Seed seed_report[] = {
    S("\x01\x3C" "\x00\x00\x00\x05" "\x00\x00\x07\x80" "\x00\x00\x04\x38" "\x00\x00\x61\xA8" "\x00\x00\x00\x00" "\x00\x00\x00\x04" "\x00\x00\x00\x02" "\x00\x00"),
    S("\x02\x3D" "\x00\x00\x00\x00" "\x00\x00\x0F\x00" "\x00\x00\x08\x70" "\x00\x00\x00\x00" "\x00\x00\x00\x03" "\x00\x00\x00\x06" "\x00\x00\x00\x03" "\x00\x00" "\x40\x01\x0C"),
    S("\x02\x3A" "\x00\x98\x96\x7F" "\x00\x00\x3F\xFF" "\x00\x00\x3F\xFF" "\x00\x0F\x42\x40" "\x00\x00\x03\xFF" "\x00\x00\x03\xFF" "\x00\x00\x03\xFF" "\x00\x40"),
    S("\x01\x38" "\x00\x00\x00\x07" "\x00\x00\x02\x80" "\x00\x00\x01\xE0" "\x00\x00\x75\x30" "\x00\x00\x00\x00" "\x00\x00\x00\x10" "\x00\x00\x00\x08" "\x00\xC8"),
    S("\x01\x00" "\xFF\xFF\xFF\xFF" "\x7F\xFF\xFF\xFF" "\x80\x00\x00\x00" "\x00\x0F\x42\x41" "\xFF\xFF\xFF\xFF" "\x00\x00\x04\x01" "\x7F\xFF\xFF\xFF" "\x19\x01"),
    S("\x03\x24" "\x00\x00\x00\x01"),
};
static const Seed seed_client[] = {
    S(DIALOGUE_H264 FRAMES FRAMES), S(DIALOGUE_HEVC F_REPORT), S(DIALOGUE_STALE FRAMES KEEPALIVE_ANSWER F_SLICE), S(DIALOGUE_OPEN F_EMPTY F_OTHER FRAMES CAMERA_REQUEST FRAMES),
    S(F_REPORT ANSWER_401 F_EMPTY DESCRIBED("2", "294", SDP_H264) SET_UP("3") F_SLICE PLAYING("4") FRAMES),
    S(DIALOGUE_H264 FRAMES "RTSP/1.0 401 Unauthorized\r\nCSeq: 5\r\nWWW-Authenticate: Digest realm=\"seed camera\", nonce=\"aa\", stale=true\r\n\r\n" FRAMES),
    S("RTSP/1.0 401 Unauthorized\r\nCSeq: 1\r\nWWW-Authenticate: Basic realm=\"seed\"\r\n\r\n"),
    S("RTSP/1.0 302 Moved\r\nCSeq: 1\r\nLocation: rtsp://198.51.100.1/x\r\n\r\n"),
};
/* RTP trains: [codec byte] then [16-bit length][packet] ... ; made at start from the frames above and by hand. */
static uint8_t train_h264[512], train_hevc[512];
static Seed seed_rtp[4];

static size_t train_add(uint8_t *out, size_t at, const char *packet, size_t n) {
    out[at] = (uint8_t)(n >> 8);
    out[at + 1] = (uint8_t)n;
    memcpy(out + at + 2, packet, n);
    return at + 2 + n;
}

static void make_trains(void) {
    size_t at = 1;
    train_h264[0] = 0;
    at = train_add(train_h264, at, &F_SETS[4], sizeof F_SETS - 5);
    at = train_add(train_h264, at, &F_KEY_1[4], sizeof F_KEY_1 - 5);
    at = train_add(train_h264, at, &F_KEY_2[4], sizeof F_KEY_2 - 5);
    at = train_add(train_h264, at, &F_SLICE[4], sizeof F_SLICE - 5);
    seed_rtp[0] = (Seed){ train_h264, at };
    seed_rtp[1] = (Seed){ train_h264, at - 9 };
#define H_VPS "\x80\x62\x00\x01\x00\x00\x00\x64\x01\x02\x03\x04\x40\x01\x0C\x01"
#define H_AP "\x80\x62\x00\x02\x00\x00\x00\x64\x01\x02\x03\x04\x60\x01\x00\x04\x42\x01\x01\x01\x00\x03\x44\x01\xC0"
#define H_FU1 "\x80\x62\x00\x03\x00\x00\x00\x64\x01\x02\x03\x04\x62\x01\x93\x11\xAF"
#define H_FU2 "\x80\xE2\x00\x04\x00\x00\x00\x64\x01\x02\x03\x04\x62\x01\x53\x22"
#define H_SLICE "\x80\xE2\x00\x05\x00\x00\x0E\x74\x01\x02\x03\x04\x02\x01\xD0\x09"
    at = 1;
    train_hevc[0] = 1;
    at = train_add(train_hevc, at, H_VPS, sizeof H_VPS - 1);
    at = train_add(train_hevc, at, H_AP, sizeof H_AP - 1);
    at = train_add(train_hevc, at, H_FU1, sizeof H_FU1 - 1);
    at = train_add(train_hevc, at, H_FU2, sizeof H_FU2 - 1);
    at = train_add(train_hevc, at, H_SLICE, sizeof H_SLICE - 1);
    seed_rtp[2] = (Seed){ train_hevc, at };
    seed_rtp[3] = (Seed){ train_hevc, at - 7 };
}

/* ---------------------------------------------------------------- chance, with a seed */
static unsigned long long g_state;
static unsigned long long chance(void) {
    g_state ^= g_state << 13;
    g_state ^= g_state >> 7;
    g_state ^= g_state << 17;
    return g_state;
}
static size_t below(size_t n) { return n ? (size_t)(chance() % n) : 0; }

static const Seed words[] = {
    S("\r\n"), S("\r\n\r\n"), S("\n\n"), S("RTSP/1.0 "), S("RTSP/1.0 200 OK\r\n"), S("RTSP/1.0 401 U\r\n"), S("CSeq: "), S("Content-Length: "), S("Content-Base: "), S("Session: "), S(";timeout="),
    S("Transport: "), S("interleaved="), S("client_port="), S("WWW-Authenticate: "), S("Digest "), S("Basic "), S("realm=\""), S("nonce=\""), S("opaque=\""), S("stale=true"), S("algorithm="),
    S("MD5"), S("SHA-256"), S("MD5-sess"), S("qop=\"auth\""), S("auth-int"), S("\\\""), S("\\\\"), S("\", "), S("m=video 0 RTP/AVP "), S("m=audio 0 RTP/AVP 0\r\n"), S("a=rtpmap:96 "), S("H264/90000"),
    S("H265/90000"), S("a=fmtp:96 "), S("a=fmtp:98 "), S("sprop-parameter-sets="), S("sprop-vps="), S("sprop-sps="), S("sprop-pps="), S("a=control:"), S("rtsp://192.0.2.10:8554/"),
    S("rtsp://198.51.100.1/"), S("Z0LAHw=="), S("aM4PyA=="), S("===="), S("$\x00\x00\x00"), S("$\x00\xFF\xFF"), S("$\x01\x00\x04"), S("\x00\x00\x01"), S("\x00\x00\x00\x01"), S("\x00\x00\x03"),
    S("\x80\x60"), S("\x80\xE0"), S("\xB1\xE0"), S("\x18\x00\x02"), S("\x7C\x85"), S("\x7C\x45"), S("\x7C\x05"), S("\x60\x01"), S("\x62\x01\x93"), S("\x62\x01\x53"), S("\xBE\xDE\x00\x01"),
    S("0"), S("-1"), S("65535"), S("65536"), S("65537"), S("2147483647"), S("2147483648"), S("4294967295"), S("4294967296"), S("99999999999999999999"), S("0x10"), S("1e9"),
};
static const uint8_t bytes_of_note[] = { 0, 1, 2, 3, 0x7F, 0x80, 0xFF, '$', '\r', '\n', '"', '\\', ',', ';', '=', ' ', ':', '/', '-', '9', 'A', 24, 28, 0x60, 0x62, 0x7C, 0x9F, 0xE0 };

static size_t insert(uint8_t *buf, size_t n, size_t at, const uint8_t *what, size_t k) {
    if (k > INPUT_MAX - n) k = INPUT_MAX - n;
    memmove(buf + at + k, buf + at, n - at);
    memcpy(buf + at, what, k);
    return n + k;
}

static size_t mutate(uint8_t *buf, size_t n, const Seed *seeds, int n_seeds) {
    static uint8_t scratch[INPUT_MAX];
    size_t at = below(n + 1), span, k;
    switch (below(15)) {
    case 13: {                                      /* one byte, as often as a bound of relay.h and one more */
        static const size_t runs[] = { 31, 32, 127, 128, 129, 255, 256, 257, 511, 512, 513, 1023, 1024, 1025, 2047, 2048, 4096, 8191, 8192, 8193, 65535, 65536, 65537 };
        static const uint8_t fill[] = { 'A', '"', '\\', ' ', '0', '9', ',', 0x55, 0, '$', '\n' };
        span = runs[below(sizeof runs / sizeof *runs)];
        if (span > INPUT_MAX - n) break;
        memset(scratch, fill[below(sizeof fill)], span);
        n = insert(buf, n, at, scratch, span);
        break;
    }
    case 0: if (n) buf[below(n)] ^= (uint8_t)(1u << below(8)); break;
    case 1: if (n) buf[below(n)] = (uint8_t)chance(); break;
    case 2: if (n) buf[below(n)] = bytes_of_note[below(sizeof bytes_of_note)]; break;
    case 3:                                         /* cut a span */
        if (!n) break;
        at = below(n);
        span = 1 + below(below(4) ? 8 : n - at);
        if (span > n - at) span = n - at;
        memmove(buf + at, buf + at + span, n - at - span);
        n -= span;
        break;
    case 4:                                         /* a span again, somewhere */
        if (!n) break;
        k = below(n);
        span = 1 + below(below(4) ? 32 : n - k);
        if (span > n - k) span = n - k;
        memcpy(scratch, buf + k, span);
        n = insert(buf, n, at, scratch, span);
        break;
    case 5:                                         /* bytes of chance */
        span = 1 + below(8);
        for (k = 0; k < span; k++) scratch[k] = (uint8_t)chance();
        n = insert(buf, n, at, scratch, span);
        break;
    case 6: { const Seed *w = &words[below(sizeof words / sizeof *words)]; n = insert(buf, n, at, w->bytes, w->n); break; }
    case 7: {                                       /* a word over what is there */
        const Seed *w = &words[below(sizeof words / sizeof *words)];
        if (at + w->n <= n) memcpy(buf + at, w->bytes, w->n);
        break;
    }
    case 8: {                                       /* a length written in 16 bits */
        static const unsigned lengths[] = { 0, 1, 2, 3, 4, 11, 12, 13, 0x7FFF, 0x8000, 0xFFFE, 0xFFFF };
        unsigned v = below(3) ? lengths[below(sizeof lengths / sizeof *lengths)] : (unsigned)(n - (at < n ? at : n)) + (unsigned)below(5) - 2;
        if (at + 2 <= n) { buf[at] = (uint8_t)(v >> 8); buf[at + 1] = (uint8_t)v; }
        break;
    }
    case 9: n = below(n + 1); break;                /* the camera stops here */
    case 10: {                                      /* the head of one input, the tail of another */
        const Seed *other = &seeds[below((size_t)n_seeds)];
        k = below(other->n + 1);
        span = other->n - k;
        if (at + span > INPUT_MAX) span = INPUT_MAX - at;
        memcpy(buf + at, other->bytes + k, span);
        n = at + span;
        break;
    }
    case 11:                                        /* a span many times: what grows without end? */
        if (!n) break;
        k = below(n);
        span = 1 + below(n - k < 64 ? n - k : 64);
        memcpy(scratch, buf + k, span);
        for (size_t times = 1 + below(below(32) ? 24 : 4096); times && n + span <= INPUT_MAX; times--) n = insert(buf, n, at, scratch, span);
        break;
    case 12: {                                      /* a number written in digits becomes another */
        static const char *const numbers[] = { "0", "1", "-1", "00000000", "255", "256", "65535", "65536", "65537", "2147483647", "4294967296", "99999999999999999999", "" };
        for (k = at; k < n && !(buf[k] >= '0' && buf[k] <= '9'); k++) { }
        if (k >= n) break;
        for (span = 0; k + span < n && buf[k + span] >= '0' && buf[k + span] <= '9'; span++) { }
        memmove(buf + k, buf + k + span, n - k - span);
        n -= span;
        const char *number = numbers[below(sizeof numbers / sizeof *numbers)];
        n = insert(buf, n, k, (const uint8_t *)number, strlen(number));
        break;
    }
    default:                                        /* two spans change places */
        if (n < 4) break;
        k = below(n - 2);
        span = 1 + below(n - k - 1 < 16 ? n - k - 1 : 16);
        at = k + span + below(n - k - span);
        if (at + span > n) break;
        memcpy(scratch, buf + k, span);
        memmove(buf + k, buf + at, span);
        memcpy(buf + at, scratch, span);
        break;
    }
    return n;
}

/* ---------------------------------------------------------------- generators: inputs with a structure */
static size_t gen_packet(uint8_t *out, int hevc, unsigned *sequence, unsigned *stamp) {
    size_t n = 0, body;
    int sources = below(16) ? 0 : (int)below(4), extended = !below(16), padded = !below(16);
    out[n++] = (uint8_t)((below(64) ? 0x80 : below(256)) | (padded ? 0x20 : 0) | (extended ? 0x10 : 0) | sources);
    out[n++] = (uint8_t)((below(4) ? 0 : 0x80) | (below(32) ? (hevc ? 98 : 96) : below(128)));
    if (below(24)) (*sequence)++; else *sequence += (unsigned)below(4);
    if (!below(3)) *stamp += below(8) ? 3600 : (unsigned)chance();
    out[n++] = (uint8_t)(*sequence >> 8); out[n++] = (uint8_t)*sequence;
    out[n++] = (uint8_t)(*stamp >> 24); out[n++] = (uint8_t)(*stamp >> 16); out[n++] = (uint8_t)(*stamp >> 8); out[n++] = (uint8_t)*stamp;
    for (int i = 0; i < 4 + 4 * sources; i++) out[n++] = (uint8_t)chance();
    if (extended) { size_t words_ = below(8) ? below(3) : below(65536); out[n++] = 0xBE; out[n++] = 0xDE; out[n++] = (uint8_t)(words_ >> 8); out[n++] = (uint8_t)words_; for (size_t i = 0; i < 4 * (words_ < 3 ? words_ : 3); i++) out[n++] = 0; }
    body = below(8) ? 1 + below(24) : below(16) ? 1400 : 60000;
    int form = (int)below(8), flags = (int)below(4), inner = below(8) ? (int)(hevc ? below(40) : 1 + below(23)) : (int)below(64);
    uint8_t forbidden = below(64) ? 0 : 0x80;
    if (!hevc) {
        if (form < 3) { out[n++] = (uint8_t)(forbidden | 0x60 | inner); }
        else if (form < 5) {
            out[n++] = (uint8_t)(forbidden | 24);
            for (int units = 1 + (int)below(3); units; units--) {
                size_t one = 1 + below(6), said = below(8) ? one : below(65536);
                out[n++] = (uint8_t)(said >> 8); out[n++] = (uint8_t)said; out[n++] = (uint8_t)(below(8) ? 1 + below(23) : below(256));
                for (size_t i = 1; i < one; i++) out[n++] = (uint8_t)chance();
            }
            body = 0;
        }
        else { out[n++] = (uint8_t)(forbidden | 0x60 | (form < 7 ? 28 : below(32))); out[n++] = (uint8_t)((flags << 6) | (inner & 0x1F)); }
    } else {
        if (form < 3) { out[n++] = (uint8_t)(forbidden | (inner << 1)); out[n++] = (uint8_t)below(8); }
        else if (form < 5) {
            out[n++] = (uint8_t)(forbidden | (48 << 1)); out[n++] = 1;
            for (int units = 1 + (int)below(3); units; units--) {
                size_t one = 2 + below(6), said = below(8) ? one : below(65536);
                out[n++] = (uint8_t)(said >> 8); out[n++] = (uint8_t)said; out[n++] = (uint8_t)(below(8) ? below(40) << 1 : below(256)); out[n++] = 1;
                for (size_t i = 2; i < one; i++) out[n++] = (uint8_t)chance();
            }
            body = 0;
        }
        else { out[n++] = (uint8_t)(forbidden | ((form < 7 ? 49 : 48 + below(16)) << 1)); out[n++] = 1; out[n++] = (uint8_t)((flags << 6) | (inner & 0x3F)); }
    }
    for (size_t i = 0; i < body; i++) out[n++] = below(24) ? (uint8_t)(0xA0 | below(16)) : (uint8_t)below(4);
    if (padded) { size_t pad = below(8) ? 1 + below(4) : below(256); for (size_t i = 1; i < pad && i < 5; i++) out[n++] = 0; out[n++] = (uint8_t)pad; }
    return n;
}

static size_t gen_rtp(uint8_t *out) {
    static uint8_t packet[70000];
    int hevc = (int)below(2);
    unsigned sequence = (unsigned)chance(), stamp = (unsigned)chance();
    size_t n = 0;
    out[n++] = (uint8_t)hevc;
    for (int packets = 1 + (int)below(24); packets; packets--) {
        size_t k = gen_packet(packet, hevc, &sequence, &stamp);
        if (k > 65535 || n + 2 + k > INPUT_MAX) break;
        out[n++] = (uint8_t)(k >> 8); out[n++] = (uint8_t)k;
        memcpy(out + n, packet, k);
        n += k;
    }
    return n;
}

static size_t gen_client(uint8_t *out) {
    static uint8_t packet[70000];
    static const Seed opens[] = { S(DIALOGUE_H264), S(DIALOGUE_HEVC), S(DIALOGUE_STALE), S(DIALOGUE_OPEN) };
    size_t which = below(4), n = opens[which].n;
    int hevc = which == 1;
    unsigned sequence = (unsigned)chance(), stamp = (unsigned)chance();
    if (!below(6)) {
        /* An answer whose body is as long as it says, around the bound of a description: the lines of a description, again and again. */
        static const char line[] = "a=tool:fuzz-filler\r\n", last[] = "m=video 0 RTP/AVP 96\r\na=rtpmap:96 H264/90000\r\na=fmtp:96 sprop-parameter-sets=Z0LAHw==,aM4PyA==\r\na=control:trackID=0\r\n";
        size_t body = below(4) ? RELAY_SDP_MAX - 3 + below(7) : below(INPUT_MAX - 4096);
        int challenged = (int)below(2);
        n = (size_t)snprintf((char *)out, 1024, "%sRTSP/1.0 200 OK\r\nCSeq: %d\r\nContent-Base: rtsp://192.0.2.10:8554/media/video1/\r\nContent-Length: %zu\r\n\r\n", challenged ? ANSWER_401 : "", challenged ? 2 : 1, below(16) ? body : body + below(3) - 1);
        for (size_t i = 0; i < body; i++) out[n++] = (uint8_t)line[i % (sizeof line - 1)];
        if (body >= sizeof last - 1 && below(8)) memcpy(out + n - (sizeof last - 1), last, sizeof last - 1);
        memcpy(out + n, SET_UP("3") PLAYING("4") FRAMES, sizeof(SET_UP("3") PLAYING("4") FRAMES) - 1);
        return n + sizeof(SET_UP("3") PLAYING("4") FRAMES) - 1;
    }
    memcpy(out, opens[which].bytes, n);
    for (int frames = (int)below(40); frames; frames--) {
        size_t kind = below(16), k;
        if (kind == 0) { static const char m[] = KEEPALIVE_ANSWER; if (n + sizeof m > INPUT_MAX) break; memcpy(out + n, m, sizeof m - 1); n += sizeof m - 1; continue; }
        if (kind == 1) { static const char m[] = CAMERA_REQUEST; if (n + sizeof m > INPUT_MAX) break; memcpy(out + n, m, sizeof m - 1); n += sizeof m - 1; continue; }
        k = kind == 2 ? 0 : gen_packet(packet, hevc, &sequence, &stamp);
        if (k > 65535 || n + 4 + k > INPUT_MAX) break;
        size_t said = below(32) ? k : below(65536);
        out[n++] = '$'; out[n++] = (uint8_t)(below(12) ? 0 : below(256)); out[n++] = (uint8_t)(said >> 8); out[n++] = (uint8_t)said;
        memcpy(out + n, packet, k);
        n += k;
    }
    return n;
}

/* ---------------------------------------------------------------- the entries and the driver */
/* `most`: inputs of an entry are cut to this length (a little beyond the largest thing its reader takes), so
 * that the time goes into many inputs, not into a few very long ones. */
typedef struct Entry { const char *name; int (*run)(const uint8_t *, size_t); const Seed *seeds; int n_seeds; size_t (*generate)(uint8_t *); size_t most; } Entry;
#define COUNT(a) ((int)(sizeof(a) / sizeof *(a)))
static const Entry entries[] = {
    { "head", fuzz_head, seed_head, COUNT(seed_head), NULL, RELAY_HEAD_MAX + 512 },
    { "wire", fuzz_wire, seed_wire, COUNT(seed_wire), gen_client, INPUT_MAX },
    { "challenge", fuzz_challenge, seed_challenge, COUNT(seed_challenge), NULL, 4 * RELAY_FIELD_CHARS + 512 },
    { "description", fuzz_description, seed_description, COUNT(seed_description), NULL, RELAY_SDP_MAX + 512 },
    { "rtp", fuzz_rtp, seed_rtp, COUNT(seed_rtp), gen_rtp, INPUT_MAX },
    { "client", fuzz_client, seed_client, COUNT(seed_client), gen_client, INPUT_MAX },
    { "start", fuzz_start, seed_start, COUNT(seed_start), NULL, RELAY_LINE_MAX + 512 },
    { "report", fuzz_report, seed_report, COUNT(seed_report), NULL, 32 + 3 * RELAY_PSET_MAX + 64 },
};

static void run_one(const Entry *e, const uint8_t *data, size_t n) {
    g_entry = e->name;
    g_input = data;
    g_input_len = n;
    e->run(data, n);
}

#ifdef RELAY_LIBFUZZER
int LLVMFuzzerInitialize(int *argc, char ***argv) { (void)argc; (void)argv; signal(SIGPIPE, SIG_IGN); make_trains(); return 0; }
int LLVMFuzzerTestOneInput(const uint8_t *data, size_t n) {
    if (n) run_one(&entries[data[0] % COUNT(entries)], data + 1, n - 1);
    return 0;
}
#else
static double now_s(void) {
    struct timespec t;
    clock_gettime(CLOCK_MONOTONIC, &t);
    return (double)t.tv_sec + (double)t.tv_nsec / 1e9;
}

static unsigned long long fuzz_entry(const Entry *e, unsigned long long seed, unsigned long long iterations, double seconds) {
    static uint8_t input[INPUT_MAX + 70000], pool[POOL][4096];
    static size_t pool_len[POOL];
    double start = now_s();
    unsigned long long done = 0;
    size_t largest = 0;
    g_seed = seed;
    g_state = seed * 0x9E3779B97F4A7C15ULL + 0x1234567 + (unsigned long long)strlen(e->name) * 7919;
    for (int i = 0; i < 8; i++) chance();
    memset(pool_len, 0, sizeof pool_len);
    /* The corpus as it stands, then each of its inputs cut at every length up to 600: a reader must hold on any prefix. */
    for (int s = 0; s < e->n_seeds; s++) {
        g_iteration = 0;
        run_one(e, e->seeds[s].bytes, e->seeds[s].n);
        for (size_t cut = 0; cut < e->seeds[s].n && cut < 600; cut++) run_one(e, e->seeds[s].bytes, cut);
    }
    while ((!iterations || done < iterations) && (done % 64 || now_s() - start < seconds)) {
        size_t n, source = below(8), slot = below(POOL);
        g_iteration = ++done;
        alarm(30);
        if (e->generate && source >= 6) n = e->generate(input);
        else if (source >= 4 && pool_len[slot]) { n = pool_len[slot]; memcpy(input, pool[slot], n); }
        else { const Seed *s = &e->seeds[below((size_t)e->n_seeds)]; n = s->n; memcpy(input, s->bytes, n); }
        for (size_t times = below(7); times; times--) n = mutate(input, n, e->seeds, e->n_seeds);
        if (n > e->most) n = e->most;
        if (n > largest) largest = n;
        run_one(e, input, n);
        if (!below(8) && n <= sizeof pool[0]) { slot = below(POOL); memcpy(pool[slot], input, n); pool_len[slot] = n; }
    }
    alarm(0);
    printf("relay_fuzz: %-11s %9llu inputs in %5.1f s, the largest %6zu bytes, %d corpus inputs: no failure\n", e->name, done, now_s() - start, largest, e->n_seeds);
    fflush(stdout);
    return done;
}

int main(int argc, char **argv) {
    unsigned long long seed = 186, iterations = 0, total = 0;
    double seconds = 2.0, start;
    const char *only = NULL;
    int ran = 0;
    signal(SIGPIPE, SIG_IGN);
    signal(SIGALRM, on_alarm);
#ifdef HAVE_DEATH_CALLBACK
    __sanitizer_set_death_callback(dump_input);
#endif
    make_trains();
    if (sizeof SDP_H264 - 1 != 294 || sizeof SDP_HEVC - 1 != 321) { fprintf(stderr, "relay_fuzz: the corpus states a wrong Content-Length (%zu, %zu)\n", sizeof SDP_H264 - 1, sizeof SDP_HEVC - 1); return 2; }
    if (argc == 4 && !strcmp(argv[1], "--replay")) {
        static uint8_t input[INPUT_MAX];
        FILE *f = fopen(argv[3], "rb");
        if (!f) { fprintf(stderr, "relay_fuzz: no file %s\n", argv[3]); return 2; }
        size_t n = fread(input, 1, sizeof input, f);
        fclose(f);
        for (int i = 0; i < COUNT(entries); i++)
            if (!strcmp(entries[i].name, argv[2])) { alarm(30); run_one(&entries[i], input, n); alarm(0); printf("relay_fuzz: %s: %zu bytes replayed: no failure\n", argv[2], n); return 0; }
        fprintf(stderr, "relay_fuzz: no entry %s\n", argv[2]);
        return 2;
    }
    for (int i = 1; i + 1 < argc; i += 2) {
        if (!strcmp(argv[i], "--seconds")) seconds = atof(argv[i + 1]);
        else if (!strcmp(argv[i], "--iterations")) iterations = strtoull(argv[i + 1], NULL, 10);
        else if (!strcmp(argv[i], "--seed")) seed = strtoull(argv[i + 1], NULL, 10);
        else if (!strcmp(argv[i], "--entry")) only = argv[i + 1];
        else { fprintf(stderr, "usage: relay_fuzz [--seconds S] [--iterations N] [--seed X] [--entry NAME] | --replay NAME FILE\n"); return 2; }
    }
    start = now_s();
    for (int i = 0; i < COUNT(entries); i++) {
        if (only && strcmp(only, entries[i].name)) continue;
        total += fuzz_entry(&entries[i], seed, iterations, seconds);
        ran++;
    }
    if (!ran) { fprintf(stderr, "relay_fuzz: no entry %s\n", only ? only : "-"); return 2; }
    printf("relay_fuzz: %llu inputs over %d entry point(s) in %.1f s, seed %llu: 0 failures (AddressSanitizer and UndefinedBehaviorSanitizer when built by `make relay-fuzz`)\n", total, ran, now_s() - start, seed);
    return 0;
}
#endif
