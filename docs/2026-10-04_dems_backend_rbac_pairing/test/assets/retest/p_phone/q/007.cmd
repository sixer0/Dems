mark p1r1
p screen sessions
p tap 540 866
sleep 2500
p screen session-detail
p shot 10_p1_r1_a_session_detail
p ids screen-|session-detail
p tap 540 2283
sleep 1200
p screen evidence
p shot 11_p1_r1_b_evidence_t1
sleep 1800
p shot 11_p1_r1_b_evidence_t3
p tap 756 2283
sleep 1200
p screen devices
p shot 12_p1_r1_c_devices_t1
sleep 1800
p shot 12_p1_r1_c_devices_t3
p ids nav-item-.*-face
p warnlog
serverlog p1r1
