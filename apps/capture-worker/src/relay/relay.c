/*
 * The capture relay: the program (relay.h has the whole picture; task 4 blueprint row 41, WP-03a).
 *
 *   standard input   ONE line, the start message, then nothing: its end is the order to stop
 *   standard output  nothing in record mode
 *   standard error   lines of fixed words and numbers (say); never a text of the library, of the camera, of
 *                    the start message, an address, a path or an account
 *   arguments        none: an argument is refused (nothing of a session may stand in a process listing)
 *   environment      not read
 *
 * THE PUSH LEG is the library's RTSP writer over TCP, as the worker's verified pushers use it: the address it
 * announces is the `ingest` member of the start message, handed on unchanged and announced by ONE call of
 * avformat_write_header - there is no second attempt, because the worker's gate takes exactly one announce
 * (../announce.h) and its listener takes one connection.
 *
 * TIME. The first forwarded picture is pts 0, and the wall clock of pts 0 (what the worker anchors on, through
 * the writer's sender reports) is THIS host's clock at that moment. Later pictures keep the distance the camera
 * gave them (its 90 kHz stamps). The camera's own wall clock is never used: a camera with a wrong clock records.
 *
 * THE KEYFRAME GATE (design addendum 5.1; review finding F10 a). Nothing is forwarded until the relay holds the
 * parameter sets and a picture that is a keyframe; after a gap in the camera's packet sequence nothing is
 * forwarded until the next keyframe. What is held back is counted.
 */
#include "relay.h"

#include <libavcodec/avcodec.h>
#include <libavformat/avformat.h>
#include <libavformat/version.h>
#include <libavutil/log.h>

#include <arpa/inet.h>
#include <errno.h>
#include <netinet/in.h>
#include <poll.h>
#include <signal.h>
#include <stdarg.h>
#include <stdio.h>
#include <string.h>
#include <sys/mman.h>
#include <sys/resource.h>
#include <sys/socket.h>
#include <time.h>
#include <unistd.h>
#ifdef __linux__
#include <sys/prctl.h>
#endif

/* THE libavformat THE RELAY IS BUILT FOR: the worker's (../ingest.c, test/static/libavformat.pin; finding F10 d).
 * Another set of headers stops the build here; another library at run time stops the start (main). */
_Static_assert(LIBAVFORMAT_VERSION_INT == AV_VERSION_INT(63, 1, 102), "libavformat is not the version the capture worker was verified against (63.1.102, FFmpeg 9.0.2): see test/static/libavformat.pin");

static RelayStart g_start;
static char g_line[RELAY_LINE_MAX + 1];
static volatile sig_atomic_t g_signal;
static int g_stop, g_closing;
static int64_t g_close_deadline_us;
static long g_library_errors, g_pictures, g_held_back;

static int64_t mono_us(void) {
    struct timespec t;
    clock_gettime(CLOCK_MONOTONIC, &t);
    return (int64_t)t.tv_sec * 1000000LL + t.tv_nsec / 1000;
}
static int64_t real_us(void) {
    struct timespec t;
    clock_gettime(CLOCK_REALTIME, &t);
    return (int64_t)t.tv_sec * 1000000LL + t.tv_nsec / 1000;
}

/* S13-02 (a): the library's messages are counted, never written. They can hold an address. */
static void library_says(void *context, int level, const char *format, va_list arguments) {
    (void)context; (void)format; (void)arguments;
    if (level <= AV_LOG_ERROR) g_library_errors++;
}

/* THE ONE WRITER of the relay's lines. `event` and the code's name are words of this program. */
static void say(const char *event, const char *word, RelayCode code, const RelayPicture *picture, const RelayCounters *camera) {
    char line[512];
    int n = snprintf(line, sizeof line, "{\"relay\":\"%s\",\"code\":\"%s\",\"rc\":%d,\"pictures\":%ld,\"held_back\":%ld,\"gaps\":%ld,\"other_payloads\":%ld,\"forms_not_taken\":%ld,\"answers_with_digest\":%ld,\"challenges\":%ld,\"keepalives\":%ld,\"library_errors\":%ld}\n",
                     event, word, (int)code, g_pictures, g_held_back, picture ? picture->gaps : 0L, picture ? picture->foreign : 0L, picture ? picture->unsupported + picture->refused : 0L,
                     camera ? camera->auth_answers : 0L, camera ? camera->challenges : 0L, camera ? camera->keepalives : 0L, g_library_errors);
    if (n > 0 && (size_t)n < sizeof line) { ssize_t w = write(STDERR_FILENO, line, (size_t)n); (void)w; }
}

