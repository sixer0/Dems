mark c02
p tap 756 2283
sleep 2500
p screen devices
p shot 27_devices_list
p tapid device-row-CAM-01
sleep 2500
p screen device-detail
p shot 28_device_detail_cam01
p swipe 540 1900 540 800 600
sleep 1500
p shot 28b_device_detail_cam01_scrolled
p ids device-(action|restart)|device-detail-
w1 api GET /api/v1/device/inventory
p warnlog
serverlog c02
