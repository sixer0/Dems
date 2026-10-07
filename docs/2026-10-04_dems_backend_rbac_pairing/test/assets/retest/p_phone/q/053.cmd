mark k05
w1 press sn-cancel
w1 wait sn-cancel-dialog present 5000
sleep 500
w1 press sn-cancel-confirm
sleep 3000
w1 js location.pathname
w1 api GET /api/v1/session/current
p screen sessions
p shot 105_p5_rina_sessions_hub_after_web_cancel
p ids sessions-start
p tap 972 2283
sleep 2500
p screen more
p tapid more-dest-settings
sleep 2500
p screen settings
p tapid settings-row-maintenance
sleep 2500
p screen settings-maintenance
p shot 106_o2_rina_maintenance_install_enabled
p ids settings-update
p warnlog
serverlog k05
