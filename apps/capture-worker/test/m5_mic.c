/*
 * Scripted fake microphones for the warning checks of blueprint row 71 (worker half; capture spec
 * E.1; check `m5warn` of test/m5mic.py). TEST FIXTURE ONLY. A separate process with its own clock
 * reads, like the NM-14 fake microphones (test-fixtures/fake_mic.c), from which it differs in one
 * thing: each microphone follows a SCRIPT of segments, so that a microphone can deliver silence
 * (samples, all zero or very quiet) or deliver nothing at all for a stated time.
 * It opens no socket: its only outputs are the two named pipes and the manifest it is given.
 *
 *   m5_mic --out1 <fifo> --out2 <fifo> [--out3 <fifo> --out4 <fifo>] --manifest <file.jsonl> --plan1 <script> --plan2 <script>
 *   D61 (2026-11-04): a FOUR-channel plan needs all four pipes fed - channels 3 and 4 join with a steady
 *   tone (script "tone:1") unless --plan3/--plan4 say otherwise, so the lane checks see no extra disconnect.
 *
 * A script is a comma-separated list of `kind:seconds`; the last segment lasts until the reader
 * closes the pipe or --seconds passed (default 120):
 *   tone   a sine at 0.1 (-23 dBFS): 440 Hz on microphone 1, 880 Hz on microphone 2
 *   zero   samples are delivered and all are 0 (digital silence)
 *   quiet  samples are delivered at -60 dBFS (a sine at 0.0014)
 *   none   nothing is delivered (the device is away; its clock goes on)
 * Raw PCM, 32-bit float, little-endian, 48 kHz, mono; one 10 ms chunk every 10 ms on this
 * process's own monotonic clock. The manifest states e0 (the wall clock of sample 0) and every
 * segment with its first sample: the truth the check compares the worker's warnings against.
 */
#include <errno.h>
#include <fcntl.h>
#include <math.h>
#include <signal.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>

#define SR 48000
#define CHUNK 480
#define US 1000000LL
#define MAX_SEG 32

typedef struct { char kind; int64_t from, to; } Seg;       /* kind: t z q n; samples [from, to) */
typedef struct { Seg seg[MAX_SEG]; int n; } Plan;

static int64_t now_us(clockid_t c) { struct timespec t; clock_gettime(c, &t); return t.tv_sec * US + t.tv_nsec / 1000; }

static int parse(const char *text, Plan *p) {
    int64_t at = 0;
    p->n = 0;
    for (const char *s = text; *s && p->n < MAX_SEG;) {
        const char *colon = strchr(s, ':');
        if (!colon) return -1;
        size_t len = (size_t)(colon - s);
        char kind = len == 4 && !strncmp(s, "tone", 4) ? 't' : len == 4 && !strncmp(s, "zero", 4) ? 'z' : len == 5 && !strncmp(s, "quiet", 5) ? 'q' : len == 4 && !strncmp(s, "none", 4) ? 'n' : 0;
        char *end;
        double seconds = strtod(colon + 1, &end);
        if (!kind || end == colon + 1 || seconds <= 0) return -1;
        int64_t samples = (int64_t)llround(seconds * SR / CHUNK) * CHUNK;      /* whole chunks */
        p->seg[p->n++] = (Seg){ kind, at, at + samples };
        at += samples;
        s = *end == ',' ? end + 1 : end;
        if (*end && *end != ',') return -1;
    }
    return p->n ? 0 : -1;
}

static char kind_at(const Plan *p, int64_t sample) {
    for (int i = 0; i < p->n; i++) if (sample < p->seg[i].to) return p->seg[i].kind;
    return p->seg[p->n - 1].kind;
}

static int write_all(int fd, const void *buf, size_t n) {
    const char *p = buf;
    while (n) {
        ssize_t w = write(fd, p, n);
        if (w < 0) { if (errno == EINTR) continue; return -1; }
        p += w;
        n -= (size_t)w;
    }
    return 0;
}

