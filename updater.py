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
import tempfile
import urllib.request

# Repository that publishes the releases. Kept in one place so it is easy to
# change if the project is ever moved to another account.
REPO = os.environ.get("UPDATE_REPO", "nhanlt-FLS/docker-local-management")
API_URL = "https://api.github.com/repos/%s/releases/latest" % REPO
USER_AGENT = "docker-local-management-updater"
ASSET_SUFFIX = ".AppImage"
TIMEOUT = 15


def _log(msg):
    print("[updater] %s" % msg, file=sys.stderr)


def parse_version(tag):
    """Turn 'v0.1.2' / '0.1.2' into a comparable tuple of ints."""
    nums = re.findall(r"\d+", tag or "")
    return tuple(int(n) for n in nums[:4]) or (0,)


def is_newer(current, latest_tag):
    return parse_version(latest_tag) > parse_version(current)


def _running_appimage_path():
    """Path of the currently running AppImage, or None when not an AppImage."""
    # AppImageLaunch/AppImageKit sets APPIMAGE to the file being executed.
    path = os.environ.get("APPIMAGE")
    if path and os.path.isfile(path):
        return path
    if getattr(sys, "frozen", False):
        # Fall back to the executable path for other frozen layouts.
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
    for asset in data.get("assets", []) or []:
        name = asset.get("name", "")
        if name.endswith(ASSET_SUFFIX):
            return tag, asset.get("browser_download_url")
    _log("release %s has no %s asset" % (tag, ASSET_SUFFIX))
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
    mode = os.stat(dest_path).st_mode
    os.chmod(dest_path, mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
    return True


def apply_update(url):
    """Download the new AppImage over the running one and relaunch.

    Returns True if a relaunch was triggered (this call does not return in that
    case), False if the update could not be applied (e.g. running from source).
    """
    target = _running_appimage_path()
    if not target:
        _log("not running from an AppImage; skipping in-place update")
        return False

    target_dir = os.path.dirname(os.path.abspath(target))
    fd, tmp_path = tempfile.mkstemp(suffix=".AppImage.part", dir=target_dir)
    os.close(fd)
    try:
        if not download_asset(url, tmp_path):
            os.remove(tmp_path)
            return False
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
        return False
    return True


def check_for_update(current_version):
    """Non-blocking check. Returns (tag, url) if an update is available."""
    result = fetch_latest_release()
    if not result:
        return None
    tag, url = result
    if is_newer(current_version, tag):
        return tag, url
    return None
