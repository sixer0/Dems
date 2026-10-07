mark h01
w1 touch
p screen evidence-detail
p tap 108 2283
sleep 2500
p screen home
p shot 74_home_before_repeat
p tap 302 1239
sleep 3000
p screen session-new
p tap 913 748
sleep 900
p tap 229 994
sleep 700
p tap 540 1309
sleep 900
p text RP Phone Repeat
sleep 800
p key 111
sleep 800
p tap 540 2257
p waitlog create 20
p waitlog precheck 20
sleep 7000
p tap 540 2257
sleep 2500
p shot 75_repeat_step3_ready
p clock
p rec start p4b_start_handoff 25
p tap 540 2257
p waitlog start 25
sleep 20000
p rec pull p4b_start_handoff
p screen live
p shot 76_repeat_monitor_settled
serverlog h01
