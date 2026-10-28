# Project Structure

> Architecture and layout map of **docker_local_management** — a local Docker
> management UI (Docker Desktop-like) composed of a React 18 + TypeScript + Vite
> frontend and a dependency-free Python standard-library backend that proxies
> the Docker Engine API over the unix socket.
>
> Companion documents: [FEATURES.md](./FEATURES.md) (feature inventory),
> [FLOWS.md](./FLOWS.md) (data and request flows).

## Repository Root

```text
docker_local_management/
├── frontend/               React 18 + TypeScript + Vite source
│   ├── src/                Application source (see below)
│   ├── eslint.config.js    Flat ESLint configuration
│   ├── package.json        Dependencies and verification scripts
│   ├── tsconfig.json       Strict TypeScript and @/* alias
│   ├── vite.config.ts      Build output, alias, and dev proxy
│   ├── .prettierrc.json    Shared formatting rules
│   └── .prettierignore     Generated output ignored
├── public/                 GENERATED production frontend bundle served by Python
│   ├── index.html
│   └── assets/             Hashed JS/CSS bundles + source maps
├── server.py               Dependency-free Python HTTP server + Docker proxy
├── app.py                  Desktop entry point: embeds server.py in a pywebview window
├── updater.py              GitHub-Releases self-update helper (stdlib only)
├── VERSION                 Single source of truth for the app version (e.g. 0.1.0)
├── desktop.spec            PyInstaller spec (onedir bundle of app.py + gi/webview)
├── requirements-desktop.txt  pywebview + pyinstaller (server.py stays dependency-free)
├── build_desktop.sh        Build frontend → PyInstaller → AppImage (used by CI too)
├── packaging/              AppImage scaffolding: AppRun, .desktop, icon.png
├── .github/workflows/      release.yml — builds + publishes an AppImage on v* tags
├── knowledges/             These documentation files
└── .qoder/skills/          Maintained architecture/feature/react maps
```

`public/` is build output — never edit it by hand. It is produced by
`npm --prefix frontend run build` (Vite `outDir: '../public'`, `emptyOutDir: true`).

## Frontend Source Structure

