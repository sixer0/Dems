mark a08
p tap 756 2283
sleep 2500
p screen devices
p shot 10_devices_list
p ids ^(devices?|screen|nav-bottom)-
serverlog a08
w1 api GET /api/v1/device/inventory
