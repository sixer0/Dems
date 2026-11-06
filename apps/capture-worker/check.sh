#!/bin/sh
# Static rules of the capture worker's C sources (blueprint rows 58 and 59; checks M3-SR-2 (row 58
# part) and M3-SR-3 (worker part); capture spec C.2, C.4, C.5, E, A.2; errata AU2-07, PE-111-02,
# PE-111-03; register W1-C1).
#
#   sh check.sh <source dir>     the rules over one directory of sources; exit 0 only if all hold
#   sh check.sh --selftest       the rules over copies of src/ with ONE planted line each
#                                (test/static/planted.tsv): every copy MUST be refused, by its rule
#
#   Row 61 (decisions D84 R-6, D85 R-8, D85 "version pin"; pair-58 F-10):
#     R-6 / F-10   test/static/pinned_calls.py over the TOKENS of the sources: every call that makes, truncates,
#                  renames, links or removes a file, sets a mux option or commands the filter graph is counted and
#                  placed (test/static/pinned-calls.tsv); forbidden option names are found in strings written in
#                  pieces. The spelling rules below (D58-1, D58-2, D59-3, C.4, SR-3) STAY: two nets, not one.
#     D85          the libavformat the anchor logic was verified against (test/static/libavformat.pin) is the one
#                  the build links; another version is refused here, before anything is compiled.
#     F-10         every proof build of the Makefile says so in its HELLO (the Core refuses it at boot).
#
#   Fix pass F-M3 (code review of row 63, gateway_check/16_m3_code_review.md; ruling D179):
#     R63-06       a PROOF build is a build with ANY proof switch: every DEMS_PROOF_ name the sources test is in the
#                  list of worker.h that defines DEMS_PROOF_BUILD, and HELLO takes its mark from that one macro.
#     R63-08       the four evasions that passed both nets - a digraph paste, an assembler label, another muxer name,
#                  removefile() - are refused by pinned_calls.py; and THE IMPORT NET reads the linked binary
#                  (`nm -u`, test/static/imports.pin; run by the Makefile after every link of build/capture-worker).
#                  What remains outside the nets is stated in the header of pinned_calls.py ("LIMITS").
#     R63-09       the sync seam of sink.c is assigned by nothing in the worker (a unit test only).
#
# Every forbidden text below is written with a bracket in it, so that this file does not contain it.
# Run from apps/capture-worker (the Makefile does).
set -u

