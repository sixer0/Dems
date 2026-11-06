/* E-11b probe (blueprint row 7, AD-01 (5)). Test code, git-ignored, never part of the worker.
 * An RTSP listener opened the way the worker's ingest opens it (apps/capture-worker/src/ingest.c:481-490:
 * rtsp_flags=listen, listen_timeout, protocol_whitelist=tcp, an interrupt callback), through the PUBLIC
 * interface of libavformat / libavutil only. It prints, with the instant, every place of that interface in
 * which the address the CLIENT announced could show up:
 *   (1) the log callback (av_log_set_callback, libavutil/log.h): every message, every level
 *   (2) AVFormatContext.url, .metadata, .event_flags, stream metadata   (avformat.h)
 *   (3) every AVOption of the context and of its children              (libavutil/opt.h)
 *   (4) the io_open callback of the context                            (avformat.h)
 * at three instants: inside avformat_open_input, after it returned (before the stream is probed), and
 * after avformat_find_stream_info and the first packets.
 *   probe <port> <listener-path> observe|refuse [listen_timeout_s]
 * refuse: when a value read during the open differs from the listener's own path, the interrupt callback
 * answers 1 from then on (the only public way to end a blocking open). */
#include <libavformat/avformat.h>
#include <libavutil/opt.h>
#include <libavutil/log.h>
#include <libavutil/time.h>
#include <libavutil/avstring.h>
#include <stdio.h>
#include <string.h>

static const char *phase = "before_open";
static int64_t t0;
static AVFormatContext *ctx;
static char listener_url[600], listener_path[512], seen_uri[1024], seen_path[512];
static int n_log, n_update, n_differs, n_io_open, refuse_mode, refuse_now, n_interrupt_refusals;
static const char *seen_phase = "";
static char line_uri[1024], line_path[512];      /* from the request line of ANNOUNCE as the library echoes it (level trace) */
static int n_line;

static double ms(void) { return (av_gettime_relative() - t0) / 1000.0; }

static void log_cb(void *avcl, int level, const char *fmt, va_list vl) {
    char m[1500];
    vsnprintf(m, sizeof m, fmt, vl);
    size_t n = strlen(m);
    while (n && (m[n - 1] == '\n' || m[n - 1] == '\r')) m[--n] = 0;
    for (char *p = m; *p; p++) if (*p == '\n' || *p == '\r') *p = '|';
    n_log++;
    const char *cls = avcl && *(AVClass **)avcl ? (*(AVClass **)avcl)->class_name : "-";
    printf("LOG t=%8.1fms phase=%-17s level=%2d ctx=%s class=%s text=%s\n", ms(), phase, level, avcl == (void *)ctx ? "listener" : "other", cls, m);
    const char *u = "Updating control URI to ";
    if (avcl == (void *)ctx && !strncmp(m, u, strlen(u))) {
        char host[128], auth[128]; int port;
        n_update++;
        av_strlcpy(seen_uri, m + strlen(u), sizeof seen_uri);
        av_url_split(NULL, 0, auth, sizeof auth, host, sizeof host, &port, seen_path, sizeof seen_path, seen_uri);
        seen_phase = phase;
        printf("READ t=%8.1fms phase=%s announced_uri=%s announced_path=%s\n", ms(), phase, seen_uri, seen_path);
        if (refuse_mode && strcmp(seen_path, listener_path)) { refuse_now = 1; printf("REFUSE t=%8.1fms decided: announced path differs from the listener's\n", ms()); }
    }
    /* The request line itself, which the library hands to the callback at level trace for EVERY request, also
     * when the address equals the listener's: "Parsing[<n>]: ANNOUNCE <uri> RTSP/1.0". */
    const char *a = avcl == (void *)ctx && !strncmp(m, "Parsing[", 8) ? strstr(m, "]: ANNOUNCE ") : NULL;
    if (a) {
        char host[128], auth[128]; int port;
        n_line++;
        av_strlcpy(line_uri, a + 12, sizeof line_uri);
        char *sp = strchr(line_uri, ' ');
        if (sp) *sp = 0;
        av_url_split(NULL, 0, auth, sizeof auth, host, sizeof host, &port, line_path, sizeof line_path, line_uri);
        printf("READ_LINE t=%8.1fms phase=%s announce_request_uri=%s announce_request_path=%s equals_listener_path=%d\n", ms(), phase, line_uri, line_path, !strcmp(line_path, listener_path));
        if (refuse_mode && strcmp(line_path, listener_path)) { refuse_now = 1; printf("REFUSE t=%8.1fms decided: path of the ANNOUNCE request differs from the listener's\n", ms()); }
    }
    if (avcl == (void *)ctx && strstr(m, "differs from expected")) n_differs++;
    fflush(stdout);
}

