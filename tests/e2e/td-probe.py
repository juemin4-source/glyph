"""
tauri-driver DnD 探针
跑: python e2e/td-probe.py
"""
import urllib.request, json, time, subprocess, os, signal, sys

PORT = 4444
EXE = "G:/AI/Claude-Workspace/Projects/glyph/target/debug/glyph.exe"
BASE = f"http://127.0.0.1:{PORT}"

def wd(method, path, body=None):
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=json.dumps(body).encode() if body else None,
        headers={"Content-Type": "application/json"} if body else {},
        method=method
    )
    resp = urllib.request.urlopen(req, timeout=20)
    return json.loads(resp.read())

def get_logs(sid):
    try:
        return wd("POST", f"/session/{sid}/log", {"type": "browser"}).get("value", [])
    except:
        return []

def elems(sid, by, val):
    return wd("POST", f"/session/{sid}/elements", {"using": by, "value": val}).get("value", [])

def elem_id(e):
    return e.get("element-6066-11e4-a52e-4f735466cecf") or e.get("ELEMENT")

def elem_click(sid, eid):
    return wd("POST", f"/session/{sid}/element/{eid}/click")

def elem_text(sid, eid):
    return wd("GET", f"/session/{sid}/element/{eid}/text").get("value", "")

def elem_rect(sid, eid):
    return wd("GET", f"/session/{sid}/element/{eid}/rect").get("value", {})

def elem_value(sid, eid, text):
    wd("POST", f"/session/{sid}/element/{eid}/clear")
    wd("POST", f"/session/{sid}/element/{eid}/value", {"text": text})

# Kill leftovers
subprocess.run(
    "powershell -NoProfile \"Get-Process tauri-driver,msedgedriver|Stop-Process -Force\"",
    shell=True, capture_output=True, timeout=5
)
time.sleep(2)

# Start tauri-driver
print("[1] Starting tauri-driver...")
driver = subprocess.Popen(
    ["tauri-driver", "--port", str(PORT)],
    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
)

for i in range(30):
    try:
        wd("GET", "/sessions")
        print("  Driver ready")
        break
    except:
        time.sleep(1)

# Create session
print("[2] Creating Tauri session...")
caps = {
    "capabilities": {
        "alwaysMatch": {
            "browserName": "tauri",
            "tauri:options": {"application": EXE}
        }
    }
}
sid = None
for attempt in range(3):
    try:
        res = wd("POST", "/session", caps)
        sid = res.get("value", {}).get("sessionId") or res.get("sessionId")
        if sid:
            print(f"  Session: {sid}")
            break
    except Exception as e:
        print(f"  Attempt {attempt+1}: {str(e)[:60]}")
        time.sleep(3)

if not sid:
    print("  FAILED")
    driver.kill()
    sys.exit(1)

# Wait for app
time.sleep(4)
try: wd("POST", f"/session/{sid}/url", {"url": "tauri://localhost"})
except: pass
time.sleep(2)

# Clear logs
get_logs(sid)
time.sleep(1)

# Inject probe
print("[3] Injecting Event Probe...")
try:
    wd("POST", f"/session/{sid}/execute/sync", {
        "script": """
            var s = document.createElement('script');
            s.src = '/event-probe.js';
            document.head.appendChild(s);
        """,
        "args": []
    })
    time.sleep(2)
    logs = get_logs(sid)
    probe_ok = any("Event Probe" in (l.get("message") or "") for l in logs)
    print(f"  Probe loaded: {probe_ok}")
except Exception as e:
    print(f"  Probe inject: {str(e)[:80]}")
    probe_ok = False

# Start probes
print("[4] Starting probes...")
try:
    wd("POST", f"/session/{sid}/execute/sync", {
        "script": """
            window.probe('.doc-outline', 'dragstart dragenter dragover drop dragend');
            window.probe('.outline-item-wrapper', 'dragstart dragover drop');
        """,
        "args": []
    })
except Exception as e:
    print(f"  Probe start: {str(e)[:80]}")

# Try to invoke Tauri commands directly to create project + objects
print("[5] Creating project via Tauri invoke...")
try:
    # First check if __TAURI__ is available
    has_tauri = wd("POST", f"/session/{sid}/execute/sync", {
        "script": "return typeof window.__TAURI__ !== 'undefined'",
        "args": []
    })
    print(f"  __TAURI__ available: {has_tauri.get('value')}")

    # Try to use Tauri invoke through the IPC endpoint
    # Tauri 2 exposes invoke via __TAURI_INTERNALS__.invoke or similar
    result = wd("POST", f"/session/{sid}/execute/sync", {
        "script": """
            // Try to create a project via Tauri invoke
            var invoke = window.__TAURI__?.core?.invoke;
            if (!invoke && window.__TAURI_INTERNALS__) {
                invoke = window.__TAURI_INTERNALS__.invoke;
            }
            if (invoke) {
                return 'invoke found';
            }
            // Try the tauri IPC directly
            if (window.__TAURI_IPC__) {
                return 'IPC found';
            }
            return 'no tauri';
        """,
        "args": []
    })
    tauri_status = result.get("value", "")
    print(f"  Tauri status: {tauri_status}")
except Exception as e:
    print(f"  Tauri check: {str(e)[:80]}")

