# Feature Inventory

> Complete inventory of what the application does, per module, with key files.
>
> Companion documents: [STRUCTURE.md](./STRUCTURE.md) (layout and conventions),
> [FLOWS.md](./FLOWS.md) (data and request flows).

## Quick Lookup — "Which feature handles this?"

| Concern | Feature | Key files |
|---|---|---|
| Navigation, global refresh, sidebar counts | App shell | `frontend/src/app/App.tsx` |
| Resource overview, disk usage | Dashboard | `frontend/src/features/dashboard/DashboardView.tsx` |
| Container lifecycle and creation | Containers | `frontend/src/features/containers/` |
| Logs, stats, processes, inspect | Container details | `frontend/src/features/containers/components/` |
| Image pull, tag, run, remove, prune | Images | `frontend/src/features/images/` |
| Volume create, inspect, remove, prune | Volumes | `frontend/src/features/volumes/` |
| Network create, inspect, remove, prune | Networks | `frontend/src/features/networks/` |
| Engine info and live events | System | `frontend/src/features/system/` |
| Toasts, confirms, prompts | Shared UI providers | `frontend/src/components/ui/` |
| Docker HTTP endpoint wrappers | API library | `frontend/src/lib/api/docker.ts` |
| Unix-socket proxy, stream framing, df cache | Backend | `server.py` |

## Application Shell

- **Purpose:** Own the active view, search filter, refresh counter, primary
  toolbar action, and sidebar resource counts.
- **Files:** `app/App.tsx`, `app/AppProviders.tsx`, `app/navigation.ts`,
  `app/types.ts`; layout in `components/layout/` (`Sidebar`, `Topbar`, `EngineStatus`).
- **Behavior:**
  - `VIEW_COMPONENTS: Record<ViewId, ComponentType<ViewProps>>` maps typed view
    ids to feature views; every view receives the shared `ViewProps` contract
    (`filter`, `refreshSignal`, `setPrimaryAction`, `onMutated`, `navigate`).
  - Views register their primary toolbar action on mount and clear it on unmount.
  - Sidebar counts (`info` + images/volumes/networks lists) load via
    `useAsyncData` and poll every **7s** (silent); mutations call `onMutated` to
    refresh counts immediately.
  - Topbar refresh button bumps `refreshSignal`, which re-runs every mounted
    view's loader. `navigate()` resets the filter.
  - `EngineStatus` polls health/version every **10s** and shows up/down/connecting.

## Dashboard

- **Purpose:** Summarize resources, disk usage, engine details, and running
  containers; quick access to other views and the run-container dialog.
- **Files:** `features/dashboard/DashboardView.tsx`.
- **Behavior:**
  - **Progressive loading:** a fast `Promise.all` batch (info, version,
    containers *without sizes*, images, volumes, networks — each with a
    per-request fallback) renders the page immediately; `/system/df` loads in a
    separate `useAsyncData` and fills in later, so the slow daemon disk walk
    never gates first paint.
  - Stat cards (Containers / Images / Volumes / Networks) navigate on click;
    the Images card hint shows "measuring…" until disk usage arrives.
  - **Disk usage panel is a donut chart** (`components/DiskUsageChart.tsx`,
    recharts): rounded segments per category with hover tooltip (size ·
    percent), center total label, and an interactive legend (color dot, icon,
    monospace size, share percent, separated Total row); Images/Containers/
    Volumes legend rows navigate to their views, zero-value categories get a
    legend row but no segment. Shows "Measuring disk usage…" while
    `/system/df` is in flight.
  - Engine panel (version, API, OS/arch, kernel, CPUs, memory, storage driver,
    docker root) and a running-containers preview (max 6 rows).
  - **Clean up dialog** (`components/DiskCleanupDialog.tsx`, button in the disk
    panel head): checkbox list of prune targets — stopped containers, dangling
    images, build cache (preselected), unused volumes (dangerous, off by
    default), unused networks — each with item count and reclaimable-size
    estimate derived from the last `/system/df` scan; footer shows the summed
    estimate. Runs selected prunes sequentially, sums `SpaceReclaimed` into a
    toast, reports per-target failures, then reloads dashboard + disk usage.
  - Composes the shared `RunContainerDialog`; on creation reloads both the fast
    batch and disk usage silently.

## Containers

- **Purpose:** List/filter containers, perform lifecycle actions, create
  containers, and inspect live details.
- **Files:** `ContainersView.tsx`, `containerActions.ts`, `containerConfig.ts`,
  `containerUtils.ts`, `components/*` (Row, RunContainerDialog,
  DetailDrawer, Logs, Stats, Processes, Inspect).
