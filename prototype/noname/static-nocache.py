#!/usr/bin/env python3
"""本地验证无名杀 dist 用的静态服务器:带 Cache-Control: no-store,.ts 按 JS 发,不存在的路径回 404.html(同 Pages 行为)。
用法:python3 static-nocache.py <port> <dir>"""
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

port, root = int(sys.argv[1]), sys.argv[2]
os.chdir(root)


class H(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, ".ts": "text/javascript", ".mjs": "text/javascript", ".vue": "text/javascript"}

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_error(self, code, message=None, explain=None):
        if code == 404 and os.path.exists("404.html"):
            body = open("404.html", "rb").read()
            self.send_response(404)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(body)
            return
        super().send_error(code, message, explain)

    def log_message(self, *a):
        pass


ThreadingHTTPServer(("0.0.0.0", port), H).serve_forever()
