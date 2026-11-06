mark b01
w1 press sn-scan
sleep 800
w1 press sn-subject-TERSANGKA
sleep 300
w1 type [data-testid="sn-subject-name"] input SC3 Web Start
sleep 500
w1 js document.querySelector('[data-testid="sn-case-number"]')?.value ?? document.querySelector('[data-testid="sn-case-number"] input')?.value ?? document.querySelector('[data-testid="sn-field-case"] input')?.value
w1 shot 51_sc3_web_step1_filled
w1 press sn-next
sleep 3000
w1 shot 52_sc3_web_step2_gate
w1 ids ^sn-
p shot 52p_sc3_phone_after_web_create
serverlog b01
