/*
 * Replays the bytes of a recorded camera file through the fMP4 writer (src/sink.c) and prints the
 * checkpoints the writer gives, one JSON object per line (blueprint row 59; the S1 chain-equality
 * pattern). TEST TOOL of the capture e2e harness: `writer_replay <recorded.mp4> <out.mp4>`.
 *
 * WHAT IT SHOWS. The chains cover the STORED BYTES and nothing else - no clock, no process ID, no
 * arrival time. So the same bytes through the writer a second time give the same checkpoints as
 * the worker's own records of the live run (everything but `durableAt`, the wall clock of the
 * sync), and the new file is byte-identical to the recorded one. Two LIVE runs of the same
 * fixture do not give the same bytes (the video is placed by the camera's wall clock relative to
 * T0, and the audio is what the mics delivered), so their chains differ; the harness says which
 * boxes differ.
 */
#include "../src/worker.h"

#include <stdlib.h>
#include <string.h>

Session S;
int64_t mono_us(void) { struct timespec t; clock_gettime(CLOCK_MONOTONIC, &t); return t.tv_sec * US + t.tv_nsec / 1000; }

static void on_durable(void *opaque, const Checkpoint *cp) {
    (void)opaque;
    char frag[65], chain[65], prefix[65], plain[65], plain_chain[65];
    sha256_hex(cp->frag, frag);
    sha256_hex(cp->chain, chain);
    sha256_hex(cp->prefix, prefix);
    sha256_hex(cp->plain, plain);
    sha256_hex(cp->plain_chain, plain_chain);
    fprintf(stdout, "{\"index\":%u,\"start\":%lld,\"len\":%lld,\"fragSha256\":\"%s\",\"chainSha256\":\"%s\",\"prefixSha256\":\"%s\",\"plaintextSha256\":\"%s\",\"plaintextChainSha256\":\"%s\",\"mediaStartMs\":%lld,\"mediaDurationMs\":%lld,\"keyframe\":%s}\n",
            cp->index, (long long)cp->start, (long long)cp->len, frag, chain, prefix, plain, plain_chain, (long long)cp->media_start_ms, (long long)cp->media_duration_ms, cp->keyframe ? "true" : "false");
}

int main(int argc, char **argv) {
    if (argc != 3) { fprintf(stderr, "usage: writer_replay <recorded.mp4> <out.mp4>\n"); return 2; }
    FILE *in = fopen(argv[1], "rb");
    if (!in) return 2;
    Sink s;
    sink_init(&s, argv[2]);
    s.on_durable = on_durable;
    static uint8_t buf[65536];                              /* the muxer's buffer size */
    size_t n;
    int r = 0;
    while (r >= 0 && (n = fread(buf, 1, sizeof buf, in)) > 0) r = sink_write(&s, buf, (int)n);
    fclose(in);
    int c = sink_close(&s);
    fflush(stdout);
    if (r < 0 || c < 0) { fprintf(stderr, "writer_replay: the writer refused the bytes (%s)\n", s.fail_code ? s.fail_code : "close"); return 1; }
    return 0;
}
