/*
 * THE fMP4 WRITER of one camera file (blueprint rows 58 and 59; register NM-04, NM-05; decision
 * D67 option C; capture spec A.5, B.2 "Restart rule", C.1-C.6).
 *
 * THE CREATION RULE (row 58, kept): no worker ever truncates or overwrites a file that exists, and
 * a file that holds no fragment never exists under an evidence name. The file APPEARS AT ITS FINAL
 * NAME ONLY WITH ITS INIT SEGMENT AND ONE WHOLE FRAGMENT IN IT: the first fragment is written to
 * `<path>.<pid>.part` (created with O_EXCL), that file is LINKED to the final name (link() is
 * atomic and fails when the name exists), and the temporary name is then removed. The descriptor
 * stays open and later fragments are appended. A `.part` a dead worker left is never reused and
 * never removed: it is reported at START. A process killed between link() and unlink() leaves the
 * `.part` as a SECOND NAME OF THE SAME FILE (same inode), not as a second file: RECOVERY treats it
 * so (apps/core-server/src/capture/fragments.ts, `classifyPartNames`). PRECONDITION: the evidence
 * volume supports hard links; on a volume without them the link fails and every session ends with
 * a fatal error (OUTPUT_LINK_FAILED) - nothing is ever written under an evidence name another way.
 *
 * APPEND-ONLY, ONE WHOLE FRAGMENT AT A TIME. The muxer writes into memory through this unit (an
 * AVIO write callback, not seekable). The bytes are held until a whole fragment is there - a
 * complete `moof` box followed by a complete `mdat` box - and that fragment goes to the file in
 * one piece. Nothing else is ever appended: after the init segment (the boxes before the first
 * `moof`: `ftyp`, `moov`) the file is `moof`, `mdat`, `moof`, `mdat` ... and ends on a fragment
 * boundary. A top-level box that is neither is a fatal error of the writer (it never looks like a
 * clean stop), and what the muxer leaves after the last whole fragment at close is NOT written
 * (the pinned flags carry `skip_trailer`, so there is nothing; spec C.6).
 *
 * THE DROP-FRAGMENT RULE (spec C.5). A fragment is either wholly in the file or not at all:
 *   - a fragment the muxer never finished stays in memory and is lost with the process: the
 *     crash-loss window is the OPEN fragment = one camera GOP on stream copy (spec C.1, RPO);
 *   - A WRITE THAT FAILS OR COMES BACK SHORT (ENOSPC, EIO, a quota) TRUNCATES THE FILE BACK TO ITS
 *     LAST GOOD LENGTH (the end of the last whole fragment), syncs, and ends the writer with a
 *     fatal error. No torn fragment stays in the file by this process's doing. If the process dies
 *     between the short write and the truncation, the torn tail is found by the box walk of
 *     RECOVERY (declared box size against the bytes present) and dropped there.
 *
 * THE TWO CHAINS (spec C.3; S1 section 3.1), per fragment, per file:
 *   stored bytes   frag  = SHA-256(the fragment's stored bytes [start, start + len))
 *                  chain = SHA-256(chain of the fragment before (32 raw bytes) || frag (32 raw bytes)),
 *                          chain 0 = SHA-256("")
 *                  prefix = SHA-256(the file from byte 0 to the end of this fragment), so the
 *                          prefix of the last fragment is the hash of the whole file
 *   plaintext      plain and its chain, built the same way over the fragment BEFORE the cipher seam
 * Without a cipher (this row) stored bytes and plaintext are the same bytes and both chains carry
 * the same digests. All of it is re-derivable with dd / head / shasum / xxd alone.
 *
 * THE SYNC POLICY (spec C.2; decision D59-2). "Written" is not "durable": a write reaches the page
 * cache, survives the death of THIS process and is visible to other processes; it does not survive
 * an operating-system crash or a power loss. A fragment is DURABLE when a sync that started after
 * its write returned: fcntl(F_FULLFSYNC) where the platform has it (macOS: through the drive's own
 * cache), else fsync(). What is synced when:
 *   1. the file data, once per fragment (several fragments that were written while one sync ran
 *      are covered by the next one: never fewer syncs than one per batch, never a claim before it);
 *   2. for the FIRST fragment, in this order: data sync of the `.part` file, link() to the final
 *      name, sync of the DIRECTORY (the name itself is durable), unlink() of the temporary name;
 *   3. after a truncation, once more.
 * The syncs run on a thread of the file (never under the camera's mutex: the muxing and the audio
 * threads are not held up by the disk). THE DURABILITY POINT: the checkpoint of a fragment (and
 * FIRST_DURABLE_FRAGMENT) is handed on only after the sync that covers it returned; `durableAt` is
 * the wall clock taken then. A fragment that is in the file without a checkpoint was written and
 * not yet known durable; RECOVERY reads the file (the file is the truth, the frame is a hint).
 * A sync that fails ends the writer with a fatal error and no checkpoint is given for what it
 * should have covered.
 *
 * THE LEVEL IS STATED, NEVER ASSUMED (review R63-09; fix pass F-M3). A volume that does not know the
 * full sync answers ENOTSUP / EINVAL / ENOTTY and gets fsync() - on macOS NOT through the drive's
 * cache. Until this fix that fallback was silent: the log and the session said F_FULLFSYNC. Now the
 * level each sync ACHIEVED is kept: the first sync of the file (data, and the directory of the final
 * name: the weaker of the two) decides `sync_level`, which the first durable fragment states
 * (FIRST_DURABLE_FRAGMENT.syncLevel); a later sync of the same file that reaches only a WEAKER level
 * is a failed sync (WRITER_SYNC_LEVEL_CHANGED): no checkpoint, fatal - never a quieter durability.
 *
 * THE SIZE BOUND (review R63-02; ruling D179). No fragment above `max_fragment_bytes` is ever
 * written: the seal and the verifier open one fragment in memory and refuse a larger one, so such a
 * fragment would make the whole recording unsealable. The ingest closes the open fragment before
 * it can pass the bound (ingest.c, "write_bounded_locked"); THIS is the backstop that holds whatever
 * the estimate there did: a fragment above the bound is refused before any byte of it is written
 * (WRITER_FRAGMENT_TOO_LARGE, fatal), and the file keeps its durable prefix. PEND_LIMIT is the
 * compiled sanity cap of what the writer holds in memory, not the bound.
 */
