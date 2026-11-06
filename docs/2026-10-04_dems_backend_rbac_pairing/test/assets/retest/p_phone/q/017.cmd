p screen more
p tapid more-dest-storage
sleep 2500
p screen storage
p shot 30_storage
p key 4
sleep 2000
p screen more
p tapid more-dest-network-time
sleep 2500
p screen network-time
p shot 31_network_time
p key 4
sleep 2000
p screen more
p tapid more-dest-audit
sleep 3000
p screen audit
p shot 32_audit
p ids audit-(count|head|total|chain)|audit-row
w1 api GET /api/v1/time/status
w1 api GET /api/v1/audit/chain
p warnlog
serverlog c03
