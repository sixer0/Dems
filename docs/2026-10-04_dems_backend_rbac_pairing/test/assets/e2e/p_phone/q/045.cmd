w1 open 9561
w1 nav /login
w1 signin andi.pratama
p screen home
p tap 995 2233
sleep 800
p tap 995 2093
sleep 1000
p shot 40_home_recording_logbox_dismissed
mark a28
p forcestop
sleep 2000
p link demsdemo:///login?core=LIVE&motion=off
sleep 8000
p screen unknown
p shot 41_relaunch_after_forcestop
p corelog 20
serverlog a28