static void on_signal(int number) { (void)number; g_signal = 1; }

/* Has the Core ordered the stop? Standard input ended (the Core closed it, or the Core is gone), or a signal. */
static int stop_asked(void *unused) {
    (void)unused;
    if (g_stop) return 1;
    if (g_signal) { g_stop = 1; return 1; }
    struct pollfd p = { STDIN_FILENO, POLLIN, 0 };
    if (poll(&p, 1, 0) > 0) {
        if (p.revents & POLLIN) {
            char more[256];
            ssize_t got = read(STDIN_FILENO, more, sizeof more);       /* nothing is expected after the start message */
            relay_wipe(more, sizeof more);
            if (got == 0 || (got < 0 && errno != EINTR && errno != EAGAIN)) g_stop = 1;
        } else if (p.revents & (POLLHUP | POLLERR | POLLNVAL)) g_stop = 1;
    }
    return g_stop;
}

/* Ends a blocking call of the library. While the push is being ANNOUNCED: on the order to stop. While a picture is
 * written or the push is closed (g_closing: "bounded"): only at a bound. A picture is never cut in the middle by
 * the order to stop - the library's writer does not report such a cut, the picture would be counted as forwarded
 * and never arrive (seen in the first run of this row); the order is seen between two pictures instead
 * (relay_camera_read asks on the turns of its loop, at least every RELAY_STOP_SLICE_US, also while the camera
 * floods it: row 186). */
static int interrupt(void *unused) {
    if (g_closing) return mono_us() > g_close_deadline_us;
    return stop_asked(unused);
}

/* S13-02 (c), RC-6: no core file; on Linux not dumpable and no new privileges; nothing inherited stays open. */
static int hygiene(void) {
    struct rlimit none = { 0, 0 }, now;
    if (setrlimit(RLIMIT_CORE, &none) || getrlimit(RLIMIT_CORE, &now) || now.rlim_cur != 0 || now.rlim_max != 0) return -1;
#ifdef __linux__
    if (prctl(PR_SET_DUMPABLE, 0, 0, 0, 0) || prctl(PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0)) return -1;
#endif
    int max = getdtablesize();
    for (int fd = 3; fd < max; fd++) close(fd);
    /* Best effort: the pages that hold the start message and the account are kept out of the swap. */
    mlock(&g_start, sizeof g_start);
    mlock(g_line, sizeof g_line);
    return 0;
}

/* The start message: one line, complete inside the bound, nothing after it. */
static RelayCode read_start(void) {
    size_t have = 0;
    int64_t deadline = mono_us() + RELAY_START_BOUND_US;
    RelayCode code = RELAY_START_MESSAGE_INVALID;
    for (;;) {
        char *end = memchr(g_line, '\n', have);
        if (end) {
            if ((size_t)(end - g_line) + 1 == have) code = relay_start_parse(g_line, have, &g_start);
            break;
        }
        if (have >= RELAY_LINE_MAX) break;
        struct pollfd p = { STDIN_FILENO, POLLIN, 0 };
        int r = poll(&p, 1, 100);
        if (g_signal) { g_stop = 1; break; }
        if (r == 0 || (r < 0 && errno == EINTR)) { if (mono_us() > deadline) { code = RELAY_START_MESSAGE_TIMEOUT; break; } continue; }
        if (r < 0) break;
        ssize_t got = read(STDIN_FILENO, g_line + have, RELAY_LINE_MAX - have);
        if (got < 0 && (errno == EINTR || errno == EAGAIN)) continue;
        if (got <= 0) break;
        have += (size_t)got;
    }
    relay_wipe(g_line, sizeof g_line);
    return code;
}

/* RC-6, checked by the relay itself once both legs stand: every internet socket of the process is a connected
 * stream socket to the camera of the locator or to the loopback ingest port, and none listens. */
