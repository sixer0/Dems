#!/usr/bin/env python3
"""Compact text summary of the official row-58 runs (.cache/m3worker/official/*.out) for the implementation note."""
import json, os, sys, glob
D = '.cache/m3worker/official'
def load(n):
    p = os.path.join(D, n + '.out')
    if not os.path.exists(p): return None
    t = open(p).read()
    for key in ('{\n "check"', '{'):
        if key in t:
            try: return json.loads(t[t.index(key):])
            except Exception: pass
    return {'verdict': 'NO-JSON', 'tail': t[-400:]}
def av(r, key='av_offsets'):
    return '; '.join('%s mean %s err %s %s' % (k, v.get('mean_offset_ms'), v.get('max_abs_error_vs_truth_ms'), v.get('regression_bound_2ms')) + (' slope %s ppm' % v['fitted_slope_ppm'] if v.get('inject_drift_ppm') else '') for k, v in (r.get(key) or {}).items())
out = []
hello, hb, ack, stop, sw, tel = [], [], [], [], [], []
for n in sorted(os.path.basename(p)[:-4] for p in glob.glob(D + '/*.out')):
    r = load(n)
    line = '%-28s %-5s %s' % (n, r.get('verdict'), r.get('negative_control', ''))
    i = r.get('info') or {}
    if i.get('hello_ms') is not None: hello.append(i['hello_ms'])
    if i.get('start_ack_ms') is not None: ack.append(i['start_ack_ms'])
    if i.get('stop_to_exit_ms') is not None and (i.get('rc') or {}).get('worker') == 0: stop.append(i['stop_to_exit_ms'])
    if (i.get('heartbeats') or {}).get('interval_ms_min_median_max'): hb.append(i['heartbeats']['interval_ms_min_median_max'])
    if (i.get('telemetry') or {}).get('rate_hz'): tel.append(i['telemetry']['rate_hz'])
    for m in i.get('switch_ack_ms', []): sw.append(m[2])
    for t in r.get('timing', []):
        if t.get('helloMs') is not None: hello.append(t['helloMs'])
        if t.get('heartbeatIntervalMs'): hb.append([t['heartbeatIntervalMs']['min'], t['heartbeatIntervalMs']['median'], t['heartbeatIntervalMs']['max']])
        if t.get('stopToExitMs') is not None: stop.append(t['stopToExitMs'])
    extra = []
    if r.get('files'): extra.append('files ' + ', '.join('%s %dB v%d a%d %s' % (k, v['bytes'], v['decoded_frames'].get('video', 0), v['decoded_frames'].get('audio', 0), 'playable' if v['playable'] else 'NOT-playable') for k, v in r['files'].items()))
    if r.get('growth'): extra.append('growth distinct sizes %s over %s samples' % (r['growth'].get('distinct_sizes_per_file'), r['growth'].get('samples_with_both_files')))
    h = r.get('h4_one_encoder_both_files') or r.get('h4')
    if h: extra.append('H-4 packets %s differing %s vs-encoder %s distinct %s' % (h['audio_packets'], h['packets_differing_between_files'], h['payload_mismatches_vs_encoder'], h['distinct_payloads_in_file1']))
    if r.get('av_offsets'): extra.append('AV ' + av(r))
    if r.get('t0'): extra.append('T0 error %d us' % r['t0']['t0_error_us'])
    if r.get('tap'): extra.append('tap samples %s decoded-minus-tap %s' % (r['tap']['samples'], r['tap']['decoded_minus_tap']))
    if r.get('first_video_sample_records'): extra.append('first-video records %s file-first-packets %s' % (r['first_video_sample_records'], {k: v[0] for k, v in (r.get('first_video_packets') or {}).items()}))
    if r.get('after_camera2_ended'): extra.append('after cam2 ended: %s samples, %s distinct sizes; audio-only fragments %s longest %s s' % (r['after_camera2_ended']['samples'], r['after_camera2_ended']['distinct_sizes'], r['fragments_file2']['audio_only_fragments'], r['fragments_file2']['longest_audio_only_run_s']))
    if 'worker_rc' in r and 'mode' in r: extra.append('mode %s worker rc %s crash %s start_ack %s sha %s' % (r['mode'], r['worker_rc'], [(c['code'], c['exitCode']) for c in r.get('crash', [])], (i.get('start_ack') or {}).get('code'), (r.get('planted_file_sha256_before_after') or r.get('existing_file_sha256_before_after') or [''])[-1][:12]))
    if 'udp_sockets' in r: extra.append('snapshots %s udp %s not-loopback %s seen %s udp-client rc %s refusal %s cam2 playable %s' % (r.get('snapshots'), [' '.join(x.split()[-2:]) for x in r['udp_sockets']], len(r['sockets_not_on_loopback']), r['sockets_seen'], r.get('udp_client_rc'), r.get('refusal_logged'), (r.get('camera2_playable') or {}).get('playable')))
    if r.get('hello') and 'heartbeats_in_1_2_s_at_100ms' in r: extra.append('hello %s heartbeats@100ms %s refused plans %s second START %s violations %s eof-exit %s sigterm-exit %s' % (r['hello'], r['heartbeats_in_1_2_s_at_100ms'], r['refused_plans'], r['start'][1].get('code'), r['protocol_violations'], r['exit_after_input_ended'], r['exit_after_sigterm']))
    for key in ('session1_killed_after_durable_record',):
        s = r.get(key)
        if s:
            st = s['status_after_kill']
            extra.append('s1 killed after durable: phase %s durable %s attempt %s pid %s; down %s; sizes before/3s-after %s/%s' % (st['phase'], st['durable'], st['attempt'], st['workerPid'], r.get('session1_worker_down'), s['sizes_before_kill'], s['sizes_3s_after_kill']))
            extra.append('s1 files ' + ', '.join('%s %dB moof %d %s' % (k, v['bytes'], v['top_level'].get('moof', 0), 'playable' if v['playable'] else 'NOT') for k, v in r['session1_files'].items()))
            extra.append('s2 next session: pid %s vs %s; ' % (r['session2_next_session']['worker_pid'], s['worker_pid']) + ', '.join('%s %dB %s' % (k, v['bytes'], 'playable' if v['playable'] else 'NOT') for k, v in r['session2_files'].items()) + '; AV ' + av(r, 'session2_av_offsets'))
    if r.get('worker_down') is not None: extra.append('down %s attempt after kill %s pids %s->%s' % (r['worker_down'], (r.get('session') or {}).get('attempt_after_kill'), (r.get('session') or {}).get('worker_pid'), (r.get('session') or {}).get('respawned_pid')))
    if r.get('records') and isinstance(r['records'][0], list): extra.append('records %s' % r['records'])
    if n.startswith('p4_shape'):
        for k in ('VIDEO-01', 'VIDEO-02'):
            v = r[k]; extra.append('%s head %s init %dB frags %d elst %d mfra %d tiles %s ends-on-boundary %s running-hash-mismatch %d final==whole %s tail-cut: boxwalk-ok %s ffprobe rc %s decoder rc %s first-video %s' % (k, v['top_level_sequence_head'][:4], v['init_bytes'], v['fragments'], v['edit_list_boxes'], v['mfra'], v['tiles_exactly'], v['ends_on_fragment_boundary'], v['running_hash_mismatches'], v['running_hash_final_equals_whole_file'], v['tail_cut']['box_walk_tiles_exactly'], v['tail_cut']['ffprobe_rc'], v['tail_cut']['decoder_rc'], v['first_video_packets_pts_dts_duration'][0]))
        extra.append('sizes during session %s' % r['sizes_during_session'])
    if 'mic_summary' in r: extra.append('mic %s; silent seconds %s; rms in gap %s after return %s; frames with PRIMARY null %s; bound %s ms' % (r['mic_summary'], r.get('silent_seconds'), r.get('rms_in_gap'), r.get('rms_after_return'), r.get('telemetry_frames_with_primary_null'), r.get('bound_ms')))
    if 'files_exist' in r: extra.append('worker rc %s crash %s files exist %s .part %s seconds %s status %s down %s warnings %s' % (r.get('worker_rc'), [(c['code'], c['exitCode']) for c in r.get('crash', [])], r['files_exist'], r.get('part_files'), r.get('seconds_from_start_to_exit') or r.get('seconds_to_faulted'), r.get('status'), r.get('worker_down'), [(w['code'], w['subject']) if isinstance(w, dict) else w[1:] for w in r.get('warnings', [])]))
    if 'log_bytes' in r: extra.append('unrecognised refusal: worker rc %s crash %s log %s bytes / %s lines, %s lines suppressed; camera 2 %s' % (r.get('worker_rc'), [(c['code'], c['exitCode']) for c in r.get('crash', [])], r['log_bytes'], r['log_lines'], r['log_suppressed_lines'], (r.get('camera2_playable') or {}).get('decoded_frames')))
    lo = r.get('leftovers') or i.get('leftovers')
    if lo is not None: extra.append('leftovers %s' % ('none' if not lo['processes'] and not lo['listeners'] else lo))
    out.append(line + ''.join('\n      ' + e for e in extra))
print('\n'.join(out))
rng = lambda xs: '%s .. %s (n=%d)' % (min(xs), max(xs), len(xs)) if xs else 'n/a'
print('\nMEASURED TIMING (all official runs)')
print('  HELLO after spawn, ms            ', rng(hello), sorted(hello))
print('  START acknowledged, ms           ', rng(ack))
print('  heartbeat interval min, ms       ', rng([h[0] for h in hb]))
print('  heartbeat interval median, ms    ', rng([h[1] for h in hb]))
print('  heartbeat interval max, ms       ', rng([h[2] for h in hb]))
print('  switch acknowledged, ms          ', rng(sw))
print('  STOP to exit, ms                 ', rng(stop))
print('  telemetry rate, Hz               ', rng(tel))
