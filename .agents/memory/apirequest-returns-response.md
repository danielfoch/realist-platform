---
name: apiRequest returns a raw Response
description: client apiRequest helper returns Response, not parsed JSON — new callers must call .json()
---
# `apiRequest` returns a raw `Response`, not parsed JSON

In `client/src/lib/queryClient.ts`, `apiRequest(method, url, data?)` returns the raw
`fetch` `Response` (`Promise<Response>`). It is NOT generic and does NOT parse JSON.

**Why:** Much of the existing code calls it as `apiRequest<SomeType>("GET", url)` and uses
the result directly (e.g. as a React Query `queryFn`). Those generic calls fail `tsc`
("Expected 0 type arguments") and are pre-existing type debt across the codebase; the app
ships via esbuild which strips types, so they don't block running.

**How to apply:** For any NEW code that needs the response body, do
`const res = await apiRequest(...); return res.json() as Promise<T>;` rather than copying the
`apiRequest<T>(...)` pattern. Don't try to "fix" the existing generic calls wholesale — it's
a large, separate cleanup. `tsc --noEmit` on this repo already reports many pre-existing
errors; judge your changes by whether they ADD new errors, not by a clean run.
