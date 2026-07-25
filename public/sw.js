const CACHE = "11kchbb-app-v3";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || event.request.mode !== "navigate")
    return;
  event.respondWith(
    fetch(event.request, { cache: "no-store" }).catch(
      () =>
        new Response(
          `<!doctype html>
          <html lang="en">
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
              <meta name="theme-color" content="#0b2f55">
              <title>11KCHBB App · Offline</title>
              <style>
                *{box-sizing:border-box}
                body{min-height:100vh;margin:0;padding:24px;display:grid;place-items:center;background:#f3f6f9;color:#142033;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
                main{width:min(440px,100%);padding:34px;border:1px solid #dfe5eb;border-radius:22px;background:white;box-shadow:0 18px 50px rgba(11,47,85,.12);text-align:center}
                .mark{width:64px;height:64px;margin:0 auto 22px;border-radius:18px;background:#0b2f55;color:white;display:grid;place-items:center;font-family:Georgia,serif;font-size:25px;font-weight:800}
                h1{margin:0;color:#0b2f55;font-family:Georgia,serif;font-size:30px}
                p{margin:13px 0 24px;color:#68768a;line-height:1.6}
                button{width:100%;min-height:48px;border:0;border-radius:11px;background:#1c6fd1;color:white;font:inherit;font-weight:750;cursor:pointer}
              </style>
            </head>
            <body>
              <main>
                <div class="mark">11</div>
                <h1>You’re offline</h1>
                <p>Reconnect to the internet, then try opening the 11KCHBB App again.</p>
                <button onclick="location.reload()">Try again</button>
              </main>
            </body>
          </html>`,
          { headers: { "Content-Type": "text/html; charset=utf-8" } },
        ),
    ),
  );
});
