# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec for the Local Docker Management desktop app.

Build with:   pyinstaller desktop.spec --noconfirm
Produces a onedir bundle at dist/docker-local-management/ which the release
workflow then packs into a single AppImage.
"""

from PyInstaller.utils.hooks import collect_all

datas = []
binaries = []
hiddenimports = []

# pywebview's Linux backend uses PyGObject (gi) + WebKit2. These are not found
# by static analysis, so pull in everything collect_all can see.
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
    excludes=["tkinter", "PyQt5", "PySide2", "PyQt6", "PySide6"],
    noarchive=False,
)

pyz = PYZ(a.pure)

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
