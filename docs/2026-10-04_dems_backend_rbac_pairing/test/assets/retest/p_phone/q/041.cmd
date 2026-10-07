w1 nav /session 3000
w1 wait page-session-monitor present 15000
w1 js document.querySelector('[data-testid="page-session-monitor"]')?.getAttribute('data-session-state')
w1 press sm-action-end
w1 wait sm-end-dialog present 5000
sleep 600
w1 type [data-testid="sm-end-reason"] RP web stop repeat
sleep 500
w1 shot 77_p4b_web_end_dialog
p screen live
p shot 78_p4b_phone_monitor_before_stop
