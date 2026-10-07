mark k03
p screen home
p clock
p rec start p5_deeplink 12
p link demsdemo:///session/new
sleep 10000
p rec pull p5_deeplink
p screen home
p shot 100_p5_rina_after_deeplink_session_new
p jslog sessionNew|entry|Not permitted|SESSION_START|permission
p warnlog
serverlog k03
