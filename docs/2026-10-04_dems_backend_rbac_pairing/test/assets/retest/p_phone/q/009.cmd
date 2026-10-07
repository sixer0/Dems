p screen session-detail
p tapid session-detail-back
sleep 1800
p screen sessions
p ids session-row-SES
p tap 540 866
sleep 2500
p screen session-detail
p shot 14_p1_r2_a_session_detail
p ids ^screen-
p tap 540 2283
sleep 1200
p screen evidence
p shot 15_p1_r2_b_evidence_t1
sleep 1800
p shot 15_p1_r2_b_evidence_t3
p tap 756 2283
sleep 1200
p screen devices
p shot 16_p1_r2_c_devices_t1
sleep 1800
p shot 16_p1_r2_c_devices_t3
p warnlog
serverlog p1r2
