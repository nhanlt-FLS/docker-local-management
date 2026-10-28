#!/usr/bin/env python3
"""
Local Docker Management - backend server.

A tiny, dependency-free HTTP server (Python standard library only) that:
  * serves the static web UI from ./public
  * proxies REST calls to the Docker Engine API over the unix socket
  * handles Docker's streaming endpoints (logs -f, stats, events, image pull)
    including de-multiplexing of the Docker log stream framing.

Nothing here is cloned from an existing library - the Docker HTTP client,
the stream de-muxer and the routing are all implemented by hand.
"""

import json
import os
import socket
import sys
import threading
import time
import http.client
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# --------------------------------------------------------------------------- #
# Configuration
# --------------------------------------------------------------------------- #
DOCKER_SOCKET = os.environ.get("DOCKER_SOCKET", "/var/run/docker.sock")
HOST = os.environ.get("HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT", "8420"))
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.join(BASE_DIR, "public")

MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".mjs": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".map": "application/json; charset=utf-8",
}


# --------------------------------------------------------------------------- #
# Minimal Docker Engine API client over a unix domain socket
# --------------------------------------------------------------------------- #
class UnixHTTPConnection(http.client.HTTPConnection):
    """An http.client connection that dials a unix domain socket."""

    def __init__(self, socket_path, timeout=60):
        super().__init__("localhost", timeout=timeout)
        self.socket_path = socket_path

    def connect(self):
        sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        sock.settimeout(self.timeout)
        sock.connect(self.socket_path)
        self.sock = sock


class StreamDemuxer:
    """
    Docker multiplexes stdout/stderr into a single stream when a container is
    NOT attached to a TTY. Each frame is prefixed by an 8 byte header:

        [stream_type, 0, 0, 0, size_be32 ...]

    This class turns a possibly-fragmented byte stream back into plain text,
    buffering partial frames between feed() calls.
    """

    def __init__(self):
        self.buf = bytearray()

    def feed(self, chunk):
        self.buf += chunk
        out = bytearray()
        while len(self.buf) >= 8:
            size = int.from_bytes(self.buf[4:8], "big")
            if len(self.buf) < 8 + size:
                break
            frame = self.buf[8:8 + size]
            del self.buf[:8 + size]
            out += frame
        return bytes(out)

    def flush(self):
        # Anything left over was not a well formed frame; return it verbatim.
        out = bytes(self.buf)
        self.buf.clear()
        return out


def docker_request(method, url, body=None, headers=None, timeout=60):
    """Open a connection to the Docker socket and issue a request.

    Returns the (connection, HTTPResponse) pair. The caller is responsible for
    closing the connection.
    """
    conn = UnixHTTPConnection(DOCKER_SOCKET, timeout=timeout)
    hdrs = {"Host": "docker.localhost", "Accept": "*/*"}
    if headers:
        hdrs.update(headers)
    conn.request(method, url, body=body, headers=hdrs)
    resp = conn.getresponse()
    return conn, resp


# --------------------------------------------------------------------------- #
# Disk usage cache
# --------------------------------------------------------------------------- #
# GET /system/df makes the daemon walk the whole storage (image layers,
# container rw layers, volumes, build cache) to compute sizes, which takes
# many seconds on a busy engine. Cache the payload for a short TTL so repeated
# dashboard loads/refreshes do not re-walk the disk; mutating calls invalidate
# it so sizes never stay stale after a prune/remove/create.
DF_CACHE_TTL = float(os.environ.get("DF_CACHE_TTL", "60"))
_df_cache = {"expires": 0.0, "status": 200, "body": b"", "ctype": "application/json"}
_df_lock = threading.Lock()


def system_df_cached():
    """Return (status, body, ctype) for /system/df, reusing a fresh cache entry.

    The lock also coalesces concurrent requests: while one thread walks the
    disk, the others wait and then serve the cached payload.
    """
    with _df_lock:
        if _df_cache["body"] and time.monotonic() < _df_cache["expires"]:
            return _df_cache["status"], _df_cache["body"], _df_cache["ctype"]
        conn, resp = docker_request("GET", "/system/df")
        body = resp.read()
        status = resp.status
        ctype = resp.getheader("Content-Type", "application/json")
        conn.close()
        if status == 200:
            _df_cache.update(
                expires=time.monotonic() + DF_CACHE_TTL,
                status=status,
                body=body,
                ctype=ctype,
            )
        return status, body, ctype


def invalidate_df_cache():
    with _df_lock:
        _df_cache["expires"] = 0.0


