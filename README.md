# Web Request Tracer

A universal browser network request tracing tool. Hook XHR/fetch/WebSocket requests, capture and analyze them, then export as JSON or HAR. Ideal for API reverse engineering, debugging, and performance profiling.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-0.4.0-blue.svg)](https://github.com/web-request-tracer/web-request-tracer)

## Features

- **Multiple capture sources** — XHR, fetch, and WebSocket (open, send, receive, close, error events)
- **Response headers recording** — automatically captures response headers from both XHR and fetch
- **Flexible capture modes**
  - `All` — capture every XHR/fetch/WebSocket event (universal, bigger data)
  - `Filtered` — only capture requests matching your filter rules
- **Advanced filter rules**
  - Hostname exact match or regex (`hostPattern`)
  - Path substring or regex (`pathPattern`)
  - HTTP method whitelist
  - Request header key-value match (e.g., `content-type: application/json`)
  - Response header key-value match
- **In-panel filter settings** — click "Filters" to configure rules without editing source code
- **Dual export** — JSON (full trace data) and HAR (Chrome DevTools / Charles / Fiddler compatible)
- **Cross-page persistence** — records survive page navigations on the same origin via localStorage
- **Click-to-request association** — automatically link user clicks with resulting network requests via a configurable time window

## Use Cases

- API reverse engineering and analysis
- Frontend performance debugging
- User behavior to network request correlation
- Automated testing data collection
- Web application security auditing
- WebSocket protocol analysis

## Quick Start

### Console version (handy for one-off tracing)

1. Open the target website
2. Open DevTools Console (F12)
3. Paste the contents of `trace-recorder.js` and press Enter
4. Click "Start" on the floating panel (bottom-right)
5. Perform the actions you want to trace
6. Click "JSON" or "HAR" to export the data

### UserScript version (install once, run forever)

1. Install [Tampermonkey](https://www.tampermonkey.net/) (or a compatible userscript manager)
2. Install `trace-recorder.user.js`
3. (Optional) Edit the `@match` rules to limit which sites the script runs on
4. Visit any target website — the script loads automatically
5. Use the floating control panel in the bottom-right corner

## Control Panel

| Button | Action |
|---|---|
| **Start / Stop** | Toggle recording on/off |
| **Mode: All / Filtered** | Switch between capture all requests or filtered mode |
| **Filters** | Open settings modal to configure filter rules dynamically |
| **JSON** | Export trace data as a JSON file |
| **HAR** | Export trace data in HAR format (Chrome DevTools compatible) |
| **Clear** | Discard all recorded events |

## Configuration

Edit the `CFG` object at the top of either script to customize default behaviour:

```javascript
const CFG = {
  captureMode: "all",               // "all" | "filtered"
  filters: {
    hosts: [],                      // e.g. ["api.example.com"]
    hostPattern: "",                // hostname regex, e.g. "api\\..*\\.com"
    pathContains: [],               // e.g. ["/api/"]
    pathPattern: "",                // path regex, e.g. "/api/v[0-9]+/.*"
    methods: [],                    // e.g. ["POST", "GET"]
    requestHeaders: {},             // e.g. {"content-type": "application/json"}
    responseHeaders: {},            // e.g. {"content-type": "application/json"}
  },
  enableClickTransaction: true,     // associate clicks with network requests
  transactionWindowMs: 3000,        // time window for click→request association (ms)
  readResponseBody: true,           // read and record response bodies
  maxResponseTextLen: 200000,       // max response text length before truncation
  persist: true,                    // enable cross-page persistence
  maxEvents: 1200,                  // maximum number of recorded events
};
```

## Filter Rules

### Filter dimensions

In filtered mode, only requests that pass ALL non-empty filters are recorded. Leave a filter empty to skip it.

| Filter | Type | Description |
|---|---|---|
| `hosts` | exact array | Request host must be in this list |
| `hostPattern` | regex string | Request host must match this regex |
| `pathContains` | substring array | Request path must contain at least one of these strings |
| `pathPattern` | regex string | Request path must match this regex |
| `methods` | exact array | Request method must be in this list |
| `requestHeaders` | key-value object | Request headers must match these key-value pairs |
| `responseHeaders` | key-value object | Response headers must match these key-value pairs (post-response check) |

### Examples

Only capture POST requests to `api.example.com` whose path contains `/v1/`:

```javascript
filters: {
  hosts: ["api.example.com"],
  pathContains: ["/v1/"],
  methods: ["POST"],
}
```

Only capture JSON API calls (filter out images and static assets):

```javascript
filters: {
  requestHeaders: { "content-type": "application/json" },
}
```

Use regex to capture any API subdomain:

```javascript
filters: {
  hostPattern: "api\\..*\\.com",
  pathPattern: "/v[0-9]+/.*",
}
```

### Dynamic configuration

Click the **Filters** button on the control panel to bring up a settings modal where you can edit all filter rules without touching the source code. Changes take effect immediately and persist across page navigations.

## Export Formats

### JSON

The exported JSON file contains:

- `meta` — metadata (start time, user agent, URL, timezone, etc.)
- `events` — event list (network requests with full request/response details including response headers, click events, WebSocket events)
- `transactions` — transaction mapping (clicks linked to network requests)
- `state` — current state (running status, capture mode)

### HAR (HTTP Archive)

HAR export follows the [HAR 1.2 specification](http://www.softwareishard.com/blog/har-12-spec/). Compatible with:

- Chrome DevTools (Network panel → Import HAR)
- Charles Proxy
- Fiddler
- Firefox Developer Tools
- Various HAR viewer tools

The HAR file includes request/response headers, query parameters, post data, timing information, and response body text.

## WebSocket Events

WebSocket recording captures these event types:

- `open` — connection established (URL, connection ID)
- `send` — outgoing message (data, auto-detects JSON)
- `receive` — incoming message (data, auto-detects JSON)
- `close` — connection closed (code, reason, duration)
- `error` — connection error

Binary data (Blob, ArrayBuffer) is recorded with type and size metadata rather than raw bytes.

## How It Works

- Hooks `XMLHttpRequest` and `fetch` APIs to intercept network requests
- Wraps `WebSocket` constructor to intercept WebSocket connections and messages
- Uses `localStorage` for cross-page data persistence
- Listens to click events to track user interactions
- Uses a time-window algorithm to associate clicks with network requests

## Project Structure

```
web-request-tracer/
├── trace-recorder.js        # Console version (paste into DevTools)
├── trace-recorder.user.js   # UserScript version (install via Tampermonkey)
├── test/
│   ├── index.html           # Test page with buttons for all features
│   ├── test-server.py       # Local HTTP + WebSocket test server
│   └── test-report.md       # Test report (v0.4.0 verification)
├── CHANGELOG.md
├── CONTRIBUTING.md
├── LICENSE
└── README.md
```

## Testing

A local test environment is included in the `test/` directory:

```bash
# Install the only external dependency
pip install websockets

# Start the test server
python test/test-server.py
```

Then open `http://localhost:8765/` in your browser. The test page provides buttons for XHR, fetch, WebSocket, and filter testing. You can inject `trace-recorder.js` via the DevTools console or load it from `http://localhost:8765/trace-recorder.js`.

## Notes

- This tool reads and records network request content — be mindful of data security and privacy
- For production use, prefer filtered mode with strict filter rules
- Exported JSON/HAR files may contain sensitive information — handle with care
- Some websites may have CSP (Content Security Policy) restrictions that interfere with script execution
- The UserScript version uses `@inject-into page` to ensure hooks work within page context

## Changelog

### v0.4.0
- Fixed JSON request body being misparsed as URL-encoded parameters
- Added `fetch(Request)` object support (method, headers now extracted correctly)
- Added XHR `abort` event recording (previously silently dropped)
- Added WebSocket property-based event handler interception (`ws.onopen = ...` now recorded)
- Added regex pattern caching to avoid recompilation on every request
- Added transaction pruning to prevent unbounded localStorage growth
- Removed unused variables and parameters
- Included test server and test page in the repository

### v0.3.0
- Added response headers recording (XHR via `getAllResponseHeaders()`, fetch via `res.headers`)
- Added dynamic filter settings modal (click "Filters" on panel to configure rules in-page)
- Added regex filter support (`hostPattern`, `pathPattern`)
- Added request/response header filters
- Added HAR format export
- Added WebSocket support (open/send/receive/close/error events)
- Filters now persist across page navigations via localStorage state

### v0.2.0
- Initial public release with XHR/fetch hooks, click transactions, JSON export, cross-page persistence

## License

MIT

## Related Projects

- [Fiddler](https://www.telerik.com/fiddler) — powerful HTTP debugging proxy
- [Charles](https://www.charlesproxy.com/) — cross-platform HTTP proxy tool
- [Chrome DevTools](https://developer.chrome.com/docs/devtools/) — built-in browser developer tools