#include "worker.h"

#include <libavutil/mem.h>
#include <libavutil/sha.h>

#include <dirent.h>
#include <errno.h>
#include <fcntl.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <time.h>
#include <unistd.h>

#define PEND_LIMIT ((size_t)MAX_FRAGMENT_BYTES_CEILING)

typedef struct SinkJob { struct SinkJob *next; Checkpoint cp; } SinkJob;

long (*sink_fault_hook)(Sink *s, int64_t fragment_no, size_t len) = NULL;
int (*sink_full_sync_hook)(int fd) = NULL;

void sink_init(Sink *s, const char *path) {
    memset(s, 0, sizeof *s);
    s->fd = -1;
    s->next_index = 1;
    snprintf(s->path, sizeof s->path, "%s", path);
}

int sink_path_occupied(const char *path) {
    struct stat st;
    return lstat(path, &st) == 0 || errno != ENOENT;
}

/* How many `<path>.<n>.part` files of earlier workers lie beside the output path. They are
 * reported and left alone: a temporary file of a dead attempt is never reused and never removed. */
int sink_stale_parts(const char *path) {
    char dir[PATH_CHARS + 1];
    snprintf(dir, sizeof dir, "%s", path);
    char *slash = strrchr(dir, '/');
    if (!slash) return 0;
    const char *base = path + (slash - dir) + 1;
    size_t n = strlen(base);
    if (slash == dir) slash[1] = 0; else *slash = 0;
    DIR *d = opendir(dir);
    if (!d) return 0;
    int found = 0;
    for (struct dirent *e; (e = readdir(d));) {
        size_t len = strlen(e->d_name);
        if (len > n + 6 && !strncmp(e->d_name, base, n) && e->d_name[n] == '.' && !strcmp(e->d_name + len - 5, ".part")) found++;
    }
    closedir(d);
    return found;
}

/* ---------------------------------------------------------------- hashes */
void sha256_hex(const uint8_t digest[SHA256_BYTES], char out[2 * SHA256_BYTES + 1]) {
    static const char hex[] = "0123456789abcdef";
    for (int i = 0; i < SHA256_BYTES; i++) { out[2 * i] = hex[digest[i] >> 4]; out[2 * i + 1] = hex[digest[i] & 15]; }
    out[2 * SHA256_BYTES] = 0;
}

static void sha_two(struct AVSHA *ctx, const uint8_t *a, size_t an, const uint8_t *b, size_t bn, uint8_t out[SHA256_BYTES]) {
    av_sha_init(ctx, 256);
    if (an) av_sha_update(ctx, a, an);
    if (bn) av_sha_update(ctx, b, bn);
    av_sha_final(ctx, out);
}

