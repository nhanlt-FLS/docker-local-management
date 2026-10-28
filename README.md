# Docker Local Management

A lightweight, local Docker management UI (Docker Desktop–like) for Linux:

- **Backend** — `server.py`, a dependency-free Python (stdlib-only) HTTP server
  that serves the web UI and proxies `/api/*` to the Docker Engine over the unix
  socket (including streaming logs, stats, events and image pulls).
- **Frontend** — a React 18 + TypeScript + Vite single-page app in `frontend/`,
  built into `public/`.
- **Desktop app** — `app.py` wraps the server in a native window and is packaged
  as an installable app with built-in **auto-update**:
  - **Linux** — pywebview (WebKitGTK) window, shipped as an **AppImage**.
  - **Windows** — Chromium "app mode" window (Edge/Chrome), shipped as a
    portable **`.exe`** plus an **Inno Setup installer**.

## Run from source

```bash
# 1. Build the frontend into ./public (only needed after UI changes)
npm --prefix frontend ci
npm --prefix frontend run build

# 2. Serve the UI and proxy to Docker on http://127.0.0.1:8420
python3 server.py
```

Requirements: Docker running locally, and your user in the `docker` group
(read/write access to `/var/run/docker.sock`).

Environment overrides: `HOST`, `PORT`, `DOCKER_SOCKET`, `PUBLIC_DIR`,
`DF_CACHE_TTL`.

## Run the desktop app from source

```bash
python3 -m pip install -r requirements-desktop.txt
python3 app.py
```

This starts the embedded server on a free port (prefers `8420`) and opens a
native window. On Linux it renders with WebKitGTK, so ensure
`libwebkit2gtk-4.0` (or `4.1`) is installed.

## Build the installable AppImage

```bash
./build_desktop.sh
# -> docker-local-management-<version>-<arch>.AppImage
```

Install it by making it executable and running it (`chmod +x *.AppImage &&
./docker-local-management-*.AppImage`). To add it to your application menu,
tools such as AppImageLauncher can register it automatically.

## One-file installer (recommended)

Each release also publishes `install-docker-local-management.sh` — a single
setup file that does everything for you:

```bash
curl -fLO https://github.com/nhanlt-FLS/docker-local-management/releases/latest/download/install-docker-local-management.sh
bash install-docker-local-management.sh
```

It will:

1. install missing system dependencies (WebKitGTK for the window, FUSE to run
   the AppImage) via `apt`,
2. install the AppImage to `~/.local/share/docker-local-management/` — reusing
   one already in `~/Downloads` (or passed as an argument), otherwise
   downloading the latest release,
3. create an application-menu launcher + icon, and
4. add a `docker-local-management` command to `~/.local/bin`.

Afterwards launch it from your app menu ("Docker Local Management") or run
`docker-local-management`.

## Windows

Releases publish two Windows artifacts:

- `docker-local-management-setup-<ver>.exe` — an Inno Setup installer (per-user,
  no admin needed). Run it once to install + create shortcuts.
- `docker-local-management-<ver>-win64.exe` — a portable single-file executable
  (also the asset the auto-updater downloads).

**Docker connection on Windows:** Docker Desktop does not expose a unix socket to
the host, so the app talks to it over TCP. In Docker Desktop open
**Settings → General** and enable **"Expose daemon on tcp://localhost:2375 without
TLS"**, then restart Docker Desktop. (Or set `DOCKER_HOST=tcp://host:port`.)

The window is rendered by Edge/Chrome in app mode (a clean window with no address
bar); no extra runtime is required beyond a Chromium-based browser, which Windows
10/11 always has.

## Auto-update & releasing a new version

The app self-updates from **GitHub Releases**:

1. Bump the version in the [`VERSION`](./VERSION) file (e.g. `0.2.0`).
2. Commit and push, then push a matching tag:

   ```bash
   git commit -am "Release v0.2.0"
   git tag v0.2.0
   git push && git push origin v0.2.0
   ```

3. The [`Release` workflow](./.github/workflows/release.yml) builds the AppImage
   and publishes it as a GitHub Release (the tag must equal `VERSION`, or the
   build fails fast).
4. On next launch, any installed app detects the newer release, prompts the
   user, downloads the new `.AppImage`, replaces itself and relaunches.

Update checks hit `https://api.github.com/repos/nhanlt-FLS/docker-local-management/releases/latest`
(override the repo with the `UPDATE_REPO` env var).

## Project docs

See [`knowledges/`](./knowledges) for deeper maps:
[`STRUCTURE.md`](./knowledges/STRUCTURE.md),
[`FEATURES.md`](./knowledges/FEATURES.md),
[`FLOWS.md`](./knowledges/FLOWS.md).
