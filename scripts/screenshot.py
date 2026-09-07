"""Render index.html?demo in headless Chromium and save assets/screenshot.png.

Usage (from the repo root):
    uv run --with playwright python scripts/screenshot.py [output.png]
"""
import http.server
import pathlib
import sys
import threading

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "assets" / "screenshot.png"


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


def main():
    handler = lambda *a, **k: Quiet(*a, directory=str(ROOT), **k)
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{server.server_port}/index.html?demo"

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 720, "height": 620}, device_scale_factor=2)
        page.goto(url)
        page.wait_for_selector(".todo-item")
        OUT.parent.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(OUT))
        browser.close()
    server.shutdown()
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
