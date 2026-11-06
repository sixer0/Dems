# sign out the web profile before the driver reloads (PNG capture)
w1 js (async()=>{const a=await fetch('/api/v1/auth/sign-out',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({reason:'USER'})});return a.status})()
done 0
