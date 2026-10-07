p tap 986 345
sleep 1500
p tapid storage-back
sleep 2000
mark a12
p tapid more-dest-network-time
sleep 2500
p screen network-time
p shot 14_network_time
p ids ^(network|time|nt|screen)-
w1 api GET /api/v1/network/status
w1 api GET /api/v1/time/status
serverlog a12