- **Behavior:**
  - List polls every **4s** (silent) with `size=1` so the Size column shows
    rw-layer sizes; buckets All/Running/Stopped plus topbar search over
    name/image/id/status/labels via `useMemo`.
  - Published TCP port chips are clickable links: running containers render
    `Ports linkable` anchors to `http://localhost:<hostPort>` (new tab,
    tooltip "Open …", specific bind IP used when not `0.0.0.0`/`::`);
    stopped containers and unpublished/UDP ports stay plain chips.
  - `performContainerAction` (shared by rows and the detail drawer) handles
    start/stop/restart/kill/pause/unpause/remove; remove requires a confirm
    dialog; success/error reported via toasts; returns whether a mutation
    happened so callers reload.
  - `RunContainerDialog`: controlled form (image, name, env, ports, volumes,
    command, restart policy…) translated to a Docker create config by
    `containerConfig.ts`.
  - `ContainerDetailDrawer` tabs:
    - **Logs** — one-shot tail or follow mode; followed chunks append directly
      to the DOM with a bounded buffer (no per-chunk React state).
    - **Stats** — streamed `/stats?stream=1` samples with derived CPU%/memory
      charts/values.
    - **Processes** — `/top` output, optional **2s** poll while the container runs.
    - **Inspect** — full JSON with copy/download.
  - Prune stopped containers with confirm + reclaimed-space toast.

## Images

- **Purpose:** List/search/sort images; pull, tag, run, remove, prune.
- **Files:** `ImagesView.tsx`, `components/ImageRow.tsx`, `components/PullImageDialog.tsx`.
- **Behavior:**
  - `PullImageDialog` consumes the streaming pull response, groups per-layer
    progress, reports failures locally, and signals completion only on success
    (so the list reloads only after a real pull).
  - Run an image reuses the containers feature's `RunContainerDialog`
    pre-filled with the image reference.
  - Remove/prune guarded by confirm dialogs; tag via prompt dialog.

## Volumes

- **Purpose:** List/search volumes; create, inspect, remove, prune.
- **Files:** `VolumesView.tsx`, `components/VolumeDialogs.tsx`.
- **Behavior:** `useAsyncData` normalizes the Docker response
  (`response.Volumes || []`); create dialog parses optional driver opts;
  inspect dialog shows full JSON with copy; remove/prune confirm-guarded.
  Usage sizes come from the list response's `UsageData`.

## Networks

- **Purpose:** List/search networks; create, inspect, remove, prune while
  protecting built-ins (bridge/host/none).
- **Files:** `NetworksView.tsx`, `networkUtils.ts`, `components/NetworkDialogs.tsx`.
- **Behavior:** utilities identify built-in networks and extract subnets for
  display; inspect dialog lists attached containers and full JSON; destructive
  actions confirm-guarded and disabled for built-ins.

## System

- **Purpose:** Engine details and a live event stream.
- **Files:** `SystemView.tsx`, `components/LiveEvents.tsx`.
- **Behavior:** info/version via `useAsyncData`; `LiveEvents` consumes
  newline-delimited JSON from `/events`, keeps a bounded list, and offers
  pause/clear controls.

## Shared UI & Contexts

- `components/ui/` — Modal, Drawer, Feedback states (Empty/Loading/Error),
  DataDisplay (KeyValueList, StatusPill, Ports with optional `linkable`
  anchors), Icon set.
- `ToastProvider` / `toastContext.ts` — `toast/success/error/info` API; toasts
  auto-dismiss; `useToast` throws outside the provider.
- `DialogProvider` / `dialogContext.ts` — promise-based `confirm` and `prompt`
  (discriminated-union dialog state), used for all destructive-action guards.
- Contexts and hooks live in separate `.ts` files from providers for Fast Refresh.

## API Library

- `lib/api/client.ts` — generic `request<T>` (JSON, `ApiError` with status/body,
  query/body handling) and cancellable `streamRequest` (fetch reader +
  TextDecoder, `onChunk`, abort handle); knows nothing about Docker.
- `lib/api/docker.ts` — typed endpoint wrappers: health, version, info,
  diskUsage (`/system/df`), containers (list *with optional size flag*,
  inspect, top, logs one-shot/follow, stats stream, lifecycle mutations,
  prune, create), images (list/remove/tag/prune/pull stream), volumes,
  networks, events stream, `pruneBuildCache` (`POST /build/prune`);
  `streamJsonLines` parses NDJSON streams.
- `types/docker.ts` — all Docker request/response models.

## Backend (`server.py`)

- Serves `public/` statically (`Cache-Control: no-store`).
- Proxies `/api/*` → Docker Engine over `/var/run/docker.sock`
  (`UnixHTTPConnection` + hand-rolled HTTP client).
- Stream support: followed logs with `StreamDemuxer` (8-byte multiplex
  framing), TTY-aware; raw chunked passthrough for stats, events, image pulls.
- **Disk-usage cache:** `GET /system/df` results cached 60s (`DF_CACHE_TTL`);
  concurrent requests coalesce behind one lock so only one daemon disk walk
  happens per window; any non-GET API call invalidates the cache.
- Health endpoint `/api/_health` pings the daemon (`/_ping`) for the UI badge.
- Threading server with daemon threads; CORS headers for dev-mode origins.

## Dependency Graph

```text
main → AppProviders → App → feature views
                         ├─→ shared layout/UI → toast/dialog contexts
                         ├─→ useAsyncData / useInterval hooks
                         └─→ lib/api → server.py → Docker Engine
feature dialogs/rows → feature utilities + shared UI + lib/api
```
