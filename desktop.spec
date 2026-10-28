# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec for the Local Docker Management desktop app.

Build with:   pyinstaller desktop.spec --noconfirm
Produces a onedir bundle at dist/docker-local-management/ which the release
workflow then packs into a single AppImage.
"""

from PyInstaller.utils.hooks import collect_all
import sys

datas = []
binaries = []
hiddenimports = []
excludes = ["tkinter", "PyQt5", "PySide2", "PyQt6", "PySide6"]

if sys.platform == "win32":
    # Windows renders via a Chromium app-mode window (no pywebview / PyGObject).
    excludes += ["webview", "gi"]
else:
    # pywebview's Linux backend uses PyGObject (gi) + WebKit2. These are not
    # found by static analysis, so pull in everything collect_all can see.
    for pkg in ("gi", "webview"):
        d, b, h = collect_all(pkg)
        datas += d
        binaries += b
        hiddenimports += h
    hiddenimports += [
        "gi.repository.GLib",
        "gi.repository.GObject",
        "gi.repository.Gio",
        "gi.repository.Gtk",
        "gi.repository.Gdk",
        "gi.repository.GdkPixbuf",
        "gi.repository.WebKit2",
        "gi.repository.Soup",
    ]

# Application data: the version marker and the built web UI (public/).
datas += [
    ("VERSION", "."),
    ("public", "public"),
]

a = Analysis(
    ["app.py"],
    pathex=["."],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    runtime_hooks=[],
    excludes=excludes,
    noarchive=False,
)

pyz = PYZ(a.pure)

if sys.platform == "win32":
    # Single portable executable (binaries+datas baked in); the updater stages
    # replacements next to it because a running .exe is locked.
    exe = EXE(
        pyz,
        a.scripts,
        a.binaries,
        a.datas,
        [],
        name="docker-local-management",
        debug=False,
        bootloader_ignore_signals=False,
        strip=False,
        upx=False,
        console=False,
    )
else:
    exe = EXE(
        pyz,
        a.scripts,
        [],
        exclude_binaries=True,
        name="docker-local-management",
        debug=False,
        bootloader_ignore_signals=False,
        strip=False,
        upx=False,
        console=False,  # GUI app: no terminal window
    )

    coll = COLLECT(
        exe,
        a.binaries,
        a.datas,
        strip=False,
        upx=False,
        name="docker-local-management",
    )
