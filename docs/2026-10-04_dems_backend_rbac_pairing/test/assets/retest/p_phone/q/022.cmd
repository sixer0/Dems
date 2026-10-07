p screen settings
p tapid settings-row-network-time
sleep 2500
p screen x-network
p shot 43_settings_network_time_row
p ids ^screen-
p key 4
sleep 2500
p screen x-after-back
p ids ^screen-
p tapid settings-row-devices
sleep 2500
p screen x-devices
p shot 44_settings_device_settings_row_repro
p ids ^screen-|^device-detail-screen
p key 4
sleep 2500
p screen x-after-back1
p shot 44b_back_1_from_device_settings
p ids ^screen-|^device-detail-screen
p key 4
sleep 2500
p screen x-after-back2
p shot 44c_back_2_from_device_settings
p ids ^screen-|^device-detail-screen
