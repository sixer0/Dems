p screen settings
p tapid settings-row-preferences
sleep 2500
p screen settings-preferences
p shot 34_settings_preferences
p swipe 540 1900 540 900 600
sleep 1200
p shot 34b_settings_preferences_scrolled
p key 4
sleep 2000
p screen settings
p tapid settings-row-notifications
sleep 2500
p screen settings-notifications
p shot 35_settings_notifications
p key 4
sleep 2000
p screen settings
p tapid settings-row-security
sleep 2500
p screen settings-security
p shot 36_settings_security
p swipe 540 1900 540 900 600
sleep 1200
p shot 36b_settings_security_scrolled
p key 4
sleep 2000
p screen settings
p ids ^settings-row-(devices|storage|network)
p warnlog