static int interrupt_cb(void *opaque) { (void)opaque; if (refuse_now) { n_interrupt_refusals++; return 1; } return 0; }

static int (*default_io_open)(AVFormatContext *, AVIOContext **, const char *, int, AVDictionary **);
static int io_open_cb(AVFormatContext *s, AVIOContext **pb, const char *url, int flags, AVDictionary **o) {
    n_io_open++;
    printf("IO_OPEN t=%8.1fms phase=%s url=%s flags=%d\n", ms(), phase, url, flags);
    return default_io_open(s, pb, url, flags, o);
}

/* Every option of obj and of its children whose value is text; counts those that hold `needle`. */
static void dump_opts(void *obj, int depth, const char *needle, int *n_opts, int *n_hit) {
    const AVOption *o = NULL;
    while ((o = av_opt_next(obj, o))) {
        if (o->type == AV_OPT_TYPE_CONST) continue;
        uint8_t *v = NULL;
        if (av_opt_get(obj, o->name, 0, &v) < 0 || !v) continue;
        (*n_opts)++;
        int hit = needle && *needle && strstr((char *)v, needle) != NULL && !strstr((char *)v, listener_path);
        if (hit) (*n_hit)++;
        if (hit || strstr((char *)v, "rtsp") || strchr((char *)v, '/'))
            printf("OPT   phase=%s depth=%d class=%s name=%s value=%s%s\n", phase, depth, (*(AVClass **)obj)->class_name, o->name, v, hit ? "   <== holds the client's path" : "");
        av_free(v);
    }
    void *child = NULL;
    while ((child = av_opt_child_next(obj, child))) dump_opts(child, depth + 1, needle, n_opts, n_hit);
}

/* What the context itself shows at this instant. `needle` = the path component a wrong-path client sent (argv). */
static void dump_ctx(const char *needle) {
    int n_opts = 0, n_hit = 0, n_meta = 0, meta_hit = 0;
    printf("FIELD t=%8.1fms phase=%s AVFormatContext.url=%s equals_listener_url=%d\n", ms(), phase, ctx->url ? ctx->url : "(null)", ctx->url && !strcmp(ctx->url, listener_url));
    printf("FIELD phase=%s event_flags=%d nb_streams=%u pb=%s priv_data=%s\n", phase, ctx->event_flags, ctx->nb_streams, ctx->pb ? "set" : "NULL", ctx->priv_data ? "set (opaque)" : "NULL");
    const AVDictionaryEntry *e = NULL;
    while ((e = av_dict_iterate(ctx->metadata, e))) { n_meta++; if (needle && *needle && strstr(e->value, needle) && !strstr(e->value, listener_path)) meta_hit++; printf("META  phase=%s context %s=%s\n", phase, e->key, e->value); }
    for (unsigned i = 0; i < ctx->nb_streams; i++) {
        e = NULL;
        while ((e = av_dict_iterate(ctx->streams[i]->metadata, e))) { n_meta++; if (needle && *needle && strstr(e->value, needle) && !strstr(e->value, listener_path)) meta_hit++; printf("META  phase=%s stream%u %s=%s\n", phase, i, e->key, e->value); }
    }
    dump_opts(ctx, 0, needle, &n_opts, &n_hit);
    printf("SCAN  phase=%s needle=%s options_read=%d options_holding_needle=%d metadata_entries=%d metadata_holding_needle=%d url_holds_needle=%d\n",
           phase, needle && *needle ? needle : "(none)", n_opts, n_hit, n_meta, meta_hit, needle && *needle && ctx->url && strstr(ctx->url, needle) && !strstr(ctx->url, listener_path) ? 1 : 0);
    fflush(stdout);
}

