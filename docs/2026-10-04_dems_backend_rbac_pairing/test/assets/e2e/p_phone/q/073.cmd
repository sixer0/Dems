p clock
p screen device-detail
p rec start sc4_to_tech_phone 12
mark c02
w1 press ur-role-confirm
par w2 until 10000 (()=>!!document.querySelector('[data-testid="start-new-session-locked"]') && !document.querySelector('[data-testid="start-new-session-locked"] [aria-disabled="false"]'))() || w1 until 10000 [...document.querySelectorAll('[data-slot="toast"]')].map(e=>e.textContent).find(t=>t.includes('is now Technician')) ?? false
w2 shot 77_sc4_w2_after_change_locked
w1 shot 77b_sc4_w1_after_change
w2 js ({start: !!document.querySelector('[data-testid="start-new-session"]'), locked: !!document.querySelector('[data-testid="start-new-session-locked"]'), lockedLabel: document.querySelector('[data-testid="start-new-session-locked"]')?.getAttribute('aria-label'), toasts:[...document.querySelectorAll('[data-slot="toast"]')].map(e=>e.textContent.replace(/\s+/g,' ').slice(0,120)), path: location.pathname})
sleep 3000
p rec pull sc4_to_tech_phone 5
p shot 78_sc4_phone_after_change
p ids device-(action|restart)
serverlog c02
