---
name: react-map
description: React component hierarchy, state ownership, hooks, contexts, API flows, and learning paths for docker_local_management. Use BEFORE changing React behavior.
---

# React Architecture and Learning Map

> **Related skills:** See `project-map` for source placement and `features-map` for feature responsibilities.

## Component Hierarchy

```text
StrictMode
└── AppProviders
    ├── ToastProvider
    └── DialogProvider
        └── App
            ├── Sidebar
            └── main
                ├── Topbar
                └── ActiveView (typed VIEW_COMPONENTS lookup)
                    └── feature-specific rows, dialogs, drawers, and panels
```

`App` owns application-wide state. Feature views own resource data and transient UI state. Reusable UI components receive props and do not call Docker APIs directly.

## Suggested Learning Path

| React concept | Study file | What to notice |
|---|---|---|
| Entry point and StrictMode | `frontend/src/main.tsx` | Root creation and provider composition |
| Composition | `frontend/src/app/AppProviders.tsx` | Small wrappers instead of deep provider setup in `main` |
| State and props | `frontend/src/app/App.tsx` | Active view, filter, refresh signal, typed props |
| Typed component maps | `frontend/src/app/App.tsx` | `Record<ViewId, ComponentType<ViewProps>>` replaces repeated branches |
| Controlled forms | `frontend/src/features/containers/components/RunContainerDialog.tsx`, `frontend/src/features/images/components/PullImageDialog.tsx` | Input values and `onChange` state updates |
| Custom data hook | `frontend/src/hooks/useAsyncData.ts` | Generic state, refs, cleanup, stale-response protection |
| Custom timer hook | `frontend/src/hooks/useInterval.ts` | Latest callback ref, nullable delay, interval cleanup |
| Memoized filtering | Resource `*View.tsx` files | Stable fallback arrays and `useMemo` dependencies |
| Context | `frontend/src/components/ui/dialogContext.ts`, `frontend/src/components/ui/toastContext.ts` | Typed API, consumer guard, provider/hook separation |
| Refs and direct DOM updates | `frontend/src/features/containers/components/ContainerLogs.tsx` | Avoiding React state updates for every high-frequency chunk |
| Effect cleanup | Logs, stats, processes, live events | Abort streams, clear timers, invalidate late completions |

## State Ownership

### Application level

`App.tsx` owns `activeView`, `filter`, `refreshSignal`, `primaryAction`, and asynchronously loaded resource counts. `navigate` resets the filter. A view mutation invokes `onMutated` so counts refresh without moving resource-specific state into the shell.

### Feature level

Each resource view owns list data through `useAsyncData`, search/filter derivatives through `useMemo`, selected resource state, and dialog visibility. Feature actions call the API and then reload their own data plus application counts.

### Reusable UI level

`ToastProvider` owns toast items and IDs. `DialogProvider` owns a discriminated-union dialog state and resolves promise-based confirm/prompt requests. Their contexts and hooks live in separate `.ts` files for Fast Refresh compatibility.

## Asynchronous Data Flow

1. A feature calls `useAsyncData(loader, refreshSignal)`.
2. The hook stores the latest loader in a ref.
3. `reload` starts a request and increments a request ID.
4. Only the latest request may update data, error, or loading state.
5. Effect cleanup invalidates outstanding completions.
6. Silent reloads preserve current UI during polling.

Use `useInterval` for periodic reloads. Its callback ref prevents timer recreation on every render, and hidden-tab polling is paused by default.

## API Boundaries

- `lib/api/client.ts`: generic `request<T>` and `streamRequest`; no Docker endpoint knowledge.
- `lib/api/docker.ts`: typed Docker paths and stream transformations.
- `lib/api/index.ts`: barrel imported as `import * as api from '@/lib/api'`.
- `types/docker.ts`: Docker request/response models.

Normal request flow:

```text
component event → api function → request<T> → /api/* → server.py → Docker
```

Streaming flow:

```text
effect → streamRequest/streamJsonLines → fetch reader → decoded chunks
       → component update or bounded DOM append → cleanup aborts reader
```

Logs use text chunks; stats and events use newline-delimited JSON; image pulls process streamed progress events. Components that start streams asynchronously also handle the case where cleanup occurs before the stream handle resolves.

## Modification Guidelines

- Add resource behavior in its feature module, not in reusable UI.
- Reuse `useAsyncData` and `useInterval` before writing new effect-based request or timer logic.
- Keep derived lists memoized only when referential stability or computation justifies it.
- Keep Docker models in `types/docker.ts` and endpoint wrappers in `lib/api/docker.ts`.
- Preserve effect cleanup for every stream, timer, animation frame, and event listener.
- Run `npm --prefix frontend run check` and `npm --prefix frontend run build` after source changes.
