/*
 * The capture relay: the camera leg (relay.h has the whole picture; task 4 blueprint row 41).
 *
 * An RTSP client of the relay's own, on ONE stream socket to the host and port of the locator. Why not the
 * library's: it answers a Basic challenge with the password (measured, libavformat 63.1.102: a DESCRIBE with
 * an `Authorization` header of that scheme left for a camera that challenged so), it has no option that
 * forbids it, and it takes the account only as part of an address (S13-01, F10).
 *
 * WHAT THIS CLIENT NEVER DOES
 *   - send anything derived from the password before a Digest challenge arrived, or to any other scheme;
 *   - follow a redirect, or send a request to an address whose host and port are not the locator's (AD-05 (3));
 *   - ask for, or accept, a transport other than RTP on this same connection (RC-6: no datagram socket);
 *   - resolve a name, open a file, or keep the password after the first challenge was answered;
 *   - hand on a text the camera sent: every failure is one code of relay.h.
 * A refused Digest answer ends the leg at once: one request carried it, no second one is tried.
 */
#include "relay.h"

#include <arpa/inet.h>
#include <errno.h>
#include <fcntl.h>
#include <netinet/in.h>
#include <netinet/tcp.h>
#include <poll.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <strings.h>
#include <sys/mman.h>
#include <sys/random.h>
#include <sys/socket.h>
#include <time.h>
#include <unistd.h>

#define BUFFER_BYTES (256 * 1024)
#define SLICE_MS 100

/* The largest whole thing the camera can put at the front of the buffer: a head and its body, or one frame. The
 * buffer holds more than three of them, which is what lets it be read by an index and moved only now and then. */
_Static_assert(RELAY_HEAD_MAX + RELAY_SDP_MAX < BUFFER_BYTES / 2 && 4 + 65535 < BUFFER_BYTES / 2, "the receive buffer is too small for its bounds");

/* TEST BUILDS WITH AddressSanitizer ONLY: the parts of the receive buffer that hold no unread byte (before the
 * index, after the last byte received) are marked unreadable. The buffer is ONE allocation, so without this a
 * frame length that reaches past what arrived would read old or unwritten bytes of it and no sanitizer would
 * see it (found by the negative controls of the fuzz build, row 186). The relay itself compiles nothing here. */
#ifdef RELAY_TEST_HOOKS
#if defined(__has_feature)
#if __has_feature(address_sanitizer)
void __asan_poison_memory_region(void const volatile *address, size_t size);
void __asan_unpoison_memory_region(void const volatile *address, size_t size);
#define UNGUARD(c) __asan_unpoison_memory_region((c)->buffer, BUFFER_BYTES)
#define GUARD(c) (__asan_poison_memory_region((c)->buffer, (c)->at), __asan_poison_memory_region((c)->buffer + (c)->have, BUFFER_BYTES - (c)->have))
#endif
#endif
#endif
#ifndef GUARD
#define UNGUARD(c) ((void)0)
#define GUARD(c) ((void)0)
#endif

struct RelayCamera {
    RelayStart *start;
    RelayStopFn stop;
    void *opaque;
    int fd;
    uint8_t *buffer;
    size_t at, have, consume;               /* the bytes not yet read are buffer[at .. have) */
    char *body;                             /* the body of the last answer, 0 after it */
    unsigned cseq, count;
    int have_key, have_challenge;
    DigestKey key;
    DigestChallenge challenge;
    char session[RELAY_SESSION_CHARS + 1];
    char aggregate[RELAY_LOCATOR_CHARS + 1], track[RELAY_LOCATOR_CHARS + 1];
    int rtp_channel, playing, refusals;
    int64_t keepalive_us, last_keepalive_us;
    int64_t progress_us;                    /* playing: PLAY, then the last complete picture (relay_camera_progress) */
    int64_t limit_us;                       /* one more absolute bound, 0: none (the whole open; the first keyframe) */
    RelayCode limit_code;
    int64_t last_stop_us;                   /* when the order to stop was last asked for */
    RelayCounters n;
};

static int64_t mono_us(void) {
    struct timespec t;
    clock_gettime(CLOCK_MONOTONIC, &t);
    return (int64_t)t.tv_sec * 1000000LL + t.tv_nsec / 1000;
}

