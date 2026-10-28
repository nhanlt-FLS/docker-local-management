#!/usr/bin/env bash
#
# One-file installer for Docker Local Management (Linux).
#
# Running this single script sets everything up:
#   1. installs missing system dependencies (WebKitGTK for the window, FUSE for
#      running the AppImage) via the system package manager,
#   2. installs the AppImage to ~/.local/share/docker-local-management/
#      (reusing one found in ~/Downloads / next to this script, else downloading
#      the latest from GitHub Releases),
#   3. creates an application-menu launcher (.desktop) + icon,
#   4. adds a `docker-local-management` command to ~/.local/bin.
#
# Usage:   bash install.sh [path-to-AppImage]
#          (or make it executable and double-click / run ./install.sh)
#
set -euo pipefail

APP_NAME="docker-local-management"
REPO="${UPDATE_REPO:-nhanlt-FLS/docker-local-management-dist}"
INSTALL_DIR="$HOME/.local/share/$APP_NAME"
APPIMAGE_PATH="$INSTALL_DIR/$APP_NAME.AppImage"
BIN_DIR="$HOME/.local/bin"
DESKTOP_DIR="$HOME/.local/share/applications"
ICON_PATH="$INSTALL_DIR/$APP_NAME.png"
ICON_URL="https://raw.githubusercontent.com/$REPO/main/packaging/icon.png"

log()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[warn]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[error]\033[0m %s\n' "$*" >&2; exit 1; }

SUDO=""
if [ "$(id -u)" -ne 0 ]; then
    if command -v sudo >/dev/null 2>&1; then SUDO="sudo"; fi
fi

# --------------------------------------------------------------------------- #
# 1. System dependencies
# --------------------------------------------------------------------------- #
have_lib() { ldconfig -p 2>/dev/null | grep -q "$1"; }

apt_install() {
    # apt_install <lib-pattern> <pkg-candidates...>
    local pattern="$1"; shift
    have_lib "$pattern" && { log "already present: $pattern"; return 0; }
    command -v apt-get >/dev/null 2>&1 || { warn "no apt-get; please install $pattern manually"; return 0; }
    local pkg
    for pkg in "$@"; do
        if apt-cache policy "$pkg" 2>/dev/null | grep -q 'Candidate:'; then
            log "installing $pkg (provides $pattern)"
            $SUDO apt-get update -qq
            $SUDO apt-get install -y -qq "$pkg"
            return 0
        fi
    done
    warn "could not find a package providing $pattern; install it manually"
}

log "Checking system dependencies"
# WebKitGTK renders the app window (pywebview). Try 4.1 then 4.0.
apt_install 'libwebkit2gtk-4' libwebkit2gtk-4.1-0 libwebkit2gtk-4.0-37 libwebkit2gtk-4.0-dev
# FUSE is required to mount/run AppImages on modern Ubuntu.
apt_install 'libfuse.so.2' libfuse2t64 libfuse2

# --------------------------------------------------------------------------- #
# 2. Locate or download the AppImage
# --------------------------------------------------------------------------- #
find_local_appimage() {
    local candidate
    # explicit argument wins
    if [ $# -ge 1 ] && [ -f "$1" ]; then printf '%s' "$1"; return 0; fi
    # newest match in Downloads, this script's dir, and cwd
    for dir in "$HOME/Downloads" "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)" "$PWD"; do
        candidate="$(ls -1t "$dir"/${APP_NAME}-*.AppImage 2>/dev/null | head -n1 || true)"
        if [ -n "$candidate" ] && [ -f "$candidate" ]; then printf '%s' "$candidate"; return 0; fi
    done
    return 1
}

download_latest_appimage() {
    local dest="$1" api tag url
    log "Downloading latest AppImage from GitHub Releases"
    api="https://api.github.com/repos/$REPO/releases/latest"
    tag="$(curl -fsSL "$api" | sed -n 's/.*"tag_name": *"\([^"]*\)".*/\1/p' | head -n1)"
    [ -n "$tag" ] || die "could not determine latest release"
    url="https://github.com/$REPO/releases/download/$tag/${APP_NAME}-${tag#v}-$(uname -m).AppImage"
    curl -fL --progress-bar -o "$dest" "$url" || die "download failed: $url"
}

SRC_APPIMAGE="$(find_local_appimage "$@" || true)"

mkdir -p "$INSTALL_DIR" "$BIN_DIR" "$DESKTOP_DIR"

if [ -n "$SRC_APPIMAGE" ]; then
    log "Using local AppImage: $SRC_APPIMAGE"
    cp -f "$SRC_APPIMAGE" "$APPIMAGE_PATH"
else
    download_latest_appimage "$APPIMAGE_PATH"
fi
chmod +x "$APPIMAGE_PATH"

# --------------------------------------------------------------------------- #
# 3. Icon + application-menu launcher
# --------------------------------------------------------------------------- #
if curl -fsSL -o "$ICON_PATH" "$ICON_URL" 2>/dev/null; then
    log "Installed icon"
else
    warn "could not fetch icon; launcher will use a default icon"
    ICON_PATH=""
fi

DESKTOP_FILE="$DESKTOP_DIR/$APP_NAME.desktop"
{
    echo "[Desktop Entry]"
    echo "Type=Application"
    echo "Name=Docker Local Management"
    echo "GenericName=Docker Manager"
    echo "Comment=Manage local Docker containers, images, volumes and networks"
    echo "Exec=$APPIMAGE_PATH"
    [ -n "$ICON_PATH" ] && echo "Icon=$ICON_PATH"
    echo "Terminal=false"
    echo "Categories=Development;System;Utility;"
    echo "StartupWMClass=$APP_NAME"
} > "$DESKTOP_FILE"
chmod +x "$DESKTOP_FILE"
if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database "$DESKTOP_DIR" >/dev/null 2>&1 || true
fi

# --------------------------------------------------------------------------- #
# 4. Command-line launcher
# --------------------------------------------------------------------------- #
cat > "$BIN_DIR/$APP_NAME" <<EOF
#!/bin/sh
exec "$APPIMAGE_PATH" "\$@"
EOF
chmod +x "$BIN_DIR/$APP_NAME"

# --------------------------------------------------------------------------- #
log "Installation complete"
cat <<EOF

  AppImage : $APPIMAGE_PATH
  Launcher : $DESKTOP_FILE
  Command  : $BIN_DIR/$APP_NAME

Launch it from your application menu ("Docker Local Management"), or run:
  $APPIMAGE_PATH
Make sure Docker is running and your user can access /var/run/docker.sock.
EOF
