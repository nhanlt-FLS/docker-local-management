# Which file should I download?

| File | Platform | What it is |
|---|---|---|
| `docker-local-management-setup-<ver>.exe` | **Windows** | **One-file installer (recommended).** Double-click it, follow the wizard, launch from the Start menu. No admin needed. |
| `docker-local-management-<ver>-win64.exe` | **Windows** | Portable single-file app. No installation — just double-click to run. |
| `install-docker-local-management.sh` | **Linux** | **One-file setup script (recommended).** Run `bash install-docker-local-management.sh`; it installs dependencies, the app, and a menu entry. |
| `docker-local-management-<ver>-x86_64.AppImage` | **Linux** | The app itself for manual use: `chmod +x` then run it. |

The `Source code (zip)` / `Source code (tar.gz)` entries are just the raw
repository snapshot — you do not need them to run the app.

## Before you run it

- **Docker must be installed and running on the device.**
- **Windows:** in Docker Desktop enable *Settings → General → "Expose daemon on
  tcp://localhost:2375 without TLS"*, then restart Docker Desktop.
- **Linux:** your user must be able to use Docker (member of the `docker` group).

## Updating

Installed apps check for a newer release on launch and offer to update
themselves — normally you never need to download again.

Full guide (install, run, troubleshooting): see the README in the repository.