static int sockets_break_the_rule(void) {
    int max = getdtablesize();
    for (int fd = 3; fd < max; fd++) {
        struct sockaddr_storage own, peer;
        socklen_t length = sizeof own, peer_length = sizeof peer, n = sizeof(int);
        int type = 0, listening = 0;
        if (getsockname(fd, (struct sockaddr *)&own, &length) < 0) continue;
        if (own.ss_family != AF_INET && own.ss_family != AF_INET6) continue;
        if (own.ss_family != AF_INET) return 1;
        if (getsockopt(fd, SOL_SOCKET, SO_TYPE, &type, &n) < 0 || type != SOCK_STREAM) return 1;
        n = sizeof(int);
        if (getsockopt(fd, SOL_SOCKET, SO_ACCEPTCONN, &listening, &n) == 0 && listening) return 1;
        if (getpeername(fd, (struct sockaddr *)&peer, &peer_length) < 0 || peer.ss_family != AF_INET) return 1;
        const struct sockaddr_in *to = (const struct sockaddr_in *)&peer;
        struct in_addr camera;
        if (inet_pton(AF_INET, g_start.host, &camera) != 1) return 1;
        int to_camera = to->sin_addr.s_addr == camera.s_addr && ntohs(to->sin_port) == g_start.port;
        int to_ingest = to->sin_addr.s_addr == htonl(INADDR_LOOPBACK) && ntohs(to->sin_port) == g_start.ingest_port;
        if (!to_camera && !to_ingest) return 1;
    }
    return 0;
}

/* ---------------------------------------------------------------- the push leg */
typedef struct Push {
    AVFormatContext *out;
    AVStream *stream;
    AVPacket *packet;
    int open;
    uint32_t last_stamp;
    int64_t ticks, last_ticks;
    int64_t first_us, last_us;              /* this host's monotonic clock at pts 0 and at the picture before */
} Push;

/* The picture size, which the library's writer asks for before it announces. It is READ, by the library's stream
 * parser, from the parameter sets and the first keyframe: nothing is decoded. 0 when it could not be read. */
static int picture_size(enum AVCodecID id, const uint8_t *extra, int n, const RelayPicture *picture, int *width, int *height) {
    AVCodecParserContext *parser = av_parser_init(id);
    AVCodecContext *context = avcodec_alloc_context3(NULL);
    size_t length = (size_t)n + picture->length;
    uint8_t *both = av_mallocz(length + AV_INPUT_BUFFER_PADDING_SIZE), *out = NULL;
    int out_size = 0, ok = 0;
    if (parser && context && both && length < INT32_MAX) {
        memcpy(both, extra, (size_t)n);
        memcpy(both + n, picture->unit, picture->length);
        parser->flags |= PARSER_FLAG_COMPLETE_FRAMES;
        av_parser_parse2(parser, context, &out, &out_size, both, (int)length, AV_NOPTS_VALUE, AV_NOPTS_VALUE, 0);
        if (parser->width > 0 && parser->height > 0 && parser->width <= 16384 && parser->height <= 16384) { *width = parser->width; *height = parser->height; ok = 1; }
    }
    av_free(both);
    avcodec_free_context(&context);
    if (parser) av_parser_close(parser);
    return ok;
}

