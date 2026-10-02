#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
PLMS 前端开发服务器（零依赖）

职责：
  1. 托管 plms-web 静态资源（index.html / src / vendor）
  2. 把 /api/** 反向代理到后端 http://127.0.0.1:8080
     —— 与 Vite 的 server.proxy 行为一致，使前后端同源，规避跨域与 OPTIONS 预检

用法：
  python scripts/dev-server.py [端口]        # 默认 5188
"""
import http.server
import os
import sys
import urllib.error
import urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'plms-web'))
API_TARGET = os.environ.get('PLMS_API', 'http://127.0.0.1:8080')
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5188

HOP_BY_HOP = {
    'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
    'te', 'trailers', 'transfer-encoding', 'upgrade', 'content-encoding', 'content-length',
}


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    # ---------------- 静态资源 ----------------
    def log_message(self, fmt, *args):
        # 只记录 API 代理与错误，避免静态资源刷屏
        if '/api/' in (self.path or '') or (args and str(args[1]).startswith(('4', '5'))):
            sys.stderr.write("[dev] %s %s\n" % (self.path, args[1] if len(args) > 1 else ''))

    def end_headers(self):
        # 开发期禁用缓存，避免改动后仍加载旧文件
        if not self.path.startswith('/api/'):
            self.send_header('Cache-Control', 'no-store, must-revalidate')
        super().end_headers()

    # ---------------- API 反向代理 ----------------
    def _proxy(self):
        url = API_TARGET + self.path
        length = int(self.headers.get('Content-Length') or 0)
        body = self.rfile.read(length) if length else None

        req = urllib.request.Request(url, data=body, method=self.command)
        for header in ('Content-Type', 'Authorization', 'Accept', 'Accept-Language'):
            value = self.headers.get(header)
            if value:
                req.add_header(header, value)

        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                payload = resp.read()
                self.send_response(resp.status)
                for key, value in resp.headers.items():
                    if key.lower() not in HOP_BY_HOP:
                        self.send_header(key, value)
                self.send_header('Content-Length', str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
        except urllib.error.HTTPError as e:
            payload = e.read()
            self.send_response(e.code)
            self.send_header('Content-Type', e.headers.get('Content-Type', 'application/json; charset=utf-8'))
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
        except Exception as e:  # 后端未启动 / 连接失败
            payload = ('{"code":50001,"message":"无法连接后端服务 %s：%s","data":null}'
                       % (API_TARGET, e)).encode('utf-8')
            self.send_response(502)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

    def _route(self):
        if self.path.startswith('/api/'):
            return self._proxy()
        return super().do_GET() if self.command == 'GET' else self.send_error(405)

    def do_GET(self):
        return self._route()

    def do_HEAD(self):
        return self._route()

    def do_POST(self):
        return self._route()

    def do_PUT(self):
        return self._route()

    def do_PATCH(self):
        return self._route()

    def do_DELETE(self):
        return self._route()

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', self.headers.get('Origin', '*'))
        self.send_header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.end_headers()


class ThreadingServer(http.server.ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True


if __name__ == '__main__':
    print("PLMS 开发服务器")
    print("  静态根目录 : %s" % ROOT)
    print("  API 代理   : /api/** -> %s" % API_TARGET)
    print("  访问地址   : http://127.0.0.1:%d/index.html" % PORT)
    print("  Ctrl+C 退出")
    ThreadingServer(('127.0.0.1', PORT), Handler).serve_forever()
