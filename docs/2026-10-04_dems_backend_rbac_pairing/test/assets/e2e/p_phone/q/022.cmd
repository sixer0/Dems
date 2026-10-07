mark a15
p tap 540 886
sleep 2500
p screen settings-preferences
p shot 17_settings_preferences
p ids ^(settings|screen)-
p swipe 540 1900 540 800 600
sleep 1200
p shot 17b_settings_preferences_scrolled
p ids ^(settings|screen)-
serverlog a15
