w1 open 9561
w2 open 9562
w1 nav /login
w1 signin andi.pratama
p screen login
p focus
p username
sleep 500
p shot 02_login_username_typed
p tap 539 1342
sleep 800
p password
sleep 300
p key 66
p waitlog signin 30
sleep 2500
p shot 03_after_signin
p corelog 20
