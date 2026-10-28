#!/usr/bin/env python3
"""
Desktop entry point for Local Docker Management.

Wraps the existing dependency-free server.py in a desktop window so the project
can be shipped as an installable app with auto-update:

  * Linux   -> native pywebview (WebKitGTK) window, packaged as an AppImage.
  * Windows -> a Chromium "app mode" window (Edge/Chrome, no address bar),
               packaged as a .exe. A dedicated browser profile is used so the
               browser process lives exactly as long as the window, which keeps
               the embedded server alive.

In both cases we:
  * pick a free local port (prefers 8420),
  * start server.py's HTTP handler in a background daemon thread,
  * wait until /api/_health answers, then open the window on that URL,
  * check GitHub Releases for a newer version and offer to self-update.

Run from source with:  python3 app.py
"""

import os
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
import json
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer

import updater

APP_NAME = "Docker Local Management"
IS_WINDOWS = sys.platform == "win32"
PREFERRED_PORT = int(os.environ.get("PORT", "8420"))
WINDOW_WIDTH = 1280
WINDOW_HEIGHT = 860


def resource_path(relative):
    """Resolve a bundled data file for both source runs and PyInstaller builds."""
    base = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, relative)


def read_version():
    try:
        with open(resource_path("VERSION"), "r", encoding="utf-8") as fh:
            return fh.read().strip()
    except OSError:
        return "0.0.0"


def pick_port(preferred=PREFERRED_PORT):
    """Return the preferred port if free, otherwise an OS-assigned free port."""
    for candidate in (preferred, 0):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            try:
                sock.bind(("127.0.0.1", candidate))
                return sock.getsockname()[1]
            except OSError:
                continue
    raise RuntimeError("Unable to bind a local port for the server")


def start_server(port):
    """Start server.py's handler on the given port in a daemon thread."""
    os.environ["PORT"] = str(port)
    os.environ.setdefault("PUBLIC_DIR", resource_path("public"))
    import server  # imported late so PUBLIC_DIR/PORT env are already set

    httpd = ThreadingHTTPServer(("127.0.0.1", port), server.Handler)
    httpd.daemon_threads = True
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    return httpd


def wait_ready(url, timeout=15.0):
    """Block until the server answers its health endpoint (or timeout).

    Returns (ready, detail) where detail carries the Docker error reported by
    /api/_health when it is not ready, so we can show an actionable message.
    """
    deadline = time.time() + timeout
    health = url + "/api/_health"
    detail = ""
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(health, timeout=2) as resp:
                if resp.status == 200:
                    return True, ""
        except urllib.error.HTTPError as exc:
            # The server is up but Docker is not reachable; surface the reason.
            try:
                body = json.loads(exc.read().decode("utf-8", "replace"))
                detail = body.get("error") or detail
            except Exception:
                detail = str(exc)
            time.sleep(0.5)
        except Exception:
            time.sleep(0.5)
    return False, detail


class Api:
    """Small surface exposed to the web UI via window.pywebview.api (Linux)."""

    def __init__(self, version):
        self._version = version

    def get_version(self):
        return self._version

    def check_for_updates(self):
        result = updater.check_for_update(self._version)
        if not result:
            return {"available": False, "version": self._version}
        tag, url = result
        return {"available": True, "latest": tag, "url": url}


# --------------------------------------------------------------------------- #
# Update prompt + apply (shared)
# --------------------------------------------------------------------------- #
def _check_and_apply(version, confirm):
    """Offer an update if available. confirm(message) -> bool.

    Returns updater.apply_update's status ("restarting"/"staged") or None/False.
    """
    result = updater.check_for_update(version)
    if not result:
        return None
    tag, url = result
    message = "Version %s is available (you are on %s).\n\nInstall now and restart?" % (
        tag,
        version,
    )
    if not confirm(message):
        return None
    return updater.apply_update(url)


# --------------------------------------------------------------------------- #
# Linux: native pywebview window
# --------------------------------------------------------------------------- #
def _linux_update_watch(window, version):
    window.events.loaded.wait()

    def confirm(message):
        return window.create_confirmation_dialog("Update available", message)

    try:
        _check_and_apply(version, confirm)
    except Exception as exc:  # dialogs unsupported on some backends
        print("[app] update prompt failed: %s" % exc, file=sys.stderr)


def _run_linux(url, version):
    import webview

    window = webview.create_window(
        APP_NAME,
        url,
        js_api=Api(version),
        width=WINDOW_WIDTH,
        height=WINDOW_HEIGHT,
        min_size=(940, 640),
    )
    # func runs in a background thread once the GUI loop is up.
    webview.start(lambda: _linux_update_watch(window, version))


# --------------------------------------------------------------------------- #
# Windows: Chromium app-mode window
# --------------------------------------------------------------------------- #
def _confirm_windows(message):
    import ctypes

    MB_YESNO = 0x00000004
    MB_ICONQUESTION = 0x00000020
    IDYES = 6
    result = ctypes.windll.user32.MessageBoxW(
        0, message, "%s - Update" % APP_NAME, MB_YESNO | MB_ICONQUESTION
    )
    return result == IDYES


def _find_browser():
    """Locate Edge or Chrome for app-mode rendering."""
    bases = [
        os.environ.get("ProgramFiles(x86)", ""),
        os.environ.get("ProgramFiles", ""),
        os.environ.get("LocalAppData", ""),
    ]
    for base in bases:
        if not base:
            continue
        for vendor, exe in (("Microsoft", "msedge.exe"), ("Google", "chrome.exe")):
            candidate = os.path.join(base, vendor, "Edge" if vendor == "Microsoft" else "Chrome",
                                     "Application", exe)
            if os.path.isfile(candidate):
                return candidate
    for name in ("msedge.exe", "chrome.exe"):
        found = shutil.which(name)
        if found:
            return found
    return None


def _run_windows(url, version):
    # Offer an update before opening the window; a staged update relaunches us.
    if _check_and_apply(version, _confirm_windows) == "staged":
        sys.exit(0)

    browser = _find_browser()
    if not browser:
        print("No Chromium browser found. Open %s manually; server stays up." % url,
              file=sys.stderr)
        while True:
            time.sleep(1)

    # A dedicated profile makes the browser a distinct process that exits when
    # the app window closes, so we can keep the embedded server alive until then.
    profile = tempfile.mkdtemp(prefix="dlm-browser-")
    proc = subprocess.Popen([browser, "--app=" + url, "--user-data-dir=" + profile])
    try:
        proc.wait()
    except KeyboardInterrupt:
        proc.terminate()
    finally:
        shutil.rmtree(profile, ignore_errors=True)


def main():
    version = read_version()
    port = pick_port()
    httpd = start_server(port)
    url = "http://127.0.0.1:%d" % port
    print("%s %s" % (APP_NAME, version))
    print("  UI: %s" % url)
    ready, detail = wait_ready(url)
    if not ready:
        print("Warning: the embedded server cannot reach the Docker engine.",
              file=sys.stderr)
        if detail:
            print("  Docker said: %s" % detail, file=sys.stderr)
        print("  Check that Docker is installed and running, and that your user",
              file=sys.stderr)
        print("  can access it (on Linux: member of the 'docker' group).", file=sys.stderr)
        print("  The window will still open and show the engine as down.", file=sys.stderr)

    try:
        if IS_WINDOWS:
            _run_windows(url, version)
        else:
            _run_linux(url, version)
    finally:
        httpd.shutdown()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nInterrupted; shutting down.")
        sys.exit(130)
