mark b02
p screen home
w1 press sn-start
p poll 54_sc3_s1_phone 14 0
w1 shot 55_sc3_s1_web_after_start
w1 js ({path: location.pathname, state: document.querySelector('[data-testid="page-session-monitor"]')?.getAttribute('data-session-state'), dur: document.querySelector('[data-testid="sm-duration"]')?.textContent})
serverlog b02 session