RelayCamera *relay_camera_new(RelayStart *start, RelayStopFn stop, void *opaque) {
    RelayCamera *c = calloc(1, sizeof *c);
    if (!c) return NULL;
    c->buffer = malloc(BUFFER_BYTES);
    c->body = malloc(RELAY_SDP_MAX + 1);
    if (!c->buffer || !c->body) { free(c->buffer); free(c->body); free(c); return NULL; }
    /* Best effort, as for the start message (relay.c): the Digest key of the realm lives in this structure for
     * the life of the relay and authenticates to that realm like the password (review M-5). */
    mlock(c, sizeof *c);
    c->start = start;
    c->stop = stop;
    c->opaque = opaque;
    c->fd = -1;
    c->keepalive_us = RELAY_KEEPALIVE_US;
    GUARD(c);
    return c;
}

int relay_camera_socket(const RelayCamera *c) { return c ? c->fd : -1; }
const RelayCounters *relay_camera_counters(const RelayCamera *c) { return &c->n; }
void relay_camera_progress(RelayCamera *c) { c->progress_us = mono_us(); }
void relay_camera_limit(RelayCamera *c, int64_t monotonic_us, RelayCode late) { c->limit_us = monotonic_us; c->limit_code = late; }

/* The bound that comes first: `deadline`, or the caller's limit (then its code). */
static int64_t nearest(const RelayCamera *c, int64_t deadline, RelayCode *late) {
    if (c->limit_us && c->limit_us < deadline) { *late = c->limit_code; return c->limit_us; }
    return deadline;
}

/* ONE TURN of a loop that reads the camera (review H-2). Asked on EVERY turn, before anything is read: the
 * bound, which is an absolute time and so is not moved by a camera that keeps bytes coming; and the order to
 * stop, at least every RELAY_STOP_SLICE_US, so that a camera that never lets a read wait cannot hide it. */
static RelayCode turn(RelayCamera *c, int64_t deadline, RelayCode late) {
    int64_t now = mono_us();
    if (c->stop && now - c->last_stop_us >= RELAY_STOP_SLICE_US) {
        c->last_stop_us = now;
        if (c->stop(c->opaque)) return RELAY_STOP_ASKED;
    }
    return now >= deadline ? late : RELAY_STOPPED;
}

/* Waits until the socket can be read (or written), never past `deadline`, in slices, so that the order to stop
 * is seen while nothing arrives. */
static RelayCode wait_for(RelayCamera *c, short what, int64_t deadline, RelayCode late) {
    for (;;) {
        struct pollfd p = { c->fd, what, 0 };
        int64_t now = mono_us();
        if (c->stop) { c->last_stop_us = now; if (c->stop(c->opaque)) return RELAY_STOP_ASKED; }
        if (now >= deadline) return late;
        int64_t left_ms = (deadline - now + 999) / 1000;
        int r = poll(&p, 1, left_ms < SLICE_MS ? (int)left_ms : SLICE_MS);
        if (r > 0) return (p.revents & (what | POLLHUP | POLLERR)) ? RELAY_INTERNAL /* ready */ : RELAY_CAMERA_LOST;
        if (r < 0 && errno != EINTR) return RELAY_CAMERA_LOST;
    }
}
#define READY RELAY_INTERNAL        /* wait_for: the socket is ready (never handed on as a code) */

static RelayCode send_all(RelayCamera *c, const char *data, size_t n, int64_t deadline, RelayCode late) {
    while (n) {
        ssize_t w = send(c->fd, data, n, 0);
        if (w > 0) { data += w; n -= (size_t)w; continue; }
        if (w < 0 && (errno == EAGAIN || errno == EWOULDBLOCK || errno == EINTR)) {
            RelayCode r = wait_for(c, POLLOUT, deadline, late);
            if (r != READY) return r;
            continue;
        }
        return RELAY_CAMERA_LOST;
    }
    return RELAY_STOPPED;
}

static size_t pending(const RelayCamera *c) { return c->have - c->at; }

/* `n` bytes at the front are read. Nothing is moved: the index goes on (review H-2: a move of the whole buffer
 * for every dropped frame let a camera spend a core on 4-byte frames). */
static void drop(RelayCamera *c, size_t n) {
    c->at += n;
    if (c->at == c->have) c->at = c->have = 0;
    GUARD(c);
}

/* More bytes into the buffer. `late` is the code of a call that met `deadline`. The unread bytes are moved to
 * the front only when the index has passed the middle: what is moved is then never more than what was read
 * since the last move. */
