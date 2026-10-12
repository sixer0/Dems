/*
 * THE ANNOUNCED ADDRESS OF AN INGEST (task 4 blueprint row 58, WP-11b; decisions C26, C27; security check
 * verification/05_security_branch_b.md, requirements BR-01 and BR-02). Pure: no I/O, no clock, no library of
 * FFmpeg, so that `make unit` checks it without a worker (test/announce_test.c).
 *
 * WHY. The RTSP listener of libavformat 63.1.102 takes a push to ANY path (experiment E-11: 18 of 21 near-miss
 * pushes recorded). The address a client announced is in no field of the context; the library shows it in ONE
 * place the public interface reaches: the text of the messages it hands to the log callback while
 * avformat_open_input runs. For every line it reads it says, at level trace,
 *     Parsing[<length of the line>]: <the line>
 * and for the request that announces a stream the line is
 *     ANNOUNCE <address> RTSP/1.0
 *
 * THE RULE IS A POSITIVE MATCH, NEVER A SEEN MISMATCH. An ingest may go on only when, during its open, the
 * library handed over EXACTLY ONE message that is such an ANNOUNCE line, and that message EQUALS - as a whole,
 * newline included, length first, then every byte in constant time - the message the plan's own address gives.
 * Everything else is "not passed": no line (another library, another wording, another level), a line that
 * differs in one byte (a near miss; nothing is decoded, case-folded, trimmed or cut into parts), a second line
 * (equal or not), a message too long for the formatting buffer, and any message by which the library says it
 * adopted another control address. A diagnostic text is thereby a NECESSARY condition of recording and never a
 * sufficient condition of refusing: if the library changes, every push is refused - the right one too - and
 * nothing foreign is recorded.
 *
 * The prefix tests below (is this message an ANNOUNCE line; is it the "other control address" message) can only
 * COUNT a message against the open. Nothing but the whole-message equality counts for it.
 */
#ifndef DEMS_CAPTURE_ANNOUNCE_H
#define DEMS_CAPTURE_ANNOUNCE_H

#include <stddef.h>

/* The buffer one message of the library is formatted into before it is compared (BR-02: at least 2,048). */
#define ANNOUNCE_MESSAGE_CHARS 4096
/* The longest ingest address of a plan (capture_worker.c, parse_listen_url). */
#define ANNOUNCE_ADDRESS_CHARS 256
#define ANNOUNCE_EXPECTED_CHARS (ANNOUNCE_ADDRESS_CHARS + 64)

typedef struct AnnounceGate {
    char expected[ANNOUNCE_EXPECTED_CHARS];     /* the one message that lets the open pass */
    size_t expected_len;                        /* 0: no expected message could be built - nothing passes */
    int lines;                                  /* ANNOUNCE lines the library showed during this open (saturates) */
    int matches;                                /* of those: equal to `expected` as a whole (saturates) */
    int adopted_other;                          /* the library said it took another control address */
} AnnounceGate;

/* Before every open: forgets what an earlier open showed and builds the expected message from the plan's address. */
void announce_gate_reset(AnnounceGate *g, const char *plan_address);
/* One message of the library, as formatted: `have` characters at `text`; `whole` is 0 when the message did not fit
 * the formatting buffer (it can then count against the open, never for it). Returns 1 when this open can no longer
 * pass (the caller may end it early), else 0. */
int announce_gate_observe(AnnounceGate *g, const char *text, size_t have, int whole);
/* 1 only after exactly one ANNOUNCE line, equal to the expected message, and no adopted other address. */
int announce_gate_passed(const AnnounceGate *g);

/* WHY AN OPEN DID NOT PASS (task 4 row 175; BR-04 (3)). Two refusals that mean different things to whoever reads
 * the worker's log, so they are told apart; neither carries a text of the library or of the plan:
 *   ANNOUNCE_NOT_MATCHED  the library showed an ANNOUNCE line and the open still may not pass: the line differs
 *                         (a near miss, another camera's address, a line too long), there was more than one
 *                         (repeated, equal or not), or the library said it adopted another control address.
 *                         A client that does not hold the plan's address did this.
 *   ANNOUNCE_NOT_SEEN     the library showed NO such line and adopted nothing during an open that returned: the
 *                         wording, the level or the thread of its messages is not what this worker was verified
 *                         against (a library change). Every push is then refused, the right one too.
 * The verdict only NAMES a refusal. It decides nothing: the gate is announce_gate_passed, and ANNOUNCE_PASSED is
 * returned exactly when that is 1. */
typedef enum { ANNOUNCE_PASSED = 0, ANNOUNCE_NOT_MATCHED = 1, ANNOUNCE_NOT_SEEN = 2 } AnnounceVerdict;
AnnounceVerdict announce_gate_verdict(const AnnounceGate *g);

/* LOG HYGIENE (task 4 row 175; BR-04 (2)). 1 when `text` (`have` characters) names the path of a plan's ingest
 * address: the whole path after the port (any length), or one of its elements between two slashes that is at
 * least ANNOUNCE_PATH_ELEMENT_CHARS long (the session's random element is 22; a shorter element alone - "1",
 * "cam" - would withhold every ordinary message and is covered by the whole path). Compared byte for byte:
 * nothing is decoded or case-folded, so it can only say "withhold" for the text the plan itself holds.
 * A message for which this is 1 is not written to the log, at any level. No address: 0. */
#define ANNOUNCE_PATH_ELEMENT_CHARS 8
int announce_names_path(const char *plan_address, const char *text, size_t have);

#endif
