p screen settings-about
p tapid settings-about-stack-check
sleep 3500
p screen stack-check
p shot 47_stack_check_p2
p ids stack-proof|service|heartbeat|source
sleep 5000
p shot 47b_stack_check_p2_t2
p swipe 540 1900 540 900 600
sleep 1200
p shot 47c_stack_check_p2_scrolled
w1 api GET /api/v1/health
p warnlog
serverlog c05
