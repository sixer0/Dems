mark e04
p screen redbox
p focus
p tap 270 2281
sleep 2500
p shot 66_p4_after_redbox_dismiss
sleep 3000
p shot 66b_p4_after_redbox_dismiss_t2
w1 api GET /api/v1/session/current
w1 api GET /api/v1/audit?sessionId=SES-20261006-0035&limit=50
serverlog e03
