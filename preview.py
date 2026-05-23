#!/usr/bin/env python3
"""启动本地预览：先起服务，再打开浏览器。"""

from __future__ import annotations

import http.server
import socket
import socketserver
import sys
import threading
import time
import webbrowser
from pathlib import Path

DEFAULT_PORT = 8088
PORT_RANGE = range(8088, 8100)
DOCS = Path(__file__).resolve().parent / "docs"


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DOCS), **kwargs)

    def log_message(self, fmt, *args):
        print(f"[{self.log_date_time_string()}] {fmt % args}")


class ReuseTCPServer(socketserver.TCPServer):
    allow_reuse_address = True


def find_available_port() -> int:
    """从 PORT_RANGE 中选取可用端口。"""
    for port in PORT_RANGE:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    raise OSError(
        f"端口 {PORT_RANGE.start}–{PORT_RANGE.stop - 1} 均被占用。"
        "请关闭其他预览窗口，或执行: netstat -ano | findstr :8088"
    )


def main() -> None:
    if not DOCS.is_dir():
        print(f"错误: 未找到 docs 目录: {DOCS}")
        sys.exit(1)

    port = find_available_port()
    if port != DEFAULT_PORT:
        print(f"提示: {DEFAULT_PORT} 已被占用，改用端口 {port}")

    url = f"http://127.0.0.1:{port}/"
    print("COROS 本地预览")
    print("=" * 40)
    print(f"目录: {DOCS}")
    print(f"地址: {url}")
    print("按 Ctrl+C 停止服务器")
    print("=" * 40)

    with ReuseTCPServer(("127.0.0.1", port), QuietHandler) as httpd:
        threading.Thread(target=httpd.serve_forever, daemon=True).start()
        time.sleep(0.5)
        webbrowser.open(url)
        print("已在浏览器中打开；若未弹出请手动访问上述地址。\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    try:
        main()
    except OSError as e:
        print(f"\n错误: {e}")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\n已停止。")
