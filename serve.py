#!/usr/bin/env python3
"""
Lokaler Vorschau-Server für den 365-Grundbesitz-Relaunch.

    python3 serve.py            -> http://localhost:4365
    python3 serve.py 8080       -> anderer Port

Warum nicht einfach `python3 -m http.server`?
Der eingebaute Server sendet bei HTML-Dateien keinen Zeichensatz mit
(`Content-Type: text/html` statt `text/html; charset=utf-8`). Manche Browser
raten dann falsch und zeigen „PersÃ¶nlich" statt „Persönlich". Dieser Server
setzt den Zeichensatz explizit und liefert außerdem die richtigen MIME-Typen
für WebP, WebM und woff2.
"""

import http.server
import os
import socketserver
import sys
import urllib.parse

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 4365
ROOT = os.path.dirname(os.path.abspath(__file__))

TEXT_TYPES = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "text/javascript",
    ".json": "application/json",
    ".svg": "image/svg+xml",
    ".md": "text/markdown",
}
BINARY_TYPES = {
    ".webp": "image/webp",
    ".avif": "image/avif",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".woff2": "font/woff2",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".ico": "image/x-icon",
}


# Niemals ausliefern: Zugangsdaten, Werkzeuge, Versionsverwaltung.
# Ohne diese Sperre wäre http://localhost:4365/.env abrufbar.
GESPERRT = (".env", ".git", ".gitignore", "tools", "serve.py")


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def _verboten(self) -> bool:
        pfad = urllib.parse.urlparse(self.path).path
        teile = [t for t in pfad.split("/") if t]
        for t in teile:
            if t.startswith(".") or t.lower() in GESPERRT:
                return True
        return False

    def send_head(self):
        if self._verboten():
            self.send_error(403, "Zugriff nicht erlaubt")
            return None
        return super().send_head()

    def guess_type(self, path):
        ext = os.path.splitext(path)[1].lower()
        if ext in TEXT_TYPES:
            return TEXT_TYPES[ext] + "; charset=utf-8"
        if ext in BINARY_TYPES:
            return BINARY_TYPES[ext]
        return super().guess_type(path)

    def end_headers(self):
        # Während der Abstimmung nichts cachen, damit Änderungen sofort sichtbar sind
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        if "404" in (fmt % args):
            super().log_message(fmt, *args)


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == "__main__":
    with Server(("127.0.0.1", PORT), Handler) as httpd:
        print(f"365 Grundbesitz — Vorschau läuft auf http://localhost:{PORT}")
        print("Beenden mit Strg+C")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer beendet.")
