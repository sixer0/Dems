#!/bin/sh
# NEGATIVE CONTROLS OF THE FUZZ BUILD (task 4 row 186; review verification/06_security_relay_client.md, H-1).
# "The fuzz run found nothing" is evidence only if the fuzz build finds what it is for. So: copies of the
# relay's sources with ONE bound removed each (sed on a copy under build/; src/relay/ is never touched), the
# fuzz driver built against the copy with AddressSanitizer and UndefinedBehaviorSanitizer, run with the seed of
# the Makefile for at most SECONDS per control. Every control MUST be found; one that is not shows a reader the
# fuzz build does not reach, and fails this script. A control whose sed changes nothing is stale and fails too.
#
#   sh test/relay_fuzz_controls.sh [SECONDS]      from apps/capture-worker (make relay-fuzz-controls); default 20
#
# Not part of `make`: 24 builds and up to 24 runs (about 3 minutes; 16 of row 186, 6 of row 42, 2 of row 143b). Run it after a change to a reader of
# camera bytes or to test/relay_fuzz.c.
set -u
LIMIT=${1:-20}
PKG=${PKG_CONFIG:-pkg-config}
FLAGS="-std=c11 -D_DEFAULT_SOURCE -g -Wall -Wextra -Werror -DRELAY_TEST_HOOKS $($PKG --cflags libavformat libavcodec libavutil) -O1 -fsanitize=address,undefined -fno-sanitize-recover=all -fno-omit-frame-pointer"
work=build/relay-fuzz-control
found=0; total=0; bad=0
run() {
  name=$1; file=$2; script=$3; entry=$4
  total=$((total + 1))
  rm -rf "$work"; mkdir -p "$work/src/relay" "$work/test" "$work/build"
  cp src/relay/*.c src/relay/*.h "$work/src/relay/"; cp test/relay_fuzz.c "$work/test/"
  sed "$script" "src/relay/$file" > "$work/src/relay/$file"
  if cmp -s "src/relay/$file" "$work/src/relay/$file"; then echo "relay_fuzz control $name: the mutation changed nothing: the control is stale"; bad=1; return; fi
  ( cd "$work" && ${CC:-clang} $FLAGS -o fuzz test/relay_fuzz.c src/relay/relay_core.c src/relay/relay_rtsp.c $($PKG --libs libavutil) ) || { echo "relay_fuzz control $name: did not compile"; bad=1; return; }
  { ( cd "$work" && ./fuzz --seconds "$LIMIT" --seed 186 --entry "$entry" > out 2>&1 ); rc=$?; } 2>/dev/null
  why=$(grep -m1 -o 'ERROR: AddressSanitizer: [a-z-]*\|runtime error: [a-z ]*[a-z]\|A BOUND OF relay.h IS BROKEN: .*' "$work/out" | head -1)
  it=$(grep -m1 -o 'iteration [0-9]*' "$work/out" | head -1)
  if [ $rc -ne 0 ] && [ -n "$why" ]; then found=$((found + 1)); echo "relay_fuzz control $name: found by entry '$entry' at $it: $why"
  else bad=1; echo "relay_fuzz control $name: NOT FOUND by entry '$entry' in ${LIMIT} s: $(tail -1 "$work/out")"; fi
}
# pictures out of RTP
run aggregate_size_not_held_to_the_packet relay_core.c 's/if (!one || one > n) { p->damaged = 1; return 0; }/if (!one) { p->damaged = 1; return 0; }/' rtp
run aggregate_size_not_held_to_the_packet__through_the_camera_leg relay_core.c 's/if (!one || one > n) { p->damaged = 1; return 0; }/if (!one) { p->damaged = 1; return 0; }/' client
run extension_header_not_held_to_the_packet relay_core.c 's/if (at + 4 > n) return -(int)RELAY_STREAM_INVALID;//' rtp
run padding_count_not_held_to_the_packet relay_core.c 's/if (n <= at || !k\[n - 1\] || k\[n - 1\] > n - at) return/if (n <= at || !k[n - 1]) return/' rtp
run start_code_inside_a_unit_handed_on relay_core.c 's/if (codes == p->units) return 1;/if (codes) return 1;/' rtp
run fragment_type_that_is_no_unit_handed_on relay_core.c 's/            if (!unit_type(p->codec, inner)) return refuse(p);//' rtp
# the Digest challenge
run challenge_field_without_its_bound relay_core.c 's/if ((unsigned char)\*v < 0x20 || \*v == 0x7F || m >= RELAY_FIELD_CHARS) return -1;/if ((unsigned char)*v < 0x20 || *v == 0x7F) return -1;/' challenge
run challenge_field_without_its_bound__through_a_head relay_core.c 's/if ((unsigned char)\*v < 0x20 || \*v == 0x7F || m >= RELAY_FIELD_CHARS) return -1;/if ((unsigned char)*v < 0x20 || *v == 0x7F) return -1;/' head
# answer heads and the framing
run session_identifier_without_its_bound relay_core.c 's/if (!k || k > RELAY_SESSION_CHARS) return -1;/if (!k) return -1;/' head
run session_identifier_without_its_bound__through_the_camera_leg relay_core.c 's/if (!k || k > RELAY_SESSION_CHARS) return -1;/if (!k) return -1;/' client
run frame_taken_before_it_arrived__through_the_camera_leg relay_core.c 's/return have >= out->total ? RELAY_FRONT_FRAME : RELAY_FRONT_MORE;/return RELAY_FRONT_FRAME;/' client
run body_length_without_its_bound__through_the_camera_leg relay_core.c 's/if (body < 0 || body > RELAY_SDP_MAX) return -1;/if (body < 0) return -1;/' client
run receive_buffer_read_past_its_index relay_rtsp.c 's/\*packet = c->buffer + c->at + 4;/*packet = c->buffer + c->at + 4 - c->at;/' client
# the stream description
run control_value_without_its_bound relay_core.c 's/if (c > RELAY_LOCATOR_CHARS) return RELAY_DESCRIPTION_INVALID;//' description
run base64_text_without_its_bound relay_core.c 's/if (n >= sizeof copy) return -1;//' description
# the start message (the Core's)
run start_message_string_without_its_bound relay_core.c 's/        if (n + 1 >= cap) return -1;$//' start
# row 42: the attempt of the start message, the stated rate of a description, the report lines
run attempt_without_its_digit_bound relay_core.c 's/        if (++digits > 9) return -1;/        if (++digits > 99) return -1;/' start
run stated_rate_without_its_digit_bound relay_core.c 's/if (++digits > 4) return -1; whole/whole/' description
run stated_rate_without_its_range relay_core.c 's/return milli >= 1 \&\& milli <= RELAY_RATE_MILLI_MAX ? milli : -1;/return milli;/' description
run report_hex_not_held_to_its_room relay_core.c 's/ || o->n + 2 \* (size_t)length >= o->cap//' report
run report_word_not_held_to_its_room relay_core.c 's/if (o->bad || o->n + k >= o->cap) { o->bad = 1; return; }/if (o->bad) return;/' report
run probe_line_of_sets_that_are_not_valid relay_core.c 's/ || !relay_sets_valid(probe->codec, probe->sets)) o.bad = 1;/) o.bad = 1;/' report
# row 143b: the source address of the start message - its range, and record mode without one
run source_address_without_its_range relay_core.c 's/    return first >= 1 && first <= 223 && inet_pton(AF_INET, s, &address) == 1;/    return first >= 0 \&\& first <= 255 \&\& inet_pton(AF_INET, s, \&address) == 1;/' start
run record_mode_without_a_source_address relay_core.c 's/    if (out->mode == RELAY_MODE_RECORD && !with_source) goto refused;//' start
rm -rf "$work"
echo "relay_fuzz controls: $found of $total planted flaws found by the fuzz build (seed 186, at most $LIMIT s each)"
[ $bad -eq 0 ] && [ $found -eq $total ]
