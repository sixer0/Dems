mark r04
p tap 246 2253
sleep 2500
p screen home
p shot 99i_retest_home_after_done
p tap 972 2283
sleep 2500
p screen more
p ids more-operator-(role|name)
p tapid more-sign-out
sleep 3000
p screen login
p shot 99j_end_state_login_live_signed_out
p corelog 10
serverlog r04
