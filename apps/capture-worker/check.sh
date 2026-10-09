#!/bin/sh
# Static rules of the capture worker's C sources (blueprint row 58; check M3-SR-2, row 58 part;
# capture spec C.4, E, A.2; errata AU2-07, PE-111-02, PE-111-03; register W1-C1).
#
#   sh check.sh <source dir>     the rules over one directory of sources; exit 0 only if all hold
#   sh check.sh --selftest       the rules over copies of src/ with ONE planted line each
#                                (test/static/planted.tsv): every copy MUST be refused, by its rule
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

  # AU2-07: one call site of the graph command, in the unit of the filtering thread, behind the thread guard.
  [ "$(count 'avfilter_graph_send_comman[d](')" = "1" ] || say "AU2-07: expected exactly 1 call site of the graph command, found $(count 'avfilter_graph_send_comman[d](')"
  [ "$(files 'avfilter_graph_send_comman[d](')" = "audio.c" ] || say "AU2-07: the graph command is called outside audio.c: $(files 'avfilter_graph_send_comman[d](')"
  grep -q 'pthread_equal(pthread_self(), filter_tid)' "$dir/audio.c" 2>/dev/null || say "AU2-07: the filtering-thread guard is missing"
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
  [ "$(count '#define DEMS_MOVFLAGS "+frag_keyframe+empty_moov+default_base_moof+skip_trailer"')" = "1" ] || say "C.4: the default movflags are not the decided set"
  [ "$(count '"flush_packets", "1"')" = "1" ] || say "C.2 (W-2): flush_packets=1 is not set on the output"

  # H-4: ONE audio encoder. One place finds it, one place opens a codec.
  [ "$(count 'avcodec_find_encoder')" = "1" ] || say "H-4: expected exactly 1 encoder lookup, found $(count 'avcodec_find_encoder')"
  [ "$(count 'avcodec_open2(')" = "1" ] || say "H-4: expected exactly 1 codec open, found $(count 'avcodec_open2(')"

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
  # F-2: the refusal of a non-TCP transport reads no message text of the library.
  [ "$(count 'not on whitelis[t]')" = "0" ] || say "F-2: the worker keys on a message text of libavformat"

  # W-4: nothing ends the process with a success code but main's return, and nothing is printed to
  # standard output but frames (one writer, in ipc.c).
  [ "$(count '[^_a-z]exit(0)\|EXIT_SUCCES[S]')" = "0" ] || say "W-4: an exit with a success code outside main's return"
  [ "$(files 'STDOUT_FILENO')" = "ipc.c" ] || say "B.2: standard output is written outside ipc.c: $(files 'STDOUT_FILENO')"
  [ "$(count '[^fnsv]printf(\|puts(\|putchar(\|fputs(\|stdou[t]')" = "0" ] || say "B.2: a print to standard output (only frames go there)"
  [ "$(count 'geten[v](')" = "0" ] || say "B.2: the worker reads no environment variable"
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
  [ "$n" -ge 18 ] || { echo "check.sh selftest: expected at least 18 planted lines, found $n"; bad=1; }
  rm -rf "$work"
  exit $bad
fi

[ $# -eq 1 ] || { echo "usage: sh check.sh <source dir> | --selftest"; exit 2; }
rules "$1" || exit 1
# The negative control of the AV checks: exactly one line of the Makefile names a forbidden option.
n=$(grep -c 'use_editlis[t]\|negative_cts_offset[s]\|avoid_negative_t[s]' Makefile)
[ "$n" = "1" ] || { echo "check.sh: Makefile: expected exactly 1 line with a forbidden mux option (the proof build), found $n"; exit 1; }
grep -q 'DEMS_PROOF_MUX_EXTRA=.*use_editlis[t]=1.*capture-worker-negctl' Makefile || { echo "check.sh: Makefile: the forbidden option is not on the line of the negative-control build"; exit 1; }
echo "check.sh: $1: static rules OK (AU2-07, N-10, C.4 forbidden options, W1-C1, H-4 one encoder, W-1, W-4, B.2, D58-1/2 exclusive create, F-2)"
