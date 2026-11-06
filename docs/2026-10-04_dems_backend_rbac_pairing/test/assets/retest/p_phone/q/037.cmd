mark g01
p screen blank
p forcestop
sleep 1500
p link demsdemo:///login?core=LIVE&motion=off
sleep 15000
p screen login
p shot 69_relaunch_after_crash_login
p jslog Live source ready
p warnlog
serverlog g01