int main(int argc, char **argv) {
    const char *out[4] = { NULL, NULL, NULL, NULL }, *manifest_path = NULL, *script[4] = { "tone:1", "tone:1", "tone:1", "tone:1" };   /* D61: four channels */
    double seconds = 120;
    for (int i = 1; i + 1 < argc; i += 2) {
        const char *k = argv[i], *v = argv[i + 1];
        if (!strcmp(k, "--out1")) out[0] = v;
        else if (!strcmp(k, "--out2")) out[1] = v;
        else if (!strcmp(k, "--out3")) out[2] = v;                                          /* D61 (2026-11-04) */
        else if (!strcmp(k, "--out4")) out[3] = v;
        else if (!strcmp(k, "--manifest")) manifest_path = v;
        else if (!strcmp(k, "--plan1")) script[0] = v;
        else if (!strcmp(k, "--plan2")) script[1] = v;
        else if (!strcmp(k, "--plan3")) script[2] = v;                                      /* D61 */
        else if (!strcmp(k, "--plan4")) script[3] = v;
        else if (!strcmp(k, "--seconds")) seconds = atof(v);
        else { fprintf(stderr, "M5_MIC unknown argument %s\n", k); return 2; }
    }
    Plan plan[4];
    if (!out[0] || !out[1] || !manifest_path || seconds <= 0 || parse(script[0], &plan[0]) || parse(script[1], &plan[1])
        || parse(script[2], &plan[2]) || parse(script[3], &plan[3])) {                     /* D61: channels 3 and 4 default to the tone */
        fprintf(stderr, "usage: m5_mic --out1 <fifo> --out2 <fifo> [--out3 <fifo>] [--out4 <fifo>] --manifest <file.jsonl> --plan1 kind:s,... --plan2 kind:s,... [--plan3 kind:s,...] [--plan4 kind:s,...] [--seconds S]   (kinds: tone zero quiet none)\n");
        return 2;
    }
    signal(SIGPIPE, SIG_IGN);
    FILE *mf = fopen(manifest_path, "w");
    if (!mf) { fprintf(stderr, "M5_MIC cannot write the manifest\n"); return 1; }
    int fd[4] = { -1, -1, -1, -1 };
    for (int m = 0; m < 4; m++) {
        if (!out[m]) continue;                              /* D61: 3 and 4 optional for old callers */
        fd[m] = open(out[m], O_WRONLY);                     /* waits until the worker reads the pipe */
        if (fd[m] < 0) { fprintf(stderr, "M5_MIC cannot open pipe %d: %s\n", m + 1, strerror(errno)); return 1; }
    }
    int64_t e0_real = now_us(CLOCK_REALTIME), e0_mono = now_us(CLOCK_MONOTONIC);
    fprintf(mf, "{\"type\":\"mic\",\"pid\":%d,\"e0_real_us\":%lld,\"sr\":%d,\"chunk\":%d}\n", (int)getpid(), (long long)e0_real, SR, CHUNK);
    for (int m = 0; m < 4; m++)
        for (int i = 0; i < plan[m].n; i++)
            fprintf(mf, "{\"type\":\"segment\",\"mic\":%d,\"kind\":\"%s\",\"from_sample\":%lld,\"to_sample\":%lld}\n", m + 1,
                    plan[m].seg[i].kind == 't' ? "tone" : plan[m].seg[i].kind == 'z' ? "zero" : plan[m].seg[i].kind == 'q' ? "quiet" : "none",
                    (long long)plan[m].seg[i].from, (long long)(i + 1 == plan[m].n ? -1 : plan[m].seg[i].to));
    fflush(mf);

    int64_t total = (int64_t)(seconds * SR), n = 0, written[4] = { 0, 0, 0, 0 };   /* D61 */
    int alive = 1;
    float buf[CHUNK];
    while (n < total && alive) {
        int64_t due = e0_mono + (n + CHUNK) * US / SR, wait = due - now_us(CLOCK_MONOTONIC);
        if (wait > 1500) { struct timespec ts = { (wait - 1500) / US, ((wait - 1500) % US) * 1000 }; nanosleep(&ts, NULL); }
        while (now_us(CLOCK_MONOTONIC) < due) { }
        for (int m = 0; m < 4 && alive; m++) {                                        /* D61: four channels */
            if (fd[m] < 0) continue;
            char kind = kind_at(&plan[m], n);
            if (kind == 'n') continue;
            double amp = kind == 't' ? 0.1 : kind == 'q' ? 0.0014142 : 0.0, hz = m == 1 ? 880.0 : m == 2 ? 660.0 : m == 3 ? 220.0 : 440.0;
            for (int i = 0; i < CHUNK; i++) buf[i] = (float)(amp * sin(2 * M_PI * hz * (double)(n + i) / SR));
            if (write_all(fd[m], buf, sizeof buf) < 0) alive = 0; else written[m] += CHUNK;
        }
        n += CHUNK;
    }
    fprintf(mf, "{\"type\":\"end\",\"samples\":%lld,\"written1\":%lld,\"written2\":%lld,\"written3\":%lld,\"written4\":%lld,\"reader_gone\":%s}\n", (long long)n, (long long)written[0], (long long)written[1], (long long)written[2], (long long)written[3], alive ? "false" : "true");   /* D61: the two lane keys unchanged, two added */
    fclose(mf);
    for (int m = 0; m < 4; m++) if (fd[m] >= 0) close(fd[m]);
    return 0;
}