/* ---------------------------------------------------------------- boxes */
static uint32_t be32(const uint8_t *p) { return ((uint32_t)p[0] << 24) | ((uint32_t)p[1] << 16) | ((uint32_t)p[2] << 8) | p[3]; }
static uint64_t be64(const uint8_t *p) { return ((uint64_t)be32(p) << 32) | be32(p + 4); }

/* The box that starts at `off`. 1: its size and header length are known; 0: more bytes are needed
 * for the header; -1: no box (a size below its own header; 0 "to the end" never occurs in a
 * fragmented file). */
static int box_head(const uint8_t *b, size_t len, size_t off, uint64_t *size, size_t *header) {
    if (len - off < 8) return 0;
    *size = be32(b + off);
    *header = 8;
    if (*size == 1) {
        if (len - off < 16) return 0;
        *size = be64(b + off + 8);
        *header = 16;
    }
    return *size < *header ? -1 : 1;
}

typedef struct { const uint8_t *p; size_t n; } Span;

/* The next child box of `in`. 1: `type` and `body` are set and `in` moved past it; 0: the end; -1: a child that does not fit. */
static int next_child(Span *in, const uint8_t **type, Span *body) {
    uint64_t size;
    size_t header;
    if (in->n == 0) return 0;
    if (box_head(in->p, in->n, 0, &size, &header) != 1 || size > in->n) return -1;
    *type = in->p + 4;
    body->p = in->p + header;
    body->n = (size_t)size - header;
    in->p += size;
    in->n -= (size_t)size;
    return 1;
}

static int track_slot(const Sink *s, uint32_t id) {
    for (int i = 0; i < s->n_tracks; i++) if (s->track_id[i] == id) return i;
    return -1;
}

/* The init segment: per track its ID, its timescale, whether it is video, and the `trex` defaults. */
static int parse_moov(Sink *s, Span moov) {
    const uint8_t *type;
    Span body;
    int r;
    s->n_tracks = 0;
    Span pass = moov;
    while ((r = next_child(&pass, &type, &body)) == 1) {
        if (memcmp(type, "trak", 4)) continue;
        uint32_t id = 0, scale = 0;
        int video = 0;
        const uint8_t *t2;
        Span b2, trak = body;
        while ((r = next_child(&trak, &t2, &b2)) == 1) {
            if (!memcmp(t2, "tkhd", 4)) {
                size_t at = b2.n && b2.p[0] == 1 ? 20 : 12;
                if (b2.n < at + 4) return -1;
                id = be32(b2.p + at);
            } else if (!memcmp(t2, "mdia", 4)) {
                const uint8_t *t3;
                Span b3, mdia = b2;
                while ((r = next_child(&mdia, &t3, &b3)) == 1) {
                    if (!memcmp(t3, "mdhd", 4)) {
                        size_t at = b3.n && b3.p[0] == 1 ? 20 : 12;
                        if (b3.n < at + 4) return -1;
                        scale = be32(b3.p + at);
                    } else if (!memcmp(t3, "hdlr", 4)) {
                        if (b3.n < 12) return -1;
                        video = !memcmp(b3.p + 8, "vide", 4);
                    }
                }
                if (r < 0) return -1;
            }
        }
        if (r < 0 || !id || !scale || s->n_tracks == SINK_TRACKS) return -1;
        s->track_id[s->n_tracks] = id;
        s->timescale[s->n_tracks] = scale;
        s->is_video[s->n_tracks] = video;
        s->trex_flags[s->n_tracks] = s->trex_duration[s->n_tracks] = 0;
        s->n_tracks++;
    }
    if (r < 0 || !s->n_tracks) return -1;
    pass = moov;
    while ((r = next_child(&pass, &type, &body)) == 1) {
        if (memcmp(type, "mvex", 4)) continue;
        const uint8_t *t2;
        Span b2, mvex = body;
        while ((r = next_child(&mvex, &t2, &b2)) == 1) {
            if (memcmp(t2, "trex", 4)) continue;
            if (b2.n < 24) return -1;
            int at = track_slot(s, be32(b2.p + 4));
            if (at < 0) continue;
            s->trex_duration[at] = be32(b2.p + 12);
            s->trex_flags[at] = be32(b2.p + 20);
        }
        if (r < 0) return -1;
    }
    return r < 0 ? -1 : 0;
}

typedef struct { uint32_t seq; int64_t start_ms, duration_ms; int keyframe; } FragInfo;