# --------------------------------------------------------------------------- #
# HTTP request handler
# --------------------------------------------------------------------------- #
class Handler(BaseHTTPRequestHandler):
    server_version = "LocalDockerMgr/1.0"
    protocol_version = "HTTP/1.1"

    # Silence the default stderr logging noise, keep it terse.
    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    # ---- verb dispatchers ------------------------------------------------- #
    def do_GET(self):
        self._dispatch("GET")

    def do_POST(self):
        self._dispatch("POST")

    def do_PUT(self):
        self._dispatch("PUT")

    def do_DELETE(self):
        self._dispatch("DELETE")

    def do_HEAD(self):
        self._dispatch("HEAD")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.send_header("Content-Length", "0")
        self.end_headers()

    # ---- core routing ----------------------------------------------------- #
    def _dispatch(self, method):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == "/api/_health":
            return self._health()
        if path.startswith("/api/"):
            return self._handle_api(method, parsed)
        return self._serve_static(method, path)

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods",
                         "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    # ---- health ----------------------------------------------------------- #
    def _health(self):
        try:
            conn, resp = docker_request("GET", "/_ping", timeout=5)
            data = resp.read()
            conn.close()
            ok = resp.status == 200
        except Exception as exc:  # noqa: BLE001
            return self._send_json(503, {"ok": False, "error": str(exc)})
        return self._send_json(200, {"ok": ok, "ping": data.decode("utf-8", "replace")})

    # ---- static files ----------------------------------------------------- #
    def _serve_static(self, method, path):
        if path in ("/", ""):
            path = "/index.html"
        # Normalise and confine to PUBLIC_DIR.
        clean = os.path.normpath(path).lstrip("/")
        full = os.path.join(PUBLIC_DIR, clean)
        if not os.path.abspath(full).startswith(PUBLIC_DIR):
            return self._send_bytes(403, b"Forbidden", "text/plain")
        if os.path.isdir(full):
            full = os.path.join(full, "index.html")
        if not os.path.isfile(full):
            return self._send_bytes(404, b"Not Found", "text/plain")

        ext = os.path.splitext(full)[1].lower()
        ctype = MIME_TYPES.get(ext, "application/octet-stream")
        try:
            with open(full, "rb") as fh:
                data = fh.read()
        except OSError as exc:
            return self._send_bytes(500, str(exc).encode(), "text/plain")

        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", ctype)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        if method != "HEAD":
            self.wfile.write(data)

    # ---- API proxy -------------------------------------------------------- #
    def _handle_api(self, method, parsed):
        # /api/containers/json  ->  /containers/json
        docker_path = parsed.path[len("/api"):]
        query = parsed.query
        docker_url = docker_path + (("?" + query) if query else "")
        qs = urllib.parse.parse_qs(query)

        if method != "GET":
            invalidate_df_cache()

        body = None
        length = int(self.headers.get("Content-Length") or 0)
        if length:
            body = self.rfile.read(length)

        fwd_headers = {}
        ctype = self.headers.get("Content-Type")
        if ctype:
            fwd_headers["Content-Type"] = ctype

        if method == "GET" and docker_path == "/system/df":
            status, cached_body, cached_ctype = system_df_cached()
            return self._send_bytes(status, cached_body, cached_ctype)

        stream_kind = self._classify_stream(docker_path, qs, method)

        try:
            if stream_kind == "logs":
                return self._stream_logs(method, docker_path, docker_url, qs, fwd_headers)
            if stream_kind == "raw":
                return self._stream_raw(method, docker_url, body, fwd_headers)
            return self._proxy_simple(method, docker_url, body, fwd_headers)
        except ConnectionRefusedError:
            return self._send_json(
                503, {"message": "Cannot reach the Docker daemon socket."})
        except Exception as exc:  # noqa: BLE001
            return self._send_json(500, {"message": str(exc)})

    @staticmethod
    def _classify_stream(docker_path, qs, method):
        """Decide whether a request maps to a Docker streaming endpoint."""
        truthy = ("1", "true", "yes")
        if docker_path.endswith("/logs"):
            return "logs"  # handled specially (follow or one-shot)
        if docker_path.endswith("/stats"):
            return "raw" if qs.get("stream", ["1"])[0] in truthy else None
        if docker_path.endswith("/events"):
            return "raw"
        if docker_path.endswith("/images/create") and method == "POST":
            return "raw"  # image pull progress
        if docker_path.endswith("/containers/create"):
            return None
        return None

    def _proxy_simple(self, method, docker_url, body, fwd_headers):
        conn, resp = docker_request(method, docker_url, body=body,
                                    headers=fwd_headers)
        data = resp.read()
        status = resp.status
        resp_ctype = resp.getheader("Content-Type", "application/json")
        conn.close()
        self._send_bytes(status, data, resp_ctype)

    # ---- logs (follow + demux aware) ------------------------------------- #
    def _stream_logs(self, method, docker_path, docker_url, qs, fwd_headers):
        follow = qs.get("follow", ["0"])[0] in ("1", "true", "yes")

        # Determine whether the container uses a TTY (raw logs, no framing).
        tty = False
        try:
            cid = docker_path.split("/")[-2]
            conn_i, resp_i = docker_request(
                "GET", "/containers/%s/json" % urllib.parse.quote(cid))
            info = json.loads(resp_i.read() or b"{}")
            conn_i.close()
            tty = bool(info.get("Config", {}).get("Tty"))
        except Exception:  # noqa: BLE001
            tty = False

        conn, resp = docker_request(method, docker_url, headers=fwd_headers)
        if resp.status != 200:
            data = resp.read()
            conn.close()
            return self._send_bytes(resp.status, data,
                                    resp.getheader("Content-Type", "text/plain"))

        if not follow:
            data = resp.read()
            conn.close()
            if not tty:
                data = StreamDemuxer().feed(data)
            return self._send_bytes(200, data, "text/plain; charset=utf-8")

        # Follow mode -> chunked stream, demuxed frame by frame.
        self._begin_chunked(200, "text/plain; charset=utf-8")
        demux = None if tty else StreamDemuxer()
        try:
            while True:
                chunk = resp.read1(65536)
                if not chunk:
                    break
                out = chunk if demux is None else demux.feed(chunk)
                if out:
                    self._write_chunk(out)
            if demux is not None:
                tail = demux.flush()
                if tail:
                    self._write_chunk(tail)
        except (BrokenPipeError, ConnectionResetError):
            pass
        finally:
            try:
                conn.close()
            except Exception:  # noqa: BLE001
                pass
            try:
                self._end_chunked()
            except Exception:  # noqa: BLE001
                pass

    # ---- generic raw streaming (stats/events/pull) ------------------------ #
    def _stream_raw(self, method, docker_url, body, fwd_headers):
        conn, resp = docker_request(method, docker_url, body=body,
                                    headers=fwd_headers)
        ctype = resp.getheader("Content-Type", "application/json")
        if resp.status != 200:
            data = resp.read()
            conn.close()
            return self._send_bytes(resp.status, data, ctype)

        self._begin_chunked(200, ctype)
        try:
            while True:
                chunk = resp.read1(65536)
                if not chunk:
                    break
                self._write_chunk(chunk)
        except (BrokenPipeError, ConnectionResetError):
            pass
        finally:
            try:
                conn.close()
            except Exception:  # noqa: BLE001
                pass
            try:
                self._end_chunked()
            except Exception:  # noqa: BLE001
                pass

    # ---- low level response helpers --------------------------------------- #
    def _send_json(self, status, obj):
        data = json.dumps(obj).encode("utf-8")
        self._send_bytes(status, data, "application/json; charset=utf-8")

    def _send_bytes(self, status, data, ctype):
        self.send_response(status)
        self._cors()
        self.send_header("Content-Type", ctype)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        if self.command != "HEAD":
            try:
                self.wfile.write(data)
            except (BrokenPipeError, ConnectionResetError):
                pass

    def _begin_chunked(self, status, ctype):
        self.send_response(status)
        self._cors()
        self.send_header("Content-Type", ctype)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Transfer-Encoding", "chunked")
        self.end_headers()

    def _write_chunk(self, data):
        if not data:
            return
        self.wfile.write(b"%X\r\n" % len(data))
        self.wfile.write(data)
        self.wfile.write(b"\r\n")
        self.wfile.flush()

    def _end_chunked(self):
        self.wfile.write(b"0\r\n\r\n")
        self.wfile.flush()


# --------------------------------------------------------------------------- #
# Entry point
# --------------------------------------------------------------------------- #
def main():
    if not os.path.exists(DOCKER_SOCKET):
        print("Docker socket not found at %s" % DOCKER_SOCKET, file=sys.stderr)
        print("Is Docker running? Set DOCKER_SOCKET to override.", file=sys.stderr)
        sys.exit(1)
    if not os.access(DOCKER_SOCKET, os.R_OK | os.W_OK):
        print("Warning: no read/write access to %s (are you in the 'docker' group?)"
              % DOCKER_SOCKET, file=sys.stderr)

    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    httpd.daemon_threads = True
    url = "http://%s:%d" % (HOST, PORT)
    print("Local Docker Management")
    print("  UI:      %s" % url)
    print("  Socket:  %s" % DOCKER_SOCKET)
    print("  Press Ctrl+C to stop.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        httpd.shutdown()


if __name__ == "__main__":
    main()
