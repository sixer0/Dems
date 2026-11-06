mark l02
p screen home
p tap 540 1442
sleep 2000
p shot 110_andi_home_supervisor
p tap 972 2283
sleep 2500
p screen more
p tapid more-dest-settings
sleep 2500
p screen settings
p tapid settings-row-maintenance
sleep 2500
p screen settings-maintenance
p shot 111_o2_andi_supervisor_maintenance_install_locked
p ids settings-update|demo
p key 4
sleep 1800
p key 4
sleep 2000
p screen more
p ids more-operator-(role|name)|more-sign-out
p tapid more-sign-out
sleep 3500
p screen login
p shot 112_e2e_s1_after_sign_out_andi_end_state
p corelog 3
p warnlog
serverlog l02
