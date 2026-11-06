mark a02
p screen home
p tap 540 1444
sleep 2000
p shot 04_home
w1 open 0
w1 nav /login
w1 js document.querySelector('[data-testid="page-login"]')?.getAttribute('data-core-mode')
w1 signin andi.pratama
w1 api GET /api/v1/storage/status
w1 api GET /api/v1/session/history?limit=3
w1 api GET /api/v1/session/current
w1 api GET /api/v1/admin/users
p warnlog
serverlog a02
