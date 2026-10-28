"""
Self-update helper for the packaged desktop app.

The app is distributed as a single Linux AppImage published on GitHub Releases.
On startup we ask the GitHub API for the latest release, compare its tag with
the bundled version, and - if the user accepts - download the new AppImage,
atomically replace the currently running file and relaunch it.

Everything here is standard library only, matching server.py's dependency-free
philosophy.
"""

import json
import os
import re
import sys
import stat
import subprocess
import tempfile
import urllib.request

# Repository that publishes the releases. Kept in one place so it is easy to
# change if the project is ever moved to another account.
REPO = os.environ.get("UPDATE_REPO", "nhanlt-FLS/docker-local-management-dist")
API_URL = "https://api.github.com/repos/%s/releases/latest" % REPO
USER_AGENT = "docker-local-management-updater"

IS_WINDOWS = sys.platform == "win32"
# Release assets are per-platform: a Linux AppImage or a Windows portable exe.
ASSET_SUFFIX = ".exe" if IS_WINDOWS else ".AppImage"
# The published app asset is named docker-local-management-<ver>-<plat><suffix>.
# Pin the prefix and reject installer/packaging-tool artifacts so we never
# download the wrong file if a release ships extra assets.
APP_ASSET_PREFIX = "docker-local-management-"
TOOL_ASSET_MARKERS = ("appimagetool", "linuxdeploy", "appstreamcli", "setup", "install")
TIMEOUT = 15


def _log(msg):
    print("[updater] %s" % msg, file=sys.stderr)


def parse_version(tag):
    """Turn 'v0.1.2' / '0.1.2' into a comparable tuple of ints."""
    nums = re.findall(r"\d+", tag or "")
    return tuple(int(n) for n in nums[:4]) or (0,)


def is_newer(current, latest_tag):
    return parse_version(latest_tag) > parse_version(current)


def _update_target():
    """Path of the running package we can replace, or None when not packaged."""
    if IS_WINDOWS:
        # A running .exe is locked by the OS, so we stage and swap on exit.
        if getattr(sys, "frozen", False) and os.path.isfile(sys.executable):
            return sys.executable
        return None
    # Linux AppImage: AppImageKit sets APPIMAGE to the file being executed.
    path = os.environ.get("APPIMAGE")
    if path and os.path.isfile(path):
        return path
    if getattr(sys, "frozen", False):
        candidate = sys.executable
        if candidate and os.path.isfile(candidate):
            return candidate
    return None


def fetch_latest_release():
    """Return (tag_name, asset_download_url) for the newest release, or None."""
    req = urllib.request.Request(
        API_URL,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/vnd.github+json",
        },
    )
    # A token is optional; only needed for private repos or to raise rate limits.
    token = os.environ.get("GITHUB_TOKEN")
    if token:
        req.add_header("Authorization", "Bearer %s" % token)
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as exc:  # network offline, rate limited, no releases yet
        _log("release check failed: %s" % exc)
        return None

    tag = data.get("tag_name")
    if not tag:
        return None
    fallback = None
    for asset in data.get("assets", []) or []:
        name = asset.get("name", "")
        if not name.endswith(ASSET_SUFFIX):
            continue
        url = asset.get("browser_download_url")
        lowered = name.lower()
        if any(marker in lowered for marker in TOOL_ASSET_MARKERS):
            continue  # a packaging tool, not our app
        if name.startswith(APP_ASSET_PREFIX):
            return tag, url
        fallback = fallback or url
    if fallback:
        return tag, fallback
    _log("release %s has no %s app asset" % (tag, APP_ASSET_PREFIX))
    return None


def download_asset(url, dest_path, progress=None):
    """Stream the release asset to dest_path. Returns True on success."""
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            total = int(resp.headers.get("Content-Length") or 0)
            done = 0
            with open(dest_path, "wb") as fh:
                while True:
                    chunk = resp.read(1024 * 256)
                    if not chunk:
                        break
                    fh.write(chunk)
                    done += len(chunk)
                    if progress and total:
                        progress(done, total)
    except Exception as exc:
        _log("download failed: %s" % exc)
        return False
    # Make sure the new file is executable before we swap it in.
    try:
        mode = os.stat(dest_path).st_mode
        os.chmod(dest_path, mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
    except OSError:
        pass
    return True


def _swap_bat(pid, staged, target):
    """A tiny batch script that waits for us to exit, then swaps + relaunches."""
    lines = [
        "@echo off",
        ":wait",
        "timeout /t 1 /nobreak >NUL",
        'tasklist /FI "PID eq {pid}" /NH | findstr /I "docker-local-management" >NUL && goto wait'.format(pid=pid),
        'move /Y "{s}" "{t}" >NUL'.format(s=staged, t=target),
        'start "" "{t}"'.format(t=target),
        'del "%~f0"',
    ]
    return "\r\n".join(lines) + "\r\n"


def _stage_update_windows(url, target, target_dir):
    """Download next to the running exe and swap it in after we exit."""
    staged = target + ".update.exe"
    if not download_asset(url, staged):
        return None
    bat = os.path.join(target_dir, "_update_swap.bat")
    with open(bat, "w", encoding="ascii") as fh:
        fh.write(_swap_bat(os.getpid(), staged, target))
    CREATE_NO_WINDOW = 0x08000000
    DETACHED_PROCESS = 0x00000008
    subprocess.Popen(
        ["cmd", "/c", bat],
        creationflags=CREATE_NO_WINDOW | DETACHED_PROCESS,
        close_fds=True,
    )
    _log("staged %s; will swap and relaunch after exit" % staged)
    return "staged"


def apply_update(url):
    """Apply a downloaded update.

    Returns:
      "restarting" - Linux: replaced in place and re-exec'd (does not return).
      "staged"     - Windows: new exe staged; caller must quit so the swap
                     script can replace and relaunch.
      None         - update could not be applied (e.g. running from source).
    """
    target = _update_target()
    if not target:
        _log("not running from a packaged build; skipping update")
        return None

    target_dir = os.path.dirname(os.path.abspath(target))
    if IS_WINDOWS:
        return _stage_update_windows(url, target, target_dir)

    fd, tmp_path = tempfile.mkstemp(suffix=".part", dir=target_dir)
    os.close(fd)
    try:
        if not download_asset(url, tmp_path):
            os.remove(tmp_path)
            return None
        # Atomic replace within the same filesystem, then relaunch.
        os.replace(tmp_path, target)
        os.chmod(target, 0o755)
        _log("updated %s, relaunching" % target)
        os.execv(target, [target] + sys.argv[1:])
    except Exception as exc:
        _log("apply_update failed: %s" % exc)
        try:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
        except OSError:
            pass
        return None
    return "restarting"


def check_for_update(current_version):
    """Non-blocking check. Returns (tag, url) if an update is available."""
    result = fetch_latest_release()
    if not result:
        return None
    tag, url = result
    if is_newer(current_version, tag):
        return tag, url
    return None
