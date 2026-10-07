mark g03
p screen summary
p tap 540 1442
sleep 1500
p shot 71_summary_ses0035_after_relaunch
p tap 760 2252
p waitlog sumack 15
sleep 3000
p screen evidence-detail
p shot 72_custody_phone_ev0023_detail
p ids evidence-detail-id|evidence-tab-integrity
p tapid evidence-tab-integrity
sleep 2000
p swipe 540 2000 540 400 600
sleep 1000
p swipe 540 2000 540 400 600
sleep 1000
p swipe 540 2000 540 400 600
sleep 1500
p shot 73_custody_phone_ev0023_integrity_custody
p ids evidence-custody
p warnlog
serverlog g03
