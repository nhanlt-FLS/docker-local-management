#!/usr/bin/env python3
"""
Desktop entry point for Local Docker Management.

Wraps the existing dependency-free server.py in a native pywebview window so the
project can be shipped as a single installable AppImage:

  * picks a free local port (prefers 8420),
  * starts server.py's HTTP handler in a background daemon thread,
  * waits until /api/_health answers, then opens the window on that URL,
  * checks GitHub Releases for a newer version and offers to self-update.

Run from source with:  python3 app.py
"""

import os
import socket
import sys
import threading
import time
import urllib.request
from http.server import ThreadingHTTPServer

import webview

import updater

APP_NAME = "Docker Local Management"
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
    """Block until the server answers its health endpoint (or timeout)."""
    deadline = time.time() + timeout
    health = url + "/api/_health"
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(health, timeout=2) as resp:
                if resp.status == 200:
                    return True
        except Exception:
            time.sleep(0.15)
    return False


class Api:
    """Small surface exposed to the web UI via window.pywebview.api."""

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


def _maybe_offer_update(window, version):
    """Runs after the page loads: prompt once if a newer release exists."""
    window.events.loaded.wait()
    result = updater.check_for_update(version)
    if not result:
        return
    tag, url = result
    message = "Version %s is available (you are on %s).\n\nInstall now and restart?" % (
        tag,
        version,
    )
    try:
        if window.create_confirmation_dialog("Update available", message):
            updater.apply_update(url)
    except Exception as exc:  # dialogs unsupported on some backends
        print("[app] update prompt failed: %s" % exc, file=sys.stderr)


def main():
    version = read_version()
    port = pick_port()
    httpd = start_server(port)
    url = "http://127.0.0.1:%d" % port
    print("%s %s" % (APP_NAME, version))
    print("  UI: %s" % url)
    if not wait_ready(url):
        print("Warning: server did not report healthy in time", file=sys.stderr)

    window = webview.create_window(
        APP_NAME,
        url,
        js_api=Api(version),
        width=WINDOW_WIDTH,
        height=WINDOW_HEIGHT,
        min_size=(940, 640),
    )
    try:
        # func runs in a background thread once the GUI loop is up.
        webview.start(lambda: _maybe_offer_update(window, version))
    finally:
        httpd.shutdown()


if __name__ == "__main__":
    main()
