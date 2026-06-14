# Wiring the board into a server

The board `kanban.html` automatically `fetch('/kanban.json')` to load when served from `localhost` / `127.0.0.1`, and `PUT /kanban.json` to save after every change. To make that work, the host server needs three routes:

| Method | Path | Behavior |
|--------|------|----------|
| GET | `/kanban` | Return `kanban.html` from the project root (Content-Type: text/html) |
| GET | `/kanban.json` | Return `kanban.json` from the project root (Content-Type: application/json) |
| PUT | `/kanban.json` | Read body → `JSON.parse` to validate → write back to `kanban.json` in the project root |

Detect the server type first, then insert the matching snippet below. **Only add routes, do not touch other logic**; place them **before** the static-file fallback.

---

## ⚠️ Security: localhost-only (REQUIRED)

These routes expose your whole board, and `PUT /kanban.json` lets the caller **overwrite your data**. If the host server is ever deployed publicly, anyone could read your tickets and clobber the file. So the routes **must only respond to loopback connections** — i.e. you, on your own machine.

Gate every kanban route with this check. It inspects the **real TCP peer address** (`socket.remoteAddress`), which **cannot be spoofed by headers**. Never gate on `X-Forwarded-For` or Express's `req.ip` (both are header-derived and forgeable). When deployed behind a proxy/load balancer the peer is the platform, not loopback, so the routes return 404 by design; locally the peer is loopback, so they work.

```js
// Loopback-only guard — share this helper across all kanban routes.
const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
function isLocal(reqOrSocket) {
  const addr = (reqOrSocket.socket || reqOrSocket).remoteAddress || "";
  return LOOPBACK.has(addr);
}
```

Return **404** (not 403) for non-local callers so the routes don't even reveal they exist.

---

## 1. Native Node http server (e.g. this repo's server.mjs)

Insert into the `createServer` callback, before the static fallback:

```js
// Kanban board — serve html and data file from project root (localhost only)
if (request.url === "/kanban" || request.url === "/kanban.json") {
  if (!isLocal(request)) {            // loopback-only; deployed = 404 by design
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }
}

if (request.method === "GET" && request.url === "/kanban") {
  try {
    const content = await readFile(join(rootDir, "kanban.html"));
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(content);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
  return;
}

if (request.method === "GET" && request.url === "/kanban.json") {
  try {
    const content = await readFile(join(rootDir, "kanban.json"), "utf8");
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    response.end(content);
  } catch {
    response.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: "kanban.json not found" }));
  }
  return;
}

if (request.method === "PUT" && request.url === "/kanban.json") {
  try {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString("utf8");
    JSON.parse(body); // validate JSON before writing
    await writeFile(join(rootDir, "kanban.json"), body, "utf8");
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ ok: true }));
  } catch (error) {
    response.writeHead(400, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ ok: false, error: error.message }));
  }
  return;
}
```

Make sure the top of the file imports `readFile` / `writeFile` (`node:fs/promises`) and `join` (`node:path`), and that `rootDir` points at the project root. Add them if missing. Also add the `LOOPBACK` / `isLocal` helper from the security section above.
You can add a log line in the `server.listen` callback: `console.log('Kanban board at http://localhost:' + port + '/kanban');`

---

## 2. Express

```js
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const rootDir = process.cwd();

const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
// Loopback-only guard for all kanban routes. Uses the real socket peer,
// NOT req.ip / X-Forwarded-For (those are header-derived and spoofable).
function kanbanLocalOnly(req, res, next) {
  if (LOOPBACK.has(req.socket.remoteAddress || "")) return next();
  return res.status(404).send("Not found"); // deployed / remote = 404 by design
}

app.get("/kanban", kanbanLocalOnly, async (_req, res) => {
  try {
    res.type("html").send(await readFile(join(rootDir, "kanban.html")));
  } catch {
    res.status(404).send("Not found");
  }
});

app.get("/kanban.json", kanbanLocalOnly, async (_req, res) => {
  try {
    res.type("json").send(await readFile(join(rootDir, "kanban.json"), "utf8"));
  } catch {
    res.status(404).json({ error: "kanban.json not found" });
  }
});

app.put("/kanban.json", kanbanLocalOnly, express.text({ type: "*/*", limit: "5mb" }), async (req, res) => {
  try {
    JSON.parse(req.body); // validate before writing
    await writeFile(join(rootDir, "kanban.json"), req.body, "utf8");
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});
```

Place these three routes **before** the `express.static(...)` fallback.

> If your app sets `app.set('trust proxy', ...)`, that only affects `req.ip` — the guard above reads `req.socket.remoteAddress` directly, so it stays correct.

---

## 3. Serverless (Vercel api/, etc.) — read-only filesystem

Serverless runtimes usually have a **read-only** filesystem, so `PUT` writing back to `kanban.json` will fail. Two options:

- **Simple (recommended): don't wire the board into the deployed app at all.** The board is a local tool. Serve `kanban.html` / `kanban.json` only from a local dev server (`npm run dev`) with the localhost-only routes above. In production these routes simply don't exist (or 404), which is exactly what you want — the board is never public.
- **If you truly need online editing:** persist data to external storage (KV / database / S3) and implement `GET`/`PUT /kanban.json` against that store instead of the local file. This is extra engineering and **must add its own auth** (the loopback guard does not apply on serverless, where every caller is the platform). Only do this on demand.

Either way, the board itself stays a private, localhost-first tool by default.

---

## When there is no server

The board **works without any server**: open `kanban.html` directly in the browser, click "Open data file" on the welcome screen, and pick the project's `kanban.json`. It reads and writes the local file via the File System Access API, so changes are saved straight to disk.
(This mode needs a Chromium-based browser; Safari/Firefox don't support the File System Access API — use the local-server mode there.)
