/*
 * The camera file under kill -9 (blueprint row 58, fix round 1, navigator finding F-3; decisions
 * D58-1, D58-2 as amended by D72). `make -C apps/capture-worker unit` runs it: `sink_kill_test
 * <scratch dir> <kills>`.
 *
 * Each round a child writes an init segment and three fragments of about 1 MB through sink.c, as
 * the muxer does (in pieces), and the parent kills it with SIGKILL after a delay that sweeps the
 * whole life of the child, so that kills land before the create, inside the first write, between
 * the write and the link, and in later fragments. After every kill:
 *   - EITHER no file is at the final name,
 *   - OR the file there starts with `ftyp`, `moov`, a whole `moof` and a whole `mdat`
 *     (at least init + one complete fragment): never empty, never a torn first fragment.
 * A `.part` file may be left by a kill; it is never the final name. The round is then repeated
 * over the left-overs: the next "worker" must refuse a final name that exists (bytes untouched)
 * and must not reuse a `.part`.
 * The test also demands that it saw BOTH outcomes (so that the kills did land around the create).
 */
#include "../src/worker.h"

#include <errno.h>
#include <fcntl.h>
#include <signal.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <sys/wait.h>
#include <unistd.h>

Session S;                                  /* sink.c logs nothing, but worker.h declares these */
int64_t mono_us(void) { struct timespec t; clock_gettime(CLOCK_MONOTONIC, &t); return t.tv_sec * US + t.tv_nsec / 1000; }

#define FRAG (1024 * 1024)
static void put32(uint8_t *p, uint32_t v) { p[0] = v >> 24; p[1] = v >> 16; p[2] = v >> 8; p[3] = v; }
static size_t box(uint8_t *p, const char *type, size_t size) { put32(p, (uint32_t)size); memcpy(p + 4, type, 4); memset(p + 8, type[1], size - 8); return size; }

static void child(const char *path) {
    static uint8_t buf[4 * FRAG];
    Sink s;
    sink_init(&s, path);
    size_t n = box(buf, "ftyp", 28);
    n += box(buf + n, "moov", 1203);
    for (int f = 0; f < 3; f++) { n += box(buf + n, "moof", 900); n += box(buf + n, "mdat", FRAG); }
    for (size_t off = 0; off < n; off += 65536) {                 /* the muxer's buffer size */
        int chunk = (int)(n - off < 65536 ? n - off : 65536);
        if (sink_write(&s, buf + off, chunk) < 0) _exit(3);
    }
    _exit(sink_close(&s) < 0 ? 4 : 0);
}

/* 0 = no file; 1 = whole init + first fragment (and whole boxes or a torn LATER box after it); -1 = violation. */
static int judge(const char *path, long long *size) {
    struct stat st;
    if (lstat(path, &st) < 0) return errno == ENOENT ? 0 : -1;
    *size = st.st_size;
    if (st.st_size < 28 + 1203 + 900 + FRAG) return -1;
    uint8_t head[8];
    int fd = open(path, O_RDONLY);
    static const struct { const char *type; long long size; } want[4] = { { "ftyp", 28 }, { "moov", 1203 }, { "moof", 900 }, { "mdat", FRAG } };
    long long off = 0;
    int ok = fd >= 0;
    for (int i = 0; ok && i < 4; i++) {
        ok = pread(fd, head, 8, off) == 8 && !memcmp(head + 4, want[i].type, 4) && (((long long)head[0] << 24) | (head[1] << 16) | (head[2] << 8) | head[3]) == want[i].size;
        off += want[i].size;
    }
    if (fd >= 0) close(fd);
    return ok ? 1 : -1;
}

int main(int argc, char **argv) {
    if (argc != 3) { fprintf(stderr, "usage: sink_kill_test <scratch dir> <kills>\n"); return 2; }
    int rounds = atoi(argv[2]), absent = 0, present = 0, bad = 0, parts = 0, refused = 0, completed = 0;
    char cmd[1200], path[1024];
    snprintf(cmd, sizeof cmd, "rm -rf '%s' && mkdir -p '%s'", argv[1], argv[1]);
    if (system(cmd)) return 2;
    int64_t t0 = mono_us();
    /* How long an unkilled child lives, to sweep the kill over its whole life. */
    snprintf(path, sizeof path, "%s/probe.mp4", argv[1]);
    int64_t a = mono_us();
    pid_t p = fork();
    if (!p) child(path);
    int st;
    waitpid(p, &st, 0);
    int64_t life = mono_us() - a;
    long long size = 0;
    if (!WIFEXITED(st) || WEXITSTATUS(st) || judge(path, &size) != 1 || size != 28 + 1203 + 3 * (900 + FRAG)) { printf("sink_kill_test: the unkilled child did not write the whole file (size %lld)\n", size); return 1; }
    for (int r = 0; r < rounds; r++) {
        snprintf(path, sizeof path, "%s/r%03d.mp4", argv[1], r);
        p = fork();
        if (!p) child(path);
        int64_t delay = life * (r % 100) / 60;                     /* 0 .. 1.65 lives: some children finish */
        if (delay > 0) usleep((useconds_t)delay);
        kill(p, SIGKILL);
        waitpid(p, &st, 0);
        completed += WIFEXITED(st);
        int v = judge(path, &size);
        if (v == 0) absent++; else if (v == 1) present++; else { bad++; printf("VIOLATION round %d: a file of %lld bytes at the final name without init + one whole fragment\n", r, size); }
        /* The next worker on the same left-overs: an existing final name is refused and untouched; a .part is not reused. */
        long long before = size;
        pid_t q = fork();
        if (!q) child(path);
        waitpid(q, &st, 0);
        int again = judge(path, &size);
        if (v == 1) { if (WIFEXITED(st) && WEXITSTATUS(st) == 3 && again == 1 && size == before) refused++; else { bad++; printf("VIOLATION round %d: the next worker did not refuse an existing file (exit %d, size %lld -> %lld)\n", r, WEXITSTATUS(st), before, size); } }
        else if (again != 1) { bad++; printf("VIOLATION round %d: the next worker could not record beside a left-over\n", r); }
    }
    snprintf(cmd, sizeof cmd, "ls '%s' | grep -c '\\.part$' > '%s/parts.txt'", argv[1], argv[1]);
    if (system(cmd) >= 0) { snprintf(path, sizeof path, "%s/parts.txt", argv[1]); FILE *f = fopen(path, "r"); if (f) { if (fscanf(f, "%d", &parts) != 1) parts = -1; fclose(f); } }
    double took = (double)(mono_us() - t0) / 1e6;
    printf("sink_kill_test: %d kills in %.1f s: final name absent %d, present with init + whole first fragment %d (of those refused untouched by the next worker %d), children that finished before the kill %d, .part files left %d, violations %d\n",
           rounds, took, absent, present, refused, completed, parts, bad);
    snprintf(cmd, sizeof cmd, "rm -rf '%s'", argv[1]);
    if (system(cmd)) return 2;
    if (!absent || !present) { printf("sink_kill_test: only one outcome was seen: the kills did not land around the create\n"); return 1; }
    return bad ? 1 : 0;
}
