#!/usr/bin/env bash
#
# Build the Local Docker Management desktop app into a single AppImage.
#
# Steps: build the React frontend into public/, install desktop build deps,
# run PyInstaller (onedir), assemble an AppDir, then pack it with appimagetool.
# The same script is used by the GitHub Actions release workflow.
#
# Usage:  ./build_desktop.sh
# Env:    SKIP_FRONTEND=1  -> reuse the existing public/ instead of rebuilding
#         ARCH=x86_64|aarch64 (defaults to the host arch)
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

APP_NAME="docker-local-management"
VERSION="$(tr -d '[:space:]' < VERSION)"
ARCH="${ARCH:-$(uname -m)}"
case "$ARCH" in
    x86_64)  ARCH_TAG="x86_64" ;;
    aarch64) ARCH_TAG="aarch64" ;;
    *)       ARCH_TAG="$ARCH" ;;
esac
SKIP_FRONTEND="${SKIP_FRONTEND:-0}"

echo "==> Version $VERSION ($ARCH_TAG)"

if [ "$SKIP_FRONTEND" != "1" ]; then
    echo "==> Building frontend into public/"
    ( cd frontend && npm ci && npm run build )
fi

echo "==> Installing desktop build dependencies"
python3 -m pip install --upgrade pip >/dev/null
python3 -m pip install -r requirements-desktop.txt

echo "==> Running PyInstaller"
python3 -m PyInstaller --noconfirm --clean desktop.spec

echo "==> Assembling AppDir"
rm -rf AppDir
mkdir -p \
    "AppDir/usr/bin" \
    "AppDir/usr/share/applications" \
    "AppDir/usr/share/icons/hicolor/256x256/apps"

cp -r "dist/${APP_NAME}/." AppDir/usr/bin/
cp packaging/AppRun AppDir/AppRun
chmod +x AppDir/AppRun

# .desktop: appimagetool wants one at the AppDir root and under share/applications
cp "packaging/${APP_NAME}.desktop" AppDir/
cp "packaging/${APP_NAME}.desktop" AppDir/usr/share/applications/

# Icon: a 256px PNG for the hicolor theme, full-size at the root + .DirIcon
if command -v convert >/dev/null 2>&1; then
    convert packaging/icon.png -resize 256x256 \
        "AppDir/usr/share/icons/hicolor/256x256/apps/${APP_NAME}.png"
elif command -v rsvg-convert >/dev/null 2>&1; then
    cp packaging/icon.png "AppDir/usr/share/icons/hicolor/256x256/apps/${APP_NAME}.png"
else
    cp packaging/icon.png "AppDir/usr/share/icons/hicolor/256x256/apps/${APP_NAME}.png"
fi
cp packaging/icon.png "AppDir/${APP_NAME}.png"
cp packaging/icon.png AppDir/.DirIcon

echo "==> Fetching appimagetool"
APPIMAGETOOL="appimagetool-${ARCH_TAG}.AppImage"
if [ ! -f "$APPIMAGETOOL" ]; then
    curl -L --fail -o "$APPIMAGETOOL" \
        "https://github.com/AppImage/AppImageKit/releases/download/continuous/${APPIMAGETOOL}"
    chmod +x "$APPIMAGETOOL"
fi

# Extract rather than execute the tool so no FUSE kernel module is required
# (GitHub Actions runners have no /dev/fuse).
echo "==> Packing AppImage"
rm -rf appimagetool-squashfs-root
"./$APPIMAGETOOL" --appimage-extract >/dev/null
mv squashfs-root appimagetool-squashfs-root

OUT="${APP_NAME}-${VERSION}-${ARCH_TAG}.AppImage"
rm -f "$OUT"
ARCH="$ARCH_TAG" ./appimagetool-squashfs-root/AppRun AppDir "$OUT"

echo "==> Done: $OUT"
ls -lh "$OUT"
