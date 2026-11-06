mark a11
p tapid more-dest-storage
sleep 2500
p screen storage
p shot 13_storage
p ids ^(storage|screen)-
w1 api GET /api/v1/storage/detail
serverlog a11
