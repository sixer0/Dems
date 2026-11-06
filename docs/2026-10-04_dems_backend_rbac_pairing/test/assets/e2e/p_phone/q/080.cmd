p tap 756 2283
sleep 2500
p screen devices
p tap 540 499
sleep 2500
p screen device-detail
p swipe 540 1900 540 800 600
sleep 1500
p shot 89_sc4_phone_device_detail_technician
p ids device-(action|restart)
w1 js !!document.querySelector('[data-testid="ur-role-dialog"]')