static RelayCode push_open(Push *p, RelayCodec codec, const ParamSets *sets, const RelayPicture *first) {
    uint8_t extra[3 * (RELAY_PSET_MAX + 4)];
    uint32_t first_stamp = first->stamp;
    int width = 0, height = 0;
    int n = relay_extradata(codec, sets, extra, sizeof extra);
    if (n <= 0) return RELAY_INTERNAL;
    /* What the library's stream parser is about to read came from the camera (review M-1). Each parameter set is
     * held to its kind, its forbidden bit and a least length before that; the keyframe is units of the codec, each
     * after a start code of the relay's own and none inside (relay_core.c). What stays: the parser reads those
     * bytes, in this process, which holds the Digest key. */
    if (!relay_sets_valid(codec, sets)) return RELAY_STREAM_INVALID;
    if (!picture_size(codec == RELAY_CODEC_H264 ? AV_CODEC_ID_H264 : AV_CODEC_ID_HEVC, extra, n, first, &width, &height)) return RELAY_STREAM_INVALID;
    if (avformat_alloc_output_context2(&p->out, NULL, "rtsp", g_start.ingest) < 0 || !p->out) return RELAY_INTERNAL;
    p->out->interrupt_callback.callback = interrupt;
    p->stream = avformat_new_stream(p->out, NULL);
    p->packet = av_packet_alloc();
    if (!p->stream || !p->packet) return RELAY_INTERNAL;
    AVCodecParameters *par = p->stream->codecpar;
    par->codec_type = AVMEDIA_TYPE_VIDEO;
    par->codec_id = codec == RELAY_CODEC_H264 ? AV_CODEC_ID_H264 : AV_CODEC_ID_HEVC;
    par->extradata = av_mallocz((size_t)n + AV_INPUT_BUFFER_PADDING_SIZE);
    if (!par->extradata) return RELAY_INTERNAL;
    memcpy(par->extradata, extra, (size_t)n);
    par->extradata_size = n;
    par->width = width;
    par->height = height;
    p->stream->time_base = (AVRational){ 1, 90000 };
    p->out->start_time_realtime = real_us();        /* this host's clock for pts 0 */
    p->last_stamp = first_stamp;
    p->ticks = 0;
    p->last_ticks = -1;
    p->first_us = p->last_us = mono_us();
    AVDictionary *options = NULL;
    av_dict_set(&options, "rtsp_transport", "tcp", 0);              /* RC-6: no datagram socket on this leg either */
    int r = avformat_write_header(p->out, &options);                /* THE announce: once */
    int unread = av_dict_count(options);
    av_dict_free(&options);
    if (r < 0) return g_stop ? RELAY_STOP_ASKED : RELAY_INGEST_REFUSED;
    p->open = 1;
    return unread ? RELAY_INTERNAL : RELAY_STOPPED;
}

static RelayCode push_write(Push *p, const RelayPicture *picture) {
    AVPacket *k = p->packet;
    int64_t now = mono_us(), step = (int32_t)(picture->stamp - p->last_stamp);
    /* Recorded time is the camera's stamps, so the camera may not run it ahead of this host's clock (review M-3):
     * one step by at most RELAY_STEP_TICKS more than the time that passed, the whole by that and a hundredth. */
    if (!relay_step_plausible(step, now - p->last_us, p->ticks + step, now - p->first_us)) return RELAY_STREAM_INVALID;
    p->ticks += step;
    p->last_stamp = picture->stamp;
    p->last_us = now;
    if (p->ticks <= p->last_ticks) p->ticks = p->last_ticks + 1;    /* the muxed time never goes backwards */
    p->last_ticks = p->ticks;
    if (av_new_packet(k, (int)picture->length) < 0) return RELAY_INTERNAL;
    memcpy(k->data, picture->unit, picture->length);
    k->stream_index = 0;
    k->pts = k->dts = av_rescale_q(p->ticks, (AVRational){ 1, 90000 }, p->stream->time_base);
    k->flags = picture->keyframe ? AV_PKT_FLAG_KEY : 0;
    g_closing = 1;                                  /* bounded, not cut by the order to stop (interrupt) */
    g_close_deadline_us = mono_us() + RELAY_IO_BOUND_US;
    int r = av_write_frame(p->out, k);
    g_closing = 0;
    av_packet_unref(k);
    if (r < 0 || mono_us() > g_close_deadline_us) return RELAY_INGEST_LOST;
    return RELAY_STOPPED;
}

/* Ends the push the way the worker's pushers do (TEARDOWN), bounded: a worker that is gone cannot hold the relay. */
static void push_close(Push *p) {
    if (p->out) {
        if (p->open) {
            g_closing = 1;
            g_close_deadline_us = mono_us() + 2000000;
            av_write_trailer(p->out);
        }
        avformat_free_context(p->out);
        p->out = NULL;
    }
    av_packet_free(&p->packet);
}

