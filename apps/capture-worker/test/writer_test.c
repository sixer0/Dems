/*
 * The fMP4 writer (src/sink.c) by itself (blueprint row 59; capture spec A.5, C.2, C.3, C.5;
 * checks M3-WI-1 "running hash == closed-file re-hash, checkpoints contiguous" and the writer half
 * of M3-KC-2). `make -C apps/capture-worker unit` runs it: `writer_test <scratch dir>`.
 *
 * A hand-made fragmented MP4 (ftyp, moov with two tracks and their `trex` defaults, then moof +
 * mdat pairs) is pushed through sink_write() in pieces of the muxer's buffer size. Everything the
 * writer says is then RE-DERIVED FROM THE FILE by this test's own box walk and its own SHA-256
 * (CommonCrypto on macOS: not the library the writer hashes with):
 *
 *   chain        per fragment: digest of the stored bytes, chain, running prefix; the last prefix is
 *                the hash of the whole file; index 1..N without a gap; byte ranges contiguous;
 *                media time and the keyframe flag as the fragments were made
 *   equality     two runs over the same bytes give the same checkpoints (S1 pattern), another
 *                input gives another chain (control)
 *   durability   at the first checkpoint the file HAS its final name, and the temporary name is gone
 *   failed write a write that comes back short, and one that fails at once (ENOSPC): the file is
 *                back at its last good length, no checkpoint was given for the failed fragment,
 *                the tail check passes. Built with -DDEMS_PROOF_KEEP_TORN_TAIL (the negative control)
 *                the torn tail stays and THIS TEST FAILS on exactly those checks.
 *   first write  the failed write is the first one: no final name, no temporary name
 *   rules        a top-level box that is no fragment, a gap in the fragment numbers: refused
 *   tail         what is left after the last whole fragment at close is never written
 *   cipher seam  with a (toy) cipher both chains differ and each re-derives from its own bytes
 *   size bound   (review R63-02) a fragment above `max_fragment_bytes` is refused BEFORE a byte of it is
 *                written: the file keeps the fragments before it, no checkpoint is given for it. Built with
 *                -DDEMS_PROOF_NO_FRAGMENT_BOUND (the rule off) THIS TEST FAILS on exactly the SIZE BOUND checks.
 *   sync level   (review R63-09) on a volume that does not take the full sync the writer falls back to
 *                fsync() and SAYS so (the level of the file is FSYNC, at the first checkpoint already); a file
 *                whose first sync was full and whose later sync is not is a FAILED sync, never a quieter one.
 *                Built with -DDEMS_PROOF_SILENT_SYNC_FALLBACK (the reporting before fix pass F-M3) THIS TEST
 *                FAILS on exactly the SYNC LEVEL checks.
 */
#include "../src/worker.h"

#include <errno.h>
#include <fcntl.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <unistd.h>

#ifdef __APPLE__
#include <CommonCrypto/CommonDigest.h>
static void sha(const uint8_t *p, size_t n, uint8_t out[32]) { CC_SHA256(p, (CC_LONG)n, out); }
#else
#include <libavutil/sha.h>
static void sha(const uint8_t *p, size_t n, uint8_t out[32]) { struct AVSHA *c = av_sha_alloc(); av_sha_init(c, 256); av_sha_update(c, p, n); av_sha_final(c, out); av_free(c); }
#endif

Session S;                                  /* worker.h declares these; the writer itself uses neither */
int64_t mono_us(void) { struct timespec t; clock_gettime(CLOCK_MONOTONIC, &t); return t.tv_sec * US + t.tv_nsec / 1000; }

static int failures;
#define CHECK(cond, ...) do { if (!(cond)) { failures++; printf("writer_test: FAILED: "); printf(__VA_ARGS__); printf("\n"); } } while (0)

/* ---------------------------------------------------------------- a hand-made fragmented MP4 */
typedef struct { uint8_t *p; size_t n, cap; } Buf;
static void put(Buf *b, const void *d, size_t n) { if (b->n + n > b->cap) { b->cap = (b->n + n) * 2; b->p = realloc(b->p, b->cap); } memcpy(b->p + b->n, d, n); b->n += n; }
static void u32(Buf *b, uint32_t v) { uint8_t x[4] = { v >> 24, v >> 16, v >> 8, v }; put(b, x, 4); }
static void u64(Buf *b, uint64_t v) { u32(b, (uint32_t)(v >> 32)); u32(b, (uint32_t)v); }
static size_t open_box(Buf *b, const char *type) { size_t at = b->n; u32(b, 0); put(b, type, 4); return at; }
static void close_box(Buf *b, size_t at) { uint32_t n = (uint32_t)(b->n - at); b->p[at] = n >> 24; b->p[at + 1] = n >> 16; b->p[at + 2] = n >> 8; b->p[at + 3] = n; }
static void zeros(Buf *b, size_t n) { static const uint8_t z[64]; while (n) { size_t k = n < 64 ? n : 64; put(b, z, k); n -= k; } }

