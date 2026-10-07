p screen summary
p shot 66_sc3_s3_phone_summary_pending
mark b08
p tap 244 2252
sleep 2500
p screen home
p shot 66b_sc3_phone_home_idle
w1 press sm-final-close
sleep 500
w1 nav / 3000
w1 press start-new-session
w1 wait page-session-new present 15000
sleep 2000
w1 press sn-scan
sleep 800
w1 press sn-subject-TERSANGKA
sleep 300
w1 type [data-testid="sn-subject-name"] SC3 Web Start Timed
sleep 500
w1 press sn-next
sleep 9000
w1 js document.querySelector('[data-testid="sn-gate-outcome"]')?.textContent?.trim()
w1 press sn-next
sleep 2500
w1 shot 67_sc3_s1b_web_ready
w1 ids ^sn-(start|countdown)
serverlog b08
