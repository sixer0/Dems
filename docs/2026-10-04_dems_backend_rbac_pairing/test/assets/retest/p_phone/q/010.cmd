mark p1r3
p tap 324 2283
sleep 2000
p screen session-detail
p shot 17_p1_r3_0_sessions_tab_again
p tapid session-detail-back
sleep 1800
p screen sessions
p ids session-row-SES
p tap 540 866
sleep 2500
p screen session-detail
p shot 18_p1_r3_a_session_detail
p ids ^screen-
p tap 540 2283
sleep 1200
p screen evidence
p shot 19_p1_r3_b_evidence_t1
sleep 1800
p shot 19_p1_r3_b_evidence_t3
p tap 756 2283
sleep 1200
p screen devices
p shot 20_p1_r3_c_devices_t1
sleep 1800
p shot 20_p1_r3_c_devices_t3
p tap 972 2283
sleep 2000
p screen more
p shot 21_p1_r3_d_more
p warnlog
serverlog p1r3