#define V_SCALE 90000
#define A_SCALE 48000
#define V_FRAME 1800        /* 50 fps */
#define A_FRAME 1024

static void trak(Buf *b, uint32_t id, uint32_t scale, const char *handler) {
    size_t t = open_box(b, "trak");
    size_t k = open_box(b, "tkhd"); u32(b, 0); u32(b, 0); u32(b, 0); u32(b, id); zeros(b, 68); close_box(b, k);
    size_t m = open_box(b, "mdia");
    size_t h = open_box(b, "mdhd"); u32(b, 0); u32(b, 0); u32(b, 0); u32(b, scale); u32(b, 0); u32(b, 0); close_box(b, h);
    size_t r = open_box(b, "hdlr"); u32(b, 0); u32(b, 0); put(b, handler, 4); zeros(b, 13); close_box(b, r);
    close_box(b, m);
    close_box(b, t);
}

static void init_segment(Buf *b) {
    size_t f = open_box(b, "ftyp"); put(b, "isom", 4); u32(b, 512); put(b, "isomiso6mp41", 12); close_box(b, f);
    size_t m = open_box(b, "moov");
    size_t h = open_box(b, "mvhd"); zeros(b, 100); close_box(b, h);
    trak(b, 1, V_SCALE, "vide");
    trak(b, 2, A_SCALE, "soun");
    size_t x = open_box(b, "mvex");
    /* trex: the video default is "not a sync sample"; the audio default duration is one AAC frame. */
    size_t t1 = open_box(b, "trex"); u32(b, 0); u32(b, 1); u32(b, 1); u32(b, V_FRAME); u32(b, 0); u32(b, 0x01010000); close_box(b, t1);
    size_t t2 = open_box(b, "trex"); u32(b, 0); u32(b, 2); u32(b, 1); u32(b, A_FRAME); u32(b, 0); u32(b, 0x02000000); close_box(b, t2);
    close_box(b, x);
    close_box(b, m);
}

/* One fragment: `vframes` video samples from `v_base` (the first a sync sample when `key`), `aframes` audio samples. */
static void fragment(Buf *b, uint32_t seq, uint64_t v_base, int vframes, int key, uint64_t a_base, int aframes, size_t payload, uint8_t fill) {
    size_t m = open_box(b, "moof");
    size_t h = open_box(b, "mfhd"); u32(b, 0); u32(b, seq); close_box(b, h);
    if (vframes) {
        size_t t = open_box(b, "traf");
        size_t a = open_box(b, "tfhd"); u32(b, 0x020000); u32(b, 1); close_box(b, a);                 /* default-base-is-moof, defaults from trex */
        size_t d = open_box(b, "tfdt"); u32(b, 0x01000000); u64(b, v_base); close_box(b, d);
        /* trun: data offset + first-sample flags + a size per sample */
        size_t r = open_box(b, "trun"); u32(b, 0x000205); u32(b, (uint32_t)vframes); u32(b, 0); u32(b, key ? 0x02000000 : 0x01010000);
        for (int i = 0; i < vframes; i++) u32(b, 100);
        close_box(b, r);
        close_box(b, t);
    }
    if (aframes) {
        size_t t = open_box(b, "traf");
        size_t a = open_box(b, "tfhd"); u32(b, 0x020008); u32(b, 2); u32(b, A_FRAME); close_box(b, a);
        size_t d = open_box(b, "tfdt"); u32(b, 0); u32(b, (uint32_t)a_base); close_box(b, d);        /* version 0: 32-bit */
        size_t r = open_box(b, "trun"); u32(b, 0x000201); u32(b, (uint32_t)aframes); u32(b, 0);
        for (int i = 0; i < aframes; i++) u32(b, 10);
        close_box(b, r);
        close_box(b, t);
    }
    close_box(b, m);
    size_t d = open_box(b, "mdat");
    for (size_t i = 0; i < payload; i++) { uint8_t x = (uint8_t)(fill + i * 31 + seq); put(b, &x, 1); }
    close_box(b, d);
}

