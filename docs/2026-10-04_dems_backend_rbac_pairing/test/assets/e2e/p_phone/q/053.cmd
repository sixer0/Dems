w1 nav /
w1 wait page-dashboard present 15000
w1 press start-new-session
w1 wait page-session-new present 15000
sleep 2500
w1 shot w1_probe_session_new_step1
w1 ids ^sn-
w1 js [...document.querySelectorAll('[data-testid="sn-subject-type"] [role="radio"], [data-testid="sn-subject-type"] input, [data-testid="sn-subject-type"] button')].map(e=>[e.tagName,e.getAttribute('value'),e.textContent.trim().slice(0,30)])
w1 js [...document.querySelectorAll('[data-testid="sn-subject-name"] input, [data-testid="sn-subject-name"]')].map(e=>[e.tagName,e.getAttribute('type'),e.outerHTML.slice(0,200)])
