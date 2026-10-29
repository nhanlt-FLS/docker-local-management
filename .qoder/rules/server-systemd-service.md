# Server Runs via systemd (Do Not Start Manually)

The local server is managed by a systemd **user** service named `docker-local-management`, installed from `deploy/docker-local-management.service` via `deploy/install-service.sh`. It starts automatically at login (linger is enabled), restarts on crash, and listens on `127.0.0.1:8420`.

- Do **not** launch the server with a manual `python3 server.py` background process; that duplicates the service and dies with the IDE session.
- To check or control it:
  - `systemctl --user status docker-local-management`
  - `systemctl --user restart docker-local-management`
  - `journalctl --user -u docker-local-management -f`
- Health check: `curl -s http://127.0.0.1:8420/api/_health` should return `200`.
- After editing `server.py`, run `systemctl --user restart docker-local-management` to apply changes.
- After editing frontend source under `frontend/src`, run `npm run build` in `frontend/` (regenerates `../public`); no server restart is needed for static asset changes.
- If the service is missing on a new machine, run `bash deploy/install-service.sh` to install and enable it.