#define NFRAG 6
/* The stream of the test: 1 s of video (50 frames) and 47 audio frames per fragment; fragment 4 has no video (a stall cut). */
static size_t stream(Buf *b, uint8_t fill, size_t ends[NFRAG + 1]) {
    init_segment(b);
    ends[0] = b->n;
    for (uint32_t i = 1; i <= NFRAG; i++) {
        fragment(b, i, (uint64_t)(i - 1) * 50 * V_FRAME, i == 4 ? 0 : 50, 1, (uint64_t)(i - 1) * 47 * A_FRAME, 47, 150000 + i * 7919, fill);
        ends[i] = b->n;
    }
    return b->n;
}

/* ---------------------------------------------------------------- what the writer said */
typedef struct { Checkpoint cp[64]; _Atomic int n; char path[1024]; int name_at_first, part_at_first; long long size_at_callback[64]; const Sink *sink; char level_at_first[16]; } Seen;

static void on_durable(void *opaque, const Checkpoint *cp) {
    Seen *seen = opaque;
    struct stat st;
    if (cp->first) {
        if (seen->sink) snprintf(seen->level_at_first, sizeof seen->level_at_first, "%s", sink_sync_level(seen->sink));
        seen->name_at_first = lstat(seen->path, &st) == 0;
        char cmd[1200];
        snprintf(cmd, sizeof cmd, "ls '%s'.*.part >/dev/null 2>&1", seen->path);
        seen->part_at_first = system(cmd) == 0;
    }
    seen->size_at_callback[seen->n] = lstat(seen->path, &st) == 0 ? (long long)st.st_size : -1;
    if (seen->n < 64) seen->cp[seen->n++] = *cp;
}

static int feed(Sink *s, const uint8_t *p, size_t n) {
    for (size_t off = 0; off < n; off += 65536) {
        int chunk = (int)(n - off < 65536 ? n - off : 65536);
        int r = sink_write(s, p + off, chunk);
        if (r < 0) return r;
    }
    return 0;
}

static uint8_t *slurp(const char *path, size_t *n) {
    FILE *f = fopen(path, "rb");
    if (!f) { *n = 0; return NULL; }
    fseek(f, 0, SEEK_END);
    *n = (size_t)ftell(f);
    rewind(f);
    uint8_t *p = malloc(*n + 1);
    if (fread(p, 1, *n, f) != *n) { free(p); p = NULL; *n = 0; }
    fclose(f);
    return p;
}

static uint32_t be(const uint8_t *p) { return ((uint32_t)p[0] << 24) | ((uint32_t)p[1] << 16) | ((uint32_t)p[2] << 8) | p[3]; }

/* THE TAIL CHECK of this test (the rule of RECOVERY, spec C.5): the top-level boxes tile the file
 * exactly, and after the init segment they are moof, mdat pairs. Returns the number of whole
 * fragments, or -1 when a declared size exceeds the bytes present or the pattern breaks. */
static int tail_check(const uint8_t *p, size_t n, size_t *starts, size_t *lens) {
    size_t off = 0;
    int frags = 0, in_fragment = 0, seen_moov = 0;
    while (off < n) {
        if (n - off < 8) return -1;
        size_t size = be(p + off);
        if (size < 8 || size > n - off) return -1;
        if (!memcmp(p + off + 4, "moov", 4)) seen_moov = 1;
        if (!memcmp(p + off + 4, "moof", 4)) { if (in_fragment || !seen_moov) return -1; in_fragment = 1; starts[frags] = off; }
        else if (!memcmp(p + off + 4, "mdat", 4)) { if (!in_fragment) return -1; in_fragment = 0; lens[frags] = off + size - starts[frags]; frags++; }
        else if (frags || in_fragment) return -1;
        off += size;
    }
    return in_fragment ? -1 : frags;
}

static void hex(const uint8_t d[32], char out[65]) { sha256_hex(d, out); }

