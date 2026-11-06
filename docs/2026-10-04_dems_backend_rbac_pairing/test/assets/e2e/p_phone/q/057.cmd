# reload the driver (screenrecord, clock offset, CDP wall times); sign the web profile out first
w1 js (async()=>{const a=await fetch('/api/v1/auth/sign-out',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({reason:'USER'})});return a.status})()
done 0
