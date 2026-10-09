#!/bin/zsh
# Official 2-run series of blueprint row 58 (parts P3, P4, P6). Run from the repository root, sandbox off.
# Each line: check, run number, exit code of the harness (0 = the check gave the expected verdict).
H() { python3 apps/capture-worker/test/m3worker.py "$@" }
O=.cache/m3worker/official; rm -rf $O; mkdir -p $O
make -C apps/capture-worker unit 2>&1 | grep -E 'anchor_test|sink_kill_test' | cut -c1-260
one() { name=$1; shift; H "$@" > $O/$name.out 2>&1; echo "$name rc=$?" }
for r in 1 2; do
  one proto_r$r proto off_proto_r$r
  one wi1_zero_r$r session off_wi1_zero_r$r --case zero --switch --tap
  one wi1_pm80_r$r session off_wi1_pm80_r$r --case pm80
  one wi1_drift_r$r session off_wi1_drift_r$r --case drift
  one wi1_camstop_r$r camstop off_wi1_camstop_r$r
  one wi1_fatal_rmdir_r$r fatal off_wi1_fatal_rmdir_r$r --mode rmdir
  one optc_planted_r$r fatal off_optc_planted_r$r --mode planted
  one optc_exists_r$r fatal off_optc_exists_r$r --mode exists
  one bind_udp_r$r udp off_bind_udp_r$r
  one sup_run_r$r sup off_sup_run_r$r --mode run --case pm80
  one kc1_r$r sup off_kc1_r$r --mode kc1
  one kc3_r$r sup off_kc3_r$r --mode kc3
  one mic_slow_r$r mic off_mic_slow_r$r --mode slow
  one mic_gap_r$r mic off_mic_gap_r$r --mode gap
  one nocam_none_r$r nocam off_nocam_none_r$r --mode none
  one nocam_one_r$r nocam off_nocam_one_r$r --mode one
  one sup_nocam_r$r sup off_sup_nocam_r$r --mode nocam
  one f2_norefusal_r$r udp off_f2_norefusal_r$r --variant norefusal
done
echo "--- negative controls (each must FAIL; rc 0 = failed as required)"
one neg_h4_reencoded h4neg off_wi1_zero_r1
one neg_av_forbidden_option session off_neg_av --case pm80 --variant negctl --expect-fail
one neg_bind_skeleton udp off_neg_bind --variant skeleton --expect-fail
one neg_fatal_clean_control fatal off_neg_clean --mode clean
one neg_sup_forbidden_option sup off_neg_sup --mode run --case pm80 --variant negctl --expect-fail
one neg_mic_no_compensation mic off_neg_mic --mode slow --variant nocomp --expect-fail
one neg_kc3_no_restart_allowed sup off_neg_kc3 --mode kc3 --limits '{"maxRestarts":0}' --expect-fail
echo "--- P4 evaluation"
one p4_delay_pm80 session off_p4_delay_pm80 --case pm80 --variant delaymoov
one p4_shape_pinned shape off_wi1_pm80_r1
one p4_shape_delay shape off_p4_delay_pm80
one p4_stall_pinned session off_p4_stall_pinned --case pm80 --stall
one p4_stall_delay session off_p4_stall_delay --case pm80 --stall --variant delaymoov --expect-fail
echo "--- leftovers"
ps -axo pid=,args= | grep -E "build/(capture-worker|fake_cam|fake_mic)|capture-session-driver" | grep -v grep ; lsof -nP -iTCP -sTCP:LISTEN | grep -E ":85(55|57|59|6[0-4]) " ; echo "(end)"