/* Re-derives every checkpoint from the bytes on the disk and holds the writer's to them. */
static void verify_against_file(const char *label, const char *path, const Seen *seen, int expect, const uint8_t *plain_of_file) {
    size_t n, starts[64], lens[64];
    uint8_t *file = slurp(path, &n);
    int frags = file ? tail_check(file, n, starts, lens) : -1;
    CHECK(frags == expect, "%s: the file holds %d whole fragments, expected %d", label, frags, expect);
    CHECK(seen->n == expect, "%s: %d checkpoints were given, expected %d", label, seen->n, expect);
    uint8_t chain[32], pchain[32], d[32], both[64];
    sha((const uint8_t *)"", 0, chain);
    memcpy(pchain, chain, 32);
    char a[65], b[65];
    for (int i = 0; i < frags && i < seen->n; i++) {
        const Checkpoint *cp = &seen->cp[i];
        CHECK(cp->index == (uint32_t)(i + 1), "%s: checkpoint %d has index %u (a gap)", label, i + 1, cp->index);
        CHECK((size_t)cp->start == starts[i] && (size_t)cp->len == lens[i], "%s: checkpoint %d names bytes [%lld, +%lld), the file has [%zu, +%zu)", label, i + 1, (long long)cp->start, (long long)cp->len, starts[i], lens[i]);
        CHECK(i == 0 || cp->start == seen->cp[i - 1].start + seen->cp[i - 1].len, "%s: checkpoint %d does not start where %d ends", label, i + 1, i);
        sha(file + starts[i], lens[i], d);
        hex(d, a); hex(cp->frag, b);
        CHECK(!memcmp(d, cp->frag, 32), "%s: fragment %d: stored digest %s, the file gives %s", label, i + 1, b, a);
        memcpy(both, chain, 32); memcpy(both + 32, d, 32); sha(both, 64, chain);
        CHECK(!memcmp(chain, cp->chain, 32), "%s: fragment %d: the chain does not re-derive from the file", label, i + 1);
        sha(file, starts[i] + lens[i], d);
        CHECK(!memcmp(d, cp->prefix, 32), "%s: fragment %d: the running prefix is not the hash of the file up to its end", label, i + 1);
        const uint8_t *plain = plain_of_file ? plain_of_file : file;
        sha(plain + starts[i], lens[i], d);
        CHECK(!memcmp(d, cp->plain, 32), "%s: fragment %d: the plaintext digest does not re-derive", label, i + 1);
        memcpy(both, pchain, 32); memcpy(both + 32, d, 32); sha(both, 64, pchain);
        CHECK(!memcmp(pchain, cp->plain_chain, 32), "%s: fragment %d: the plaintext chain does not re-derive", label, i + 1);
        CHECK(cp->durable_at_ms > 1600000000000LL, "%s: fragment %d has no durable time", label, i + 1);
        CHECK(seen->size_at_callback[i] >= cp->start + cp->len, "%s: checkpoint %d was given before its bytes were in the file", label, i + 1);
    }
    if (frags > 0 && seen->n == frags) {
        sha(file, n, d);
        CHECK(!memcmp(d, seen->cp[frags - 1].prefix, 32), "%s: the last running prefix is not the hash of the whole file", label);
        CHECK((size_t)(seen->cp[frags - 1].start + seen->cp[frags - 1].len) == n, "%s: the file length %zu is not the end of the last checkpoint", label, n);
    }
    free(file);
}

static int part_files(const char *dir) {
    char cmd[1200];
    snprintf(cmd, sizeof cmd, "test -z \"$(ls '%s' | grep '\\.part$')\"", dir);
    return system(cmd) != 0;
}

/* ---------------------------------------------------------------- the sync seam (review R63-09) */
static _Atomic int sync_calls;
static int sync_full_until;     /* the first N full syncs are taken; after them the volume answers ENOTSUP. 0: never taken */
static int no_full_sync(int fd) { (void)fd; return atomic_fetch_add(&sync_calls, 1) < sync_full_until ? 0 : ENOTSUP; }
static char sync_failure_code[64];
static void on_sync_failure(void *opaque, const char *code, int averror) { (void)opaque; (void)averror; snprintf(sync_failure_code, sizeof sync_failure_code, "%s", code ? code : "(none)"); }

/* ---------------------------------------------------------------- the fault seam */
static int64_t fault_at;
static long fault_bytes;        /* -2: half of the fragment */
static long fault(Sink *s, int64_t fragment_no, size_t len) { (void)s; return fragment_no == fault_at ? (fault_bytes == -2 ? (long)(len / 2) : fault_bytes) : -1; }

static void xor_bytes(uint8_t *p, size_t n) { for (size_t i = 0; i < n; i++) p[i] ^= 0x5a; }
static int toy_seal(void *ctx, uint32_t index, int64_t off, uint8_t *bytes, size_t len, uint8_t iv[12], uint8_t tag[16]) {
    (void)ctx; (void)off;
    /* Seals the WHOLE fragment but keeps the two box headers and the moof readable (spec D.1: the structure stays clear). */
    size_t moof = be(bytes);
    xor_bytes(bytes + moof + 8, len - moof - 8);
    memset(iv, (int)index, 12);
    memset(tag, 0xee, 16);
    return 0;
}

