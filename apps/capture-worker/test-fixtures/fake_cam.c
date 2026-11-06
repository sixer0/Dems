/*
 * NM-14 fake camera (blueprint row 60; first written for row 111): a SEPARATE PROCESS with its
 * OWN clock - the H-10 / AU2-06 fixture, the flash half of the flash+beep generator (S4 section 7),
 * and with --gop 250 the long-GOP camera of AU2-08.
 *
 * Camera clock model (all values integer microseconds, CLOCK_REALTIME of this host as "true time"):
 *   frame k leaves the sensor at TRUE time   epoch + k * 20000 * (1 + drift_ppm * 1e-6)
 *   the camera BELIEVES frame k was taken at  claimed + k * 20000        (its own wall clock)
 * so the camera clock is wrong by (claimed - epoch) at start and runs at (1 + drift) of true time.
 * The belief travels as RTP timestamps (pts k/50) plus the RTCP sender report, whose NTP origin is
 * AVFormatContext.start_time_realtime = claimed. Nothing else tells the receiver the time.
 *
 * Video: 320x240 gray (luma 16), 50 fps, GOP 50 by default (1 s, Q-GOP <= 2 s; --gop N sets it:
 * 250 = a keyframe every 5 s, the camera-like long GOP), libx264 zerolatency, no B-frames, no
 * scene-cut keyframes. Frames k = flash_first + j * flash_every are white (luma 235) - exactly one
 * frame each. With --noise 1 every other frame is pseudo-random luma: a HIGH-BITRATE stream (about 2 MB per
 * second at this size), which with a long GOP gives one group of pictures of many megabytes - the oversized
 * fragment of review R63-02 (fix pass F-M3). The flash frames stay white.
 *
 * Pushes to an RTSP LISTENER on 127.0.0.1 over TCP (S1 section 3 shape) and ends with TEARDOWN.
 * It opens no listener of its own and refuses any URL that is not rtsp://127.0.0.1:<port>/...
 * (SEC35-23). Build: `make -C apps/capture-worker fixtures` (build/fake_cam).
 */
#include <libavcodec/avcodec.h>
#include <libavformat/avformat.h>
#include <libavutil/opt.h>
#include <libavutil/time.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>

#define OK(x) do { int _e = (x); if (_e < 0) { fprintf(stderr, "FAKE_CAM FATAL %s: %s\n", #x, av_err2str(_e)); exit(1); } } while (0)
static int64_t real_us(void) { struct timespec t; clock_gettime(CLOCK_REALTIME, &t); return t.tv_sec * 1000000LL + t.tv_nsec / 1000; }

