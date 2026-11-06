p screen settings-maintenance
p key 4
sleep 2000
p screen settings
p shot 41_settings_back_from_maintenance
p tapid settings-row-storage
sleep 2500
p screen x-storage
p shot 42_settings_storage_management_row
p ids ^screen-|-header
p key 4
sleep 2500
p screen x-after-back
p shot 42b_after_back_from_storage_management
p ids ^screen-|-header
