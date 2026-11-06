mark k04
w1 nav / 3000
w1 wait page-dashboard present 15000
w1 press start-new-session
w1 wait page-session-new present 15000
sleep 2000
w1 press sn-scan
sleep 800
w1 press sn-subject-TERSANGKA
sleep 300
w1 type [data-testid="sn-subject-name"] RP setup for technician check
sleep 500
w1 press sn-next
sleep 4000
w1 shot 102_p5_web_setup_session_created
w1 api GET /api/v1/session/current
p screen home
p shot 103_p5_rina_home_continue_setup_locked
p tap 302 1239
sleep 2000
p shot 103b_p5_rina_home_after_press_continue_setup
p tap 324 2283
sleep 2500
p screen sessions
p shot 104_p5_rina_sessions_hub_continue_setup_locked
p ids sessions-start
p warnlog
serverlog k04
