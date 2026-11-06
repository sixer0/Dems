mark a09
p tap 540 499
sleep 2500
p screen device-detail
p shot 11_device_detail_cam01
p ids ^(device|screen)- 
p swipe 540 1900 540 800 600
sleep 1500
p shot 11b_device_detail_cam01_scrolled
p ids ^(device|screen)- 
serverlog a09
