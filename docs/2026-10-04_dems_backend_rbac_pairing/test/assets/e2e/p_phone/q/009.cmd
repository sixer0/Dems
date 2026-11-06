p key 4
sleep 2000
p shot 07b_back_to_sessions
mark a05
p tap 539 864
sleep 2500
p screen session-detail
p shot 07_session_detail_incomplete
p ids ^(session|screen|detail)
serverlog a05
