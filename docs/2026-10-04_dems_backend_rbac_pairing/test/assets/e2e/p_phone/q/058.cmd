p clock
w1 open 9561
w1 nav /login
w1 signin andi.pratama
w1 nav /session 3000
w1 js ({state: document.querySelector('[data-testid="page-session-monitor"]')?.getAttribute('data-session-state'), dur: document.querySelector('[data-testid="sm-duration"]')?.textContent})
w1 shot 56_sc3_s2_web_monitor_before_stop
p rec start rec_test 4
sleep 4500
p rec pull rec_test 2
p clock