/* One `moof`: its sequence number, the span of media time its tracks cover, and whether its video
 * starts on a sync sample. -1 when the box cannot be read (the writer then refuses the fragment). */
static int parse_moof(const Sink *s, Span moof, FragInfo *out) {
    const uint8_t *type;
    Span body;
    int r, have_seq = 0, tracks = 0, video = 0, sync = 0;
    int64_t lo = 0, hi = 0;
    while ((r = next_child(&moof, &type, &body)) == 1) {
        if (!memcmp(type, "mfhd", 4)) {
            if (body.n < 8) return -1;
            out->seq = be32(body.p + 4);
            have_seq = 1;
        } else if (!memcmp(type, "traf", 4)) {
            const uint8_t *t2;
            Span b2, traf = body;
            int slot = -1, have_dur = 0, have_flags = 0, first_known = 0;
            uint32_t def_dur = 0, def_flags = 0, first_flags = 0;
            uint64_t base = 0, total = 0, samples = 0;
            while ((r = next_child(&traf, &t2, &b2)) == 1) {
                if (!memcmp(t2, "tfhd", 4)) {
                    if (b2.n < 8) return -1;
                    uint32_t fl = be32(b2.p) & 0xFFFFFF;
                    size_t q = 8;
                    if ((slot = track_slot(s, be32(b2.p + 4))) < 0) return -1;
                    if (fl & 0x1) q += 8;
                    if (fl & 0x2) q += 4;
                    if (fl & 0x8) { if (b2.n < q + 4) return -1; def_dur = be32(b2.p + q); have_dur = 1; q += 4; }
                    if (fl & 0x10) q += 4;
                    if (fl & 0x20) { if (b2.n < q + 4) return -1; def_flags = be32(b2.p + q); have_flags = 1; }
                } else if (!memcmp(t2, "tfdt", 4)) {
                    if (b2.n < 8 || (b2.p[0] == 1 && b2.n < 12)) return -1;
                    base = b2.p[0] == 1 ? be64(b2.p + 4) : be32(b2.p + 4);
                } else if (!memcmp(t2, "trun", 4)) {
                    if (b2.n < 8 || slot < 0) return -1;
                    uint32_t fl = be32(b2.p) & 0xFFFFFF, n = be32(b2.p + 4), run_first = 0;
                    size_t q = 8, stride = 0;
                    int has_first = 0;
                    if (fl & 0x1) q += 4;
                    if (fl & 0x4) { if (b2.n < q + 4) return -1; run_first = be32(b2.p + q); has_first = 1; q += 4; }
                    for (uint32_t bit = 0x100; bit <= 0x800; bit <<= 1) if (fl & bit) stride += 4;
                    if ((uint64_t)n * stride > b2.n - (q > b2.n ? b2.n : q) || q > b2.n) return -1;
                    uint32_t dd = have_dur ? def_dur : s->trex_duration[slot], df = have_flags ? def_flags : s->trex_flags[slot];
                    for (uint32_t i = 0; i < n; i++) {
                        const uint8_t *e = b2.p + q + (size_t)i * stride;
                        size_t at = 0;
                        if (fl & 0x100) { total += be32(e); at += 4; } else total += dd;
                        if (fl & 0x200) at += 4;
                        if (i == 0 && !first_known) { first_flags = has_first ? run_first : (fl & 0x400) ? be32(e + at) : df; first_known = 1; }
                    }
                    samples += n;
                }
            }
            if (r < 0 || slot < 0) return -1;
            if (!samples) continue;
            int64_t a = (int64_t)(base * 1000000ULL / s->timescale[slot]), b = (int64_t)((base + total) * 1000000ULL / s->timescale[slot]);
            if (!tracks || a < lo) lo = a;
            if (!tracks || b > hi) hi = b;
            tracks++;
            if (s->is_video[slot]) { video = 1; sync = first_known && !(first_flags & 0x00010000); }
        }
    }
    if (r < 0 || !have_seq || !tracks) return -1;
    out->start_ms = lo / 1000;
    out->duration_ms = (hi - lo + 500) / 1000;
    if (out->duration_ms < 1) out->duration_ms = 1;
    out->keyframe = video && sync;
    return 0;
}

/* ---------------------------------------------------------------- the disk */
const char *sink_sync_wanted(void) {
#ifdef F_FULLFSYNC
    return "F_FULLFSYNC";
#else
    return "FSYNC";
#endif
}

