"""Local dev server for the game: like `python -m http.server`, but tells the browser not to
cache, so a normal refresh always loads the latest code (ES module imports are otherwise
cached and can mix old and new files).

    python tools/serve.py [port]      (serves the project folder, default port 8000)
"""
import http.server
import os
import socket
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Expires', '0')
        super().end_headers()


class DualStackServer(http.server.ThreadingHTTPServer):
    """Listen on IPv6 and IPv4 so 'localhost' works whichever the browser tries first."""
    address_family = socket.AF_INET6
    request_queue_size = 128  # the default (5) refuses some of the ~40 files the game requests at once

    def server_bind(self):
        try:
            self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        except (AttributeError, OSError):
            pass
        super().server_bind()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
    print(f'Serving United Realm at http://localhost:{port}  (Ctrl+C to stop)')
    DualStackServer(('::', port), NoCacheHandler).serve_forever()