# If Tauri invoke is available, create project directly
# Otherwise fall back to GUI wizard
if tauri_status == 'invoke found':
    try:
        proj = wd("POST", f"/session/{sid}/execute/sync", {
            "script": """
                var invoke = window.__TAURI__.core.invoke;
                return invoke('create_project', {
                    name: 'DnD测试',
                    genre: '科幻',
                    status: 'drafting',
                    wordCount: 0,
                    gradient: '[\"#6366f1\",\"#8b5cf6\"]'
                }).then(function(p) { return JSON.stringify(p); });
            """,
            "args": []
        })
        pid = json.loads(proj.get("value", "{}")).get("id", "")
        print(f"  Project created: {pid[:20]}...")

        if pid:
            # Create two objects
            for obj in [
                {"id": "dnd-ch1", "name": "第一章", "type": "章节", "sortOrder": 0},
                {"id": "dnd-ch2", "name": "第二章", "type": "章节", "sortOrder": 1},
            ]:
                wd("POST", f"/session/{sid}/execute/sync", {
                    "script": """
                        var invoke = window.__TAURI__.core.invoke;
                        return invoke('create_world_object', {object: {
                            id: arguments[0],
                            projectId: arguments[1],
                            name: arguments[2],
                            type: arguments[3],
                            status: '草稿',
                            canonLevel: '项目正典',
                            tags: [], aliases: [], selectedBoards: [],
                            content: '测试内容' + arguments[2],
                            referencesCount: 0,
                            judgmentHistory: [],
                            sortOrder: arguments[4]
                        }});
                    """,
                    "args": [obj["id"], pid, obj["name"], obj["type"], obj["sortOrder"]]
                })
            print("  Objects created")
            time.sleep(1)

            # Navigate to project (click on its card)
            cards = elems(sid, "css selector", "[class*='card'], [class*='Card']")
            print(f"  Found {len(cards)} project cards")
            if cards:
                elem_click(sid, elem_id(cards[0]))
                print("  Clicked project card")
                time.sleep(2)
    except Exception as e:
        print(f"  Invoke error: {str(e)[:100]}")
else:
    # Fall back: try GUI wizard
    print("  Fallback: GUI wizard...")
    try:
        btns = elems(sid, "xpath", "//button")
        for b in btns:
            bid = elem_id(b)
            txt = elem_text(sid, bid)
            if "创" in txt:
                elem_click(sid, bid)
                print(f"  Clicked: {txt.strip()[:15]}")
                break
        time.sleep(2)
    except Exception as e:
        print(f"  GUI error: {str(e)[:80]}")

# Attempt DnD
print("[6] Testing drag-and-drop...")
drags = elems(sid, "css selector", "[draggable]")
print(f"  Found {len(drags)} draggable elements")

if len(drags) >= 2:
    src_id = elem_id(drags[0])
    dst_id = elem_id(drags[1])
    src_r = elem_rect(sid, src_id)
    dst_r = elem_rect(sid, dst_id)

    if src_r and dst_r:
        sx = int(src_r["x"] + src_r["width"] / 2)
        sy = int(src_r["y"] + src_r["height"] / 2)
        dx = int(dst_r["x"] + dst_r["width"] / 2)
        dy = int(dst_r["y"] + dst_r["height"] / 2)

        print(f"  From ({sx},{sy}) → ({dx},{dy})")

        wd("POST", f"/session/{sid}/actions", {
            "actions": [{
                "type": "pointer", "id": "mouse",
                "parameters": {"pointerType": "mouse"},
                "actions": [
                    {"type": "pointerMove", "duration": 0, "x": sx, "y": sy},
                    {"type": "pointerDown", "button": 0},
                    {"type": "pointerMove", "duration": 800, "x": dx, "y": dy},
                    {"type": "pause", "duration": 500},
                    {"type": "pointerUp", "button": 0},
                ],
            }]
        })
        print("  Drag complete")
        time.sleep(1)

# Get probe logs
time.sleep(1)
all_logs = get_logs(sid)

print(f"\n{'='*50}")
print(f"Probe Results ({len(all_logs)} console messages)")
print(f"{'='*50}")

dnd_events = [l for l in all_logs if any(x in (l.get("message") or "") for x in ["📍", "dragstart", "dragover", "drop", "dragenter"])]

for l in dnd_events:
    msg = (l.get("message") or "").strip()
    # Clean up WebDriver log format
    if msg:
        print(msg[:300])

msgs = [l.get("message") or "" for l in dnd_events]
print(f"\n{'='*50}")
print(f"Summary")
print(f"{'='*50}")
print(f"  dragstart: {'✅' if any('📍' in m and 'dragstart' in m for m in msgs) else '❌'}")
print(f"  dragenter: {'✅' if any('📍' in m and 'dragenter' in m for m in msgs) else '❌'}")
print(f"  dragover:  {'✅' if any('📍' in m and 'dragover' in m for m in msgs) else '❌'}")
print(f"  drop:      {'✅' if any('📍' in m and 'drop' in m for m in msgs) else '❌'}")

# Any errors
errors = [l for l in all_logs if "ERROR" in (l.get("message") or "").upper()]
if errors:
    print(f"\nErrors:")
    for e in errors[:5]:
        print(f"  {(e.get('message') or '')[:150]}")

driver.kill()
print("\nDone")