rules() {
  dir=$1
  fail=0
  say() { echo "check.sh: $dir: $1"; fail=1; }
  count() { cat "$dir"/*.c "$dir"/*.h 2>/dev/null | grep -c -- "$1"; }
  files() { grep -l -- "$1" "$dir"/*.c "$dir"/*.h 2>/dev/null | sed 's|.*/||' | sort | tr '\n' ' ' | sed 's/ $//'; }
  # Row N3: "file:function:count ..." of the matches of an awk expression, by the function they stand in ("-": outside one).
  # A function begins at a line of column 0 that ends in ") {" and ends at a "}" of column 0 (the style of the sources).
  by_function() {
    for f in "$2"/*.c "$2"/*.h; do
      [ -f "$f" ] || continue
      awk -v re="$1" -v file="${f##*/}" '
        /^[A-Za-z_].*\(.*\) \{$/ { fn = $0; sub(/\(.*/, "", fn); sub(/.*[ *]/, "", fn) }
        { line = $0; n = gsub(re, "", line); if (n > 0) c[fn == "" ? "-" : fn] += n }
        /^\}/ { fn = "" }
        END { for (k in c) printf "%s:%s:%d\n", file, k, c[k] }' "$f"
    done | sort | tr '\n' ' ' | sed 's/ $//'
  }

  # AU2-07: the graph is never commanded. Until row 152b the operator's switch was its ONE call site (in audio.c, behind
  # the filtering-thread guard); the switch is retired (N-31; D135, D136): the selector of the tap keeps the input
  # filter_build() gave it at START, so a call of the graph command anywhere is a way to move it, and is refused.
  [ "$(count 'avfilter_graph_send_comman[d](')" = "0" ] || say "AU2-07: expected no call of the graph command (the switch is retired), found $(count 'avfilter_graph_send_comman[d](') in $(files 'avfilter_graph_send_comman[d](')"
  # Pair-111 N-10: no other unit can reach the graph at all, by any function of the filter library.
  [ "$(files 'avfilter_\|av_buffersrc_\|av_buffersink_\|libavfilter/')" = "audio.c" ] || say "N-10: libavfilter is named outside audio.c: $(files 'avfilter_\|av_buffersrc_\|av_buffersink_\|libavfilter/')"
  for other in av_opt_set avfilter_graph_queue_comman[d] avfilter_process_comman[d]; do
    [ "$(count "$other")" = "0" ] || say "N-10: $other is not used by the worker (a second way to command the graph)"
  done

  # Capture spec C.4 (erratum PE-111-02): three mux options are forbidden with the pinned flags.
  # Each shifts the whole video track by about 450 ms while the file still decodes.
  for option in 'use_editlis[t]' 'negative_cts_offset[s]' 'avoid_negative_t[s]'; do
    [ "$(count "$option")" = "0" ] || say "C.4: forbidden mux option $(echo "$option" | tr -d '[]') in the worker"
  done
  # Register W1-C1 (capture spec C.4 "confirmed absences"): three options this FFmpeg does not have.
  for option in 'frag_typ[e]' 'default_prf[t]' 'frag_start_numbe[r]'; do
    [ "$(count "$option")" = "0" ] || say "W1-C1: non-existent mux option $(echo "$option" | tr -d '[]') in the worker"
  done
  # The mux options of the camera files are the decided ones (row 58 part P4), in one place.
  # D61 (2026-11-04): the channel files of the microphone plane set the SAME options (flush_packets twice now: camera muxer and mic muxer).
  [ "$(count '#define DEMS_MOVFLAGS "+frag_keyframe+empty_moov+default_base_moof+skip_trailer"')" = "1" ] || say "C.4: the default movflags are not the decided set"
  [ "$(count '"flush_packets", "1"')" = "2" ] || say "C.2 (W-2): flush_packets=1 is not set on the camera output and the D61 channel output"

  # H-4 was ONE audio encoder (row 58); D61 (2026-11-04) made it one encoder instance per file. Row 152 (D5 pairs,
  # DF-06): the legacy lane's encoder that fed EVERY camera file is gone. ONE place finds and opens an encoder
  # (audio.c enc_open): one per microphone channel of the plan, whose packets go to its own file AND to the camera of
  # its pair, plus the silent one of a camera that states its channel missing. A second place is a bug.
  [ "$(count 'avcodec_find_encoder')" = "1" ] || say "H-4/D61: expected exactly 1 encoder lookup (audio.c enc_open: the pairs' encoders), found $(count 'avcodec_find_encoder')"
  [ "$(count 'avcodec_open2(')" = "1" ] || say "H-4/D61: expected exactly 1 codec open (audio.c enc_open: the pairs' encoders), found $(count 'avcodec_open2(')"

  # W-1 / SEC35-23: TCP only on the ingest, and no wildcard address anywhere.
  [ "$(count '"protocol_whitelist", "tcp"')" = "1" ] || say "W-1: the ingest does not restrict its protocols to tcp"
  [ "$(count '0\.0\.0\.[0]\|INADDR_AN[Y]\|rtsp:/[/]:\|\[:[:]\]')" = "0" ] || say "SEC35-23: a wildcard address in the worker"
  [ "$(count 'rtsp_transpor[t]')" = "0" ] || say "W-1: rtsp_transport does not keep a listen ingest off UDP; it must not be relied on"

  # D58-1 / D58-2 (decision D72, findings A-9, F-3): an evidence file is never opened for
  # truncation and never created in place. Every create is exclusive, the final name is reached by
  # ONE link() in sink.c, and the only stream opened for writing is the diagnostic manifest.
  [ "$(count 'O_TRUN[C]')" = "0" ] || say "D58-1: O_TRUNC in the worker"
  [ "$(count 'O_CREA[T]')" = "$(count 'O_CREAT | O_EXC[L]')" ] || say "D58-1: a create without O_EXCL"
  [ "$(count '[ (]link([a-z]')" = "1" ] && [ "$(files '[ (]link([a-z]')" = "sink.c" ] || say "D58-2: the final name of a camera file is reached by exactly one link() in sink.c"
  [ "$(count 'rename(')" = "1" ] && [ "$(files 'rename(')" = "ipc.c" ] || say "D58-1: rename() is used for the log rotation only"
  [ "$(count 'fopen([^)]*, "w[b+]*")')" = "1" ] && [ "$(files 'fopen([^)]*, "w[b+]*")')" = "audio.c" ] || say "D58-1: a stream opened for (over)writing other than the diagnostic manifest"
  # Row 59 (decisions D59-2, D59-3): the writer of the camera files.
  #   - ONE truncation in the worker: sink.c cutting a failed write back to the last good length.
  #     Nothing truncates by path, and nothing else calls it.
  [ "$(count 'ftruncat[e](')" = "1" ] && [ "$(files 'ftruncat[e](')" = "sink.c" ] || say "D59-3: exactly one ftruncate(), in sink.c (a failed write goes back to the last good length)"
  [ "$(count '[^f]truncat[e](')" = "0" ] || say "D59-3: truncate() by path in the worker"
  grep -q 'st.st_size > good && ftruncate(s->fd, good)' "$dir/sink.c" 2>/dev/null || say "D59-3: the truncation is not bound to the last good length"
  #   - the sync of a fragment is the strongest the platform has, and the directory is synced after the link.
  [ "$(count 'fcntl(fd, F_FULLFSYN[C])')" = "1" ] && [ "$(files 'fcntl(fd, F_FULLFSYN[C])')" = "sink.c" ] || say "D59-2: the full sync of a fragment is missing from sink.c"
  [ "$(count 'sync_dir(s->path)')" = "1" ] || say "D59-2: the directory is not synced after the link"
  #   - the write-fault seam is set by nothing but the proof build, behind its own switch.
  [ "$(count 'sink_fault_hook [=] ')" = "1" ] || say "D59-4: the write-fault seam is assigned outside the proof build"
  [ "$(grep -B1 'sink_fault_hook = proof_write_fault;' "$dir/capture_worker.c" 2>/dev/null | head -1)" = "#ifdef DEMS_PROOF_WRITE_FAULT" ] || say "D59-4: the write-fault seam is not behind the proof-build switch"
  [ "$(cat "$dir"/*.c 2>/dev/null | grep -c 'DEMS_PROOF_KEEP_TORN_TAI[L]')" = "1" ] && [ "$(grep -l 'DEMS_PROOF_KEEP_TORN_TAI[L]' "$dir"/*.c 2>/dev/null | sed 's|.*/||')" = "sink.c" ] || say "D59-4: the no-truncation control is named outside its one place in sink.c"
  #   - R63-09: the sync seam (a volume without the full sync) is a unit-test seam: defined NULL once, assigned by nothing.
  [ "$(count 'sink_full_sync_hook [=] ')" = "0" ] && [ "$(count '(\*sink_full_sync_hook)(int fd) = NULL;')" = "1" ] || say "R63-09: the sync seam is assigned in the worker (only a unit test sets it)"
  #   - R63-06: every proof switch the sources test is one of the list that makes a build a PROOF build (worker.h).
  for switch in $(cat "$dir"/*.c "$dir"/*.h 2>/dev/null | grep -o 'DEMS_PROOF_[A-Z_]*' | sort -u); do
    [ "$switch" = "DEMS_PROOF_BUILD" ] && continue
    sed -n '/^#if defined(DEMS_PROOF_MUX_EXTRA)/,/^#define DEMS_PROOF_BUILD 1/p' "$dir/worker.h" 2>/dev/null | grep -q "defined($switch)" || say "R63-06: the proof switch $switch does not make its build a PROOF build (it is missing from the list of worker.h)"
  done
  for switch in MIC_MAX_PPM DEMS_MOVFLAGS DEMS_VERIFIED_LAVF_VERSION_INT; do
    sed -n '/^#if defined(DEMS_PROOF_MUX_EXTRA)/,/^#define DEMS_PROOF_BUILD 1/p' "$dir/worker.h" 2>/dev/null | grep -q "defined($switch)" || say "R63-06: the build switch $switch does not make its build a PROOF build (it is missing from the list of worker.h)"
  done
  # M3-SR-3 (worker part): the options set on an input or an output context are the decided ones.
  # The muxer gets movflags (the four pinned flags), flush_packets and min_frag_duration, nothing else.
  opts=$(cat "$dir"/*.c 2>/dev/null | grep -o 'av_dict_set\(_int\)\{0,1\}(&o, "[a-z_]*"' | sed 's/.*"\(.*\)"/\1/' | sort -u | tr '\n' ' ' | sed 's/ $//')
  [ "$opts" = "flush_packets listen_timeout min_frag_duration movflags protocol_whitelist rtsp_flags" ] || say "SR-3: the options the worker sets are not the decided set: $opts"
  # F-2: the refusal of a non-TCP transport reads no message text of the library.
  [ "$(count 'not on whitelis[t]')" = "0" ] || say "F-2: the worker keys on a message text of libavformat"
  # Task 4 rows 58 / 142 (verification/05_security_branch_b.md, BR-01; decision C26): THE GATE CANNOT BE BYPASSED.
  # F-2 has ONE decided exception - the ANNOUNCE line of the library is read by announce.c, as a NECESSARY condition
  # of an open only (a missing or another line refuses; none accepts). What holds the gate in its place:
  #   - ONE open of an input and ONE probe of a stream in the whole worker, both in ingest.c, and the stream is read
  #     (av_read_frame) in ONE place, after the probe: there is no second path to a camera's bytes;
  #   - the gate's test stands exactly once, as written, after the open and before the probe; its refusal leaves;
  #   - no line of the preprocessor and no jump stands between the open and the probe: no switch is around the gate;
  #   - the one proof switch of the gate removes what the callback SEES (so that everything is refused), never the test.
  open_at=$(grep -n 'avformat_open_inpu[t](' "$dir/ingest.c" 2>/dev/null | head -1 | cut -d: -f1)
  gate_at=$(grep -n '^    if (!announce_gate_passed(&c->announce)) {$' "$dir/ingest.c" 2>/dev/null | head -1 | cut -d: -f1)
  info_at=$(grep -n 'avformat_find_stream_inf[o](' "$dir/ingest.c" 2>/dev/null | head -1 | cut -d: -f1)
  read_at=$(grep -n 'av_read_fram[e](' "$dir/ingest.c" 2>/dev/null | head -1 | cut -d: -f1)
  [ "$(count 'avformat_open_inpu[t](')" = "1" ] && [ "$(files 'avformat_open_inpu[t](')" = "ingest.c" ] || say "BR-01: expected exactly 1 open of an input in the worker, in ingest.c (a second open is a path the gate does not stand on)"
  [ "$(count 'avformat_find_stream_inf[o](')" = "1" ] && [ "$(files 'avformat_find_stream_inf[o](')" = "ingest.c" ] || say "BR-01: expected exactly 1 probe of a stream (avformat_find_stream_info) in the worker, in ingest.c (a second probe is a path the gate does not stand on)"
  [ "$(count 'av_read_fram[e](')" = "1" ] && [ "$(files 'av_read_fram[e](')" = "ingest.c" ] || say "BR-01: a camera's stream is read (av_read_frame) in more than one place, or outside ingest.c"
  [ "$(grep -c 'announce_gate_passe[d](' "$dir/ingest.c" 2>/dev/null)" = "1" ] && [ -n "$gate_at" ] || say "BR-01: the gate's test must stand exactly once in ingest.c, as written: if (!announce_gate_passed(&c->announce)) {"
  if [ -n "$open_at" ] && [ -n "$gate_at" ] && [ -n "$info_at" ] && [ -n "$read_at" ]; then
    [ "$open_at" -lt "$gate_at" ] && [ "$gate_at" -lt "$info_at" ] && [ "$info_at" -lt "$read_at" ] || say "BR-01: the gate does not stand after the open and before the probe and the first read of the stream"
    [ "$(sed -n "${open_at},${info_at}p" "$dir/ingest.c" | grep -c '^[[:space:]]*#\|^[[:space:]]*%:\|[^a-z_]got[o] \|setjm[p]\|longjm[p]')" = "0" ] || say "BR-01: a preprocessor line or a jump between the open and the probe (a switch around the gate)"
    [ "$(sed -n "$((gate_at + 1)),$((gate_at + 5))p" "$dir/ingest.c" | grep -c '^        return NULL;$')" = "1" ] && [ "$(sed -n "$((gate_at + 5))p" "$dir/ingest.c")" = "    }" ] || say "BR-01: the refusal of the gate does not end the ingest (its block must close the input and return)"
  fi
  [ "$(cat "$dir"/*.c "$dir"/*.h 2>/dev/null | grep -o 'DEMS_PROOF_ANNOUNC[E][A-Z_]*' | sort -u | tr '\n' ' ')" = "DEMS_PROOF_ANNOUNCE_UNSEEN " ] && [ "$(grep -c '^#ifndef DEMS_PROOF_ANNOUNCE_UNSEE[N]$' "$dir/ingest.c" 2>/dev/null)" = "1" ] || say "BR-01: a proof switch of the gate other than the one that makes the callback see nothing"
  # BR-03: the early end of ONE camera's open goes through that camera's own flag (the interrupt callback's argument).
  [ "$(count 'interrupt_callback.opaque = c;')" = "1" ] || say "BR-03: the interrupt callback of an ingest is not given its own camera"
  # Task 4 rows 175 / 142 (BR-04 (1)): no log level is ever set. The compiler refuses a use of the name (the poison
  # line of worker.h); this rule holds the line itself and finds the name wherever it is code.
  [ "$(count 'av_log_set_leve[l](')" = "0" ] && [ "$(cat "$dir"/*.c "$dir"/*.h 2>/dev/null | grep 'av_log_set_leve[l]' | grep -vc '^[[:space:]]*/\{0,1\}\*')" = "1" ] || say "BR-04: av_log_set_level is named in the worker's code (no level is ever set: nothing above level 16 may reach the log)"
  [ "$(grep -c '^#pragma GCC poison av_log_set_level$' "$dir/worker.h" 2>/dev/null)" = "1" ] || say "BR-04: the line of worker.h that makes av_log_set_level uncallable is missing"
  # Task 4 row 178 (the requests of rows 175 and 182; BR-04 (2), (3)): THE WORDS OF A REFUSAL ARE FIXED. Each of the
  # two log codes and of the two frame members of the gate is a literal on exactly ONE line of the worker, the body
  # of its own function, in its order (no line seen / another line); CAMERA_NO_PICTURE is a literal once; and every
  # caller of ingest_over_as hands it the gate's two functions or literals - a frame reason is never built from a text.
  [ "$(count '"INGEST_ANNOUNCE_NOT_SEE[N]"')" = "1" ] && [ "$(count '"INGEST_ANNOUNCE_NOT_MATCHE[D]"')" = "1" ] \
    && [ "$(grep -A1 '^static const char \*announce_refusal_code(const AnnounceGate \*g) {$' "$dir/ingest.c" 2>/dev/null | grep -c '^    return announce_gate_verdict(g) == ANNOUNCE_NOT_SEEN ? "INGEST_ANNOUNCE_NOT_SEEN" : "INGEST_ANNOUNCE_NOT_MATCHED";$')" = "1" ] || say "BR-04: the two log codes of the gate are not literals of exactly one line, the body of announce_refusal_code (each in its case)"
  [ "$(count '"CAMERA_ANNOUNCE_NOT_SEE[N]"')" = "1" ] && [ "$(count '"CAMERA_ANNOUNCE_NOT_MATCHE[D]"')" = "1" ] \
    && [ "$(grep -A1 '^static const char \*announce_refusal_reason(const AnnounceGate \*g) {$' "$dir/ingest.c" 2>/dev/null | grep -c '^    return announce_gate_verdict(g) == ANNOUNCE_NOT_SEEN ? "CAMERA_ANNOUNCE_NOT_SEEN" : "CAMERA_ANNOUNCE_NOT_MATCHED";$')" = "1" ] || say "BR-04: the two frame members of the gate are not literals of exactly one line, the body of announce_refusal_reason (each in its case)"
  [ "$(count '"CAMERA_NO_PICTUR[E]"')" = "1" ] || say "BR-04: the frame member CAMERA_NO_PICTURE is not a literal of exactly one line"
  [ "$(count 'ingest_over_a[s](')" = "5" ] && [ "$(files 'ingest_over_a[s](')" = "ingest.c" ] \
    && [ "$(grep -c 'ingest_over_as(c, src, announce_refusal_code(&c->announce), announce_refusal_reason(&c->announce), ' "$dir/ingest.c" 2>/dev/null)" = "2" ] \
    && [ "$(grep -c 'ingest_over_as(c, src, "INGEST_NO_PICTURE_SIZE", "CAMERA_NO_PICTURE", ' "$dir/ingest.c" 2>/dev/null)" = "1" ] \
    && [ "$(grep -c 'ingest_over_as(c, source, code, !strcmp(code, "CAMERA_CLOCK_OUT_OF_BOUND") ? code : !strcmp(code, "INGEST_ENDED") ? "CAMERA_STREAM_ENDED" : "CAMERA_NOT_CONNECTED", averror);' "$dir/ingest.c" 2>/dev/null)" = "1" ] || say "BR-04: a caller of ingest_over_as hands it a frame reason that is neither the gate's function nor a literal (four callers, as written)"

  # W-4: nothing ends the process with a success code but main's return, and nothing is printed to
  # standard output but frames (one writer, in ipc.c).
  [ "$(count '[^_a-z]exit(0)\|EXIT_SUCCES[S]')" = "0" ] || say "W-4: an exit with a success code outside main's return"
  [ "$(files 'STDOUT_FILENO')" = "ipc.c" ] || say "B.2: standard output is written outside ipc.c: $(files 'STDOUT_FILENO')"
  [ "$(count '[^fnsv]printf(\|puts(\|putchar(\|fputs(\|stdou[t]')" = "0" ] || say "B.2: a print to standard output (only frames go there)"
  [ "$(count 'geten[v](')" = "0" ] || say "B.2: the worker reads no environment variable"
  # Task 4 row N3 (protocol version 5; design 06 s7.2a "the worker's static rule"; SM-31, SM-33 (4)): THE GAPPED KIND.
  # ONE predicate, ONE place that sets it, read in a closed set of functions; no resampler call can be reached for it.
  #   - exactly one assignment of the member, as written, in the plan reader; no address of it is ever taken;
  [ "$(count 'gapped[[:space:]]*[-+*/%&|^]\{0,1\}=[^=]\|gapped[[:space:]]*++\|gapped[[:space:]]*--\|++[[:space:]]*[A-Za-z_][]A-Za-z0-9_.>[-]*gappe[d]\|--[[:space:]]*[A-Za-z_][]A-Za-z0-9_.>[-]*gappe[d]')" = "1" ] \
    && [ "$(grep -c '^        s->mic\[at\]\.gapped = !strcmp(kind->str, "PCM_FIFO_GAPPED");$' "$dir/capture_worker.c" 2>/dev/null)" = "1" ] \
    && [ "$(count '\(^\|[^&]\)&[[:space:]]*[A-Za-z_(][]A-Za-z0-9_.>[(-]*gappe[d]')" = "0" ] || say "N3-GAP: the gapped flag is set in more than one place, not as written in the plan reader, or its address is taken"
  #   - its reads, per function (a member access `.gapped` / `->gapped`; comments never spell it so): the closed set;
  [ "$(by_function '[.>]gapped([^A-Za-z0-9_]|$)' "$dir")" = "audio.c:audio_main:3 audio.c:mic_open:1 audio.c:mic_read:2 audio.c:mic_take:1 audio.c:telemetry:1 capture_worker.c:take_plan:1" ] \
    || say "N3-GAP: the gapped flag is read outside its closed set of places (mic_open, mic_read, mic_take, telemetry, audio_main; the plan reader sets it): $(by_function '[.>]gapped([^A-Za-z0-9_]|$)' "$dir")"
  #   - the kind words are literals of the plan reader and of nothing else: no other place branches on a kind;
  [ "$(by_function '"PCM_FIFO' "$dir")" = "capture_worker.c:take_plan:3" ] || say "N3-GAP: a microphone kind word is a literal outside the plan reader: $(by_function '"PCM_FIFO' "$dir")"
  #   - the resampler's functions: exactly these five names, each mentioned as often as it is called, all in audio.c;
  [ "$(cat "$dir"/*.c "$dir"/*.h 2>/dev/null | grep -o 'swr_[a-z_0-9]*' | sort -u | tr '\n' ' ')" = "swr_alloc_set_opts2 swr_convert swr_free swr_init swr_set_compensation " ] \
    && [ "$(count 'swr_set_compensatio[n]')" = "2" ] && [ "$(count 'swr_conver[t]')" = "1" ] && [ "$(count 'swr_alloc_set_opts[2]')" = "1" ] && [ "$(count 'swr_ini[t]')" = "1" ] \
    && [ "$(by_function 'swr_set_compensation[(]' "$dir")" = "audio.c:mic_open:1 audio.c:mic_take:1" ] && [ "$(by_function 'swr_convert[(]' "$dir")" = "audio.c:mic_read:1" ] \
    || say "N3-GAP: the resampler is called otherwise than by its five calls in mic_open, mic_read and mic_take"
  #   - mic_open: the resampler is made and switched on only inside the branch of a microphone that is NOT gapped;
  ga=$(grep -n '^    if (!plan->gapped) {$' "$dir/audio.c" 2>/dev/null | head -1 | cut -d: -f1)
  ge=$( [ -n "$ga" ] && awk -v a="$ga" 'NR > a && /^    }$/ { print NR; exit }' "$dir/audio.c")
  for call in 'swr_alloc_set_opts[2](' 'swr_ini[t](' 'swr_set_compensation(m->swr, 0, 0)'; do
    at=$(grep -n "$call" "$dir/audio.c" 2>/dev/null | head -1 | cut -d: -f1)
    [ -n "$ga" ] && [ -n "$ge" ] && [ -n "$at" ] && [ "$ga" -lt "$at" ] && [ "$at" -lt "$ge" ] || say "N3-GAP: mic_open makes or switches on the resampler outside the branch of a microphone that is not gapped ($(echo "$call" | tr -d '[]'))"
  done
  #   - mic_read: the convert stands in the else-branch of the gapped test (a gapped microphone's samples are copied);
  ra=$(grep -n '^        if (m->plan->gapped) {$' "$dir/audio.c" 2>/dev/null | head -1 | cut -d: -f1)
  re=$( [ -n "$ra" ] && awk -v a="$ra" 'NR > a && /^        } else {$/ { print NR; exit }' "$dir/audio.c")
  rz=$( [ -n "$re" ] && awk -v a="$re" 'NR > a && /^        }$/ { print NR; exit }' "$dir/audio.c")
  at=$(grep -n 'swr_conver[t](' "$dir/audio.c" 2>/dev/null | head -1 | cut -d: -f1)
  [ -n "$re" ] && [ -n "$rz" ] && [ -n "$at" ] && [ "$re" -lt "$at" ] && [ "$at" -lt "$rz" ] || say "N3-GAP: the convert of mic_read does not stand in the branch of a microphone that is not gapped"
  #   - mic_take: the return of a gapped microphone precedes the compensation and the rate judgement; no jump in the function.
  gt=$(grep -n '^    if (m->plan->gapped) return 0;$' "$dir/audio.c" 2>/dev/null | cut -d: -f1)
  ta=$(grep -n '^static int mic_take(' "$dir/audio.c" 2>/dev/null | head -1 | cut -d: -f1)
  tz=$( [ -n "$ta" ] && awk -v a="$ta" 'NR > a && /^}$/ { print NR; exit }' "$dir/audio.c")
  tc=$(grep -n 'swr_set_compensation(m->swr, (int)lrint(rate), SR)' "$dir/audio.c" 2>/dev/null | head -1 | cut -d: -f1)
  tw=$(grep -n 'return micwatch_rat[e](' "$dir/audio.c" 2>/dev/null | head -1 | cut -d: -f1)
  [ "$(echo "$gt" | grep -c .)" = "1" ] && [ -n "$ta" ] && [ -n "$tz" ] && [ -n "$tc" ] && [ -n "$tw" ] && [ "$ta" -lt "$gt" ] && [ "$gt" -lt "$tc" ] && [ "$gt" -lt "$tw" ] && [ "$tw" -lt "$tz" ] \
    && [ "$(sed -n "${ta},${tz}p" "$dir/audio.c" | grep -c '[^a-z_]got[o] \|^[A-Za-z_][A-Za-z0-9_]*:\|setjm[p]\|longjm[p]')" = "0" ] \
    || say "N3-GAP: in mic_take the compensation or the rate judgement can be reached for a gapped microphone (its return must stand once before both, with no jump in the function)"
  # Row 61 (D84 R-6, D85 R-8, pair-58 F-10): the pinned calls, read as tokens. One line per violation, tagged R-6 or F-10.
  if command -v python3 >/dev/null 2>&1; then
    pinned=$(python3 test/static/pinned_calls.py "$dir" test/static/pinned-calls.tsv 2>&1)
    [ $? -eq 0 ] || { printf '%s\n' "$pinned" | sed "s|^|check.sh: $dir: |"; fail=1; }
  else
    say "R-6: python3 is needed for the pinned-call rule (test/static/pinned_calls.py)"
  fi
  return $fail
}

# Row 61 (decision D85): the build links the libavformat the worker was verified against, and no other.
#   version_rule <pin file> <version found>
version_rule() {
  want=$(grep -v '^#' "$1" 2>/dev/null | awk -F'\t' '$1 == "libavformat" { print $2 }' | head -1)
  [ -n "$want" ] || { echo "check.sh: D85: $1 names no libavformat version"; return 1; }
  [ "$2" = "$want" ] || { echo "check.sh: D85: the installed libavformat is ${2:-not found}, the worker was verified against $want (FFmpeg $(grep -v '^#' "$1" | awk -F'\t' '$1 == "libavformat" { print $3 }' | head -1)). Do not build: re-run the capture e2e series on the new version and move the pin by decision"; return 1; }
  return 0
}

# Row 61 (pair-58 F-10): EVERY proof build names itself in HELLO. The mark is put on the version when the proof-build
# seam is defined (ipc.c), so every build line of a capture-worker-<name> defines it, and the worker's own line does not.
#   proof_rule <Makefile> <source dir>
proof_rule() {
  fail=0
  builds=$(grep -c -- '-o $(BUILD)/capture-worker-[a-z]' "$1")
  marked=$(grep -- '-o $(BUILD)/capture-worker-[a-z]' "$1" | grep -c -- '-DDEMS_PROOF_MUX_EXTR[A]=')
  [ "$builds" -ge 6 ] || { echo "check.sh: F-10: $1: expected the proof builds of the worker, found $builds"; fail=1; }
  [ "$builds" = "$marked" ] || { echo "check.sh: F-10: $1: $((builds - marked)) proof build(s) do not define the proof-build seam: their HELLO would not say PROOF"; fail=1; }
  [ "$(grep -A2 '^$(BIN):' "$1" | grep -c 'DEMS_PROO[F]')" = "0" ] || { echo "check.sh: F-10: $1: the worker's own build line defines a proof switch"; fail=1; }
  # R63-06: the mark hangs on DEMS_PROOF_BUILD (ANY proof switch), not on the mux seam alone; HELLO names that macro's word.
  [ "$(grep -A1 '^#ifdef DEMS_PROOF_BUILD' "$2/ipc.c" 2>/dev/null | grep -c '^#define HELLO_WORKER_VERSION WORKER_VERSION "-PROOF"$')" = "1" ] && [ "$(grep -c 'CAPTURE_PROTOCOL_VERSION, HELLO_WORKER_VERSION);' "$2/ipc.c" 2>/dev/null)" = "1" ] || { echo "check.sh: F-10: $2/ipc.c: HELLO does not mark a proof build"; fail=1; }
  [ "$(grep -B1 'const char \*g_mux_extra = DEMS_PROOF_MUX_EXTRA;' "$2/capture_worker.c" 2>/dev/null | head -1)" = "#ifdef DEMS_PROOF_MUX_EXTRA" ] || { echo "check.sh: F-10: $2/capture_worker.c: the proof-build seam is not behind its switch"; fail=1; }
  return $fail
}

# NM-14 media fixtures (blueprint row 60; SEC35-23): the fake camera and the fake mics open no
# listener and name no wildcard address; the fake camera pushes to 127.0.0.1 and nowhere else.
# test-fixtures/negative-control/ is NOT covered: that vendored program exists to fail a check.
fixture_rules() {
  dir=$1
  fail=0
  say() { echo "check.sh: $dir: $1"; fail=1; }
  # fake_cam_sr.py: the camera with hand-written sender reports (blueprint row 62; its request of 10:14:20Z).
  count() { cat "$dir"/fake_cam.c "$dir"/fake_mic.c "$dir"/av_analyse.py "$dir"/fake_cam_sr.py 2>/dev/null | grep -c -- "$1"; }
  [ "$(count '0\.0\.0\.[0]\|INADDR_AN[Y]\|rtsp:/[/]:\|\[:[:]\]')" = "0" ] || say "SEC35-23 (fixtures): a wildcard address in a fixture"
  [ "$(count '[^a-z_]bin[d](\|[^a-z_]liste[n](\|[^a-z_]accep[t](\|"liste[n]"\|rtsp_flag[s]')" = "0" ] || say "SEC35-23 (fixtures): a media fixture opens a listener"
  [ "$(grep -c 'strncmp(url, "rtsp://127.0.0.1:", 17)' "$dir/fake_cam.c" 2>/dev/null)" = "1" ] || say "SEC35-23 (fixtures): the fake camera's loopback-only URL guard is missing"
  [ "$(grep -c 'a.url.startswith("rtsp://127.0.0.1:")' "$dir/fake_cam_sr.py" 2>/dev/null)" = "1" ] || say "SEC35-23 (fixtures): the sender-report camera's loopback-only URL guard is missing"
  return $fail
}

if [ "${1:-}" = "--selftest" ]; then
  bad=0
  work=build/selftest
  rm -rf "$work"; mkdir -p "$work/clean"
  cp src/*.c src/*.h "$work/clean/"
  # CONTROL: an untouched copy of the sources passes, so a refusal below is the planted line's doing.
  rules "$work/clean" >/dev/null 2>&1 || { echo "check.sh selftest: an untouched copy of src/ is refused"; bad=1; }
  n=0
  while IFS="$(printf '\t')" read -r tag file line; do
    case "$tag" in ''|'#'*) continue ;; esac
    n=$((n + 1))
    dir="$work/planted$n"
    mkdir -p "$dir"; cp src/*.c src/*.h "$dir/"
    printf '%s\n' "$line" >> "$dir/$file"
    out=$(rules "$dir" 2>&1)
    if [ $? -eq 0 ]; then echo "check.sh selftest: planted line $n ($tag in $file) was NOT refused: the rule cannot fail"; bad=1
    elif ! echo "$out" | grep -q ": $tag"; then echo "check.sh selftest: planted line $n was refused, but not by rule $tag: $out"; bad=1
    else echo "check.sh selftest: refused as required ($tag): $(echo "$out" | head -1 | sed "s|^check.sh: $dir: ||")"; fi
  done < test/static/planted.tsv
  [ "$n" -ge 55 ] || { echo "check.sh selftest: expected at least 55 planted lines, found $n"; bad=1; }
  # Row 61: evasions that CHANGE a pinned line instead of adding one (planted.tsv can only append).
  for mutation in 'sink.c~s/O_WRONLY | O_CREAT | O_EXCL | O_APPEND | O_CLOEXEC, 0600/part_flags, 0600/~R-6~the flags of the exclusive create moved into a variable' \
                  'sink.c~s/link(s->part, s->path)/link(s->part, other)/~R-6~the link to the final name with another target' \
                  'audio.c~s/fopen(path, "w")/fopen(path, mode)/~R-6~the mode of the manifest stream in a variable' \
                  'ingest.c~s/av_dict_set(&o, "flush_packets", "1", 0)/av_dict_set(\&o, key, "1", 0)/~F-10~a mux option key in a variable' \
                  'ingest.c~s/"protocol_whitelist", "tcp"/"protocol_whitelist", "tcp,udp"/~F-10~another value of a pinned option' \
                  'ingest.c~s/avformat_alloc_output_context2(&c->out, NULL, "mp4", NULL)/avformat_alloc_output_context2(\&c->out, NULL, "segment", NULL)/~F-10~another muxer name (review R63-08: it would open files of its own)' \
                  'sink.c~s/#ifdef DEMS_PROOF_SILENT_SYNC_FALLBACK/#ifdef DEMS_PROOF_PLANTED_SWITCH/~R63-06~a proof switch that is not in the list of worker.h' \
                  'capture_worker.c~s/^    ingest_init();$/    ingest_init(); sink_full_sync_hook = NULL;/~R63-09~the sync seam assigned in the worker' \
                  'ingest.c~s/^    if (!announce_gate_passed(&c->announce)) {$/    if (0 \&\& !announce_gate_passed(\&c->announce)) {/~BR-01~the test of the announce gate behind a constant' \
                  'ingest.c~s/^    tls_opening = NULL;$/    tls_opening = NULL; if (r >= 0 \&\& avformat_find_stream_info(c->in, NULL) >= 0) av_dump_format(c->in, 0, "", 0);/~BR-01~the stream probed before the announce gate' \
                  'ingest.c~/^    if (!announce_gate_passed(&c->announce)) {$/,/^    }$/s/^        return NULL;$/        ;/~BR-01~a refusal of the announce gate that goes on to the probe' \
                  'ingest.c~s/^#ifndef DEMS_PROOF_ANNOUNCE_UNSEEN$/#ifndef DEMS_PROOF_ANNOUNCE_UNSEEN_TOO/~BR-01~another proof switch of the announce gate' \
                  'ingest.c~s/^    c->in->interrupt_callback.opaque = c;$/    c->in->interrupt_callback.opaque = NULL;/~BR-03~an interrupt callback without its camera' \
                  'worker.h~s/^#pragma GCC poison av_log_set_level$//~BR-04~the line that makes av_log_set_level uncallable removed' \
                  'ingest.c~s/ANNOUNCE_NOT_SEEN ? "CAMERA_ANNOUNCE_NOT_SEEN" : "CAMERA_ANNOUNCE_NOT_MATCHED";/ANNOUNCE_NOT_SEEN ? "CAMERA_ANNOUNCE_NOT_MATCHED" : "CAMERA_ANNOUNCE_NOT_SEEN";/~BR-04~the two frame members of the gate swapped' \
                  'ingest.c~s/ANNOUNCE_NOT_SEEN ? "INGEST_ANNOUNCE_NOT_SEEN" : "INGEST_ANNOUNCE_NOT_MATCHED";/ANNOUNCE_NOT_SEEN ? "INGEST_ANNOUNCE_NOT_MATCHED" : "INGEST_ANNOUNCE_NOT_SEEN";/~BR-04~the two log codes of the gate swapped' \
                  'ingest.c~s/ingest_over_as(c, src, "INGEST_NO_PICTURE_SIZE", "CAMERA_NO_PICTURE", /ingest_over_as(c, src, "INGEST_NO_PICTURE_SIZE", src, /~BR-04~a frame reason taken from a variable' \
                  'audio.c~s/^    if (m->plan->gapped) return 0;$//~N3-GAP~the return of a gapped microphone in mic_take removed (its compensation and rate judgement become reachable)' \
                  'audio.c~s/^    if (m->plan->gapped) return 0;$/    if (m->plan->gapped \&\& !realtime) return 0;/~N3-GAP~the return of a gapped microphone in mic_take made conditional' \
                  'audio.c~s/^    m->taken = present;$/    m->taken = present; if (realtime < 0) goto planted;/~N3-GAP~a jump inside mic_take (a way round its return)' \
                  'audio.c~s/^    if (!plan->gapped) {$/    {/~N3-GAP~mic_open makes and switches on the resampler for a gapped microphone too' \
                  'audio.c~s/^        if (m->plan->gapped) {$/        if (0) {/~N3-GAP~mic_read sends a gapped microphone through the convert (its copy branch never taken)' \
                  'capture_worker.c~s/s->mic\[at\].gapped = !strcmp(kind->str, "PCM_FIFO_GAPPED");/s->mic[at].gapped = !strcmp(kind->str, "PCM_FIFO");/~N3-GAP~the plan reader sets the flag from another word'; do
    file=${mutation%%~*}; rest=${mutation#*~}; script=${rest%%~*}; rest=${rest#*~}; tag=${rest%%~*}; what=${rest#*~}
    n=$((n + 1)); dir="$work/mutated$n"; mkdir -p "$dir"; cp src/*.c src/*.h "$dir/"
    sed "$script" "src/$file" > "$dir/$file"
    if cmp -s "src/$file" "$dir/$file"; then echo "check.sh selftest: the mutation '$what' changed nothing in $file: the control is stale"; bad=1; continue; fi
    out=$(rules "$dir" 2>&1)
    if [ $? -eq 0 ]; then echo "check.sh selftest: mutation ($what) was NOT refused: the rule cannot fail"; bad=1
    elif ! echo "$out" | grep -q ": $tag: "; then echo "check.sh selftest: mutation ($what) was refused, but not by rule $tag: $out"; bad=1
    else echo "check.sh selftest: refused as required ($tag): $what"; fi
  done
  # The pattern in a COMMENT neither satisfies nor breaks the pinned-call rule: a copy with one comment line more passes it.
  mkdir -p "$work/comment"; cp src/*.c src/*.h "$work/comment/"
  printf '%s\n' '/* open(p, O_WRONLY | O_TRUNC); creat(p, 0600); "use_" "editlist" */' >> "$work/comment/ingest.c"
  python3 test/static/pinned_calls.py "$work/comment" test/static/pinned-calls.tsv >/dev/null 2>&1 && echo "check.sh selftest: accepted as required (R-6): the forbidden texts inside a comment are not code" || { echo "check.sh selftest: a comment was read as code by the pinned-call rule"; bad=1; }
  # Row 61 (D85): the version pin refuses another libavformat and a missing one, and accepts the pinned one.
  pinned_version=$(grep -v '^#' test/static/libavformat.pin | awk -F'\t' '$1 == "libavformat" { print $2 }' | head -1)
  version_rule test/static/libavformat.pin "$pinned_version" >/dev/null 2>&1 || { echo "check.sh selftest: the pinned libavformat version is refused"; bad=1; }
  for other in '62.3.100' '63.1.103' ''; do
    version_rule test/static/libavformat.pin "$other" >/dev/null 2>&1 && { echo "check.sh selftest: libavformat '$other' was NOT refused: the version pin cannot fail"; bad=1; } || echo "check.sh selftest: refused as required (D85): libavformat '${other:-not installed}'"
  done
  # Row 61 (F-10): a proof build without the seam, and a HELLO without the mark, are refused.
  proof_rule Makefile src >/dev/null 2>&1 || { echo "check.sh selftest: the untouched Makefile is refused by the proof-build rule"; bad=1; }
  mkdir -p "$work/proof"; cp src/*.c src/*.h "$work/proof/"
  sed "s/-DDEMS_PROOF_MUX_EXTRA='\"\"' -DMIC_MAX_PPM=0/-DMIC_MAX_PPM=0/" Makefile > "$work/proof/Makefile"
  proof_rule "$work/proof/Makefile" "$work/proof" 2>&1 | grep -q 'do not define the proof-build seam' && echo "check.sh selftest: refused as required (F-10): a proof build whose HELLO would not say PROOF" || { echo "check.sh selftest: a proof build without the seam was NOT refused"; bad=1; }
  sed 's/^#define HELLO_WORKER_VERSION WORKER_VERSION "-PROOF"$/#define HELLO_WORKER_VERSION WORKER_VERSION/' src/ipc.c > "$work/proof/ipc.c"
  proof_rule Makefile "$work/proof" 2>&1 | grep -q 'HELLO does not mark a proof build' && echo "check.sh selftest: refused as required (F-10): a HELLO without the proof mark" || { echo "check.sh selftest: a HELLO without the proof mark was NOT refused"; bad=1; }
  # Fix pass F-M3 (review R63-08): THE IMPORT NET on real binaries. A program that reaches creat() through an assembler
  # label (no rule that reads C sees a call of creat) is refused by what it IMPORTS; its control imports only pinned names.
  # Task 4 row 193 (finding L-2 of row 78): the label is the name creat() has FOR THE LINKER of this platform - the
  # compiler's own prefix of a C name (`_` in a Mach-O object, none in an ELF one) and then the name; the reader of
  # the import net names a function under each spelling of the two object formats (its own check, silent when it holds).
  python3 test/static/pinned_calls.py --reader-selftest >/dev/null 2>&1 || { echo "check.sh selftest: the reader of the import net does not name a function under every spelling of the two object formats: $(python3 test/static/pinned_calls.py --reader-selftest 2>&1 | head -1)"; bad=1; }
  if command -v "${CC:-clang}" >/dev/null 2>&1; then
    mkdir -p "$work/imports"
    printf '%s\n' '#include <fcntl.h>' '#include <unistd.h>' '#define LABEL_TEXT(prefix) #prefix "creat"' '#define LABEL(prefix) LABEL_TEXT(prefix)' 'static int quiet(const char *, int) __asm__(LABEL(__USER_LABEL_PREFIX__));' 'int main(void) { int fd = quiet("/nonexistent/x", 0600); if (fd >= 0) close(fd); return unlink("/nonexistent/x") != 0; }' > "$work/imports/label.c"
    printf '%s\n' '#include <fcntl.h>' '#include <stdio.h>' '#include <unistd.h>' 'int main(void) { int fd = open("/nonexistent/x", O_RDONLY); FILE *f = fopen("/nonexistent/y", "r"); if (fd >= 0) close(fd); if (f) fclose(f); return (ftruncate(-1, 0) != 0) + (rename("/nonexistent/a", "/nonexistent/b") != 0) + (link("/nonexistent/a", "/nonexistent/b") != 0) + (unlink("/nonexistent/x") != 0) == 0; }' > "$work/imports/control.c"
    if "${CC:-clang}" -o "$work/imports/label" "$work/imports/label.c" 2>/dev/null && "${CC:-clang}" -o "$work/imports/control" "$work/imports/control.c" 2>/dev/null; then
      python3 test/static/pinned_calls.py --imports "$work/imports/control" test/static/imports.pin >/dev/null 2>&1 || { echo "check.sh selftest: a program that imports exactly the pinned functions is refused by the import net"; bad=1; }
      python3 test/static/pinned_calls.py --imports "$work/imports/label" test/static/imports.pin 2>&1 | grep -q 'imports creat, which is not a pinned' && echo "check.sh selftest: refused as required (R-6, import net): creat() reached through an assembler label" || { echo "check.sh selftest: creat() through an assembler label was NOT refused by the import net"; bad=1; }
    else echo "check.sh selftest: the two programs of the import-net check did not compile"; bad=1; fi
  else echo "check.sh selftest: no C compiler for the import-net check"; bad=1; fi
  # The fixture rules, the same way: an untouched copy passes, each planted line is refused.
  mkdir -p "$work/fix0"; cp test-fixtures/fake_cam.c test-fixtures/fake_mic.c test-fixtures/av_analyse.py test-fixtures/fake_cam_sr.py "$work/fix0/"
  fixture_rules "$work/fix0" >/dev/null 2>&1 || { echo "check.sh selftest: an untouched copy of the fixtures is refused"; bad=1; }
  m=0
  for planted in 'fake_cam.c|static const char *planted = "rtsp://0.0.0.0:8555/cam";|a wildcard address' \
                 'fake_mic.c|static int planted(int s) { return listen(s, 1); }|opens a listener' \
                 'fake_cam.c|static void planted(AVDictionary **o) { av_dict_set(o, "rtsp_flags", "listen", 0); }|opens a listener' \
                 'av_analyse.py|PLANTED = "0.0.0.0"|a wildcard address' \
                 'fake_cam_sr.py|PLANTED = "rtsp://0.0.0.0:8555/cam"|a wildcard address'; do
    m=$((m + 1))
    file=${planted%%|*}; rest=${planted#*|}; line=${rest%|*}; want=${rest##*|}
    dir="$work/fix$m"; mkdir -p "$dir"; cp "$work/fix0"/* "$dir/"
    printf '%s\n' "$line" >> "$dir/$file"
    out=$(fixture_rules "$dir" 2>&1)
    if [ $? -eq 0 ]; then echo "check.sh selftest: planted fixture line $m ($file) was NOT refused: the rule cannot fail"; bad=1
    elif ! echo "$out" | grep -q "$want"; then echo "check.sh selftest: planted fixture line $m was refused, but not by its rule: $out"; bad=1
    else echo "check.sh selftest: refused as required (fixtures): $(echo "$out" | head -1 | sed "s|^check.sh: $dir: ||")"; fi
  done
  # The guard itself: a fake camera without its loopback-only check is refused.
  mkdir -p "$work/fixg"; cp "$work/fix0"/* "$work/fixg/"; sed 's/strncmp(url, "rtsp:\/\/127.0.0.1:", 17)/0/' "$work/fix0/fake_cam.c" > "$work/fixg/fake_cam.c"
  fixture_rules "$work/fixg" 2>&1 | grep -q "URL guard is missing" && echo "check.sh selftest: refused as required (fixtures): the fake camera without its loopback-only URL guard" || { echo "check.sh selftest: a fake camera without its URL guard was NOT refused"; bad=1; }
  rm -rf "$work"
  exit $bad
fi

[ $# -eq 1 ] || { echo "usage: sh check.sh <source dir> | --selftest"; exit 2; }
rules "$1" || exit 1
# The negative control of the AV checks: exactly one line of the Makefile names a forbidden option.
n=$(grep -c 'use_editlis[t]\|negative_cts_offset[s]\|avoid_negative_t[s]' Makefile)
[ "$n" = "1" ] || { echo "check.sh: Makefile: expected exactly 1 line with a forbidden mux option (the proof build), found $n"; exit 1; }
grep -q 'DEMS_PROOF_MUX_EXTRA=.*use_editlis[t]=1.*capture-worker-negctl' Makefile || { echo "check.sh: Makefile: the forbidden option is not on the line of the negative-control build"; exit 1; }
fixture_rules test-fixtures || exit 1
proof_rule Makefile "$1" || exit 1
version_rule test/static/libavformat.pin "$(${PKG_CONFIG:-pkg-config} --modversion libavformat 2>/dev/null)" || exit 1
echo "check.sh: $1: static rules OK (AU2-07, N-10, C.4 forbidden options, W1-C1, SR-3 mux options, H-4/D61 one encoder per file, W-1, W-4, B.2, D58-1/2 exclusive create, D59-2 sync, D59-3 one truncation, D59-4 fault seam, F-2, BR-01 one open + one probe + the announce gate between them and no switch around it, BR-03 per-camera interrupt, BR-04 no av_log_set_level + the words of a refusal fixed (each code and frame member a literal of one line, no frame reason from a text), R-6 pinned file calls + no digraph / assembler name, F-10 pinned mux calls + one muxer name + proof builds marked, R63-06 every proof switch marks, R63-09 sync seam, N3-GAP the gapped kind: one place sets it, a closed set reads it, no resampler call reachable for it, D85 libavformat $(${PKG_CONFIG:-pkg-config} --modversion libavformat); fixtures: SEC35-23)"
