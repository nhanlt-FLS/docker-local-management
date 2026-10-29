#!/usr/bin/env bash
# Installs the docker-local-management systemd user service so the server
# starts automatically at login (linger) and restarts if it crashes.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UNIT_DIR="$HOME/.config/systemd/user"

mkdir -p "$UNIT_DIR"
cp "$REPO_DIR/deploy/docker-local-management.service" "$UNIT_DIR/docker-local-management.service"

systemctl --user daemon-reload
systemctl --user enable --now docker-local-management.service

# Keep the service running even after full logout (no re-login needed).
loginctl enable-linger "$USER" 2>/dev/null || sudo loginctl enable-linger "$USER"

systemctl --user --no-pager status docker-local-management.service || true
echo
echo "Installed. Useful commands:"
echo "  systemctl --user status docker-local-management"
echo "  systemctl --user restart docker-local-management"
echo "  journalctl --user -u docker-local-management -f"
