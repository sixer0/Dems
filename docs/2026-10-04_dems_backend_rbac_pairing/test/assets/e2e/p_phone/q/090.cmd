mark r03
p screen home
p tap 302 1239
sleep 2500
p screen live
p tap 539 2266
sleep 1800
p tap 539 1279
sleep 900
p text Retest end
sleep 1000
p shot 99g_retest_end_dialog
p tap 811 1622
p waitlog stop 15
sleep 12000
p screen summary
p shot 99h_retest_summary
serverlog r03