static RelayCode fill(RelayCamera *c, int64_t deadline, RelayCode late) {
    if (c->at && (c->at >= BUFFER_BYTES / 2 || c->have >= BUFFER_BYTES)) {
        UNGUARD(c);
        memmove(c->buffer, c->buffer + c->at, c->have - c->at);
        c->have -= c->at;
        c->at = 0;
        GUARD(c);
    }
    if (c->have >= BUFFER_BYTES) return RELAY_CAMERA_PROTOCOL;
    for (;;) {
        RelayCode r = turn(c, deadline, late);
        if (r) return r;
        UNGUARD(c);
        ssize_t got = recv(c->fd, c->buffer + c->have, BUFFER_BYTES - c->have, 0);
        int why = errno;
        if (got > 0) { c->have += (size_t)got; c->n.bytes += (long)got; }
        GUARD(c);
        errno = why;
        if (got > 0) return RELAY_STOPPED;
        if (got == 0) return RELAY_CAMERA_LOST;
        if (errno != EAGAIN && errno != EWOULDBLOCK && errno != EINTR) return RELAY_CAMERA_LOST;
        r = wait_for(c, POLLIN, deadline, late);
        if (r != READY) return r;
    }
}

/* The next whole message at the front of the buffer that is not an RTP frame; frames before it are dropped
 * (a camera may send pictures before it answers PLAY). Its body lands in c->body. Frames and bytes that keep
 * coming do not move `deadline`. */
static RelayCode next_message(RelayCamera *c, RelayAnswer *a, int64_t deadline, RelayCode late) {
    for (;;) {
        RelayCode r;
        RelayWire w;
        if ((r = turn(c, deadline, late))) return r;
        int front = relay_wire_front(c->buffer + c->at, pending(c), &w);
        if (front < 0) return RELAY_CAMERA_PROTOCOL;
        if (front == RELAY_FRONT_MORE) { if ((r = fill(c, deadline, late))) return r; continue; }
        if (front == RELAY_FRONT_FRAME) { c->n.frames_dropped++; drop(c, w.total); continue; }
        long body = relay_head_parse((char *)c->buffer + c->at, w.total, a);
        if (body < 0) return RELAY_CAMERA_PROTOCOL;
        while (pending(c) < w.total + (size_t)body) if ((r = fill(c, deadline, late))) return r;
        memcpy(c->body, c->buffer + c->at + w.total, (size_t)body);
        c->body[body] = 0;
        a->body_len = (size_t)body;
        drop(c, w.total + (size_t)body);
        return RELAY_STOPPED;
    }
}

/* One request. `answered`: 0 = do not wait for the answer (keep-alive, TEARDOWN). The Authorization header is
 * added only when a Digest challenge of this camera is held; *carried says whether it was. `bound_us`: for the
 * request to leave, and then for its answer to be whole (one absolute time each). */
static RelayCode request(RelayCamera *c, const char *method, const char *address, const char *extra, RelayAnswer *answered, int *carried, int64_t bound_us) {
    /* Room for every field at its bound with every character escaped (review L-2: a challenge full of quotes
     * must not end the relay with the code of a fault of its own). */
    char authorization[2 * (3 * RELAY_FIELD_CHARS + RELAY_ACCOUNT_CHARS) + RELAY_LOCATOR_CHARS + 1024] = "", text[sizeof authorization + RELAY_LOCATOR_CHARS + 1024];
    RelayCode r = RELAY_STOPPED, late = RELAY_CAMERA_STALLED;
    int with = c->have_key && c->have_challenge, n = 0;
    if (carried) *carried = with;
    if (with) {
        char client_nonce[33] = "";
        if (c->challenge.qop_auth) {
            static const char hex[] = "0123456789abcdef";
            uint8_t chance[16];
            if (getentropy(chance, sizeof chance)) return RELAY_INTERNAL;
            for (int i = 0; i < 16; i++) { client_nonce[2 * i] = hex[chance[i] >> 4]; client_nonce[2 * i + 1] = hex[chance[i] & 15]; }
            client_nonce[32] = 0;
        }
        if (relay_digest_answer(&c->key, c->start->account, &c->challenge, method, address, ++c->count, client_nonce, authorization, sizeof authorization)) r = RELAY_INTERNAL;
        else c->n.auth_answers++;
    }
    if (!r) {
        n = snprintf(text, sizeof text, "%s %s RTSP/1.0\r\nCSeq: %u\r\nUser-Agent: DEMS-capture-relay\r\n%s%s%s%s%s%s%s\r\n",
                     method, address, ++c->cseq, with ? "Authorization: " : "", authorization, with ? "\r\n" : "",
                     c->session[0] ? "Session: " : "", c->session, c->session[0] ? "\r\n" : "", extra ? extra : "");
        if (n <= 0 || (size_t)n >= sizeof text) r = RELAY_INTERNAL;
    }
    if (!r) {
        int64_t deadline = nearest(c, mono_us() + bound_us, &late);
        r = send_all(c, text, (size_t)n, deadline, late);
    }
    relay_wipe(text, sizeof text);
    relay_wipe(authorization, sizeof authorization);
    if (r || !answered) return r;
    late = RELAY_CAMERA_STALLED;
    int64_t deadline = nearest(c, mono_us() + bound_us, &late);
    /* Messages that are not the answer (a request of the camera, an answer to something else) are read and
     * dropped, a counted few of them: the wait for one answer ends by the clock or by this count. */
    for (int skipped = 0; skipped <= RELAY_SKIPPED_MAX; skipped++) {
        if ((r = next_message(c, answered, deadline, late))) return r;
        if (answered->status && answered->cseq == (long)c->cseq) return RELAY_STOPPED;
    }
    return RELAY_CAMERA_PROTOCOL;
}