int main(int argc, char **argv) {
    if (argc != 2) { fprintf(stderr, "usage: writer_test <scratch dir>\n"); return 2; }
    char cmd[1200], path[1024];
    snprintf(cmd, sizeof cmd, "rm -rf '%s' && mkdir -p '%s'", argv[1], argv[1]);
    if (system(cmd)) return 2;
    Buf in = { 0 }, other = { 0 };
    size_t ends[NFRAG + 1], ends2[NFRAG + 1];
    stream(&in, 7, ends);
    stream(&other, 8, ends2);
    static Seen run[2], third, seen;
    Sink s;

    /* ---- chain: two runs over the same bytes, every value re-derived from the file */
    for (int r = 0; r < 2; r++) {
        snprintf(path, sizeof path, "%s/run%d.mp4", argv[1], r);
        snprintf(run[r].path, sizeof run[r].path, "%s", path);
        sink_init(&s, path);
        s.on_durable = on_durable; s.opaque = &run[r];
        CHECK(feed(&s, in.p, in.n) == 0, "run %d: a write was refused", r);
        CHECK(sink_close(&s) == 0, "run %d: close failed", r);
        verify_against_file(r ? "run 2" : "run 1", path, &run[r], NFRAG, NULL);
        CHECK(run[r].name_at_first == 1, "run %d: the first checkpoint was given before the file had its final name", r);
        CHECK(!part_files(argv[1]), "run %d: a temporary name was left after a clean close", r);
    }
    int same = run[0].n == run[1].n;
    for (int i = 0; same && i < run[0].n; i++) same = !memcmp(run[0].cp[i].chain, run[1].cp[i].chain, 32) && !memcmp(run[0].cp[i].prefix, run[1].cp[i].prefix, 32) && !memcmp(run[0].cp[i].plain_chain, run[1].cp[i].plain_chain, 32);
    CHECK(same, "chain equality: two runs over the same bytes gave different chains");
    /* media time and keyframe flag, as the fragments were made (fragment 4 is audio only) */
    for (int i = 0; i < run[0].n; i++) {
        const Checkpoint *cp = &run[0].cp[i];
        long long a0 = (long long)i * 47 * A_FRAME * 1000 / A_SCALE, a1 = (long long)(i + 1) * 47 * A_FRAME * 1000 / A_SCALE, v0 = (long long)i * 1000, v1 = (long long)(i + 1) * 1000;
        long long lo = i == 3 ? a0 : (a0 < v0 ? a0 : v0), hi = i == 3 ? a1 : (a1 > v1 ? a1 : v1);
        CHECK(llabs(cp->media_start_ms - lo) <= 1 && llabs(cp->media_start_ms + cp->media_duration_ms - hi) <= 1, "fragment %d: media [%lld, +%lld) ms, made as [%lld, %lld)", i + 1, (long long)cp->media_start_ms, (long long)cp->media_duration_ms, lo, hi);
        CHECK(cp->keyframe == (i != 3), "fragment %d: keyframe flag %d", i + 1, cp->keyframe);
        CHECK(!cp->sealed, "fragment %d: marked sealed without a cipher", i + 1);
        CHECK(!memcmp(cp->frag, cp->plain, 32) && !memcmp(cp->chain, cp->plain_chain, 32), "fragment %d: without a cipher the two chains must carry the same digests", i + 1);
    }
    /* CONTROL: another input gives another chain (the equality above is not an accident of the test). */
    snprintf(path, sizeof path, "%s/other.mp4", argv[1]);
    snprintf(third.path, sizeof third.path, "%s", path);
    sink_init(&s, path);
    s.on_durable = on_durable; s.opaque = &third;
    feed(&s, other.p, other.n);
    sink_close(&s);
    CHECK(third.n == NFRAG && memcmp(third.cp[NFRAG - 1].chain, run[0].cp[NFRAG - 1].chain, 32), "control: a different input gave the same chain");

    /* ---- failed write: short, then ENOSPC at once. The file is back at its last good length. */
    sink_fault_hook = fault;
    for (int mode = 0; mode < 2; mode++) {
        memset(&seen, 0, sizeof seen);
        snprintf(path, sizeof path, "%s/fault%d.mp4", argv[1], mode);
        snprintf(seen.path, sizeof seen.path, "%s", path);
        fault_at = 3;
        fault_bytes = mode ? 0 : -2;
        sink_init(&s, path);
        s.on_durable = on_durable; s.opaque = &seen;
        int r = feed(&s, in.p, in.n);
        CHECK(r == AVERROR(ENOSPC), "failed write (%s): the write was not reported as failed (%d)", mode ? "at once" : "short", r);
        CHECK(sink_write(&s, in.p, 8) == AVERROR(ENOSPC), "failed write: the writer took bytes after it failed");
        CHECK(s.fail_code && !strcmp(s.fail_code, "WRITER_WRITE_FAILED"), "failed write: code %s", s.fail_code ? s.fail_code : "(none)");
        CHECK(sink_close(&s) == AVERROR(ENOSPC), "failed write: close did not return the failure");
        struct stat st;
        long long size = lstat(path, &st) == 0 ? (long long)st.st_size : -1;
        CHECK(size == (long long)ends[2], "failed write (%s): the file is %lld bytes, its last good length is %zu (TRUNCATION)", mode ? "at once" : "short", size, ends[2]);
        verify_against_file(mode ? "failed write at once (TRUNCATION)" : "short write (TRUNCATION)", path, &seen, 2, NULL);
    }
    /* ---- the failed write is the first one: no final name and no temporary name */
    memset(&seen, 0, sizeof seen);
    snprintf(path, sizeof path, "%s/first.mp4", argv[1]);
    snprintf(seen.path, sizeof seen.path, "%s", path);
    fault_at = 1;
    fault_bytes = -2;
    sink_init(&s, path);
    s.on_durable = on_durable; s.opaque = &seen;
    CHECK(feed(&s, in.p, in.n) == AVERROR(ENOSPC), "first write failed: not reported");
    sink_close(&s);
    CHECK(!sink_path_occupied(path) && !part_files(argv[1]) && seen.n == 0, "first write failed: a name or a checkpoint was left");
    sink_fault_hook = NULL;

    /* ---- rules: a box that is no fragment, a gap in the numbers, a partial tail at close */
    {
        Buf b = { 0 };
        init_segment(&b);
        fragment(&b, 1, 0, 50, 1, 0, 47, 1000, 1);
        size_t f = open_box(&b, "free"); zeros(&b, 32); close_box(&b, f);
        fragment(&b, 2, 50 * V_FRAME, 50, 1, 47 * A_FRAME, 47, 1000, 1);
        snprintf(path, sizeof path, "%s/free.mp4", argv[1]);
        sink_init(&s, path);
        int r = feed(&s, b.p, b.n);
        CHECK(r < 0 && s.fail_code && !strcmp(s.fail_code, "WRITER_UNEXPECTED_BOX"), "a top-level box that is no fragment was accepted (%d, %s)", r, s.fail_code ? s.fail_code : "(none)");
        sink_close(&s);
        b.n = 0;
        init_segment(&b);
        fragment(&b, 1, 0, 50, 1, 0, 47, 1000, 1);
        fragment(&b, 3, 50 * V_FRAME, 50, 1, 47 * A_FRAME, 47, 1000, 1);
        snprintf(path, sizeof path, "%s/gap.mp4", argv[1]);
        sink_init(&s, path);
        r = feed(&s, b.p, b.n);
        CHECK(r < 0 && s.fail_code && !strcmp(s.fail_code, "WRITER_SEQUENCE_GAP"), "a gap in the fragment numbers was accepted (%d, %s)", r, s.fail_code ? s.fail_code : "(none)");
        sink_close(&s);
        size_t n;
        uint8_t *file = slurp(path, &n);
        size_t st[8], ln[8];
        CHECK(file && tail_check(file, n, st, ln) == 1, "after a refused fragment the file must hold exactly the fragments before it");
        free(file);
        /* the muxer stops in the middle of a fragment: what is left is not written */
        memset(&seen, 0, sizeof seen);
        snprintf(path, sizeof path, "%s/tail.mp4", argv[1]);
        snprintf(seen.path, sizeof seen.path, "%s", path);
        sink_init(&s, path);
        s.on_durable = on_durable; s.opaque = &seen;
        CHECK(feed(&s, in.p, ends[3] + 4321) == 0, "partial tail: a write was refused");
        CHECK(sink_close(&s) == 0 && s.dropped_tail_bytes == 4321, "partial tail: %lld bytes reported as not written, expected 4321", (long long)s.dropped_tail_bytes);
        verify_against_file("partial tail at close", path, &seen, 3, NULL);
        free(b.p);
    }

    /* ---- the cipher seam: plaintext chain before it, stored-bytes chain after it */
    {
        FragmentCipher toy = { NULL, "KID-TEST", toy_seal };
        memset(&seen, 0, sizeof seen);
        snprintf(path, sizeof path, "%s/sealed.mp4", argv[1]);
        snprintf(seen.path, sizeof seen.path, "%s", path);
        sink_init(&s, path);
        s.cipher = &toy;
        s.on_durable = on_durable; s.opaque = &seen;
        CHECK(feed(&s, in.p, in.n) == 0 && sink_close(&s) == 0, "cipher seam: the writer failed");
        verify_against_file("cipher seam", path, &seen, NFRAG, in.p);
        int differ = seen.n == NFRAG;
        for (int i = 0; differ && i < seen.n; i++) differ = seen.cp[i].sealed && memcmp(seen.cp[i].frag, seen.cp[i].plain, 32) && memcmp(seen.cp[i].chain, seen.cp[i].plain_chain, 32) && seen.cp[i].iv[0] == (uint8_t)(i + 1);
        CHECK(differ, "cipher seam: the stored-bytes chain and the plaintext chain must differ on sealed bytes");
        CHECK(seen.n == NFRAG && !memcmp(seen.cp[NFRAG - 1].plain_chain, run[0].cp[NFRAG - 1].plain_chain, 32), "cipher seam: the plaintext chain must be the chain of the unsealed run");
    }

    /* ---- the size bound (review R63-02): a fragment above it is refused before a byte of it is written */
    {
        size_t bound = ends[3] - ends[2];                   /* exactly fragment 3: it is taken; fragment 4 is larger and is not */
        CHECK(ends[4] - ends[3] > bound && ends[2] - ends[1] <= bound && ends[1] - ends[0] <= bound, "size bound: the test stream is not what the test assumes");
        memset(&seen, 0, sizeof seen);
        snprintf(path, sizeof path, "%s/bound.mp4", argv[1]);
        snprintf(seen.path, sizeof seen.path, "%s", path);
        sink_init(&s, path);
        s.max_fragment_bytes = bound;
        s.on_durable = on_durable; s.opaque = &seen;
        int r = feed(&s, in.p, in.n);
        CHECK(r == AVERROR(EFBIG) && s.fail_code && !strcmp(s.fail_code, "WRITER_FRAGMENT_TOO_LARGE"), "a fragment above the bound was not refused by name (%d, %s) (SIZE BOUND)", r, s.fail_code ? s.fail_code : "(none)");
        sink_close(&s);
        struct stat st;
        long long size = lstat(path, &st) == 0 ? (long long)st.st_size : -1;
        CHECK(size == (long long)ends[3], "size bound: the file is %lld bytes; it must end with the last fragment inside the bound, at %zu (SIZE BOUND)", size, ends[3]);
        int inside = seen.n == 3;
        for (int i = 0; i < seen.n; i++) inside = inside && (size_t)seen.cp[i].len <= bound;
        CHECK(inside, "size bound: %d checkpoints were given, or one is above the bound of %zu bytes (SIZE BOUND)", seen.n, bound);
        if (size == (long long)ends[3]) verify_against_file("size bound: the fragments before the refused one", path, &seen, 3, NULL);
        /* CONTROL: the same stream with the bound at its largest fragment is written whole. */
        memset(&seen, 0, sizeof seen);
        snprintf(path, sizeof path, "%s/bound_ok.mp4", argv[1]);
        snprintf(seen.path, sizeof seen.path, "%s", path);
        sink_init(&s, path);
        s.max_fragment_bytes = ends[NFRAG] - ends[NFRAG - 1];
        s.on_durable = on_durable; s.opaque = &seen;
        CHECK(feed(&s, in.p, in.n) == 0 && sink_close(&s) == 0 && seen.n == NFRAG, "size bound control: a stream inside the bound was not written whole (%d checkpoints)", seen.n);
    }

    /* ---- the sync level (review R63-09): what a sync really was is stated, never assumed */
    {
        /* this volume, no seam: the level of the file is known at its first checkpoint and is one of the two words */
        memset(&seen, 0, sizeof seen);
        snprintf(path, sizeof path, "%s/sync_plain.mp4", argv[1]);
        snprintf(seen.path, sizeof seen.path, "%s", path);
        sink_init(&s, path);
        CHECK(!strcmp(sink_sync_level(&s), "NOT_YET") || !strcmp(sink_sync_level(&s), sink_sync_wanted()), "sync level: a file that was never synced claims %s", sink_sync_level(&s));
        seen.sink = &s;
        s.on_durable = on_durable; s.opaque = &seen;
        CHECK(feed(&s, in.p, in.n) == 0 && sink_close(&s) == 0, "sync level: the plain run failed");
        CHECK(!strcmp(seen.level_at_first, "F_FULLFSYNC") || !strcmp(seen.level_at_first, "FSYNC"), "sync level: at the first checkpoint the level reads '%s'", seen.level_at_first);
        /* a volume that does not take the full sync: fsync() is used, every checkpoint is given, and the level SAYS FSYNC */
        sink_full_sync_hook = no_full_sync;
        sync_full_until = 0;
        atomic_store(&sync_calls, 0);
        memset(&seen, 0, sizeof seen);
        snprintf(path, sizeof path, "%s/sync_fallback.mp4", argv[1]);
        snprintf(seen.path, sizeof seen.path, "%s", path);
        sink_init(&s, path);
        seen.sink = &s;
        s.on_durable = on_durable; s.opaque = &seen;
        CHECK(feed(&s, in.p, in.n) == 0 && sink_close(&s) == 0 && seen.n == NFRAG, "sync level: on a volume without the full sync the writer must still write and checkpoint (%d checkpoints)", seen.n);
        CHECK(atomic_load(&sync_calls) >= 2, "sync level: the seam was not asked (%d calls): the test cannot fail", atomic_load(&sync_calls));
        CHECK(!strcmp(seen.level_at_first, "FSYNC"), "the fallback was silent: at the first checkpoint the level reads '%s', the volume gave FSYNC (SYNC LEVEL)", seen.level_at_first);
        CHECK(!strcmp(sink_sync_level(&s), "FSYNC"), "the fallback was silent: the file's level reads '%s', the volume gave FSYNC (SYNC LEVEL)", sink_sync_level(&s));
        /* the first sync (data + directory) is full, every later one is not: a FAILED sync, no checkpoint, never a quieter level */
        sync_full_until = 2;
        atomic_store(&sync_calls, 0);
        sync_failure_code[0] = 0;
        memset(&seen, 0, sizeof seen);
        snprintf(path, sizeof path, "%s/sync_changed.mp4", argv[1]);
        snprintf(seen.path, sizeof seen.path, "%s", path);
        sink_init(&s, path);
        seen.sink = &s;
        s.on_durable = on_durable; s.on_sync_failure = on_sync_failure; s.opaque = &seen;
        CHECK(feed(&s, in.p, ends[1]) == 0, "sync level: the first fragment was refused");
        for (int i = 0; i < 2000 && atomic_load(&seen.n) < 1; i++) usleep(1000);       /* the first batch (fragment 1) is synced and named */
        CHECK(atomic_load(&seen.n) == 1 && !strcmp(seen.level_at_first, "F_FULLFSYNC"), "sync level: the first fragment is not durable at the full level (%d checkpoints, '%s')", atomic_load(&seen.n), seen.level_at_first);
        feed(&s, in.p + ends[1], in.n - ends[1]);
        int closed = sink_close(&s);
        CHECK(closed < 0 && !strcmp(sync_failure_code, "WRITER_SYNC_LEVEL_CHANGED"), "a weaker sync of the same file was taken quietly: close %d, failure '%s' (SYNC LEVEL)", closed, sync_failure_code);
        CHECK(atomic_load(&seen.n) == 1, "a checkpoint was given for a fragment whose sync was weaker than the file's stated level: %d checkpoints, expected 1 (SYNC LEVEL)", atomic_load(&seen.n));
        CHECK(!strcmp(sink_sync_level(&s), "F_FULLFSYNC"), "sync level: the stated level of the file changed to '%s' (SYNC LEVEL)", sink_sync_level(&s));
        sink_full_sync_hook = NULL;
    }

    snprintf(cmd, sizeof cmd, "rm -rf '%s'", argv[1]);
    if (system(cmd)) return 2;
    if (failures) { printf("writer_test: %d check(s) FAILED\n", failures); return 1; }
    printf("writer_test: all checks hold (%d fragments: chains re-derived from the file with another SHA-256, two runs equal, sync wanted %s and stated per file; short and failed writes truncate to the last good length; cipher seam; size bound; sync level)\n", NFRAG, sink_sync_wanted());
    return 0;
}
