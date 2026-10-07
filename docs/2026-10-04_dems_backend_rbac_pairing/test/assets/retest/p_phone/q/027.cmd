mark d02
p screen session-new
p tap 913 748
sleep 900
p tap 229 994
sleep 700
p tap 540 1309
sleep 900
p text RP Phone Start
sleep 800
p key 111
sleep 800
p shot 50_start_session_step1_filled
p tap 540 2257
p waitlog create 20
p waitlog precheck 20
sleep 7000
p shot 51_start_session_step2_gate
p tap 540 2257
sleep 2500
p shot 52_start_session_step3_ready
p ids session-new-(start|countdown|ready)
p warnlog
serverlog d02
