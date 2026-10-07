"""Opt-in loopback server for the exact prepared public fixture files only."""
import argparse
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parents[1] / 'output/manual-store-fixture'
FILES = {
    '/': ('index.html', 'text/html; charset=utf-8'),
    '/index.html': ('index.html', 'text/html; charset=utf-8'),
    '/vendor/quill/dist/quill.js': ('vendor/quill/dist/quill.js', 'application/javascript'),
    '/vendor/quill/dist/quill.snow.css': ('vendor/quill/dist/quill.snow.css', 'text/css'),
    '/vendor/quill/LICENSE': ('vendor/quill/LICENSE', 'text/plain; charset=utf-8')
}


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        entry = FILES.get(urlsplit(self.path).path)
        if entry is None:
            self.send_error(404)
            return
        relative, content_type = entry
        target = ROOT / relative
        if not target.is_file() or target.is_symlink() or not target.resolve().is_relative_to(ROOT):
            self.send_error(404)
            return
        body = target.read_bytes()
        self.send_response(200)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        pass  # Do not log request paths, query strings or any caller-provided data.


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Serve only the isolated Quill fixture on loopback.')
    parser.add_argument('--port', type=int, default=8769)
    args = parser.parse_args()
    if not 1024 <= args.port <= 65535:
        parser.error('Use an unprivileged TCP port from 1024 to 65535.')
    with HTTPServer(('127.0.0.1', args.port), Handler) as server:
        print('Prepared public fixture only: http://127.0.0.1:' + str(args.port) + '/ (Ctrl+C stops it)', flush=True)
        server.serve_forever()