const char *sink_sync_level(const Sink *s) {
#ifdef DEMS_PROOF_SILENT_SYNC_FALLBACK      /* PROOF / RED RUN ONLY: the level as it was claimed before fix pass F-M3 (what the build wants) */
    (void)s;
    return sink_sync_wanted();
#else
    int level = atomic_load(&s->sync_level);
    return level == SYNC_FULL ? "F_FULLFSYNC" : level == SYNC_FSYNC ? "FSYNC" : "NOT_YET";
#endif
}

/* The strongest sync the platform has. A file system that does not know F_FULLFSYNC gets fsync().
 * Returns the level it ACHIEVED (SYNC_FULL or SYNC_FSYNC), or an AVERROR: the caller states the level. */
static int full_sync(int fd) {
#ifdef F_FULLFSYNC
    int refused = sink_full_sync_hook ? sink_full_sync_hook(fd) : 0;
    if (refused) errno = refused;
    else if (fcntl(fd, F_FULLFSYNC) == 0) return SYNC_FULL;
    if (errno != ENOTSUP && errno != EINVAL && errno != ENOTTY) return AVERROR(errno);
#endif
    for (;;) {
        if (fsync(fd) == 0) return SYNC_FSYNC;
        if (errno != EINTR) return AVERROR(errno);
    }
}

/* The directory of the final name: after this the NAME is durable, not only the bytes. */
static int sync_dir(const char *path) {
    char dir[PATH_CHARS + 1];
    snprintf(dir, sizeof dir, "%s", path);
    char *slash = strrchr(dir, '/');
    if (!slash) return AVERROR(EINVAL);
    if (slash == dir) slash[1] = 0; else *slash = 0;
    int fd = open(dir, O_RDONLY | O_DIRECTORY | O_CLOEXEC);
    if (fd < 0) return AVERROR(errno);
    int r = full_sync(fd);                                  /* the level of the directory's sync, or an AVERROR */
    close(fd);
    return r;
}

static int64_t wall_ms(void) { struct timespec t; clock_gettime(CLOCK_REALTIME, &t); return (int64_t)t.tv_sec * 1000 + t.tv_nsec / 1000000; }

static int write_fd(int fd, const uint8_t *p, size_t n) {
    while (n) {
        ssize_t w = write(fd, p, n);
        if (w < 0) { if (errno == EINTR) continue; return AVERROR(errno); }
        p += w;
        n -= (size_t)w;
    }
    return 0;
}

/* One fragment (the first one together with the init segment) to the file. The test seam can
 * make it short: the bytes it allows are really written, then the write fails. */
static int write_out(Sink *s, int fd, const uint8_t *p, size_t n) {
    long allow = sink_fault_hook ? sink_fault_hook(s, atomic_load(&s->fragments) + 1, n) : -1;
    if (allow < 0) return write_fd(fd, p, n);
    int r = write_fd(fd, p, (size_t)allow < n ? (size_t)allow : n);
    return r < 0 ? r : AVERROR(ENOSPC);
}

/* A failed or short write: the file goes back to its last good length, and that is synced. */
static void truncate_back(Sink *s) {
#ifndef DEMS_PROOF_KEEP_TORN_TAIL      /* PROOF BUILD ONLY: the negative control (the torn tail stays; RECOVERY must flag it) */
    struct stat st;
    off_t good = (off_t)atomic_load(&s->bytes);
    /* Only what THIS write added is cut: the length never goes below the last good one, and a
     * file that is not longer than it is not touched. */
    if (fstat(s->fd, &st) == 0 && st.st_size > good && ftruncate(s->fd, good) == 0) (void)full_sync(s->fd);
#else
    (void)s;
#endif
}

static int fail(Sink *s, const char *code, int averror) {
    if (!s->failed) { s->failed = averror; s->fail_code = code; }
    return s->failed;
}

