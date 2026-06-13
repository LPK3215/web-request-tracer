"""
Simple HTTP + WebSocket test server for Web Request Tracer testing.

Usage:
    pip install websockets
    python test/test-server.py

Then open http://localhost:8765/ in your browser.
"""
import http.server
import asyncio
import websockets
import json
import threading
import sys
import os

PORT = 8765
WS_PORT = 8766
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ── HTTP Test Server ──
class TestHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/" or self.path == "/index.html":
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("X-Custom-Header", "test-value-123")
            self.send_header("X-Response-Time", "42ms")
            self.end_headers()
            with open(os.path.join(os.path.dirname(__file__), "index.html"), "rb") as f:
                self.wfile.write(f.read())
        elif self.path == "/trace-recorder.js":
            # Serve the console script so it can be loaded via <script> tag
            js_path = os.path.join(PROJECT_ROOT, "trace-recorder.js")
            if os.path.isfile(js_path):
                self.send_response(200)
                self.send_header("Content-Type", "application/javascript; charset=utf-8")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                with open(js_path, "rb") as f:
                    self.wfile.write(f.read())
            else:
                self.send_response(404)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": "trace-recorder.js not found"}).encode())
        elif self.path == "/api/test-get":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("X-API-Version", "1.0")
            self.send_header("X-Custom-Header", "test-value-123")
            self.end_headers()
            self.wfile.write(json.dumps({"status": "ok", "method": "GET", "data": [1, 2, 3]}).encode())
        elif self.path == "/api/test-post":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length) if content_length else b"{}"
            self.send_response(201)
            self.send_header("Content-Type", "application/json")
            self.send_header("X-API-Version", "1.0")
            self.send_header("X-Custom-Header", "test-value-123")
            self.end_headers()
            resp = {"status": "created", "method": "POST", "received": json.loads(body) if body else {}}
            self.wfile.write(json.dumps(resp).encode())
        elif self.path == "/api/test-xhr":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("X-XHR-Test", "yes")
            self.send_header("X-Custom-Header", "test-value-123")
            self.end_headers()
            self.wfile.write(json.dumps({"source": "xhr", "items": ["a", "b", "c"]}).encode())
        elif self.path == "/api/text-response":
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.send_header("X-Text-Only", "true")
            self.end_headers()
            self.wfile.write(b"Hello, this is plain text!")
        elif self.path == "/api/filter-test":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("X-Filter-Test", "pass")
            self.send_header("X-Custom-Header", "test-value-123")
            self.end_headers()
            self.wfile.write(json.dumps({"filter": "test"}).encode())
        elif self.path == "/api/slow":
            import time
            time.sleep(0.5)
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("X-Custom-Header", "test-value-123")
            self.end_headers()
            self.wfile.write(json.dumps({"slow": True, "delay_ms": 500}).encode())
        else:
            self.send_response(404)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": "not found"}).encode())

    def do_POST(self):
        self.do_GET()

    def log_message(self, format, *args):
        print(f"[HTTP] {args[0]}")

# ── WebSocket Test Server ──
async def ws_handler(websocket):
    print(f"[WS] Client connected: {websocket.remote_address}")
    try:
        # Send welcome message
        await websocket.send(json.dumps({"type": "welcome", "message": "Hello from test server!"}))

        async for message in websocket:
            print(f"[WS] Received: {message}")
            # Echo back with timestamp
            try:
                data = json.loads(message)
                data["_echo"] = True
                data["_server_time"] = __import__("datetime").datetime.now().isoformat()
                await websocket.send(json.dumps(data))
            except (json.JSONDecodeError, ValueError):
                await websocket.send(json.dumps({"echo": message, "_server_time": __import__("datetime").datetime.now().isoformat()}))
    except websockets.exceptions.ConnectionClosed:
        print(f"[WS] Client disconnected")

async def start_ws():
    async with websockets.serve(ws_handler, "localhost", WS_PORT):
        print(f"[WS] WebSocket server running on ws://localhost:{WS_PORT}")
        await asyncio.Future()

def run_ws():
    asyncio.run(start_ws())

# ── Main ──
if __name__ == "__main__":
    print(f"Starting test servers...")
    print(f"  HTTP: http://localhost:{PORT}")
    print(f"  WS:   ws://localhost:{WS_PORT}")
    print(f"  JS:   http://localhost:{PORT}/trace-recorder.js")

    # Start WebSocket in background thread
    ws_thread = threading.Thread(target=run_ws, daemon=True)
    ws_thread.start()

    # Start HTTP server
    server = http.server.HTTPServer(("localhost", PORT), TestHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.shutdown()