/* One request and its answer, through the camera's challenge. The ONLY place where the password is used: once,
 * for the key of the realm of the first Digest challenge; it is overwritten in the same breath. */
static RelayCode exchange(RelayCamera *c, const char *method, const char *address, const char *extra, RelayAnswer *a) {
    int renewed = 0;
    for (;;) {
        int carried;
        RelayCode r = request(c, method, address, extra, a, &carried, RELAY_IO_BOUND_US);
        if (r) return r;
        if (a->status != 401) return RELAY_STOPPED;
        c->n.challenges++;
        if (carried) {
            /* The camera refused an answer. Only a nonce it calls stale is answered again, once. */
            if (!(a->have_digest && a->digest.stale && !renewed)) return RELAY_AUTH_REFUSED;
            renewed = 1;
        }
        if (!a->have_digest) return RELAY_AUTH_SCHEME_NOT_ALLOWED;      /* S13-01: nothing was sent, nothing will be */
        if (!c->have_key) {
            int made = relay_digest_key(a->digest.hash, c->start->account, a->digest.realm, c->start->secret, &c->key);
            relay_wipe(c->start->secret, sizeof c->start->secret);
            if (made) return RELAY_INTERNAL;
            c->have_key = 1;
        } else if (c->key.hash != a->digest.hash || strcmp(c->key.realm, a->digest.realm)) return RELAY_AUTH_REFUSED;
        if (!c->have_challenge || strcmp(c->challenge.nonce, a->digest.nonce)) c->count = 0;       /* a new nonce counts from 1 (RFC 7616, 3.4) */
        c->challenge = a->digest;
        c->have_challenge = 1;
    }
}

/* THE ONE DIAL of the camera leg: the first open and every re-open come through here (relay_camera_open), and
 * nothing else of the relay makes a socket.
 * Row 143b (relay.h "THE SOURCE ADDRESS"): when the start message states a source address - in record mode it
 * always does - the socket is given THAT address of this host before it is connected, and no port (the system
 * chooses one: this is the end of a client, never a place to be reached at). An address this host does not hold
 * cannot be given: the leg ends here, with the code of a camera that cannot be reached, and nothing was sent -
 * no connection was asked for. There is no second try without the address. */
static RelayCode dial(RelayCamera *c) {
    struct sockaddr_in to, from;
    int one = 1;
    memset(&to, 0, sizeof to);
    to.sin_family = AF_INET;
    to.sin_port = htons((uint16_t)c->start->port);
    if (inet_pton(AF_INET, c->start->host, &to.sin_addr) != 1) return RELAY_INTERNAL;
    c->fd = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (c->fd < 0) return RELAY_INTERNAL;
    if (fcntl(c->fd, F_SETFD, FD_CLOEXEC) || fcntl(c->fd, F_SETFL, fcntl(c->fd, F_GETFL) | O_NONBLOCK)) return RELAY_INTERNAL;
    setsockopt(c->fd, IPPROTO_TCP, TCP_NODELAY, &one, sizeof one);
    if (c->start->source[0]) {
        memset(&from, 0, sizeof from);
        from.sin_family = AF_INET;
        from.sin_port = 0;
        if (inet_pton(AF_INET, c->start->source, &from.sin_addr) != 1) return RELAY_INTERNAL;
        if (bind(c->fd, (struct sockaddr *)&from, sizeof from)) return RELAY_CAMERA_UNREACHABLE;
    }
    if (connect(c->fd, (struct sockaddr *)&to, sizeof to) == 0) return RELAY_STOPPED;
    if (errno != EINPROGRESS) return RELAY_CAMERA_UNREACHABLE;
    RelayCode r = wait_for(c, POLLOUT, mono_us() + RELAY_IO_BOUND_US, RELAY_CAMERA_UNREACHABLE);
    if (r == RELAY_STOP_ASKED) return r;
    if (r != READY) return RELAY_CAMERA_UNREACHABLE;
    int error = 0;
    socklen_t length = sizeof error;
    if (getsockopt(c->fd, SOL_SOCKET, SO_ERROR, &error, &length) || error) return RELAY_CAMERA_UNREACHABLE;
    return RELAY_STOPPED;
}

