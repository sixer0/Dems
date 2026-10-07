p screen more
p tap 756 2283
sleep 2500
p screen devices
p tapid device-row-CAM-01
sleep 2500
p screen device-detail
p tap 972 2283
sleep 2500
p screen x-more
p ids ^screen-
p tapid more-dest-settings
sleep 2500
p screen settings
p tapid settings-row-devices
sleep 2500
p screen x-devices
p shot 45_repro_device_settings_with_cam_detail_in_stack
p ids ^screen-|^device-detail-screen
p key 4
sleep 2500
p screen x-back1
p shot 45b_repro_back_1
p ids ^screen-|^device-detail-screen
p key 4
sleep 2500
p screen x-back2
p ids ^screen-|^device-detail-screen
p key 4
sleep 2500
p screen x-back3
p ids ^screen-|^device-detail-screen