int main(int argc, char **argv) {
    const char *url = NULL;
    int64_t epoch = 0, claimed = 0;
    double drift_ppm = 0;
    int frames = 500, flash_first = 100, flash_every = 100, fps = 50, gop = 0, noise = 0;
    uint32_t lcg = 0x2545F491u;
    for (int i = 1; i + 1 < argc; i += 2) {
        const char *k = argv[i], *v = argv[i + 1];
        if (!strcmp(k, "--url")) url = v;
        else if (!strcmp(k, "--epoch-us")) epoch = atoll(v);
        else if (!strcmp(k, "--claimed-epoch-us")) claimed = atoll(v);
        else if (!strcmp(k, "--drift-ppm")) drift_ppm = atof(v);
        else if (!strcmp(k, "--frames")) frames = atoi(v);
        else if (!strcmp(k, "--flash-first")) flash_first = atoi(v);
        else if (!strcmp(k, "--flash-every")) flash_every = atoi(v);
        else if (!strcmp(k, "--gop")) gop = atoi(v);
        else if (!strcmp(k, "--noise")) noise = atoi(v);
        else { fprintf(stderr, "unknown arg %s\n", k); return 2; }
    }
    if (gop <= 0) gop = fps;
    if (!url || strncmp(url, "rtsp://127.0.0.1:", 17) || !epoch || !claimed) { fprintf(stderr, "usage: fake_cam --url rtsp://127.0.0.1:<port>/<name> --epoch-us N --claimed-epoch-us N [--drift-ppm D] [--frames N] [--flash-first K] [--flash-every K] [--gop N]\n"); return 2; }

    avformat_network_init();
    const AVCodec *codec = avcodec_find_encoder_by_name("libx264");
    if (!codec) { fprintf(stderr, "FAKE_CAM FATAL libx264 missing\n"); return 1; }
    AVCodecContext *e = avcodec_alloc_context3(codec);
    e->width = 320; e->height = 240; e->pix_fmt = AV_PIX_FMT_YUV420P;
    e->time_base = (AVRational){ 1, fps }; e->framerate = (AVRational){ fps, 1 };
    e->gop_size = gop; e->max_b_frames = 0; e->flags |= AV_CODEC_FLAG_GLOBAL_HEADER;
    av_opt_set(e->priv_data, "preset", "ultrafast", 0);
    av_opt_set(e->priv_data, "tune", "zerolatency", 0);
    char x264[64];
    snprintf(x264, sizeof x264, "scenecut=0:keyint=%d:min-keyint=%d", gop, gop);
    av_opt_set(e->priv_data, "x264-params", x264, 0);
    OK(avcodec_open2(e, codec, NULL));

    AVFormatContext *oc = NULL;
    OK(avformat_alloc_output_context2(&oc, NULL, "rtsp", url));
    AVStream *st = avformat_new_stream(oc, NULL);
    OK(avcodec_parameters_from_context(st->codecpar, e));
    st->time_base = e->time_base;
    oc->start_time_realtime = claimed;          /* the camera's wall clock for pts 0 -> RTCP SR */
    int r = -1;
    for (int attempt = 0; attempt < 50 && r < 0; attempt++) {       /* wait for the listener */
        AVDictionary *o = NULL;
        av_dict_set(&o, "rtsp_transport", "tcp", 0);
        r = avformat_write_header(oc, &o);
        av_dict_free(&o);
        if (r < 0) av_usleep(100000);
    }
    OK(r);
    fprintf(stderr, "FAKE_CAM CONNECTED pid=%d lead_ms=%lld gop=%d\n", (int)getpid(), (long long)((epoch - real_us()) / 1000), gop);
    if (real_us() > epoch) { fprintf(stderr, "FAKE_CAM FATAL connected after the epoch (host too slow); rerun\n"); return 3; }

    AVFrame *f = av_frame_alloc();
    f->format = e->pix_fmt; f->width = e->width; f->height = e->height;
    OK(av_frame_get_buffer(f, 0));
    AVPacket *p = av_packet_alloc();
    int64_t max_late = 0;
    for (int k = 0; k <= frames; k++) {
        if (k < frames) {
            int64_t due = epoch + (int64_t)((double)k * (1000000.0 / fps) * (1.0 + drift_ppm * 1e-6) + 0.5);
            int64_t wait = due - real_us();
            if (wait > 0) av_usleep((unsigned)wait); else if (-wait > max_late) max_late = -wait;
            OK(av_frame_make_writable(f));
            int flash = k >= flash_first && (k - flash_first) % flash_every == 0;
            for (int y = 0; y < f->height; y++) memset(f->data[0] + y * f->linesize[0], flash ? 235 : 16, f->width);
            if (noise && !flash)
                for (int y = 0; y < f->height; y++)
                    for (int x = 0; x < f->width; x++) { lcg = lcg * 1664525u + 1013904223u; f->data[0][y * f->linesize[0] + x] = (uint8_t)(16 + ((lcg >> 24) % 220)); }
            for (int y = 0; y < f->height / 2; y++) { memset(f->data[1] + y * f->linesize[1], 128, f->width / 2); memset(f->data[2] + y * f->linesize[2], 128, f->width / 2); }
            f->pts = k;
            OK(avcodec_send_frame(e, f));
        } else {
            OK(avcodec_send_frame(e, NULL));
        }
        while (avcodec_receive_packet(e, p) >= 0) {
            av_packet_rescale_ts(p, e->time_base, st->time_base);
            p->stream_index = 0;
            OK(av_write_frame(oc, p));
            av_packet_unref(p);
        }
    }
    OK(av_write_trailer(oc));
    fprintf(stderr, "FAKE_CAM DONE frames=%d max_late_us=%lld\n", frames, (long long)max_late);
    avformat_free_context(oc);
    return 0;
}
