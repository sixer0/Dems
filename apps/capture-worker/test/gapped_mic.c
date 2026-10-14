/*
 * THE STAND-IN of a gapped microphone writer (task 4 row N3; design 06 sections 7.2, 9.2; protocol version 5).
 * A test tool of test/n3gapped.py, never a product program: it opens no socket and no device; its only outputs
 * are the named pipes and the manifest it is given.
 *
 * It writes what the macOS bench path delivers, in a pattern KNOWN TO THE SAMPLE: a device produces packets of
 * 512 samples (32-bit float, little-endian, mono, 48,000 Hz) on this process's own clock - packet k holds device
 * samples 512k .. 512k + 511 and is written at e0 + (k + 1) * 512 / 48000 s, when its last sample was "captured" -
 * and whole packets are LEFT OUT by a rule of the arguments (row MM3 measured about one packet in ten missing,
 * test/mm3_macos_microphone_loss.md; the helper never says so). A packet left out is lost: it is never written later.
 *
 * THE MARKER. Device sample j of output 1 is ((j % 30000) + 1) / 32767 and of output 2 its negative: never zero, so
 * every zero in the worker's PCM tap is a zero the worker made, and every other value names its device sample
 * (the tap is s16 at x * 32767, which these values reach exactly).
 *
 *   --out1 F [--out2 F] --manifest M --seconds S   the pipes, the manifest, and how long it writes (then it ends)
 *   --skip-every K      leave out packet k when k % K == K - 1 (K = 10: the measured pattern); 0: a whole pipe
 *   --start1-after S / --start2-after S   that output writes nothing before second S (a writer that starts late)
 *   --stop-at S --resume-at S             no output writes between these seconds (a writer that stops)
 *   --cycles N --cycle-from S --on-ms A --off-ms B   N stops: from second S, A ms written then B ms left out, N times
 *   --nan-at J          device sample J of output 1 is NaN (a sample that is not a number)
 *
 * The manifest (JSON lines): the start (e0 on the wall clock, the pattern), and at the end the samples written per
 * output and the written spans of output 1 as [first device sample, count] - the truth an analyser compares with.
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
#define PACKET 512
#define US 1000000LL
#define MAX_SPANS 200000

static int64_t now_us(clockid_t c) { struct timespec t; clock_gettime(c, &t); return t.tv_sec * US + t.tv_nsec / 1000; }

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

static int64_t spans[MAX_SPANS][2];
static int n_spans;

int main(int argc, char **argv) {
    const char *out[2] = { NULL, NULL }, *manifest_path = NULL;
    double seconds = 10, start_after[2] = { 0, 0 }, stop_at = -1, resume_at = -1, cycle_from = -1, on_ms = 0, off_ms = 0;
    long long skip_every = 0, cycles = 0, nan_at = -1;
    for (int i = 1; i + 1 < argc; i += 2) {
        const char *k = argv[i], *v = argv[i + 1];
        if (!strcmp(k, "--out1")) out[0] = v;
        else if (!strcmp(k, "--out2")) out[1] = v;
        else if (!strcmp(k, "--manifest")) manifest_path = v;
        else if (!strcmp(k, "--seconds")) seconds = atof(v);
        else if (!strcmp(k, "--skip-every")) skip_every = atoll(v);
        else if (!strcmp(k, "--start1-after")) start_after[0] = atof(v);
        else if (!strcmp(k, "--start2-after")) start_after[1] = atof(v);
        else if (!strcmp(k, "--stop-at")) stop_at = atof(v);
        else if (!strcmp(k, "--resume-at")) resume_at = atof(v);
        else if (!strcmp(k, "--cycles")) cycles = atoll(v);
        else if (!strcmp(k, "--cycle-from")) cycle_from = atof(v);
        else if (!strcmp(k, "--on-ms")) on_ms = atof(v);
        else if (!strcmp(k, "--off-ms")) off_ms = atof(v);
        else if (!strcmp(k, "--nan-at")) nan_at = atoll(v);
        else { fprintf(stderr, "GAPPED_MIC unknown argument %s\n", k); return 2; }
    }
    if (!out[0] || !manifest_path || seconds <= 0 || skip_every < 0 || skip_every == 1) {
        fprintf(stderr, "usage: gapped_mic --out1 <fifo> [--out2 <fifo>] --manifest <file.jsonl> [--seconds S] [--skip-every K] [--start1-after S] [--start2-after S] [--stop-at S --resume-at S] [--cycles N --cycle-from S --on-ms A --off-ms B] [--nan-at J]\n");
        return 2;
    }
    signal(SIGPIPE, SIG_IGN);
    FILE *mf = fopen(manifest_path, "w");
    if (!mf) return 3;
    int fd[2] = { -1, -1 };
    for (int o = 0; o < 2; o++)
        if (out[o] && (fd[o] = open(out[o], O_WRONLY)) < 0) { fprintf(stderr, "GAPPED_MIC open %s: %s\n", out[o], strerror(errno)); return 4; }
    int64_t e0_mono = now_us(CLOCK_MONOTONIC), e0_real = now_us(CLOCK_REALTIME);
    fprintf(mf, "{\"type\":\"mic\",\"pid\":%d,\"e0_real_us\":%lld,\"sr\":%d,\"packet\":%d,\"skip_every\":%lld,\"start_after\":[%.3f,%.3f],\"stop_at\":%.3f,\"resume_at\":%.3f,\"cycles\":%lld,\"cycle_from\":%.3f,\"on_ms\":%.1f,\"off_ms\":%.1f,\"nan_at\":%lld}\n",
            (int)getpid(), (long long)e0_real, SR, PACKET, skip_every, start_after[0], start_after[1], stop_at, resume_at, cycles, cycle_from, on_ms, off_ms, nan_at);
    fflush(mf);
    int64_t written[2] = { 0, 0 }, packets = (int64_t)(seconds * SR / PACKET), left_out = 0;
    float buf[PACKET];
    for (int64_t k = 0; k < packets; k++) {
        int64_t due = e0_mono + (k + 1) * PACKET * US / SR;
        for (int64_t t; (t = now_us(CLOCK_MONOTONIC)) < due;) {
            struct timespec ts = { (time_t)((due - t) / US), (long)((due - t) % US) * 1000 };
            nanosleep(&ts, NULL);
        }
        double at = (double)k * PACKET / SR;                                   /* the packet's first sample, in seconds */
        int gone = skip_every > 1 && k % skip_every == skip_every - 1;
        if (stop_at >= 0 && at >= stop_at && (resume_at < 0 || at < resume_at)) gone = 1;
        if (cycles > 0 && cycle_from >= 0 && at >= cycle_from) {
            double in = (at - cycle_from) * 1000.0, period = on_ms + off_ms;
            if (in < cycles * period && fmod(in, period) >= on_ms) gone = 1;
        }
        if (gone) { left_out++; continue; }
        for (int o = 0; o < 2; o++) {
            if (fd[o] < 0 || at < start_after[o]) continue;
            for (int i = 0; i < PACKET; i++) {
                int64_t j = k * PACKET + i;
                float v = (float)((j % 30000) + 1) / 32767.0f;
                buf[i] = o == 0 ? (j == nan_at ? NAN : v) : -v;
            }
            if (write_all(fd[o], buf, sizeof buf) < 0) { fprintf(stderr, "GAPPED_MIC write: %s\n", strerror(errno)); goto done; }
            written[o] += PACKET;
            if (o == 0) {
                if (n_spans && spans[n_spans - 1][0] + spans[n_spans - 1][1] == k * PACKET) spans[n_spans - 1][1] += PACKET;
                else if (n_spans < MAX_SPANS) { spans[n_spans][0] = k * PACKET; spans[n_spans][1] = PACKET; n_spans++; }
            }
        }
    }
done:
    for (int o = 0; o < 2; o++) if (fd[o] >= 0) close(fd[o]);
    fprintf(mf, "{\"type\":\"end\",\"written\":[%lld,%lld],\"packets\":%lld,\"left_out\":%lld,\"spans1\":[", (long long)written[0], (long long)written[1], (long long)packets, (long long)left_out);
    for (int s = 0; s < n_spans; s++) fprintf(mf, "%s[%lld,%lld]", s ? "," : "", (long long)spans[s][0], (long long)spans[s][1]);
    fprintf(mf, "]}\n");
    fclose(mf);
    return 0;
}
