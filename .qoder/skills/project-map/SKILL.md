---
name: project-map
description: Complete architectural map of docker_local_management. Provides file locations, naming conventions, build commands, and placement guidance. Use BEFORE implementing any feature.
---

# Docker Local Management Architecture Map

> **Related skills:** See `features-map` for the feature inventory and `react-map` for React data flow and learning examples.

## Quick Reference — "Where does this go?"

| Intent | Location |
|---|---|
| Add application-wide state or change view composition | `frontend/src/app/` |
| Add navigation metadata or shared view contracts | `frontend/src/app/navigation.ts`, `frontend/src/app/types.ts` |
| Add reusable layout or UI primitives | `frontend/src/components/layout/`, `frontend/src/components/ui/` |
| Add a Docker resource screen | `frontend/src/features/<resource>/` |
| Add a resource-specific dialog, row, or detail panel | `frontend/src/features/<resource>/components/` |
| Add reusable asynchronous or timer behavior | `frontend/src/hooks/` |
| Add a Docker endpoint wrapper | `frontend/src/lib/api/docker.ts` |
| Change generic HTTP or stream behavior | `frontend/src/lib/api/client.ts` |
| Add formatting or browser-only helpers | `frontend/src/lib/format.ts`, `frontend/src/lib/browser.ts` |
| Add Docker API models | `frontend/src/types/docker.ts` |
| Change global styles | `frontend/src/styles.css` |
| Change backend proxy or stream handling | `server.py` |

## Project Root

```text
docker_local_management/
├── frontend/               React 18 + TypeScript + Vite source
│   ├── src/                Application source
│   ├── eslint.config.js    Flat ESLint configuration
│   ├── package.json        Dependencies and verification scripts
│   ├── tsconfig.json       Strict TypeScript and @/* aliases
│   └── vite.config.ts      Build output, alias, and development proxy
├── public/                 Generated production frontend served by Python
├── server.py               Dependency-free Python HTTP/Docker proxy server
└── .qoder/skills/          Maintained architecture and feature guides
```

## Frontend Source Structure

```text
frontend/src/
├── app/                    Shell, providers, navigation, shared app contracts
├── components/
│   ├── layout/             Sidebar, top bar, engine status
│   └── ui/                 Reusable display, modal, drawer, feedback, contexts
├── features/
│   ├── containers/         List, actions, creation, details, logs, stats, processes
│   ├── dashboard/          Overview and quick actions
│   ├── images/             List, pull, tag, remove, prune, run
│   ├── networks/           List, create, inspect, remove, prune
│   ├── system/             Engine details and live events
│   └── volumes/            List, create, inspect, remove, prune
├── hooks/                  Generic useAsyncData and useInterval hooks
├── lib/
│   ├── api/                Generic HTTP client and typed Docker endpoints
│   ├── browser.ts          Clipboard and download helpers
│   └── format.ts           Display formatting and parsing helpers
├── types/docker.ts         Docker domain contracts
├── main.tsx                StrictMode entry point and provider composition
└── styles.css              Global application styles
```

## Build System

Run commands from the project root:

| Command | Purpose |
|---|---|
| `npm --prefix frontend run dev` | Start Vite development server |
| `npm --prefix frontend run typecheck` | Run TypeScript without emitting files |
| `npm --prefix frontend run lint` | ESLint with zero warnings allowed |
| `npm --prefix frontend run format` | Format source and configuration with Prettier |
| `npm --prefix frontend run format:check` | Verify formatting |
| `npm --prefix frontend run check` | Typecheck, lint, and formatting check |
| `npm --prefix frontend run build` | Typecheck and build into `public/` |
| `python3 server.py` | Serve `public/` and proxy Docker API requests |

Vite listens on port 5173 by default and proxies `/api` to `http://127.0.0.1:8420`. `DOCKER_UI_BACKEND` overrides that proxy target. The Python server defaults to `127.0.0.1:8420`; `HOST`, `PORT`, and `DOCKER_SOCKET` configure it.

## Naming and Code Conventions

- React components and component files use `PascalCase`; functions use named exports.
- Hooks use `use*.ts`; utilities and non-component modules use `camelCase.ts`.
- Feature-specific code stays inside its feature directory until reused by multiple features.
- Import across layers with `@/`; use relative imports within a feature or closely related UI files.
- Use explicit `import type` for TypeScript-only imports.
- Keep providers separate from context hooks so Fast Refresh remains effective.
- Use `useAsyncData` for request state and `useInterval` for polling rather than duplicating lifecycle code.

## Key Configuration

- `frontend/tsconfig.json`: strict checks, unused-code checks, bundler resolution, `@/*` mapping.
- `frontend/eslint.config.js`: TypeScript, React Hooks, and React Refresh rules.
- `frontend/.prettierrc.json`: shared formatting rules; generated output is ignored.
- `frontend/vite.config.ts`: React plugin, alias, source maps, `../public` output, API proxy.
- `server.py`: static file serving, Docker unix-socket connection, routing, stream classification.

## Deployment Pipeline

`main.tsx` → React application → Vite production bundle → `public/` → `server.py` static handler. Browser `/api/*` requests follow `server.py` → `/var/run/docker.sock` → Docker Engine. Logs, stats, events, and image pulls use streaming backend paths rather than the simple JSON proxy.