/* ---------------------------------------------------------------- the sync thread */
static void *sync_main(void *arg) {
    Sink *s = arg;
    for (;;) {
        pthread_mutex_lock(&s->sync_mx);
        while (!s->job_head && !s->sync_closing) pthread_cond_wait(&s->sync_cv, &s->sync_mx);
        SinkJob *batch = s->job_head;
        s->job_head = s->job_tail = NULL;
        pthread_mutex_unlock(&s->sync_mx);
        if (!batch) return NULL;                            /* closing, and nothing waits */
        int r = atomic_load(&s->async_failed), level = SYNC_NOT_YET;
        const char *code = NULL;
        /* 1. the data of every fragment of the batch (they were all written before this point) */
        if (!r) { if ((level = full_sync(s->fd)) < 0) { r = level; code = "WRITER_SYNC_FAILED"; } }
        if (!r && !s->linked) {
            /* 2. the final name, exclusive by construction; 3. the directory; 4. the temporary name goes */
            if (link(s->part, s->path) < 0) { r = AVERROR(errno); code = "OUTPUT_LINK_FAILED"; }   /* EEXIST: something is there; it is not touched */
            else {
                s->linked = 1;
                int dir = sync_dir(s->path);
                if (dir < 0) { r = dir; code = "WRITER_DIR_SYNC_FAILED"; }
                else if (dir > level) level = dir;          /* the name is only as durable as the weaker of the two */
            }
            unlink(s->part);
        }
#ifndef DEMS_PROOF_SILENT_SYNC_FALLBACK
        /* THE LEVEL (R63-09): the first sync of the file decides it; a later one that is weaker is a failed sync. */
        if (!r) {
            int was = atomic_load(&s->sync_level);
            if (was == SYNC_NOT_YET) atomic_store(&s->sync_level, level);
            else if (level > was) { r = AVERROR(EIO); code = "WRITER_SYNC_LEVEL_CHANGED"; }
        }
#endif
        if (r < 0) {
            int was = 0;
            if (atomic_compare_exchange_strong(&s->async_failed, &was, r) && s->on_sync_failure) s->on_sync_failure(s->opaque, code, r);
        }
        int64_t now = wall_ms();
        while (batch) {
            SinkJob *j = batch;
            batch = j->next;
            if (r >= 0) {
                j->cp.durable_at_ms = now;
                atomic_fetch_add(&s->durable_fragments, 1);
                if (s->on_durable) s->on_durable(s->opaque, &j->cp);
            }                                               /* else: written, never claimed durable */
            free(j);
        }
    }
}

static int enqueue(Sink *s, const Checkpoint *cp) {
    SinkJob *j = malloc(sizeof *j);
    if (!j) return AVERROR(ENOMEM);
    j->next = NULL;
    j->cp = *cp;
    if (!s->sync_started) {
        if (pthread_mutex_init(&s->sync_mx, NULL) || pthread_cond_init(&s->sync_cv, NULL)) { free(j); return AVERROR(EAGAIN); }
        s->job_head = s->job_tail = j;
        if (pthread_create(&s->sync_th, NULL, sync_main, s)) { s->job_head = s->job_tail = NULL; free(j); return AVERROR(EAGAIN); }
        s->sync_started = 1;
        return 0;
    }
    pthread_mutex_lock(&s->sync_mx);
    if (s->job_tail) s->job_tail->next = j; else s->job_head = j;
    s->job_tail = j;
    pthread_cond_signal(&s->sync_cv);
    pthread_mutex_unlock(&s->sync_mx);
    return 0;
}

