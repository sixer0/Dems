p screen home
p shot 04_biometric_offer
mark a02
p tap 540 1444
sleep 1500
p shot 05_home
p swipe 540 1700 540 700 500
sleep 1200
p shot 05b_home_scrolled
w1 api GET /api/v1/session/history?limit=5
w1 api GET /api/v1/storage/status
serverlog a02