int main(int argc, char **argv) {
    if (argc < 4) { fprintf(stderr, "usage: probe <port> <listener-path> observe|refuse [listen_timeout_s] [needle]\n"); return 2; }
    int port = atoi(argv[1]), timeout_s = argc > 4 ? atoi(argv[4]) : 12;
    const char *needle = argc > 5 ? argv[5] : "";
    refuse_mode = !strcmp(argv[3], "refuse");
    snprintf(listener_url, sizeof listener_url, "rtsp://127.0.0.1:%d/%s", port, argv[2]);
    snprintf(listener_path, sizeof listener_path, "/%s", argv[2]);
    printf("PROBE libavformat=%s (%u.%u.%u) mode=%s listener_url=%s listener_path=%s needle=%s\n", LIBAVFORMAT_IDENT, avformat_version() >> 16, (avformat_version() >> 8) & 255, avformat_version() & 255,
           argv[3], listener_url, listener_path, *needle ? needle : "(none)");
    av_log_set_callback(log_cb);
    AVDictionary *o = NULL;
    av_dict_set(&o, "rtsp_flags", "listen", 0);
    av_dict_set_int(&o, "listen_timeout", timeout_s, 0);
    av_dict_set(&o, "protocol_whitelist", "tcp", 0);
    ctx = avformat_alloc_context();
    ctx->interrupt_callback.callback = interrupt_cb;
    default_io_open = ctx->io_open;
    ctx->io_open = io_open_cb;
    AVFormatContext *mine = ctx;                 /* avformat_open_input frees the context and clears the pointer on failure */
    t0 = av_gettime_relative();
    phase = "avformat_open_input";
    int r = avformat_open_input(&mine, listener_url, NULL, &o);
    phase = "after_open";
    av_dict_free(&o);
    printf("OPEN  t=%8.1fms avformat_open_input=%d (%s) log_messages=%d update_messages=%d differs_messages=%d io_open_calls=%d interrupt_refusals=%d\n",
           ms(), r, r < 0 ? av_err2str(r) : "ok", n_log, n_update, n_differs, n_io_open, n_interrupt_refusals);
    if (r < 0) {
        ctx = NULL;
        printf("RESULT mode=%s open=failed read_during_open=%s announced_path=%s listener_path=%s equal=%d packets=0 request_line_path=%s request_line_equal=%d\n", argv[3], n_update ? "yes" : "no", n_update ? seen_path : "(none)", listener_path, n_update ? !strcmp(seen_path, listener_path) : -1,
               n_line ? line_path : "(none)", n_line ? !strcmp(line_path, listener_path) : -1);
        return 0;
    }
    dump_ctx(needle);                             /* the instant a listener would have to decide: opened, nothing probed yet */
    printf("BEFORE_PROBE t=%8.1fms request_line_path=%s request_line_equal=%d | update_message: read_from_log=%s announced_path=%s read_in_phase=%s listener_path=%s equal=%d\n", ms(), n_line ? line_path : "(none)", n_line ? !strcmp(line_path, listener_path) : -1, n_update ? "yes" : "no", n_update ? seen_path : "(none)", n_update ? seen_phase : "-", listener_path,
           n_update ? !strcmp(seen_path, listener_path) : -1);
    phase = "find_stream_info";
    r = avformat_find_stream_info(ctx, NULL);
    printf("PROBED t=%8.1fms avformat_find_stream_info=%d\n", ms(), r);
    phase = "after_probe";
    dump_ctx(needle);
    phase = "read";
    AVPacket *p = av_packet_alloc();
    int packets = 0;
    while (packets < 25 && av_read_frame(ctx, p) >= 0) { packets++; av_packet_unref(p); }
    av_packet_free(&p);
    phase = "after_read";
    dump_ctx(needle);
    printf("RESULT mode=%s open=ok read_during_open=%s announced_path=%s listener_path=%s equal=%d packets=%d request_line_path=%s request_line_equal=%d log_messages=%d io_open_calls=%d\n", argv[3], n_update ? "yes" : "no", n_update ? seen_path : "(none)", listener_path,
           n_update ? !strcmp(seen_path, listener_path) : -1, packets, n_line ? line_path : "(none)", n_line ? !strcmp(line_path, listener_path) : -1, n_log, n_io_open);
    phase = "close";
    avformat_close_input(&ctx);
    return 0;
}
