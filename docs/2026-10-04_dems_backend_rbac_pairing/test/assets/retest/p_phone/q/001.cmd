keyguard
p focus
p top
p clock
mark start
serverlog start
p screen login
p shot 00_before_relaunch
p forcestop
sleep 1500
p link demsdemo:///login?core=LIVE&motion=off
mark relaunch
sleep 20000
p screen login
p focus
p jslog source|ready|Live|bundle
p warnlog
