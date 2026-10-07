tap 760 568
sleep 1000
tap 1178 808
sleep 1200
text Rbac Probe
sleep 1000
key 4
sleep 1200
shot 22g_technician_form_filled
mark technician Next (expect 403)
tap 1178 1455
waitlog create 20
sleep 2500
shot 22h_technician_next_refused
noshot
