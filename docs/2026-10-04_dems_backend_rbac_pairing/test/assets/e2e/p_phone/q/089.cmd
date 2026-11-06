p key 4
sleep 1500
p shot 99d_retest_back_guard_dialog
p clock
p rec start retest_go_home 12
mark r02
p tap 539 1380
sleep 8000
p rec pull retest_go_home 5
p screen unknown
p shot 99e_retest_after_go_home
serverlog r02