/* ---------------------------------------------------------------- one fragment */
/* The whole fragment `frag` (moof of `moof_len` bytes with a header of `moof_header`, then mdat) is in memory. */
static int append_fragment(Sink *s, uint8_t *frag, size_t moof_len, size_t moof_header, size_t len) {
    int first = s->fd < 0, r;
    FragInfo info;
    Span moof = { frag + moof_header, moof_len - moof_header };
#ifndef DEMS_PROOF_NO_FRAGMENT_BOUND        /* PROOF BUILD ONLY: the negative control of the size bound (the rule off) */
    /* THE SIZE BOUND (R63-02): refused before a byte of it is written; the file keeps its durable prefix. */
    if (s->max_fragment_bytes && len > s->max_fragment_bytes) return fail(s, "WRITER_FRAGMENT_TOO_LARGE", AVERROR(EFBIG));
#endif
    if (parse_moof(s, moof, &info) < 0) return fail(s, "WRITER_MOOF_UNREADABLE", AVERROR_INVALIDDATA);
    /* The zero-gap rule: fragment numbers are 1, 2, 3 ... of this file. */
    if (info.seq != s->next_index) return fail(s, "WRITER_SEQUENCE_GAP", AVERROR_INVALIDDATA);
    if (!s->prefix_ctx) {
        static const uint8_t none = 0;
        s->prefix_ctx = av_sha_alloc();
        s->work_ctx = av_sha_alloc();
        if (!s->prefix_ctx || !s->work_ctx) return fail(s, "WRITER_NO_MEMORY", AVERROR(ENOMEM));
        av_sha_init(s->prefix_ctx, 256);
        sha_two(s->work_ctx, &none, 0, NULL, 0, s->chain);              /* chain 0 = SHA-256("") */
        memcpy(s->plain_chain, s->chain, SHA256_BYTES);
    }

    Checkpoint cp;
    memset(&cp, 0, sizeof cp);
    cp.index = info.seq;
    cp.first = first;
    cp.start = atomic_load(&s->bytes) + (first ? (int64_t)s->init_len : 0);
    cp.len = (int64_t)len;
    cp.media_start_ms = info.start_ms;
    cp.media_duration_ms = info.duration_ms;
    cp.keyframe = info.keyframe;
    /* plaintext chain, then the cipher seam, then the stored-bytes chain */
    sha_two(s->work_ctx, frag, len, NULL, 0, cp.plain);
    sha_two(s->work_ctx, s->plain_chain, SHA256_BYTES, cp.plain, SHA256_BYTES, cp.plain_chain);
    if (s->cipher) {
        if ((r = s->cipher->seal(s->cipher->ctx, cp.index, cp.start, frag, len, cp.iv, cp.tag)) < 0) return fail(s, "WRITER_CIPHER_FAILED", r);
        cp.sealed = 1;
        sha_two(s->work_ctx, frag, len, NULL, 0, cp.frag);
    } else memcpy(cp.frag, cp.plain, SHA256_BYTES);                     /* the same bytes: the same digest */
    sha_two(s->work_ctx, s->chain, SHA256_BYTES, cp.frag, SHA256_BYTES, cp.chain);
    if (first) av_sha_update(s->prefix_ctx, s->pend, s->init_len);
    av_sha_update(s->prefix_ctx, frag, len);
    memcpy(s->work_ctx, s->prefix_ctx, (size_t)av_sha_size);            /* the running state is kept; a copy is finished */
    av_sha_final(s->work_ctx, cp.prefix);

    if (first) {
        /* A name that is taken is refused before anything is created (the link below is the guarantee; this is the early answer). */
        if (sink_path_occupied(s->path)) return fail(s, "OUTPUT_EXISTS", AVERROR(EEXIST));
        if (snprintf(s->part, sizeof s->part, "%s.%d.part", s->path, (int)getpid()) >= (int)sizeof s->part) return fail(s, "OUTPUT_NAME_TOO_LONG", AVERROR(ENAMETOOLONG));
        int fd = open(s->part, O_WRONLY | O_CREAT | O_EXCL | O_APPEND | O_CLOEXEC, 0600);
        if (fd < 0) return fail(s, "OUTPUT_CREATE_FAILED", AVERROR(errno));
        /* The init segment and the first fragment lie one after the other in memory: one write. */
        if ((r = write_out(s, fd, s->pend, s->init_len + len)) < 0) {
            close(fd);
            unlink(s->part);                                            /* this worker's own temporary file: no name of evidence ever pointed at it */
            return fail(s, "WRITER_WRITE_FAILED", r);
        }
        s->fd = fd;
        atomic_fetch_add(&s->bytes, (int64_t)(s->init_len + len));
    } else {
        if ((r = write_out(s, s->fd, frag, len)) < 0) {
            truncate_back(s);
            return fail(s, "WRITER_WRITE_FAILED", r);
        }
        atomic_fetch_add(&s->bytes, (int64_t)len);
    }
    memcpy(s->chain, cp.chain, SHA256_BYTES);
    memcpy(s->plain_chain, cp.plain_chain, SHA256_BYTES);
    s->next_index++;
    atomic_fetch_add(&s->fragments, 1);
    atomic_store(&s->last_fragment_mono_us, mono_us());
    if ((r = enqueue(s, &cp)) < 0) return fail(s, "WRITER_SYNC_THREAD_FAILED", r);
    return 0;
}

/* Finds the init segment at the head of the pending bytes: every box before the first `moof`.
 * 1: known; 0: more bytes are needed; <0: an AVERROR. */
static int find_init(Sink *s) {
    size_t off = 0, header;
    uint64_t size;
    int ftyp = 0, moov = 0, k;
    for (;;) {
        if ((k = box_head(s->pend, s->pend_len, off, &size, &header)) == 0) return 0;
        if (k < 0) return fail(s, "WRITER_BOX_INVALID", AVERROR_INVALIDDATA);
        const uint8_t *type = s->pend + off + 4;
        if (!memcmp(type, "moof", 4)) break;
        if (!memcmp(type, "mdat", 4)) return fail(s, "WRITER_UNEXPECTED_BOX", AVERROR_INVALIDDATA);
        if (size > s->pend_len - off) return 0;
        if (!memcmp(type, "ftyp", 4)) ftyp = 1;
        if (!memcmp(type, "moov", 4)) {
            Span body = { s->pend + off + header, (size_t)size - header };
            if (parse_moov(s, body) < 0) return fail(s, "WRITER_MOOV_UNREADABLE", AVERROR_INVALIDDATA);
            moov = 1;
        }
        off += (size_t)size;
    }
    if (!ftyp || !moov) return fail(s, "WRITER_INIT_INCOMPLETE", AVERROR_INVALIDDATA);
    s->init_len = off;
    return 1;
}

