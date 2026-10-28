# Docker Local Management

A lightweight, local **Docker management UI** (like Docker Desktop, but a small
self-hosted app) for **Linux** and **Windows**. It shows containers, images,
volumes, networks, live logs/stats/events and disk usage, and lets you run,
stop, prune and inspect everything — all against your local Docker engine.

- **Backend** — `server.py`, a dependency-free Python (stdlib-only) HTTP server
  that serves the web UI and proxies `/api/*` to the Docker Engine.
- **Frontend** — a React 18 + TypeScript + Vite single-page app.
- **Desktop app** — packaged per platform with built-in **auto-update**:
  - **Linux** — native window (WebKitGTK), shipped as an **AppImage**.
  - **Windows** — clean Chromium "app mode" window (Edge/Chrome), shipped as an
    **installer `.exe`** and a **portable `.exe`**.

---

## 1. Which file should I download?

Go to the **[latest release](https://github.com/nhanlt-FLS/docker-local-management/releases/latest)**
and pick the file for your OS:

| Your OS | Download this | What it is |
|---|---|---|
| **Windows** | `docker-local-management-setup-<ver>.exe` | Installer (recommended). Run once; adds Start-menu + desktop shortcuts. |
| **Windows** | `docker-local-management-<ver>-win64.exe` | Portable single-file app. No install; just double-click. |
| **Linux** | `install-docker-local-management.sh` | One-file setup script (recommended). Installs deps + app + menu entry. |
| **Linux** | `docker-local-management-<ver>-x86_64.AppImage` | The app itself, if you prefer to manage it manually. |

> Not sure? **Windows → the `setup` `.exe`. Linux → the `install-...sh` script.**

---

## 2. Before you install (prerequisites)

- **Docker must be installed and running.**
- **Linux:** your user needs access to Docker (normally membership in the
  `docker` group). The installer script installs the two system libraries the
  app needs (WebKitGTK and FUSE) automatically.
- **Windows:** Docker Desktop does not expose a unix socket, so the app talks to
  it over TCP. In Docker Desktop open
  **Settings → General** and tick **"Expose daemon on tcp://localhost:2375 without TLS"**,
  then **restart Docker Desktop**. (Alternatively set the `DOCKER_HOST`
  environment variable, e.g. `tcp://localhost:2375`.)

---

## 3. Install & run — Windows

**Installer (recommended):**

1. Download `docker-local-management-setup-<ver>.exe` and double-click it.
2. Follow the wizard (installs per-user into `%LocalAppData%`; **no admin needed**).
   Tick "Create a desktop icon" if you want one.
3. Make sure the Docker Desktop TCP option above is enabled and Docker is running.
4. Launch **Docker Local Management** from the Start menu / desktop icon
   (or run the portable `docker-local-management-<ver>-win64.exe` directly).

The app opens a clean window (no address bar) rendered by your Edge/Chrome.
If Windows SmartScreen warns about an unsigned app, choose **More info → Run anyway**.

## 4. Install & run — Linux

**One-file installer (recommended):**

```bash
curl -fLO https://github.com/nhanlt-FLS/docker-local-management/releases/latest/download/install-docker-local-management.sh
bash install-docker-local-management.sh
```

It will: install missing system deps via `apt`; install the app to
`~/.local/share/docker-local-management/` (reusing an AppImage already in
`~/Downloads`, else downloading the latest); add an application-menu entry +
icon; and add a `docker-local-management` command. Then launch it from your app
menu, or:

```bash
docker-local-management
```

**Manual (AppImage) instead:**

```bash
chmod +x docker-local-management-*.AppImage
./docker-local-management-*.AppImage
```

If it complains about `libfuse.so.2`, run `sudo apt install libfuse2t64`
(or `libfuse2` on older releases). If the window fails to open, install
WebKitGTK: `sudo apt install libwebkit2gtk-4.1-0`.

---

## 5. Updating the app

You normally **don't need to do anything**: on launch the app checks GitHub for a
newer release and, if found, asks whether to update.

- **Linux:** it downloads the new AppImage, replaces the running file and relaunches.
- **Windows:** a running `.exe` can't be overwritten, so it downloads the new
  `.exe` beside it and swaps + relaunches right after the app closes.

To update manually, just download the newest release again and reinstall/rerun.

---

## 6. Troubleshooting

| Symptom | Fix |
|---|---|
| Repeated `GET /api/_health ... 503`, window shows engine down | The app is running but **cannot reach Docker**. Start Docker (`sudo systemctl start docker`), ensure it's installed, and on Linux make sure your user is in the `docker` group. The app now prints the exact Docker error to the terminal. |
| Linux: `dlopen(): error loading libfuse.so.2` | `sudo apt install libfuse2t64` (or `libfuse2`) |
| Linux: window doesn't open / WebKit missing | `sudo apt install libwebkit2gtk-4.1-0` (or `4.0`) |
| Linux: `Docker socket not found at /var/run/docker.sock` | Start Docker; ensure your user is in the `docker` group (`sudo usermod -aG docker $USER`, then re-login) |
| Windows: `Cannot reach Docker at tcp://127.0.0.1:2375` | Enable *"Expose daemon on tcp://localhost:2375 without TLS"* in Docker Desktop → Settings → General, then restart Docker Desktop |
| Windows: SmartScreen warning | Unsigned app → **More info → Run anyway** |
| Port 8420 already in use | The app automatically picks a free port; nothing to do |

---

## 7. For developers

Run from source (Linux):

```bash
npm --prefix frontend ci && npm --prefix frontend run build   # build UI into ./public
python3 server.py                                              # serve on http://127.0.0.1:8420
# or the desktop window:
python3 -m pip install -r requirements-desktop.txt && python3 app.py
```

Build the Linux AppImage locally: `./build_desktop.sh`.

**Releasing a new version** (this also feeds auto-update):

1. Bump [`VERSION`](./VERSION) (e.g. `0.3.0`).
2. `git commit -am "Release v0.3.0" && git tag v0.3.0 && git push && git push origin v0.3.0`
3. The [`Release` workflow](./.github/workflows/release.yml) builds **both**
   platforms and publishes all artifacts (the tag must equal `VERSION`).

Environment overrides: `HOST`, `PORT`, `DOCKER_SOCKET`, `DOCKER_HOST`,
`PUBLIC_DIR`, `DF_CACHE_TTL`, `UPDATE_REPO`.

Deeper architecture/feature maps live in [`knowledges/`](./knowledges):
[`STRUCTURE.md`](./knowledges/STRUCTURE.md),
[`FEATURES.md`](./knowledges/FEATURES.md),
[`FLOWS.md`](./knowledges/FLOWS.md).