```text
frontend/src/
├── main.tsx                    StrictMode entry; root creation + provider composition
├── styles.css                  Global application styles (single stylesheet)
├── vite-env.d.ts               Vite client types
├── app/                        Application shell and shared contracts
│   ├── App.tsx                 Owns activeView, filter, refreshSignal, primaryAction, counts
│   ├── AppProviders.tsx        ToastProvider + DialogProvider wrapper
│   ├── navigation.ts           VIEW_METADATA (titles/subtitles per view)
│   └── types.ts                ViewId, ViewProps, PrimaryAction, ResourceCounts
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx         Navigation + resource counts
│   │   ├── Topbar.tsx          Title, search filter, refresh, primary action slot
│   │   └── EngineStatus.tsx    Engine up/down badge (health + version, 10s poll)
│   └── ui/
│       ├── Modal.tsx           Base modal primitive
│       ├── Drawer.tsx          Side drawer primitive (container details)
│       ├── DialogProvider.tsx  Promise-based confirm/prompt provider
│       ├── dialogContext.ts    DialogApi contract + useDialog hook
│       ├── ToastProvider.tsx   Toast list provider
│       ├── toastContext.ts     ToastApi contract + useToast hook
│       ├── Feedback.tsx        EmptyState / LoadingState / ErrorState
│       ├── DataDisplay.tsx     KeyValueList, StatusPill, shared display bits
│       └── Icon.tsx            Hand-authored inline SVG icon set (IconName union)
├── features/                   One directory per Docker resource screen
│   ├── dashboard/
│   │   ├── DashboardView.tsx   Overview: stat cards, disk-usage chart, engine panel
│   │   └── components/
│   │       ├── DiskUsageChart.tsx     Recharts donut + interactive legend
│   │       └── DiskCleanupDialog.tsx  Prune targets with reclaim estimates
│   ├── containers/
│   │   ├── ContainersView.tsx  List, buckets, filter, prune, polling (4s)
│   │   ├── containerActions.ts Shared lifecycle action union + performContainerAction
│   │   ├── containerConfig.ts  Controlled form values → Docker create config
│   │   ├── containerUtils.ts   Naming / activity helpers
│   │   └── components/
│   │       ├── ContainerRow.tsx            Summary row + per-row actions
│   │       ├── RunContainerDialog.tsx      Controlled creation form
│   │       ├── ContainerDetailDrawer.tsx   Detail coordination + tabs
│   │       ├── ContainerLogs.tsx           Historical/followed logs (bounded DOM append)
│   │       ├── ContainerStats.tsx          Streamed stats + derived metrics
│   │       ├── ContainerProcesses.tsx      top output, optional 2s poll while running
│   │       └── ContainerInspect.tsx        Inspect JSON display, copy, download
│   ├── images/
│   │   ├── ImagesView.tsx      List/search/sort, pull, tag, run, remove, prune
│   │   └── components/
│   │       ├── ImageRow.tsx
│   │       └── PullImageDialog.tsx         Streaming pull progress per layer
│   ├── volumes/
│   │   ├── VolumesView.tsx     List/search, create, inspect, remove, prune
│   │   └── components/VolumeDialogs.tsx
│   ├── networks/
│   │   ├── NetworksView.tsx    List/search, create, inspect, remove, prune
│   │   ├── networkUtils.ts     Built-in detection, subnet extraction
│   │   └── components/NetworkDialogs.tsx
│   └── system/
│       ├── SystemView.tsx      Engine info/version details
│       └── components/LiveEvents.tsx   Streamed /events with pause + clear
├── hooks/
│   ├── useAsyncData.ts         Generic loading/error/data + stale-response guard
│   └── useInterval.ts          Declarative setInterval (nullable delay, latest-cb ref)
├── lib/
│   ├── api/
│   │   ├── client.ts           Generic request<T> / streamRequest / ApiError
│   │   ├── docker.ts           Typed Docker endpoint wrappers + NDJSON helper
│   │   └── index.ts            Barrel (import * as api from '@/lib/api')
│   ├── browser.ts              Clipboard + download helpers
│   └── format.ts               formatBytes, shortenId, date helpers
└── types/
    └── docker.ts               Docker Engine request/response models
```

## Backend Structure (`server.py`, single file)

| Section | Responsibility |
|---|---|
| Configuration | `DOCKER_SOCKET`, `HOST`, `PORT` env vars; `PUBLIC_DIR` static root; MIME table |
| `UnixHTTPConnection` | `http.client.HTTPConnection` subclass dialing a unix domain socket |
| `StreamDemuxer` | Removes Docker's 8-byte stdout/stderr multiplex framing from log streams |
| `docker_request()` | Opens a socket connection and issues one Engine API request |
| Disk-usage cache | 60s TTL cache for `GET /system/df` (`DF_CACHE_TTL` env override); lock coalesces concurrent walks; any non-GET API call invalidates it |
| `Handler` | `BaseHTTPRequestHandler` (HTTP/1.1, `ThreadingHTTPServer`): routing, CORS, static files, JSON proxy, stream proxying |
| `_classify_stream()` | Maps paths to stream kinds: `*/logs` → logs, `*/stats?stream=1` / `*/events` / `POST /images/create` → raw |
| `_stream_logs()` | One-shot (demuxed) or follow mode (chunked, frame-by-frame demux); TTY-aware |
| `_stream_raw()` | Chunked passthrough for stats/events/pull progress |
| `_proxy_simple()` | Read-full-body JSON proxy for everything else |
| `main()` | Socket checks, `ThreadingHTTPServer` with daemon threads, serve loop |

## Build & Run Commands

Run from the project root:

| Command | Purpose |
|---|---|
| `npm --prefix frontend run dev` | Vite dev server (port 5173, proxies `/api` → `http://127.0.0.1:8420`) |
| `npm --prefix frontend run typecheck` | `tsc --noEmit` |
| `npm --prefix frontend run lint` | ESLint, zero warnings allowed |
| `npm --prefix frontend run format` / `format:check` | Prettier write / verify |
| `npm --prefix frontend run check` | typecheck + lint + format:check |
| `npm --prefix frontend run build` | typecheck + Vite build into `../public` |
| `python3 server.py` | Serve `public/` and proxy `/api/*` to Docker (default `127.0.0.1:8420`) |
| `python3 app.py` | Run the desktop app (native pywebview window; needs `pip install pywebview`) |
| `./build_desktop.sh` | Build frontend + PyInstaller + AppImage into `docker-local-management-<ver>-<arch>.AppImage` |

Environment overrides: `HOST`, `PORT`, `DOCKER_SOCKET`, `DF_CACHE_TTL` (server);
`DOCKER_UI_BACKEND` (Vite dev proxy target).

## Key Configuration

- `frontend/tsconfig.json` — strict mode, `noUnusedLocals/Parameters`, bundler
  resolution, `baseUrl: "."` with `paths: { "@/*": ["./src/*"] }`, `noEmit`.
- `frontend/vite.config.ts` — React plugin, `@` alias, sourcemaps,
  `build.outDir: '../public'`, dev proxy for `/api` (ws disabled; streams are plain HTTP).
- `frontend/eslint.config.js` — TypeScript, React Hooks, React Refresh rules.
- `frontend/package.json` — runtime deps limited to `react`, `react-dom` and
  `recharts` (dashboard donut chart); all other UI is hand-rolled.
- `server.py` — no dependencies beyond the Python standard library.

## Naming & Code Conventions

- Components and component files: `PascalCase`, named exports.
- Hooks: `use*.ts`; utilities/non-component modules: `camelCase.ts`.
- Feature-specific code lives in its feature directory until reused by multiple features.
- Cross-layer imports use `@/`; relative imports within a feature or tightly coupled UI files.
- Explicit `import type` for type-only imports (`isolatedModules`).
- Context contracts + consumer hooks live in separate `.ts` files from provider
  components (`dialogContext.ts` vs `DialogProvider.tsx`) for Fast Refresh.
- Request state via `useAsyncData`, polling via `useInterval` — no ad-hoc effect loops.
- Every stream/timer/listener gets effect cleanup.

## Deployment Pipeline

```text
main.tsx → React app → Vite production build → public/
browser → server.py static handler → public/assets/*
browser /api/* → server.py → /var/run/docker.sock → Docker Engine
```

## Desktop App & Auto-Update

The web app is also shipped as an installable Linux **AppImage**.

```text
app.py
  ├─ pick_port()      prefers 8420, else an OS-assigned free port
  ├─ start_server()   sets PUBLIC_DIR to the bundled public/, imports server,
  │                   runs server.Handler in a ThreadingHTTPServer daemon thread
  ├─ wait_ready()     polls /api/_health before opening the window
  ├─ webview window   native pywebview (WebKitGTK) pointing at 127.0.0.1:<port>
  └─ updater          after load, checks GitHub Releases; prompts + self-updates
```

- **Version source of truth:** the `VERSION` file (bundled via `desktop.spec`).
  `updater.py` compares it against the latest GitHub Release `tag_name`.
- **Packaging:** `build_desktop.sh` builds the frontend, runs PyInstaller
  (`desktop.spec`, onedir), assembles an `AppDir` (`packaging/AppRun`,
  `.desktop`, `icon.png`) and packs it with `appimagetool` (extracted, so no
  FUSE is needed in CI).
- **Release / auto-update loop:** pushing a `v*` tag runs
  `.github/workflows/release.yml`, which rebuilds the AppImage and attaches it
  to a GitHub Release. On next launch the running app detects the newer tag,
  downloads the new `.AppImage`, atomically replaces the file at `$APPIMAGE`
  and re-execs itself. The tag must equal the `VERSION` file or CI fails fast.
- **Runtime requirement:** the target machine needs WebKitGTK
  (`libwebkit2gtk-4.0` or `4.1`) present, which pywebview uses to render.
