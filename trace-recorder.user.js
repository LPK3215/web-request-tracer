// ==UserScript==
// @name         Web Request Tracer
// @namespace    web-request-tracer
// @version      0.4.0
// @description  Generic browser network request tracer – XHR, fetch, WebSocket capture with filter UI, response headers, regex rules, and HAR/JSON export.
// @author       web-request-tracer
// @match        *://*/*
// @run-at       document-start
// @inject-into  page
// @grant        none
// ==/UserScript==

(() => {
  "use strict";

  function recorderMain() {
    if (window.__WRT_TRACE_INSTALLED__) {
      console.warn("[wrt] already installed");
      return;
    }
    window.__WRT_TRACE_INSTALLED__ = true;

    const CFG = {
      captureMode: "all",

      filters: {
        hosts: [],
        hostPattern: "",
        pathContains: [],
        pathPattern: "",
        methods: [],
        requestHeaders: {},
        responseHeaders: {},
      },

      enableClickTransaction: true,
      transactionWindowMs: 3000,

      readResponseBody: true,
      maxResponseTextLen: 200000,

      persist: true,
      storageKey: "__WRT_TRACE_BUFFER__",
      maxEvents: 1200,

      exportFileName: () =>
        `web_request_trace_${new Date().toISOString().replace(/[:.]/g, "-")}.json`,

      harFileName: () =>
        `web_request_trace_${new Date().toISOString().replace(/[:.]/g, "-")}.har`,
    };

    const TRACE = {
      meta: {
        started_at: new Date().toISOString(),
        user_agent: navigator.userAgent,
        url: location.href,
        title: document.title,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      events: [],
      transactions: {},
    };

    const RUN = { enabled: false, hooksInstalled: false, wsHooksInstalled: false };
    const _regexCache = {};
    const _getRegex = (pattern) => {
      if (!_regexCache[pattern]) {
        try { _regexCache[pattern] = new RegExp(pattern); } catch (e) { _regexCache[pattern] = null; }
      }
      return _regexCache[pattern];
    };

    const TX = { currentId: null, lastClickAt: 0 };
    const newTxId = () => `tx_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const getActiveTxId = () => {
      if (!CFG.enableClickTransaction) return null;
      if (!TX.currentId) return null;
      if (Date.now() - TX.lastClickAt > CFG.transactionWindowMs) {
        TX.currentId = null;
        return null;
      }
      return TX.currentId;
    };
    const touchTx = (txId, networkEventIndex) => {
      const tx = TRACE.transactions[txId];
      if (!tx) return;
      tx.lastTouchAt = new Date().toISOString();
      tx.networkEventIndexes.push(networkEventIndex);
    };

    const cut = (s, maxLen = CFG.maxResponseTextLen) => {
      if (typeof s !== "string") return s;
      if (!maxLen || maxLen <= 0) return s;
      if (s.length <= maxLen) return s;
      return s.slice(0, maxLen) + "\n…(truncated: " + s.length + ")";
    };

    const toJsonSafe = (v) => {
      try {
        if (v == null) return v;
        if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
        if (v instanceof Error) return { name: v.name, message: v.message, stack: v.stack };
        return v;
      } catch (e) {
        return "[unserializable: " + String(e) + "]";
      }
    };

    // ── URL / Body parsers ──
    const parseUrl = (rawUrl) => {
      try {
        const u = new URL(rawUrl, location.href);
        const query = {};
        for (const [k, v] of u.searchParams.entries()) query[k] = v;
        return {
          href: u.href,
          host: u.host,
          pathname: u.pathname,
          query,
        };
      } catch (e) {
        return { href: String(rawUrl), error: String(e) };
      }
    };

    const parseBody = (body) => {
      if (body == null) return { type: "empty", value: null };
      if (typeof body === "string") {
        var _trimmed = body.trimStart();
        if (_trimmed[0] === '{' || _trimmed[0] === '[' || _trimmed[0] === '<') {
          return { type: "text", value: body };
        }
        try {
          const usp = new URLSearchParams(body);
          const o = {};
          for (const [k, v] of usp.entries()) o[k] = v;
          if (Object.keys(o).length) return { type: "urlencoded", value: o };
        } catch {}
        return { type: "text", value: body };
      }
      if (body instanceof URLSearchParams) {
        const o = {};
        for (const [k, v] of body.entries()) o[k] = v;
        return { type: "urlsearchparams", value: o };
      }
      if (body instanceof FormData) {
        const o = {};
        for (const [k, v] of body.entries()) {
          o[k] = v instanceof File ? { __file__: true, name: v.name, type: v.type, size: v.size } : v;
        }
        return { type: "formdata", value: o };
      }
      return { type: Object.prototype.toString.call(body), value: "[unsupported]" };
    };

    // ── Response header parsing ──
    const parseResponseHeaders = (raw) => {
      const headers = {};
      if (!raw || typeof raw !== "string") return headers;
      const lines = raw.trim().split(/[\r\n]+/);
      for (const line of lines) {
        const idx = line.indexOf(":");
        if (idx > 0) {
          const key = line.slice(0, idx).trim().toLowerCase();
          headers[key] = line.slice(idx + 1).trim();
        }
      }
      return headers;
    };

    const headersFromFetch = (resHeaders) => {
      const h = {};
      if (resHeaders && typeof resHeaders.forEach === "function") {
        resHeaders.forEach((v, k) => { h[k.toLowerCase()] = v; });
      }
      return h;
    };

    // ── Generic filter matcher ──
    const filterMatch = (u, method, reqHeaders) => {
      const f = CFG.filters;
      if (!f) return false;

      if (Array.isArray(f.hosts) && f.hosts.length > 0) {
        if (!u.host || !f.hosts.includes(u.host)) return false;
      }
      if (f.hostPattern && typeof f.hostPattern === "string" && f.hostPattern.trim()) {
        try {
          var _hostRe = _getRegex(f.hostPattern);
          if (!_hostRe || !u.host || !_hostRe.test(u.host)) return false;
        } catch { return false; }
      }
      if (Array.isArray(f.pathContains) && f.pathContains.length > 0) {
        if (!u.pathname || !f.pathContains.some(function(s) { return u.pathname.indexOf(s) !== -1; }))
          return false;
      }
      if (f.pathPattern && typeof f.pathPattern === "string" && f.pathPattern.trim()) {
        try {
          var _pathRe = _getRegex(f.pathPattern);
          if (!_pathRe || !u.pathname || !_pathRe.test(u.pathname)) return false;
        } catch { return false; }
      }
      if (Array.isArray(f.methods) && f.methods.length > 0) {
        if (!f.methods.includes(String(method || "").toUpperCase())) return false;
      }

      // request header filter
      if (f.requestHeaders && typeof f.requestHeaders === "object") {
        const keys = Object.keys(f.requestHeaders);
        if (keys.length > 0 && reqHeaders) {
          for (var i = 0; i < keys.length; i++) {
            var k = keys[i];
            var expected = String(f.requestHeaders[k]).toLowerCase();
            var actual = String(reqHeaders[k] || reqHeaders[k.toLowerCase()] || "").toLowerCase();
            if (actual !== expected) return false;
          }
        }
      }

      return true;
    };

    // ── Post-response filter (response headers check) ──
    const responseHeadersMatch = (resHeaders) => {
      const f = CFG.filters;
      if (!f || !f.responseHeaders || typeof f.responseHeaders !== "object") return true;
      const keys = Object.keys(f.responseHeaders);
      if (keys.length === 0) return true;
      if (!resHeaders) return false;
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        var expected = String(f.responseHeaders[k]).toLowerCase();
        var actual = String(resHeaders[k] || resHeaders[k.toLowerCase()] || "").toLowerCase();
        if (actual !== expected) return false;
      }
      return true;
    };

    const shouldRecord = (u, method, reqHeaders) => {
      if (!u || u.error) return false;
      if (CFG.captureMode === "all") return true;
      return filterMatch(u, method, reqHeaders);
    };

    const buildRecordedBody = (parsedBody) => {
      return { type: parsedBody.type, value: parsedBody.value };
    };

    const attachTx = (record) => {
      const txId = getActiveTxId();
      if (!txId) return record;
      record.transactionId = txId;
      record.sinceClickMs = Date.now() - TX.lastClickAt;
      return record;
    };

    // ── Persistence ──
    const persist = () => {
      if (!CFG.persist) return;
      try {
        var payload = {
          meta: TRACE.meta,
          events: TRACE.events,
          transactions: TRACE.transactions,
          state: { running: RUN.enabled, captureMode: CFG.captureMode, filters: CFG.filters },
        };
        localStorage.setItem(CFG.storageKey, JSON.stringify(payload));
      } catch (e) {
        console.warn("[wrt] persist failed:", e);
      }
    };

    const addEvent = (ev) => {
      TRACE.events.push(ev);
      if (CFG.maxEvents && TRACE.events.length > CFG.maxEvents) {
        TRACE.events.splice(0, TRACE.events.length - CFG.maxEvents);
      }
      // Prune transactions (keep last maxEvents worth)
      var txKeys = Object.keys(TRACE.transactions);
      if (txKeys.length > CFG.maxEvents) {
        txKeys.sort();
        var toRemove = txKeys.slice(0, txKeys.length - CFG.maxEvents);
        for (var ti = 0; ti < toRemove.length; ti++) delete TRACE.transactions[toRemove[ti]];
      }
      persist();
      return TRACE.events.length - 1;
    };

    const restore = () => {
      if (!CFG.persist) return;
      try {
        var raw = localStorage.getItem(CFG.storageKey);
        if (!raw) return false;
        var data = JSON.parse(raw);
        if (!data || typeof data !== "object") return false;
        if (data.meta && typeof data.meta === "object")
          TRACE.meta = Object.assign({}, TRACE.meta, data.meta);
        if (Array.isArray(data.events)) TRACE.events = data.events;
        if (data.transactions && typeof data.transactions === "object")
          TRACE.transactions = data.transactions;
        if (data.state && typeof data.state === "object") {
          if (typeof data.state.captureMode === "string") CFG.captureMode = data.state.captureMode;
          if (typeof data.state.running === "boolean") RUN.enabled = data.state.running;
          if (data.state.filters && typeof data.state.filters === "object")
            CFG.filters = Object.assign({}, CFG.filters, data.state.filters);
        }
        return true;
      } catch (e) {
        console.warn("[wrt] restore failed:", e);
        return false;
      }
    };

    // ── Public commands ──
    window.__WRT_TRACE_EXPORT__ = function() {
      TRACE.meta.ended_at = new Date().toISOString();
      TRACE.meta.final_url = location.href;
      TRACE.meta.final_title = document.title;

      var jsonStr = JSON.stringify(
        { meta: TRACE.meta, events: TRACE.events, transactions: TRACE.transactions, state: { running: RUN.enabled, captureMode: CFG.captureMode } },
        null, 2
      );
      var blob = new Blob([jsonStr], { type: "application/json;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = CFG.exportFileName();
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      console.log("[wrt] exported:", a.download);
    };

    // ── HAR export ──
    window.__WRT_TRACE_EXPORT_HAR__ = function() {
      TRACE.meta.ended_at = new Date().toISOString();
      TRACE.meta.final_url = location.href;
      TRACE.meta.final_title = document.title;

      var entries = [];
      for (var i = 0; i < TRACE.events.length; i++) {
        var ev = TRACE.events[i];
        if (ev.type !== "network") continue;
        var req = ev.request || {};
        var res = ev.response || {};

        // build HAR headers array
        var reqHeadersArr = [];
        var reqH = req.headers || {};
        for (var hk in reqH) {
          if (reqH.hasOwnProperty(hk))
            reqHeadersArr.push({ name: hk, value: String(reqH[hk]) });
        }

        var resHeaders = ev._responseHeaders || {};
        var resHeadersArr = [];
        for (var rk in resHeaders) {
          if (resHeaders.hasOwnProperty(rk))
            resHeadersArr.push({ name: rk, value: String(resHeaders[rk]) });
        }

        // query string
        var queryArr = [];
        var query = req.query || {};
        for (var qk in query) {
          if (query.hasOwnProperty(qk))
            queryArr.push({ name: qk, value: String(query[qk]) });
        }

        // postData
        var postData = null;
        if (req.body && req.body.type !== "empty" && req.body.value != null) {
          postData = { mimeType: "application/octet-stream", text: typeof req.body.value === "string" ? req.body.value : JSON.stringify(req.body.value) };
        }

        var entry = {
          startedDateTime: ev.ts_start || ev.ts,
          time: typeof ev.durationMs === "number" ? ev.durationMs : 0,
          request: {
            method: req.method || "GET",
            url: req.url || "",
            httpVersion: "HTTP/1.1",
            cookies: [],
            headers: reqHeadersArr,
            queryString: queryArr,
            postData: postData,
            headersSize: -1,
            bodySize: -1,
          },
          response: {
            status: res.status || 0,
            statusText: res.statusText || "",
            httpVersion: "HTTP/1.1",
            cookies: [],
            headers: resHeadersArr,
            content: {
              size: typeof res.bodyText === "string" ? res.bodyText.length : 0,
              mimeType: resHeaders["content-type"] || "",
              text: typeof res.bodyText === "string" ? res.bodyText : "",
            },
            redirectURL: "",
            headersSize: -1,
            bodySize: -1,
          },
          cache: {},
          timings: { send: 0, wait: typeof ev.durationMs === "number" ? ev.durationMs : 0, receive: 0 },
        };

        entries.push(entry);
      }

      var har = {
        log: {
          version: "1.2",
          creator: { name: "Web Request Tracer", version: "0.4.0" },
          pages: [{ startedDateTime: TRACE.meta.started_at, id: "page_1", title: TRACE.meta.title || "", pageTimings: { onContentLoad: -1, onLoad: -1 } }],
          entries: entries,
        },
      };

      var jsonStr = JSON.stringify(har, null, 2);
      var blob = new Blob([jsonStr], { type: "application/json;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = CFG.harFileName();
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      console.log("[wrt] HAR exported:", a.download);
    };

    window.__WRT_TRACE_CLEAR__ = function() {
      TRACE.events.length = 0;
      TRACE.transactions = {};
      TX.currentId = null;
      TX.lastClickAt = 0;
      try { localStorage.removeItem(CFG.storageKey); } catch (e) {}
      console.log("[wrt] cleared");
    };

    window.__WRT_TRACE_START__ = function() {
      if (RUN.enabled) return;
      RUN.enabled = true;
      installHooks();
      installWSHooks();
      persist();
      console.log("[wrt] started");
    };

    window.__WRT_TRACE_STOP__ = function() {
      if (!RUN.enabled) return;
      RUN.enabled = false;
      uninstallHooks();
      uninstallWSHooks();
      persist();
      console.log("[wrt] stopped");
    };

    var normalizeMode = function(mode) {
      var next = String(mode || "").toLowerCase().trim();
      if (next === "all" || next === "max") return "all";
      if (next === "filtered" || next === "minimal" || next === "mini") return "filtered";
      return null;
    };

    var displayMode = function(mode) { return mode === "all" ? "All" : "Filtered"; };

    window.__WRT_TRACE_MODE__ = function(mode) {
      var normalized = normalizeMode(mode);
      if (!normalized) {
        console.warn("[wrt] invalid mode:", mode, '(use "All" / "Filtered")');
        return;
      }
      CFG.captureMode = normalized;
      persist();
      console.log("[wrt] mode set:", displayMode(normalized));
    };

    // ── Click transaction ──
    if (CFG.enableClickTransaction) {
      document.addEventListener("click", function(event) {
        if (!RUN.enabled) return;
        var txId = newTxId();
        var now = Date.now();
        TX.currentId = txId;
        TX.lastClickAt = now;

        var clickEv = {
          type: "click",
          ts: new Date().toISOString(),
          page: { url: location.href, title: document.title },
          transactionId: txId,
          element: (function() {
            try {
              var target = event.target;
              var el = target && target.closest
                ? target.closest("button, a, [role='button'], [onclick], input, select, textarea")
                : null;
              el = el || target;
              if (!el || el.nodeType !== 1) return null;
              return {
                tagName: el.tagName,
                id: el.id || null,
                className: typeof el.className === "string" ? el.className : null,
                ariaLabel: el.getAttribute("aria-label") || null,
                text: (el.textContent || "").trim().slice(0, 200),
              };
            } catch (err) { return { error: String(err) }; }
          })(),
        };

        var clickIndex = addEvent(clickEv);
        TRACE.transactions[txId] = {
          transactionId: txId,
          startedAt: new Date(now).toISOString(),
          lastTouchAt: new Date(now).toISOString(),
          clickEventIndex: clickIndex,
          networkEventIndexes: [],
        };
      }, true);
    }

    // ════════════════════════════════════════════════════════════
    // ── XHR / Fetch hooks ──
    // ════════════════════════════════════════════════════════════
    var originalXHROpen = null;
    var originalXHRSend = null;
    var originalXHRSetHeader = null;
    var originalFetch = null;

    var installHooks = function() {
      if (RUN.hooksInstalled) return;
      RUN.hooksInstalled = true;

      originalXHROpen = XMLHttpRequest.prototype.open;
      originalXHRSend = XMLHttpRequest.prototype.send;
      originalXHRSetHeader = XMLHttpRequest.prototype.setRequestHeader;
      originalFetch = window.fetch;

      XMLHttpRequest.prototype.open = function(method, url) {
        this.__wrtTrace = {
          kind: "xhr",
          method: String(method || "GET").toUpperCase(),
          url: String(url),
          ts_start: new Date().toISOString(),
          start: Date.now(),
          requestHeaders: {},
          requestBody: null,
        };
        return originalXHROpen.apply(this, arguments);
      };

      XMLHttpRequest.prototype.setRequestHeader = function(k, v) {
        try { if (this.__wrtTrace) this.__wrtTrace.requestHeaders[String(k)] = String(v); } catch (e) {}
        return originalXHRSetHeader.apply(this, arguments);
      };

      XMLHttpRequest.prototype.send = function(data) {
        try { if (this.__wrtTrace) this.__wrtTrace.requestBody = data; } catch (e) {}

        var xhr = this;
        var done = function(isError) {
          if (!RUN.enabled) return;
          var t = xhr.__wrtTrace;
          if (!t) return;

          var u = parseUrl(t.url);
          var parsedBody = parseBody(t.requestBody);
          // pre-response filter
          if (!shouldRecord(u, t.method, t.requestHeaders)) return;

          // response headers
          var resHeaders = parseResponseHeaders(xhr.getAllResponseHeaders ? xhr.getAllResponseHeaders() : "");
          // post-response filter
          if (!responseHeadersMatch(resHeaders)) return;

          var durationMs = Date.now() - (t.start || Date.now());
          var responseText = null;
          try { responseText = xhr.responseText; } catch (e) {
            responseText = "[unreadable responseText: " + String(e) + "]";
          }

          var record = {
            type: "network",
            kind: "xhr",
            ts: new Date().toISOString(),
            ts_start: t.ts_start,
            durationMs: durationMs,
            request: {
              url: u.href, host: u.host, pathname: u.pathname,
              method: t.method, query: u.query,
              headers: t.requestHeaders,
              body: buildRecordedBody(parsedBody),
            },
            response: isError
              ? { error: "XHR error" }
              : {
                  status: xhr.status, statusText: xhr.statusText,
                  headers: resHeaders,
                  bodyText: CFG.readResponseBody ? cut(String(responseText || "")) : "[not read]",
                },
            _responseHeaders: resHeaders,
            page: { url: location.href, title: document.title },
          };

          record = attachTx(record);
          var idx = addEvent(record);
          if (record.transactionId) touchTx(record.transactionId, idx);
        };

        xhr.addEventListener("load", function() { done(false); });
        xhr.addEventListener("error", function() { done(true); });
        xhr.addEventListener("abort", function() { done(true); });
        return originalXHRSend.apply(this, arguments);
      };

      window.fetch = async function() {
        var args = arguments;
        var start = Date.now();
        var ts_start = new Date().toISOString();
        var input = args[0];
        var init = args[1] || {};
        var url = typeof input === "string" ? input : (input instanceof Request ? input.url : (input && input.url) || String(input));
        var method = String(init.method || (input instanceof Request ? input.method : (input && input.method)) || "GET").toUpperCase();

        var reqHeaders = (function() {
          try {
            var h = init.headers || (input instanceof Request ? input.headers : (input && input.headers)) || null;
            if (!h) return {};
            if (h instanceof Headers) { var o = {}; h.forEach(function(v, k) { o[k.toLowerCase()] = v; }); return o; }
            if (Array.isArray(h)) { var a = {}; for (var i = 0; i < h.length; i++) a[h[i][0].toLowerCase()] = h[i][1]; return a; }
            if (typeof h === "object") { var obj = {}; for (var _k in h) { if (h.hasOwnProperty(_k)) obj[_k.toLowerCase()] = h[_k]; } return obj; }
            return String(h);
          } catch (e) { return { __error__: String(e) }; }
        })();
        var reqBody = init.body != null ? init.body : null;

        var res;
        try {
          res = await originalFetch.apply(this, args);
        } catch (err) {
          if (!RUN.enabled) throw err;
          var _u = parseUrl(url);
          var _parsedBody = parseBody(reqBody);
          if (shouldRecord(_u, method, reqHeaders)) {
            var _rec = {
              type: "network", kind: "fetch",
              ts: new Date().toISOString(), ts_start: ts_start,
              durationMs: Date.now() - start,
              request: {
                url: _u.href, host: _u.host, pathname: _u.pathname,
                method: method, query: _u.query, headers: reqHeaders,
                body: buildRecordedBody(_parsedBody),
              },
              error: toJsonSafe(err),
              page: { url: location.href, title: document.title },
            };
            _rec = attachTx(_rec);
            var _idx = addEvent(_rec);
            if (_rec.transactionId) touchTx(_rec.transactionId, _idx);
          }
          throw err;
        }

        if (!RUN.enabled) return res;

        var u = parseUrl(url);
        var parsedBody = parseBody(reqBody);
        if (!shouldRecord(u, method, reqHeaders)) return res;

        var resHeaders = headersFromFetch(res.headers);
        if (!responseHeadersMatch(resHeaders)) return res;

        var bodyText = "[not read]";
        if (CFG.readResponseBody) {
          try {
            var clone = res.clone();
            bodyText = cut(await clone.text());
          } catch (e) { bodyText = "[read failed: " + String(e) + "]"; }
        }

        var record = {
          type: "network", kind: "fetch",
          ts: new Date().toISOString(), ts_start: ts_start,
          durationMs: Date.now() - start,
          request: {
            url: u.href, host: u.host, pathname: u.pathname,
            method: method, query: u.query, headers: reqHeaders,
            body: buildRecordedBody(parsedBody),
          },
          response: {
            status: res.status, statusText: res.statusText,
            headers: resHeaders, bodyText: bodyText,
          },
          _responseHeaders: resHeaders,
          page: { url: location.href, title: document.title },
        };

        record = attachTx(record);
        var idx = addEvent(record);
        if (record.transactionId) touchTx(record.transactionId, idx);
        return res;
      };
    };

    var uninstallHooks = function() {
      if (!RUN.hooksInstalled) return;
      RUN.hooksInstalled = false;
      try {
        if (originalXHROpen) XMLHttpRequest.prototype.open = originalXHROpen;
        if (originalXHRSend) XMLHttpRequest.prototype.send = originalXHRSend;
        if (originalXHRSetHeader) XMLHttpRequest.prototype.setRequestHeader = originalXHRSetHeader;
        if (originalFetch) window.fetch = originalFetch;
      } catch (e) { console.warn("[wrt] uninstallHooks failed:", e); }
    };

    // ════════════════════════════════════════════════════════════
    // ── WebSocket hooks ──
    // ════════════════════════════════════════════════════════════
    var OriginalWebSocket = null;

    var installWSHooks = function() {
      if (RUN.wsHooksInstalled) return;
      if (!window.WebSocket) return;
      RUN.wsHooksInstalled = true;
      OriginalWebSocket = window.WebSocket;

      var WRTWS = function() {
        var args = arguments;
        var wsUrl = args[0];
        var protocols = args[1];
        var ws = new OriginalWebSocket(wsUrl, protocols);

        var connId = "ws_" + Date.now() + "_" + Math.random().toString(16).slice(2);
        var openAt = Date.now();

        ws.addEventListener("open", function() {
          if (!RUN.enabled) return;
          var rec = {
            type: "websocket", kind: "open",
            ts: new Date().toISOString(),
            connectionId: connId,
            url: wsUrl,
            page: { url: location.href, title: document.title },
          };
          rec = attachTx(rec);
          var idx = addEvent(rec);
          if (rec.transactionId) touchTx(rec.transactionId, idx);
        });

        ws.addEventListener("message", function(e) {
          if (!RUN.enabled) return;
          var rec = {
            type: "websocket", kind: "receive",
            ts: new Date().toISOString(),
            connectionId: connId, url: wsUrl,
            data: (function() {
              if (typeof e.data === "string") {
                var cutStr = cut(e.data, 50000);
                // try json
                try { return JSON.parse(cutStr === e.data ? e.data : cutStr); } catch (_) { return cutStr; }
              }
              if (e.data instanceof Blob) return { __blob__: true, size: e.data.size, type: e.data.type };
              if (e.data instanceof ArrayBuffer) return { __arraybuffer__: true, byteLength: e.data.byteLength };
              return String(e.data);
            })(),
            page: { url: location.href, title: document.title },
          };
          rec = attachTx(rec);
          var idx = addEvent(rec);
          if (rec.transactionId) touchTx(rec.transactionId, idx);
        });

        ws.addEventListener("close", function(e) {
          if (!RUN.enabled) return;
          var rec = {
            type: "websocket", kind: "close",
            ts: new Date().toISOString(),
            connectionId: connId, url: wsUrl,
            code: e.code, reason: e.reason,
            durationMs: Date.now() - openAt,
            page: { url: location.href, title: document.title },
          };
          rec = attachTx(rec);
          var idx = addEvent(rec);
          if (rec.transactionId) touchTx(rec.transactionId, idx);
        });

        ws.addEventListener("error", function(e) {
          if (!RUN.enabled) return;
          var rec = {
            type: "websocket", kind: "error",
            ts: new Date().toISOString(),
            connectionId: connId, url: wsUrl,
            page: { url: location.href, title: document.title },
          };
          rec = attachTx(rec);
          var idx = addEvent(rec);
          if (rec.transactionId) touchTx(rec.transactionId, idx);
        });

        // Intercept property-based event handlers
        ["onopen", "onmessage", "onclose", "onerror"].forEach(function(prop) {
          var eventType = prop.slice(2);
          var _userHandler = null;
          Object.defineProperty(ws, prop, {
            configurable: true,
            enumerable: true,
            get: function() { return _userHandler; },
            set: function(fn) { _userHandler = fn; }
          });
          ws.addEventListener(eventType, function(e) {
            if (typeof _userHandler === "function") {
              try { _userHandler.call(ws, e); } catch (err) { console.error("[wrt] ws handler error:", err); }
            }
          });
        });

        // wrap send
        var origSend = ws.send;
        ws.send = function(data) {
          if (RUN.enabled) {
            var rec = {
              type: "websocket", kind: "send",
              ts: new Date().toISOString(),
              connectionId: connId, url: wsUrl,
              data: (function() {
                if (typeof data === "string") {
                  var cutStr = cut(data, 50000);
                  try { return JSON.parse(cutStr === data ? data : cutStr); } catch (_) { return cutStr; }
                }
                if (data instanceof Blob) return { __blob__: true, size: data.size, type: data.type };
                if (data instanceof ArrayBuffer) return { __arraybuffer__: true, byteLength: data.byteLength };
                return String(data);
              })(),
              page: { url: location.href, title: document.title },
            };
            rec = attachTx(rec);
            var idx = addEvent(rec);
            if (rec.transactionId) touchTx(rec.transactionId, idx);
          }
          return origSend.call(this, data);
        };

        return ws;
      };

      WRTWS.prototype = OriginalWebSocket.prototype;
      WRTWS.CONNECTING = OriginalWebSocket.CONNECTING;
      WRTWS.OPEN = OriginalWebSocket.OPEN;
      WRTWS.CLOSING = OriginalWebSocket.CLOSING;
      WRTWS.CLOSED = OriginalWebSocket.CLOSED;

      window.WebSocket = WRTWS;
    };

    var uninstallWSHooks = function() {
      if (!RUN.wsHooksInstalled) return;
      RUN.wsHooksInstalled = false;
      try { if (OriginalWebSocket) window.WebSocket = OriginalWebSocket; } catch (e) {
        console.warn("[wrt] uninstallWSHooks failed:", e);
      }
    };

    // ════════════════════════════════════════════════════════════
    // ── Floating control panel ──
    // ════════════════════════════════════════════════════════════
    var mountPanel = function() {
      if (document.getElementById("__WRT_TRACE_PANEL__")) return;
      var panel = document.createElement("div");
      panel.id = "__WRT_TRACE_PANEL__";
      panel.style.cssText = [
        "position:fixed", "right:16px", "bottom:16px", "z-index:2147483647",
        "background:rgba(20,20,20,0.92)", "color:#fff", "padding:10px 12px",
        "border-radius:10px", "font-size:12px", "font-family:Arial,sans-serif",
        "box-shadow:0 6px 18px rgba(0,0,0,0.25)", "min-width:220px",
      ].join(";");

      var title = document.createElement("div");
      title.textContent = "Web Request Tracer";
      title.style.cssText = "font-weight:600;margin-bottom:6px;";

      var row = document.createElement("div");
      row.style.cssText = "display:flex;gap:6px;flex-wrap:wrap;";

      var _btn = function(label, bg, onClick) {
        var b = document.createElement("button");
        b.textContent = label;
        b.style.cssText = [
          "background:" + bg, "color:#fff", "border:none", "padding:5px 8px",
          "border-radius:6px", "cursor:pointer", "font-size:12px",
        ].join(";");
        b.addEventListener("click", onClick);
        return b;
      };

      var status = document.createElement("div");
      status.textContent = "idle";
      status.style.cssText = "margin-top:6px;opacity:0.75;";

      var startBtn = _btn("Start", "#2d8cff", function() {
        if (RUN.enabled) {
          window.__WRT_TRACE_STOP__();
          startBtn.textContent = "Start";
          status.textContent = "idle";
          return;
        }
        window.__WRT_TRACE_START__();
        startBtn.textContent = "Stop";
        status.textContent = "running";
      });

      var modeBtn = _btn("Mode: " + displayMode(CFG.captureMode), "#6f42c1", function() {
        var next = CFG.captureMode === "all" ? "filtered" : "all";
        window.__WRT_TRACE_MODE__(next);
        modeBtn.textContent = "Mode: " + displayMode(next);
      });

      var downloadBtn = _btn("JSON", "#21a366", function() { window.__WRT_TRACE_EXPORT__(); });
      var harBtn = _btn("HAR", "#17a2b8", function() { window.__WRT_TRACE_EXPORT_HAR__(); });
      var clearBtn = _btn("Clear", "#d9534f", function() {
        window.__WRT_TRACE_CLEAR__();
        status.textContent = RUN.enabled ? "running" : "idle";
      });
      var settingsBtn = _btn("Filters", "#f0ad4e", function() { openSettings(); });

      row.append(startBtn, modeBtn, settingsBtn, downloadBtn, harBtn, clearBtn);
      panel.append(title, row, status);
      document.body.appendChild(panel);

      if (RUN.enabled) {
        startBtn.textContent = "Stop";
        status.textContent = "running";
      }
    };

    // ════════════════════════════════════════════════════════════
    // ── Settings modal ──
    // ════════════════════════════════════════════════════════════
    var openSettings = function() {
      // remove existing
      var existing = document.getElementById("__WRT_SETTINGS_MODAL__");
      if (existing) existing.remove();

      var overlay = document.createElement("div");
      overlay.id = "__WRT_SETTINGS_MODAL__";
      overlay.style.cssText = [
        "position:fixed", "inset:0", "z-index:2147483646",
        "background:rgba(0,0,0,0.6)", "display:flex",
        "align-items:center", "justify-content:center",
      ].join(";");

      var box = document.createElement("div");
      box.style.cssText = [
        "background:#2a2a2a", "color:#eee", "padding:20px 24px",
        "border-radius:12px", "min-width:420px", "max-width:520px",
        "max-height:80vh", "overflow-y:auto", "font-size:13px",
        "font-family:Arial,sans-serif", "box-shadow:0 8px 32px rgba(0,0,0,0.5)",
      ].join(";");

      var heading = document.createElement("div");
      heading.textContent = "Filter Settings";
      heading.style.cssText = "font-weight:700;font-size:16px;margin-bottom:14px;text-align:center;";

      var makeField = function(labelText, placeholder, value, isMultiline) {
        var wrap = document.createElement("div");
        wrap.style.cssText = "margin-bottom:10px;";

        var label = document.createElement("label");
        label.textContent = labelText;
        label.style.cssText = "display:block;margin-bottom:4px;color:#aaa;font-size:11px;";

        var input;
        if (isMultiline) {
          input = document.createElement("textarea");
          input.style.cssText = "width:100%;min-height:50px;resize:vertical;";
        } else {
          input = document.createElement("input");
          input.type = "text";
          input.style.cssText = "width:100%;";
        }
        input.style.cssText += [
          "background:#1a1a1a", "color:#ddd", "border:1px solid #444",
          "border-radius:6px", "padding:6px 8px", "font-size:12px",
          "box-sizing:border-box", "font-family:monospace",
        ].join(";");
        input.placeholder = placeholder || "";
        input.value = value || "";

        wrap.append(label, input);
        return { wrap: wrap, input: input };
      };

      var f = CFG.filters;
      var fields = {};

      var hostField = makeField("Hosts (comma-separated)", "api.example.com, cdn.example.com",
        Array.isArray(f.hosts) ? f.hosts.join(", ") : "");
      fields.hosts = hostField;

      var hostPatField = makeField("Host Regex", "api\\..*\\.com",
        f.hostPattern || "");
      fields.hostPattern = hostPatField;

      var pathField = makeField("Path Contains (comma-separated)", "/api/v1/, /graphql",
        Array.isArray(f.pathContains) ? f.pathContains.join(", ") : "");
      fields.pathContains = pathField;

      var pathPatField = makeField("Path Regex", "/api/v[0-9]+/.*",
        f.pathPattern || "");
      fields.pathPattern = pathPatField;

      var methodField = makeField("Methods (comma-separated)", "POST, PUT, DELETE",
        Array.isArray(f.methods) ? f.methods.join(", ") : "");
      fields.methods = methodField;

      var reqHeaderStr = "";
      if (f.requestHeaders && typeof f.requestHeaders === "object") {
        var reqH = [];
        for (var rk in f.requestHeaders) {
          if (f.requestHeaders.hasOwnProperty(rk)) reqH.push(rk + ": " + f.requestHeaders[rk]);
        }
        reqHeaderStr = reqH.join("\n");
      }
      var reqHeaderField = makeField("Request Headers (key: value, one per line)", "content-type: application/json",
        reqHeaderStr, true);
      fields.requestHeaders = reqHeaderField;

      var resHeaderStr = "";
      if (f.responseHeaders && typeof f.responseHeaders === "object") {
        var resH = [];
        for (var rsk in f.responseHeaders) {
          if (f.responseHeaders.hasOwnProperty(rsk)) resH.push(rsk + ": " + f.responseHeaders[rsk]);
        }
        resHeaderStr = resH.join("\n");
      }
      var resHeaderField = makeField("Response Headers (key: value, one per line)", "content-type: application/json",
        resHeaderStr, true);
      fields.responseHeaders = resHeaderField;

      box.append(heading);
      for (var fk in fields) {
        if (fields.hasOwnProperty(fk)) box.append(fields[fk].wrap);
      }

      var btnRow = document.createElement("div");
      btnRow.style.cssText = "display:flex;gap:10px;margin-top:14px;justify-content:flex-end;";

      var cancelBtn = document.createElement("button");
      cancelBtn.textContent = "Cancel";
      cancelBtn.style.cssText = [
        "background:#555", "color:#fff", "border:none", "padding:7px 16px",
        "border-radius:6px", "cursor:pointer", "font-size:13px",
      ].join(";");
      cancelBtn.addEventListener("click", function() { overlay.remove(); });

      var applyBtn = document.createElement("button");
      applyBtn.textContent = "Apply";
      applyBtn.style.cssText = [
        "background:#f0ad4e", "color:#111", "border:none", "padding:7px 16px",
        "border-radius:6px", "cursor:pointer", "font-size:13px", "font-weight:600",
      ].join(";");
      applyBtn.addEventListener("click", function() {
        // parse hosts
        var hostsRaw = fields.hosts.input.value.trim();
        CFG.filters.hosts = hostsRaw ? hostsRaw.split(",").map(function(s) { return s.trim(); }).filter(Boolean) : [];
        // host pattern
        CFG.filters.hostPattern = fields.hostPattern.input.value.trim();
        // path contains
        var pathRaw = fields.pathContains.input.value.trim();
        CFG.filters.pathContains = pathRaw ? pathRaw.split(",").map(function(s) { return s.trim(); }).filter(Boolean) : [];
        // path pattern
        CFG.filters.pathPattern = fields.pathPattern.input.value.trim();
        // methods
        var methodRaw = fields.methods.input.value.trim();
        CFG.filters.methods = methodRaw ? methodRaw.split(",").map(function(s) { return s.trim().toUpperCase(); }).filter(Boolean) : [];

        // request headers
        CFG.filters.requestHeaders = {};
        var reqHLines = fields.requestHeaders.input.value.trim().split("\n").filter(function(l) { return l.indexOf(":") > 0; });
        for (var rhi = 0; rhi < reqHLines.length; rhi++) {
          var ci = reqHLines[rhi].indexOf(":");
          CFG.filters.requestHeaders[reqHLines[rhi].slice(0, ci).trim().toLowerCase()] = reqHLines[rhi].slice(ci + 1).trim();
        }

        // response headers
        CFG.filters.responseHeaders = {};
        var resHLines = fields.responseHeaders.input.value.trim().split("\n").filter(function(l) { return l.indexOf(":") > 0; });
        for (var rsi = 0; rsi < resHLines.length; rsi++) {
          var cj = resHLines[rsi].indexOf(":");
          CFG.filters.responseHeaders[resHLines[rsi].slice(0, cj).trim().toLowerCase()] = resHLines[rsi].slice(cj + 1).trim();
        }

        persist();
        overlay.remove();
        console.log("[wrt] filters updated:", JSON.parse(JSON.stringify(CFG.filters)));
      });

      btnRow.append(cancelBtn, applyBtn);
      box.append(btnRow);
      overlay.appendChild(box);

      // click outside to close
      overlay.addEventListener("click", function(e) {
        if (e.target === overlay) overlay.remove();
      });

      document.body.appendChild(overlay);
    };

    // ── Init ──
    restore();

    if (document.body) mountPanel();
    else document.addEventListener("DOMContentLoaded", mountPanel, { once: true });

    if (RUN.enabled) {
      installHooks();
      installWSHooks();
      console.log("[wrt] resumed (running=true)");
    } else {
      console.log("[wrt] installed (idle).");
    }
  }

  try { recorderMain(); return; } catch (e) {
    console.warn("[wrt] direct start failed, falling back to <script> injection:", e);
  }
  try {
    var script = document.createElement("script");
    script.textContent = "(" + recorderMain.toString() + ")();";
    (document.head || document.documentElement).appendChild(script);
    script.remove();
  } catch (e) { console.error("[wrt] injection failed:", e); }
})();
