mark b04
p tap 244 2252
sleep 2500
p screen home
p shot 59_sc3_s3_phone_home_after_done
p corelog 5
w1 press sm-final-close
sleep 800
w1 nav / 3000
w1 wait page-dashboard present 15000
w1 shot 59w_sc3_s3_web_dashboard_idle
w1 js ({idle: !!document.querySelector('[data-testid="session-idle"]'), rec: !!document.querySelector('[data-testid="session-recording"]')})
serverlog b04