int main(int argc, char **argv) {
    RelayCamera *camera = NULL;
    RelayDescription description;
    RelayPicture picture;
    Push push;
    RelayCode code;
    int have_picture = 0, gate = 0;
    long losses_seen = 0;
    struct sigaction ignore, stop;
    (void)argv;
    memset(&push, 0, sizeof push);
    memset(&picture, 0, sizeof picture);
    /* sigaction, not signal (review L-7): the same on every platform - the handler stays, and a wait that a
     * signal interrupts is NOT started again by the system, so the order to stop is seen at once. */
    memset(&ignore, 0, sizeof ignore);
    memset(&stop, 0, sizeof stop);
    ignore.sa_handler = SIG_IGN;
    stop.sa_handler = on_signal;
    sigemptyset(&ignore.sa_mask);
    sigemptyset(&stop.sa_mask);
    sigaction(SIGPIPE, &ignore, NULL);
    sigaction(SIGTERM, &stop, NULL);
    sigaction(SIGINT, &stop, NULL);

    if (hygiene()) { code = RELAY_HYGIENE_FAILED; goto done; }
    if (argc != 1) { code = RELAY_USAGE; goto done; }
    if (avformat_version() != (unsigned)LIBAVFORMAT_VERSION_INT) { code = RELAY_LIBAVFORMAT_VERSION_MISMATCH; goto done; }
    av_log_set_callback(library_says);
    avformat_network_init();

    if ((code = read_start())) { if (g_stop) code = RELAY_STOP_ASKED; goto done; }
    if (!(camera = relay_camera_new(&g_start, stop_asked, NULL))) { code = RELAY_INTERNAL; goto done; }
    code = relay_camera_open(camera, &description);
    relay_wipe(g_start.secret, sizeof g_start.secret);      /* whatever happened: the password is not needed again */
    if (code) goto done;
    if (relay_picture_init(&picture, description.codec, description.payload_type)) { code = RELAY_INTERNAL; goto done; }
    have_picture = 1;
    say("camera_playing", "RUNNING", RELAY_STOPPED, &picture, relay_camera_counters(camera));

    /* The first keyframe has its bound from here. The camera leg asks for it on every turn of its read loop, so
     * a camera that sends no video packet at all, or only what is dropped, meets it too (review H-2). */
    int64_t keyframe_deadline = mono_us() + RELAY_KEYFRAME_BOUND_US;
    relay_camera_limit(camera, keyframe_deadline, RELAY_KEYFRAME_TIMEOUT);
    for (;;) {
        const uint8_t *packet;
        size_t length;
        int r;
        if ((code = relay_camera_read(camera, &packet, &length))) break;
        do {
            r = relay_picture_add(&picture, packet, length);
            if (r < 0) { code = (RelayCode)-r; break; }
            if (r == 0) break;
            /* A picture. After a gap in the camera's sequence, or a picture that was not handed on (damaged,
             * refused), the pictures that follow lean on what was lost. */
            if (picture.gaps + picture.dropped != losses_seen) { losses_seen = picture.gaps + picture.dropped; gate = 0; }
            if (!gate) {
                const ParamSets *sets = relay_sets_complete(description.codec, &picture.seen) ? &picture.seen : &description.sets;
                if (picture.keyframe && (push.open || relay_sets_complete(description.codec, sets))) {
                    if (!push.open) {
                        if ((code = push_open(&push, description.codec, sets, &picture))) break;
                        if (sockets_break_the_rule()) { code = RELAY_SOCKET_RULE; break; }
                        say("push_open", "RUNNING", RELAY_STOPPED, &picture, relay_camera_counters(camera));
                        relay_camera_limit(camera, 0, RELAY_STOPPED);       /* the keyframe came */
                    }
                    gate = 1;
                }
            }
            if (gate) {
                if ((code = push_write(&push, &picture))) break;
                g_pictures++;
            } else g_held_back++;
            relay_picture_taken(&picture);
            relay_camera_progress(camera);          /* a complete picture: the bound of a playing camera starts again */
        } while (r == 2);
        if (code) break;
        if (!push.open && mono_us() > keyframe_deadline) { code = RELAY_KEYFRAME_TIMEOUT; break; }
    }

done:
    {
        RelayCounters counters = { 0, 0, 0, 0, 0, 0 };
        if (camera) counters = *relay_camera_counters(camera);
        push_close(&push);
        relay_camera_close(camera);
        relay_wipe(&g_start, sizeof g_start);
        relay_wipe(g_line, sizeof g_line);
        if (code == RELAY_STOP_ASKED) code = RELAY_STOPPED;
        say("exit", relay_code_name(code), code, have_picture ? &picture : NULL, &counters);
        if (have_picture) relay_picture_free(&picture);
    }
    return (int)code;
}
