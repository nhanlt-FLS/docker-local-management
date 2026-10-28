# Data & Request Flows

> How data moves through the system: request paths, streaming, polling,
> mutations, loading states, and the backend proxy/cache behavior.
>
> Companion documents: [STRUCTURE.md](./STRUCTURE.md) (layout),
> [FEATURES.md](./FEATURES.md) (feature inventory).

## 1. Normal (JSON) Request Flow

```text
component event / mount effect
  → api.<endpoint>()                     frontend/src/lib/api/docker.ts
  → request<T>(method, path, {query,body})  lib/api/client.ts
  → fetch("/api" + path + ?query)        browser
  → server.py Handler._dispatch          route: /api/* vs static
  → _handle_api → _proxy_simple          strip "/api", forward headers/body
  → docker_request() over unix socket    /var/run/docker.sock
  → Docker Engine API                    JSON response
  ← full body read, Content-Length reply ← browser fetch resolves
  → useAsyncData setData / component state update
```

Notes:
- `client.ts` parses JSON when possible, wraps non-2xx in `ApiError`
  (status + daemon `message`), and network failures become `ApiError(0, …)`.
- Every list loader attaches `.catch(...)` fallbacks (empty arrays / null) so
  one failing endpoint degrades instead of blanking the view.

## 2. Backend Proxy & Stream Classification

`Handler._handle_api` decides the path per request:

| Docker path | Kind | Handler |
|---|---|---|
| `*/logs` | logs | `_stream_logs` — one-shot: read all + demux; `follow=1`: chunked stream, demuxed frame-by-frame; TTY containers skip demux (checked via `/containers/{id}/json` `Config.Tty`) |
| `*/stats?stream=1` | raw | `_stream_raw` chunked passthrough (`stream=0` falls back to simple proxy) |
| `*/events` | raw | `_stream_raw` chunked passthrough |
| `POST /images/create` | raw | `_stream_raw` pull progress events |
| `GET /system/df` | cached | served from the 60s TTL disk-usage cache (see §6) |
| everything else | simple | `_proxy_simple` full-body JSON proxy |

Stream framing: non-TTY Docker logs are multiplexed with an 8-byte header
`[stream_type, 0, 0, 0, size_be32]`; `StreamDemuxer` reassembles plain text
across fragmented chunks and flushes leftovers at stream end.

Chunked replies use `Transfer-Encoding: chunked` with manual frame writes
(`_begin_chunked` / `_write_chunk` / `_end_chunked`); broken pipes from
client disconnects are swallowed and the daemon connection closed in `finally`.

## 3. Streaming Flows (frontend)

```text
effect (mount / tab / id change)
  → api.followLogs | streamStats | streamEvents | pullImage
  → streamRequest: fetch → response.body.getReader()
  → loop: reader.read() → TextDecoder → onChunk(text)
      logs    → bounded direct-DOM append (no React state per chunk)
      stats   → streamJsonLines: buffer split on "\n", JSON.parse per line → sample state
      events  → streamJsonLines → bounded event list (pause/clear controls)
      pull    → progress lines → per-layer progress UI in dialog
  → cleanup: abort() cancels reader; done promise settles; late completions ignored
```

Guards: components that start streams asynchronously handle cleanup happening
before the stream handle resolves; `AbortError` is not surfaced as an error.

## 4. Polling Flows

All polling uses `useInterval(() => void reload(true), ms)` — silent reloads
keep current UI visible while refreshing; hidden tabs pause polling.

| Source | Interval | Payload |
|---|---|---|
| `App.tsx` sidebar counts | 7s | info + images + volumes + networks lists |
| `ContainersView` list | 4s | `/containers/json?all=1&size=1` |
| `EngineStatus` badge | 10s | `/api/_health` (+ version) |
| `ContainerProcesses` (while running, auto-refresh on) | 2s | `/containers/{id}/top` |

Continuous streams (logs follow, stats, events) are not polling — they stay
open until unmount/abort.

## 5. Mutation Flow (actions with user feedback)

```text
row/drawer/dialog action
  → (confirm/prompt dialog if destructive)      DialogProvider promise
  → api.<mutation>()                            e.g. stopContainer, pruneImages
  → server.py: non-GET invalidates df cache     sizes refresh on next df read
  → success: toast.success + reload(true) own list + onMutated() → App counts reload
  → failure: toast.error(daemon message)        UI state unchanged
```

`performContainerAction` (containers) centralizes this: it returns `true` only
after an actual mutation (cancelled confirm → `false`, no reload), so rows and
the detail drawer share identical behavior.

The dashboard clean-up dialog chains this flow: it runs the selected prune
endpoints sequentially, sums `SpaceReclaimed` across results into one toast,
reports per-target failures separately, then reloads dashboard data, disk
usage, and app counts (each POST also invalidates the df cache).

## 6. Disk-Usage (`/system/df`) Flow & Cache

Why it exists: `/system/df` makes the daemon walk the entire storage (image
layers, container rw-layers, volumes, build cache) — measured ~9–11s on a busy
local engine, versus <0.3s for every other dashboard call.

Backend cache (`server.py`):

```text
GET /api/system/df
  → lock acquired
  → cache fresh (<60s, DF_CACHE_TTL)?  → serve cached bytes
  → else: one daemon walk; concurrent requests wait on the same lock
          and then serve the cached bytes (coalescing)
  → store {status, body, ctype, expires}
any non-GET /api/* call → invalidate (expires = 0)
```

Frontend progressive load (`DashboardView`):

```text
mount / refreshSignal
  ├─ fast batch: Promise.all(info, version, containers(no size),
  │    images, volumes, networks)  → render page (~0.3s)
  └─ separate useAsyncData: diskUsage
       → panel shows "Measuring disk usage…" (LoadingState)
       → resolves → disk-usage donut chart + legend fill in
       → Images stat-card hint switches "measuring…" → "<size> on disk"
```

Result: first paint never waits on the daemon disk walk; repeat visits within
the TTL are instant; mutations invalidate so numbers stay correct.

## 7. `useAsyncData` Request-State Flow

1. View passes `loader` + `refreshKey` (usually `refreshSignal` or an id).
2. Hook keeps the latest loader in a ref (no effect re-runs on loader identity).
3. `reload(silent?)` increments a request id; non-silent sets `loading`.
4. Only the response whose id matches `latestRequest` may write
   data/error/loading — stale slow responses are dropped.
5. Unmount/refreshKey change bumps the id in cleanup, invalidating in-flight work.
6. Silent reloads (polling, post-mutation) never flash loading UI.

## 8. State Ownership

| Level | Owns |
|---|---|
| `App` | activeView, filter, refreshSignal, primaryAction, sidebar counts |
| Feature view | list data (`useAsyncData`), memoized filter derivatives, selected resource id, dialog open flags |
| Dialog/drawer components | their form state and stream lifecycles |
| `ToastProvider` | toast items + ids |
| `DialogProvider` | discriminated-union dialog state; resolves confirm/prompt promises |
| Reusable UI | props only — never calls Docker APIs |

## 9. Dev vs Production Flow

```text
dev:   browser → Vite :5173 → static from source; /api proxied → :8420 server.py
prod:  browser → server.py :8420 → public/ bundle; /api → docker.sock (same process)
```

Build gate: `npm --prefix frontend run build` runs `tsc --noEmit` first, then
Vite emits hashed assets into `public/` (emptyOutDir), which the running
server picks up on next request (no server restart needed for frontend changes;
`server.py` changes do require a restart).
