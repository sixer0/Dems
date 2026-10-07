keyguard
p focus
p top
mark start
w1 open 9561
w2 open 9562
w1 nav /login
w1 js document.querySelector('[data-testid="page-login"]')?.getAttribute('data-core-mode')
w1 signin andi.pratama
w1 shot w1_dashboard_supervisor_probe
w1 api GET /api/v1/session/current
w1 api GET /api/v1/admin/users
