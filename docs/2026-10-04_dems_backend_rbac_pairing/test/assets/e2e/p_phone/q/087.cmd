# Re-test of the back-guard "Go to Home" at low host load (E2E-P-3 triage)
p screen login
mark r01
p tap 539 1342
sleep 800
p focus
p username
sleep 500
p tap 539 1499
sleep 800
p password
sleep 300
p key 66
p waitlog signin 30
sleep 5000
p screen home
p shot 99a_retest_after_signin
serverlog r01
