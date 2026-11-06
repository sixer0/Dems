mark force-stop and cold relaunch (current bundle from Metro)
forcestop
sleep 1500
link demsdemo:///login?core=LIVE&motion=off
sleep 12000
waitlog any 20
pid
top
shot 01_login_live_after_relaunch
noshot
