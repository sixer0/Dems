p screen settings
p tapid settings-row-devices
sleep 2500
p screen settings-devices
p shot 37_settings_device_settings
p key 4
sleep 2000
p screen settings
p tapid settings-row-storage
sleep 2500
p screen settings-storage
p shot 38_settings_storage_management
p key 4
sleep 2000
p screen settings
p tapid settings-row-network-time
sleep 2500
p screen settings-network
p shot 39_settings_network_time
p key 4
sleep 2000
p screen settings
p tapid settings-row-maintenance
sleep 2500
p screen settings-maintenance
p shot 40_settings_maintenance_budi_investigator
p swipe 540 1900 540 900 600
sleep 1200
p shot 40b_settings_maintenance_budi_investigator_scrolled
p ids settings-update|install|maintenance-
p warnlog
