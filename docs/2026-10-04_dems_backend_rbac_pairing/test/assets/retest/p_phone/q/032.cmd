mark e02
w1 shot 61a_web_after_idle_expiry
w1 nav /login
w1 signin andi.pratama
w1 nav /session 3000
w1 wait page-session-monitor present 15000
w1 js document.querySelector('[data-testid="page-session-monitor"]')?.getAttribute('data-session-state')
w1 shot 61_p4_web_session_monitor_before_stop
w1 press sm-action-end
w1 wait sm-end-dialog present 5000
sleep 600
w1 type [data-testid="sm-end-reason"] RP web stop by supervisor
sleep 500
w1 shot 62_p4_web_end_dialog
serverlog e02
