mark a01
p screen login
p tap 539 1184
sleep 900
p username budi.santoso
sleep 500
p shot 02_login_username_typed_budi
p tap 539 1342
sleep 800
p password
sleep 300
p key 66
p waitlog signin 30
sleep 3000
p screen home
p shot 03_after_signin_biometric_offer
p warnlog
serverlog a01
