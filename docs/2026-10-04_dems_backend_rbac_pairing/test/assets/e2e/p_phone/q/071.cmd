mark c01
w2 open 9562
w2 nav /login
w2 signin budi.santoso
w2 nav / 3000
w2 wait page-dashboard present 15000
sleep 2000
w2 js ({start: !!document.querySelector('[data-testid="start-new-session"]'), locked: !!document.querySelector('[data-testid="start-new-session-locked"]'), idle: !!document.querySelector('[data-testid="session-idle"]'), sealed: !!document.querySelector('[data-testid="session-sealed"]'), user: document.body.textContent.match(/Logged in as(.{0,30})/)?.[1]})
w2 shot 73_sc4_w2_budi_dashboard_before
serverlog c01
