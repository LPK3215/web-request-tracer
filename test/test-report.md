# Web Request Tracer v0.4.0 — Test Report

**Test Date:** 2026-06-13
**Test Environment:** Windows 11, Chrome (latest), Python 3.11.8, websockets 15.0.1
**Tester:** Automated browser testing via QoderWork

---

## Test Summary

All 21 test cases passed. Both scripts (`trace-recorder.js` and `trace-recorder.user.js`) are logically identical and free of known bugs.

| Category | Result |
|---|---|
| Syntax validation | 2/2 pass |
| Cross-file consistency | Identical logic |
| Backend server | All endpoints OK |
| Browser functional tests | 21/21 pass |
| Bug regression tests | 3/3 fixed & verified |

---

## 1. Pre-flight Checks

### 1.1 JavaScript Syntax (`node --check`)

```
trace-recorder.js       → Exit: 0 ✓
trace-recorder.user.js  → Exit: 0 ✓
```

### 1.2 Cross-file Consistency

A line-by-line comparison confirmed both files share identical application logic. The only differences are structural (UserScript metadata wrapper, `"use strict"`, and fallback `<script>` injection in the UserScript version).

### 1.3 Backend Server (`test-server.py`)

| Endpoint | Method | Expected | Actual | Status |
|---|---|---|---|---|
| `/` | GET | HTML test page | HTML served correctly | ✓ |
| `/trace-recorder.js` | GET | JS script | Script served correctly | ✓ |
| `/api/test-get` | GET | `{"status":"ok","method":"GET","data":[1,2,3]}` | Match | ✓ |
| `/api/test-post` | POST | Echo received body | Match | ✓ |
| `/api/test-xhr` | GET | `{"source":"xhr","items":["a","b","c"]}` | Match | ✓ |
| `/api/text-response` | GET | `Hello, this is plain text!` | Match | ✓ |
| `/api/filter-test` | GET | `{"filter":"test"}` | Match | ✓ |
| `/api/slow` | GET | 500ms delayed JSON | Match | ✓ |
| `/nonexistent` | GET | 404 JSON | Match | ✓ |

Custom response headers (`X-Custom-Header`, `X-API-Version`, `X-XHR-Test`, etc.) all present. ✓

### 1.4 WebSocket Server

```
Connect → Welcome message received ✓
Send    → Echo with _echo flag and _server_time ✓
Close   → code=1000, reason="Normal closure" ✓
```

---

## 2. Browser Functional Tests

Script injected into `http://localhost:8765/`, recording started, all test buttons triggered.

### 2.1 XHR Capture

**XHR GET** (`/api/test-xhr`):
```json
{
  "type": "network",
  "kind": "xhr",
  "request": { "url": "http://localhost:8765/api/test-xhr", "method": "GET",
               "headers": { "X-Test-Header": "xhr-get-test" } },
  "response": { "status": 200, "bodyText": "{\"source\": \"xhr\", \"items\": [\"a\", \"b\", \"c\"]}" },
  "_responseHeaders": { "content-type": "application/json", "x-custom-header": "test-value-123", "x-xhr-test": "yes" }
}
```
✓ Method, URL, status, request headers, response headers, response body all correct.

**XHR POST** (`/api/test-post`):
```json
{
  "type": "network", "kind": "xhr",
  "request": { "method": "POST", "body": { "type": "text", "value": "{\"name\":\"test\",\"value\":42}" } },
  "response": { "status": 201 }
}
```
✓ POST method, status 201, JSON body correctly recorded as `type: "text"`.

**XHR with Custom Header** (`/api/test-get`):
✓ Custom request header `X-Custom-Client: wrt-test-suite` captured.

### 2.2 Fetch Capture

**Fetch GET** (`/api/test-get`):
```json
{
  "type": "network", "kind": "fetch",
  "request": { "method": "GET" },
  "response": { "status": 200, "bodyText": "{\"status\": \"ok\", \"method\": \"GET\", \"data\": [1, 2, 3]}" }
}
```
✓ Method, status, response body all correct.

**Fetch POST** (`/api/test-post`):
```json
{
  "type": "network", "kind": "fetch",
  "request": { "method": "POST", "body": { "type": "text", "value": "{\"action\":\"create\",\"id\":999}" } },
  "response": { "status": 201 }
}
```
✓ POST method, status 201, JSON body correctly recorded.

**Fetch Text Response** (`/api/text-response`):
```json
{ "response": { "status": 200, "bodyText": "Hello, this is plain text!" } }
```
✓ Plain text body captured correctly.

### 2.3 WebSocket Capture

| Event | Kind | Data | Status |
|---|---|---|---|
| Connection opened | `open` | url: `ws://localhost:8766` | ✓ |
| Welcome received | `receive` | `{"type":"welcome","message":"Hello from test server!"}` | ✓ |
| Ping sent | `send` | `{"type":"ping","ts":...,"data":"hello"}` | ✓ |
| Echo received | `receive` | `{"type":"ping",...,"_echo":true,"_server_time":"..."}` | ✓ |
| Connection closed | `close` | code: 1000, reason: "Normal closure" | ✓ |

### 2.4 Other Features

| Feature | Status |
|---|---|
| Control panel renders (bottom-right) | ✓ |
| Start/Stop toggle | ✓ |
| Mode switch (All/Filtered) | ✓ |
| Filters settings modal | ✓ |
| JSON export | ✓ |
| HAR export | ✓ |
| Clear events | ✓ |
| localStorage persistence | ✓ |

---

## 3. v0.4.0 Bug Fix Verification

### 3.1 JSON Body Parsing Fix

**Before (v0.3.0):**
```
Input:  '{"action":"create","id":999}'
Output: { type: "urlencoded", value: { '{"action":"create","id":999}': "" } }  ← WRONG
```

**After (v0.4.0):**
```
Input:  '{"action":"create","id":999}'
Output: { type: "text", value: '{"action":"create","id":999}' }  ← CORRECT
```

Tested with both XHR POST and Fetch POST — both correctly capture JSON bodies. ✓

### 3.2 WebSocket Property Handler Interception

```javascript
var ws = new WebSocket('ws://localhost:8766');
ws.onopen = function() { /* user handler */ };
ws.onmessage = function(e) { /* user handler */ };
```

Result:
- User's `onopen` handler was called ✓
- User's `onmessage` handler received data ✓
- Tracer recorded both `open` and `receive` events ✓

### 3.3 XHR Abort Recording

```javascript
var xhr = new XMLHttpRequest();
xhr.open('GET', '/api/slow');
xhr.send();
xhr.abort();
```

Result:
```json
{
  "type": "network", "kind": "xhr",
  "request": { "method": "GET", "url": ".../api/slow" },
  "response": { "error": "XHR error" }
}
```
Aborted request is now recorded instead of silently dropped. ✓

---

## 4. v0.4.0 Optimization Verification

| Optimization | Status |
|---|---|
| `fetch(Request)` — method/headers extracted from Request objects | ✓ Implemented |
| Regex caching (`_getRegex`) — patterns compiled once, reused | ✓ Implemented |
| Transaction pruning — capped at `maxEvents` | ✓ Implemented |
| Unused code removed (`originalWSSend`, `buildRecordedBody.u`, `parseUrl.origin`) | ✓ Cleaned up |

---

## 5. Conclusion

**All 21 functional tests passed. All 3 bug fixes verified in the browser. All 4 optimizations confirmed implemented.**

Both `trace-recorder.js` and `trace-recorder.user.js` are fully synchronized in logic and free of known bugs as of v0.4.0.
