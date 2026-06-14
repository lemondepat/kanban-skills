# Self-verification recipe (loaded in step 5 of kanban-implement)

After each ticket is implemented, two things must be done: **self-verify** (confirm it was done right) + **explain** (let the user know what was touched).

## Pick a free port

Avoid the everyday 4173. Use a script to probe for a free port:

```bash
node -e "const net=require('net');const s=net.createServer();s.listen(0,()=>{const p=s.address().port;s.close(()=>console.log(p))})"
```

## Self-verifying UI changes (web/* : app.js / views.js / stickers.js / export.js / splash.js / citydata.js)

1. Start a server on a dedicated port (the whole batch of UI changes shares this single instance):
   ```bash
   PORT=<free port> node server.mjs
   ```
   (Run it in the background and note the port.)
2. Use Claude in Chrome to open `http://localhost:<port>`, navigate to the corresponding view for each UI ticket one by one, and actually check whether the change took effect and matches the ticket's intent; take screenshots when necessary.
3. Write "what was confirmed in the browser at :<port>" into the acceptance checklist.
4. Once the whole batch of UI tickets is verified, kill that server process.

## Self-verifying backend / logic changes (server.mjs / lib/ai-proxy.mjs / api/*)

1. **Write enough tests and pass them**: add test cases for the changed pure functions / proxy behavior (follow the repo's existing test organization; when the current repo has no test framework, use `node --test` with `*.test.mjs` files and run `node --test`).
2. If it's a change to server behavior, also start a dedicated port and hit the real endpoint to confirm (e.g. `curl http://localhost:<port>/api/...` to check the response matches expectations).
3. Write "which tests were added, whether all green, what endpoint was hit, and the result" into the acceptance checklist.
4. Only when neither can be self-verified should you fall back to the "needs manual verification" annotation, stating why it can't be self-verified.

## Explain (mandatory for every ticket)

A concrete change list: **which file, which function, what changed, and why**.
For backend tickets this part is a hard requirement — it's invisible in the UI, so the user has no way to know unless you spell it out.