#ifdef RELAY_TEST_HOOKS
void relay_camera_adopt(RelayCamera *c, int descriptor) {
    c->fd = descriptor;
    fcntl(c->fd, F_SETFL, fcntl(c->fd, F_GETFL) | O_NONBLOCK);
}
#endif

static RelayCode opened(RelayCamera *c, RelayDescription *description);

/* Connect (its own bound), then DESCRIBE, SETUP and PLAY inside ONE bound for all three: each answer has its
 * bound, and a camera that uses each of them to the end does not get their sum (review H-2). The password is
 * held no longer than this call (relay.c overwrites it when it returns). */
RelayCode relay_camera_open(RelayCamera *c, RelayDescription *description) {
    RelayCode r;
    if (c->fd < 0 && (r = dial(c))) return r;
    relay_camera_limit(c, mono_us() + RELAY_OPEN_BOUND_US, RELAY_CAMERA_STALLED);
    r = opened(c, description);
    relay_camera_limit(c, 0, RELAY_STOPPED);
    return r;
}

static RelayCode opened(RelayCamera *c, RelayDescription *description) {
    RelayAnswer a;
    RelayCode r;
    if ((r = exchange(c, "DESCRIBE", c->start->locator, "Accept: application/sdp\r\n", &a))) return r;
    if (a.status >= 300 && a.status < 400) return RELAY_REDIRECT_REFUSED;
    if (a.status == 404) return RELAY_LOCATOR_NOT_FOUND;
    if (a.status != 200) return RELAY_CAMERA_PROTOCOL;
    if ((r = relay_description_parse(c->body, a.body_len, description))) return r;
    /* Every later request goes to the locator's own host and port, or it is not sent. */
    if ((r = relay_control_address(c->start, a.base, "", c->aggregate, sizeof c->aggregate))) return r;
    if ((r = relay_control_address(c->start, a.base, description->control, c->track, sizeof c->track))) return r;

    if ((r = exchange(c, "SETUP", c->track, "Transport: RTP/AVP/TCP;unicast;interleaved=0-1\r\n", &a))) return r;
    if (a.status == 461) return RELAY_TRANSPORT_REFUSED;
    if (a.status == 404) return RELAY_LOCATOR_NOT_FOUND;
    if (a.status != 200 || !a.session[0]) return RELAY_CAMERA_PROTOCOL;
    if (a.datagram) return RELAY_TRANSPORT_REFUSED;
    c->rtp_channel = a.interleaved ? a.rtp_channel : 0;
    memcpy(c->session, a.session, sizeof c->session);
    if (a.timeout_s >= 4 && (int64_t)a.timeout_s * 500000LL < c->keepalive_us) c->keepalive_us = (int64_t)a.timeout_s * 500000LL;

    if ((r = exchange(c, "PLAY", c->aggregate, "Range: npt=0.000-\r\n", &a))) return r;
    if (a.status != 200) return RELAY_CAMERA_PROTOCOL;
    c->playing = 1;
    c->last_keepalive_us = c->progress_us = mono_us();
    return RELAY_STOPPED;
}

/* THE BOUND OF A PLAYING CAMERA (review H-2): RELAY_IO_BOUND_US without a complete picture (the caller says when
 * one was completed, relay_camera_progress), or the caller's limit (the first keyframe). It is asked on every
 * turn of the loop below. What does NOT move it: a byte, a frame of another channel, an empty frame, a message,
 * a video packet that completes nothing - whatever their number and however they are spread over time. */
