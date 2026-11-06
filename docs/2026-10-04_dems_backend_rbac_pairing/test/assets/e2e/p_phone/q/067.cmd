p clock
p screen home
p rec start sc3_s1b_phone 12
mark b09
w1 press sn-start
w1 until 15000 (()=>location.pathname==='/session' && document.querySelector('[data-testid="page-session-monitor"]')?.getAttribute('data-session-state')==='RECORDING')()
w1 shot 68_sc3_s1b_web_recording
sleep 4000
p rec pull sc3_s1b_phone 5
p shot 68p_sc3_s1b_phone_home_recording
p clock
serverlog b09
