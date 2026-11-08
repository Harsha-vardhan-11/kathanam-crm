"""
Kathanam's CRM Platform — optional local / offline server.

The main way to use the CRM is the hosted version (GitHub Pages + your Google account).
This server is for using it with no internet: it keeps the data on this computer in
data/db.json and serves the CRM to devices on the same Wi-Fi.

Start:   python server.py      (or double-click start.bat on Windows)
Needs:   Python 3.8+  — no extra packages.
"""
import json
import os
import shutil
import socket
import threading
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
PUBLIC = os.path.join(ROOT, "docs")
DATA_DIR = os.path.join(ROOT, "data")
BACKUP_DIR = os.path.join(DATA_DIR, "backups")
DB_FILE = os.path.join(DATA_DIR, "db.json")
CONFIG_FILE = os.path.join(ROOT, "config.json")

DEFAULT_CONFIG = {"port": 8080, "pin": ""}
EMPTY_DB = {"projects": [], "events": [], "team": [], "equipment": [], "transactions": [], "settings": {}}

LOCK = threading.Lock()


def load_config():
    if not os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(DEFAULT_CONFIG, f, indent=2)
        return dict(DEFAULT_CONFIG)
    with open(CONFIG_FILE, encoding="utf-8") as f:
        return {**DEFAULT_CONFIG, **json.load(f)}


CONFIG = load_config()


def read_db():
    if not os.path.exists(DB_FILE):
        return {"rev": 0, "data": EMPTY_DB}
    with open(DB_FILE, encoding="utf-8") as f:
        return json.load(f)


def write_db(obj):
    os.makedirs(BACKUP_DIR, exist_ok=True)
    # One backup per day: the first save of the day keeps a copy of yesterday's state.
    daily = os.path.join(BACKUP_DIR, f"db-{datetime.now():%Y-%m-%d}.json")
    if os.path.exists(DB_FILE) and not os.path.exists(daily):
        shutil.copy2(DB_FILE, daily)
    tmp = DB_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)
    os.replace(tmp, DB_FILE)


def lan_ips():
    ips = set()
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("10.255.255.255", 1))
        ips.add(s.getsockname()[0])
        s.close()
    except OSError:
        pass
    try:
        for ip in socket.gethostbyname_ex(socket.gethostname())[2]:
            if not ip.startswith("127."):
                ips.add(ip)
    except OSError:
        pass
    return sorted(ips)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PUBLIC, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass  # keep the console quiet

    def _path(self):
        return self.path.split("?", 1)[0]

    def _authorized(self):
        pin = str(CONFIG.get("pin") or "")
        return not pin or self.headers.get("X-PIN", "") == pin

    def _json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self._path()
        if path == "/api/info":
            return self._json(200, {"ips": lan_ips(), "port": CONFIG["port"], "pinRequired": bool(CONFIG.get("pin"))})
        if path == "/api/db":
            if not self._authorized():
                return self._json(401, {"error": "PIN required"})
            with LOCK:
                return self._json(200, read_db())
        return super().do_GET()

    def do_PUT(self):
        if self._path() != "/api/db":
            return self._json(404, {"error": "Not found"})
        if not self._authorized():
            return self._json(401, {"error": "PIN required"})
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length).decode("utf-8"))
            data, rev = body["data"], int(body["rev"])
        except (ValueError, KeyError, TypeError):
            return self._json(400, {"error": "Bad request"})
        with LOCK:
            current = read_db()
            # Another device saved since this one loaded: refuse so nothing is silently overwritten.
            if rev != current["rev"]:
                return self._json(409, {"error": "Changed on another device", "rev": current["rev"]})
            new_rev = current["rev"] + 1
            write_db({"rev": new_rev, "savedAt": datetime.now().isoformat(timespec="seconds"), "data": data})
        return self._json(200, {"rev": new_rev})


def main():
    port = int(CONFIG["port"])
    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    line = "=" * 58
    print(line)
    print("  KATHANAM'S CRM PLATFORM  — local / offline mode")
    print(line)
    print(f"  On this computer :  http://localhost:{port}")
    for ip in lan_ips():
        print(f"  On your phone    :  http://{ip}:{port}   (same Wi-Fi)")
    print(f"  PIN lock         :  {'ON' if CONFIG.get('pin') else 'off  (set one in config.json)'}")
    print(f"  Data file        :  {DB_FILE}")
    print(line)
    print("  Keep this window open while you use the CRM. Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
