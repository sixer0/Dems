p screen live
p tap 540 1444
sleep 1500
p shot 43_monitor_resumed_after_relaunch
mark a30
p link demsdemo:///session/recovery
sleep 4000
p screen recovery
p shot 44_recovery_deeplink_while_recording
p ids ^(recovery|screen)
serverlog a30