RelayCode relay_camera_read(RelayCamera *c, const uint8_t **packet, size_t *length) {
    if (c->consume) { drop(c, c->consume); c->consume = 0; }
    for (;;) {
        RelayCode r, late = RELAY_CAMERA_STALLED;
        RelayWire w;
        int64_t deadline = nearest(c, c->progress_us + RELAY_IO_BOUND_US, &late);
        if ((r = turn(c, deadline, late))) return r;
        int64_t now = mono_us();
        if (now - c->last_keepalive_us >= c->keepalive_us) {
            /* The answer comes between the frames and is read (and dropped) below. */
            c->last_keepalive_us = now;
            c->n.keepalives++;
            if ((r = request(c, "OPTIONS", c->aggregate, NULL, NULL, NULL, RELAY_IO_BOUND_US))) return r;
        }
        int front = relay_wire_front(c->buffer + c->at, pending(c), &w);
        if (front < 0) return (RelayCode)-front;
        if (front == RELAY_FRONT_FRAME) {
            if (w.channel == c->rtp_channel && w.total > 4) {
                *packet = c->buffer + c->at + 4;
                *length = w.total - 4;
                c->consume = w.total;
                c->n.packets++;
                return RELAY_STOPPED;
            }
            c->n.frames_dropped++;          /* the camera's reports, another channel, an empty frame */
            drop(c, w.total);
            continue;
        }
        if (front == RELAY_FRONT_MESSAGE) {
            /* A message between the frames: the answer to a keep-alive, or a request of the camera. Read and dropped. */
            RelayAnswer a;
            long body = relay_head_parse((char *)c->buffer + c->at, w.total, &a);
            if (body < 0) return RELAY_CAMERA_PROTOCOL;
            /* A keep-alive the camera refused. Only a nonce it calls STALE is renewed, for the same realm and
             * hash, and the second refusal in a row ends the leg: a responder that refuses at will would
             * otherwise collect an answer to a nonce of its choice at every keep-alive (review M-4). */
            if (a.status == 401) {
                if (++c->refusals >= 2 || !a.have_digest || !a.digest.stale || a.digest.hash != c->key.hash || strcmp(a.digest.realm, c->key.realm)) return RELAY_AUTH_REFUSED;
                c->challenge = a.digest;
                c->count = 0;
            } else if (a.status == 200) c->refusals = 0;
            while (pending(c) < w.total + (size_t)body) if ((r = fill(c, deadline, late))) return r;
            drop(c, w.total + (size_t)body);
            continue;
        }
        if ((r = fill(c, deadline, late))) return r;
    }
}

/* Row 43 (relay.h): the connection is closed without a request, and what belonged to it is forgotten - the bytes
 * not yet read, the session, the challenge and its count, the control addresses, the bounds. What STAYS is the
 * Digest key of the realm. Nothing derived from the password leaves on a new connection before the camera of that
 * connection has challenged (the challenge of the old one is not carried over). */
void relay_camera_drop(RelayCamera *c) {
    if (!c) return;
    if (c->fd >= 0) { shutdown(c->fd, SHUT_RDWR); close(c->fd); }
    c->fd = -1;
    UNGUARD(c);
    relay_wipe(c->buffer, BUFFER_BYTES);
    c->at = c->have = c->consume = 0;
    GUARD(c);
    relay_wipe(&c->challenge, sizeof c->challenge);
    c->have_challenge = 0;
    /* No key was made on the first open (the camera asked for no answer) and the password is gone: the key is
     * marked as one that fits no challenge, so a camera that challenges now is not answered. */
    if (!c->have_key) { relay_wipe(&c->key, sizeof c->key); c->have_key = 1; }
    c->session[0] = c->aggregate[0] = c->track[0] = 0;
    c->cseq = c->count = 0;
    c->rtp_channel = c->playing = c->refusals = 0;
    c->keepalive_us = RELAY_KEEPALIVE_US;
    c->limit_us = 0;
}

void relay_camera_close(RelayCamera *c) {
    if (!c) return;
    if (c->fd >= 0) {
        /* TEARDOWN is a courtesy with a short bound of its own: a camera that does not read cannot hold the end. */
        if (c->playing) { c->stop = NULL; c->limit_us = 0; request(c, "TEARDOWN", c->aggregate, NULL, NULL, NULL, RELAY_CLOSE_BOUND_US); }
        shutdown(c->fd, SHUT_RDWR);
        close(c->fd);
    }
    relay_wipe(&c->key, sizeof c->key);
    relay_wipe(&c->challenge, sizeof c->challenge);
    UNGUARD(c);
    relay_wipe(c->buffer, BUFFER_BYTES);
    free(c->buffer);
    free(c->body);
    free(c);
}
