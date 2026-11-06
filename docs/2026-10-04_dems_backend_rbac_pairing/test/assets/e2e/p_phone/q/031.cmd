p tap 986 1382
sleep 1500
p tap 108 2283
sleep 2500
p screen home
p shot 24a_home_before_start
mark a23
p tap 302 1239
sleep 3000
p screen session-new
p shot 24_start_session_step1
p ids ^(session-new|screen)-
serverlog a23
