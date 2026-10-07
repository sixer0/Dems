mark d01
p screen stack-check
p key 4
sleep 2000
p tap 108 2283
sleep 2500
p screen home
p shot 48_home_before_start
p tap 302 1239
sleep 3000
p screen session-new
p shot 49_start_session_step1
p ids ^sn-|session-new|wizard
p warnlog
serverlog d01
