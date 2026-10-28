---
name: features-map
description: Complete inventory of docker_local_management features, files, dependencies, hooks, and APIs. Use BEFORE modifying or extending any feature.
---

# Custom Features Inventory

> **Related skills:** See `project-map` for placement and commands. See `react-map` for component, context, hook, and streaming flows.

## Quick Lookup — "Which feature handles this?"

| Concern | Feature | Key files |
|---|---|---|
| Application navigation and global refresh | App shell | `frontend/src/app/App.tsx` |
| Resource overview | Dashboard | `frontend/src/features/dashboard/DashboardView.tsx` |
| Container lifecycle and creation | Containers | `frontend/src/features/containers/` |
| Logs, stats, processes, inspection | Container details | `frontend/src/features/containers/components/` |
| Image pull, tag, remove, prune | Images | `frontend/src/features/images/` |
| Volume creation and inspection | Volumes | `frontend/src/features/volumes/` |
| Network creation and inspection | Networks | `frontend/src/features/networks/` |
| Engine information and live events | System | `frontend/src/features/system/` |
| Toasts, confirms, prompts | Shared UI providers | `frontend/src/components/ui/` |
| Docker HTTP endpoints | API library | `frontend/src/lib/api/docker.ts` |
| Unix-socket proxy and stream framing | Backend | `server.py` |

## Application Shell

**Purpose:** Own the active view, search filter, refresh counter, primary toolbar action, and sidebar counts.

**Files:** `frontend/src/app/App.tsx`, `AppProviders.tsx`, `navigation.ts`, `types.ts`; layout components under `frontend/src/components/layout/`.

**How it works:** `VIEW_COMPONENTS` maps each typed `ViewId` to a feature view. Every view receives the shared `ViewProps` contract. Views register their primary action and clean it up on unmount. Counts refresh after mutations and through seven-second polling.

**Dependencies:** All feature views, `useAsyncData`, `useInterval`, Docker info/list endpoints, toast and dialog providers.

## Dashboard

**Purpose:** Summarize Docker resources, disk usage, engine details, and running containers; provide quick actions.

**Files:** `frontend/src/features/dashboard/DashboardView.tsx`.

**How it works:** Loads independent requests with `Promise.all` and per-request fallbacks. Local `StatCard` and `UsageBar` components remain dashboard-specific. It composes the shared run-container and pull-image dialogs.

**Dependencies:** Docker info/version/disk/list APIs, formatting utilities, container and image features.

## Containers

**Purpose:** List/filter containers, perform lifecycle actions, create containers, and inspect live resource details.

**Files:**
- `ContainersView.tsx`: loading, polling, filtering, rows, dialogs, prune.
- `containerActions.ts`: shared typed lifecycle action union and mutations.
- `containerConfig.ts`: controlled form values → Docker create configuration.
- `containerUtils.ts`: container naming and activity helpers.
- `components/ContainerRow.tsx`: summary row and actions.
- `components/RunContainerDialog.tsx`: controlled creation form.
- `components/ContainerDetailDrawer.tsx`: detail coordination and tabs.
- `components/ContainerInspect.tsx`: inspection display, copy, download.
- `components/ContainerLogs.tsx`: historical/followed logs with bounded direct DOM append.
- `components/ContainerStats.tsx`: streamed statistics and derived metrics.
- `components/ContainerProcesses.tsx`: top output with optional polling.

**Dependencies:** Docker container/logs/stats APIs, shared UI contexts, async/interval hooks, browser and formatting helpers.

## Images

**Purpose:** List/search/sort images and support pull, tag, run, remove, and prune workflows.

**Files:** `ImagesView.tsx`, `components/ImageRow.tsx`, `components/PullImageDialog.tsx`.

**How it works:** The view owns resource state and mutations. `PullImageDialog` consumes the streaming pull response, groups layer progress, reports failure locally, and only signals completion after success.

**Dependencies:** Docker image APIs, run-container dialog, confirm/prompt contexts, formatting helpers.

## Volumes

**Purpose:** List/search volumes and create, inspect, remove, or prune them.

**Files:** `VolumesView.tsx`, `components/VolumeDialogs.tsx`.

**How it works:** `useAsyncData` normalizes the Docker volume response. Create uses controlled fields and parses optional driver options. Inspect loads full details and supports JSON copy.

**Dependencies:** Docker volume APIs, toast/confirm contexts, formatting and browser helpers.

## Networks

**Purpose:** List/search networks and create, inspect, remove, or prune them while protecting built-ins.

**Files:** `NetworksView.tsx`, `networkUtils.ts`, `components/NetworkDialogs.tsx`.

**How it works:** Utility functions identify built-in networks and extract subnets. The inspect dialog shows attached containers and full JSON.

**Dependencies:** Docker network APIs, shared UI contexts, formatting and browser helpers.

## System

**Purpose:** Display engine version/info and stream Docker events.

**Files:** `SystemView.tsx`, `components/LiveEvents.tsx`.

**How it works:** System details use `useAsyncData`; live events consume newline-delimited JSON and maintain a bounded event list with pause and clear controls.

**Dependencies:** Docker info/version/events APIs, formatting helpers, toast context.

## Shared Infrastructure

### UI and contexts

`frontend/src/components/ui/` contains reusable modals, drawers, feedback states, icons, data displays, toast UI, and dialog UI. `dialogContext.ts` and `toastContext.ts` own context contracts and consumer hooks separately from provider components.

### Data and streaming

`frontend/src/lib/api/client.ts` provides generic JSON requests, `ApiError`, query/body handling, and cancellable text streams. `docker.ts` supplies typed Docker endpoints and newline-delimited JSON parsing. `index.ts` is the public API barrel.

### Backend proxy

`server.py` serves production assets and forwards `/api/*` to Docker over a unix socket. `StreamDemuxer` removes Docker stdout/stderr framing. Streaming handlers support followed logs, stats, events, and image pulls; ordinary requests use the simple JSON proxy.

## Dependency Graph

```text
main → AppProviders → App → feature views
                         ├─→ shared layout/UI → contexts
                         ├─→ custom hooks → React lifecycle
                         └─→ lib/api → server.py → Docker Engine
feature dialogs/rows → feature utilities + shared UI + lib/api
```