static int sink_flush_fragments(Sink *s) {
    for (;;) {
        int k;
        if (!s->init_len && (k = find_init(s)) <= 0) return k;
        size_t at = s->fd < 0 ? s->init_len : 0, moof_header, mdat_header;
        uint64_t moof_size, mdat_size;
        if ((k = box_head(s->pend, s->pend_len, at, &moof_size, &moof_header)) == 0) return 0;
        if (k < 0) return fail(s, "WRITER_BOX_INVALID", AVERROR_INVALIDDATA);
        /* After the init segment the file is moof, mdat, moof, mdat ... and nothing else. */
        if (memcmp(s->pend + at + 4, "moof", 4)) return fail(s, "WRITER_UNEXPECTED_BOX", AVERROR_INVALIDDATA);
        if (moof_size > s->pend_len - at) return 0;
        if ((k = box_head(s->pend, s->pend_len, at + (size_t)moof_size, &mdat_size, &mdat_header)) == 0) return 0;
        if (k < 0) return fail(s, "WRITER_BOX_INVALID", AVERROR_INVALIDDATA);
        if (memcmp(s->pend + at + (size_t)moof_size + 4, "mdat", 4)) return fail(s, "WRITER_UNEXPECTED_BOX", AVERROR_INVALIDDATA);
        if (mdat_size > s->pend_len - at - (size_t)moof_size) return 0;
        size_t len = (size_t)moof_size + (size_t)mdat_size;
        int r = append_fragment(s, s->pend + at, (size_t)moof_size, moof_header, len);
        if (r < 0) return r;
        memmove(s->pend, s->pend + at + len, s->pend_len - at - len);
        s->pend_len -= at + len;
    }
}

int sink_write(void *opaque, const uint8_t *buf, int size) {
    Sink *s = opaque;
    if (s->failed) return s->failed;
    int async = atomic_load(&s->async_failed);
    if (async) return fail(s, "WRITER_SYNC_FAILED", async);
    if (size <= 0) return 0;
    if (s->pend_len + (size_t)size > s->pend_cap) {
        size_t cap = s->pend_cap ? s->pend_cap : 256 * 1024;
        while (cap < s->pend_len + (size_t)size) cap *= 2;
        uint8_t *grown = cap > PEND_LIMIT ? NULL : realloc(s->pend, cap);
        if (!grown) return fail(s, "WRITER_NO_MEMORY", AVERROR(ENOMEM));
        s->pend = grown;
        s->pend_cap = cap;
    }
    memcpy(s->pend + s->pend_len, buf, (size_t)size);
    s->pend_len += (size_t)size;
    int r = sink_flush_fragments(s);
    if (r < 0) return r;
    return size;
}

int sink_close(Sink *s) {
    /* What the muxer left after the last whole fragment is not a fragment: it is never written.
     * (With no file at all it is the init segment of a camera that never completed a fragment.) */
    s->dropped_tail_bytes = s->fd >= 0 ? (int64_t)s->pend_len : 0;
    if (s->sync_started) {
        /* Everything that was written is synced, named and reported before the file is closed. */
        pthread_mutex_lock(&s->sync_mx);
        s->sync_closing = 1;
        pthread_cond_signal(&s->sync_cv);
        pthread_mutex_unlock(&s->sync_mx);
        pthread_join(s->sync_th, NULL);
        pthread_mutex_destroy(&s->sync_mx);
        pthread_cond_destroy(&s->sync_cv);
        s->sync_started = 0;
    }
    int r = s->failed ? s->failed : atomic_load(&s->async_failed);
    if (s->fd >= 0) {
        if (close(s->fd) < 0 && !r) r = AVERROR(errno);
        s->fd = -1;
    }
    /* No fragment was ever complete: no file was created, and none is created now. */
    free(s->pend);
    s->pend = NULL;
    s->pend_len = s->pend_cap = 0;
    av_freep(&s->prefix_ctx);
    av_freep(&s->work_ctx);
    return r;
}
