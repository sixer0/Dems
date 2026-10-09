#!/bin/sh
# Static rules of the capture worker's C sources (blueprint rows 58 and 59; checks M3-SR-2 (row 58
# part) and M3-SR-3 (worker part); capture spec C.2, C.4, C.5, E, A.2; errata AU2-07, PE-111-02,
# PE-111-03; register W1-C1).
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
  [ "$(count 'DEMS_PROOF_KEEP_TORN_TAI[L]')" = "1" ] && [ "$(files 'DEMS_PROOF_KEEP_TORN_TAI[L]')" = "sink.c" ] || say "D59-4: the no-truncation control is named outside its one place in sink.c"
  # M3-SR-3 (worker part): the options set on an input or an output context are the decided ones.
  # The muxer gets movflags (the four pinned flags), flush_packets and min_frag_duration, nothing else.
  opts=$(cat "$dir"/*.c 2>/dev/null | grep -o 'av_dict_set\(_int\)\{0,1\}(&o, "[a-z_]*"' | sed 's/.*"\(.*\)"/\1/' | sort -u | tr '\n' ' ' | sed 's/ $//')
  [ "$opts" = "flush_packets listen_timeout min_frag_duration movflags protocol_whitelist rtsp_flags" ] || say "SR-3: the options the worker sets are not the decided set: $opts"
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
  [ "$n" -ge 23 ] || { echo "check.sh selftest: expected at least 23 planted lines, found $n"; bad=1; }
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
echo "check.sh: $1: static rules OK (AU2-07, N-10, C.4 forbidden options, W1-C1, SR-3 mux options, H-4 one encoder, W-1, W-4, B.2, D58-1/2 exclusive create, D59-2 sync, D59-3 one truncation, D59-4 fault seam, F-2; fixtures: SEC35-23)"
