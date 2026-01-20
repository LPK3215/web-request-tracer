/**
 * Gemini Business Team/Mailbox RPC Trace Recorder (batchexecute)
 * 控制台版本 - 直接在 DevTools Console 粘贴执行
 *
 * 使用方式：
 * 1) 打开：https://business.gemini.google/settings/team
 * 2) DevTools Console 粘贴本脚本回车
 * 3) 点击右下角面板 "Start"
 * 4) 执行操作（list / add / remove / update）
 * 5) 点击 "Download JSON"
 */
(() => {
  if (window.__MBX_TRACE_INSTALLED__) {
    console.warn("[mbx-trace] already installed");
    return;
  }
  window.__MBX_TRACE_INSTALLED__ = true;

  const CFG = {
    // 采集模式：
    // - "minimal": 仅采集 batchexecute + list-sessions（用于 Gemini Business 场景）
    // - "all":     采集全部 XHR/fetch（通用抓包，数据量更大）
    captureMode: "minimal",

    enableClickTransaction: true,
    transactionWindowMs: 3000,

    captureBatchexecute: true, // minimal 模式下启用
    captureListSessions: true, // minimal 模式下启用

    readResponseBody: true,
    maxResponseTextLen: 200000,

    // 持久化：开启后，同一站点(同一 origin)跨页面继续累积记录
    persist: true,
    storageKey: "__MBX_TRACE_BUFFER__",
    maxEvents: 1200, // 防止 localStorage 爆

    exportFileName: () =>
      `batchexecute_trace_${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
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

  const RUN = { enabled: false, hooksInstalled: false };

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
    const now = Date.now();
    tx.lastTouchAt = new Date(now).toISOString();
    tx.networkEventIndexes.push(networkEventIndex);
  };

  const cut = (s, maxLen = CFG.maxResponseTextLen) => {
    if (typeof s !== "string") return s;
    if (!maxLen || maxLen <= 0) return s;
    if (s.length <= maxLen) return s;
    return s.slice(0, maxLen) + `\n…(truncated: ${s.length})`;
  };

  const toJsonSafe = (v) => {
    try {
      if (v == null) return v;
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
      if (v instanceof Error) return { name: v.name, message: v.message, stack: v.stack };
      return v;
    } catch (e) {
      return `[unserializable: ${String(e)}]`;
    }
  };

  const parseUrl = (rawUrl) => {
    try {
      const u = new URL(rawUrl, location.href);
      const query = {};
      for (const [k, v] of u.searchParams.entries()) query[k] = v;
      return {
        href: u.href,
        origin: u.origin,
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
        o[k] =
          v instanceof File ? { __file__: true, name: v.name, type: v.type, size: v.size } : v;
      }
      return { type: "formdata", value: o };
    }

    return { type: Object.prototype.toString.call(body), value: "[unsupported]" };
  };

  const pickRpcPayload = (parsedBody) => {
    const v = parsedBody?.value;
    if (!v || typeof v !== "object") return null;
    const out = {};
    if (typeof v["f.req"] === "string") out["f.req"] = v["f.req"];
    if (typeof v["at"] === "string") out["at"] = v["at"];
    return Object.keys(out).length ? out : null;
  };

  const isBatchexecute = (u, method) => {
    if (!CFG.captureBatchexecute) return false;
    if (!u || u.error) return false;
    if (u.host !== "business.gemini.google") return false;
    if (!String(method || "").toUpperCase().startsWith("POST")) return false;
    return u.pathname.includes("/data/batchexecute");
  };

  const isListSessions = (u, method) => {
    if (!CFG.captureListSessions) return false;
    if (!u || u.error) return false;
    if (u.host !== "auth.business.gemini.google") return false;
    if (String(method || "").toUpperCase() !== "GET") return false;
    return u.pathname.includes("/list-sessions");
  };

  const shouldRecord = (u, method, parsedBody) => {
    if (!u || u.error) return false;
    if (CFG.captureMode === "all") return true;

    if (isBatchexecute(u, method)) {
      const rpcPayload = pickRpcPayload(parsedBody);
      if (!rpcPayload) return false;
      if (!u.query || !u.query.rpcids) return false;
      return true;
    }
    if (isListSessions(u, method)) return true;
    return false;
  };

  const attachTx = (record) => {
    const txId = getActiveTxId();
    if (!txId) return record;
    record.transactionId = txId;
    record.sinceClickMs = Date.now() - TX.lastClickAt;
    return record;
  };

  const persist = () => {
    if (!CFG.persist) return;
    try {
      const payload = {
        meta: TRACE.meta,
        events: TRACE.events,
        transactions: TRACE.transactions,
        state: { running: RUN.enabled, captureMode: CFG.captureMode },
      };
      localStorage.setItem(CFG.storageKey, JSON.stringify(payload));
    } catch (e) {
      console.warn("[mbx-trace] persist failed:", e);
    }
  };

  const addEvent = (ev) => {
    const idx = TRACE.events.push(ev) - 1;
    if (CFG.maxEvents && TRACE.events.length > CFG.maxEvents) {
      TRACE.events.splice(0, TRACE.events.length - CFG.maxEvents);
    }
    persist();
    return idx;
  };

  const restore = () => {
    if (!CFG.persist) return;
    try {
      const raw = localStorage.getItem(CFG.storageKey);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!data || typeof data !== "object") return false;
      if (data.meta && typeof data.meta === "object") TRACE.meta = { ...TRACE.meta, ...data.meta };
      if (Array.isArray(data.events)) TRACE.events = data.events;
      if (data.transactions && typeof data.transactions === "object") TRACE.transactions = data.transactions;
      if (data.state && typeof data.state === "object") {
        if (typeof data.state.captureMode === "string") CFG.captureMode = data.state.captureMode;
        if (typeof data.state.running === "boolean") RUN.enabled = data.state.running;
      }
      return true;
    } catch (e) {
      console.warn("[mbx-trace] restore failed:", e);
      return false;
    }
  };

  const buildRecordedBody = (u, parsedBody) => {
    if (CFG.captureMode === "minimal") {
      const payload = pickRpcPayload(parsedBody);
      return payload ? { type: parsedBody.type, value: payload } : null;
    }
    // all 模式：保留解析后的 body（注意数据量/敏感信息）
    return { type: parsedBody.type, value: parsedBody.value };
  };

  const normalizeMode = (mode) => {
    const next = String(mode || "").toLowerCase().trim();
    if (next === "mini") return "minimal";
    if (next === "max") return "all";
    if (next === "minimal" || next === "all") return next;
    return null;
  };

  const displayMode = (mode) => (mode === "all" ? "max" : "mini");

  // ====== public commands ======
  window.__MBX_TRACE_EXPORT__ = () => {
    TRACE.meta.ended_at = new Date().toISOString();
    TRACE.meta.final_url = location.href;
    TRACE.meta.final_title = document.title;

    const jsonStr = JSON.stringify(
      {
        meta: TRACE.meta,
        events: TRACE.events,
        transactions: TRACE.transactions,
        state: { running: RUN.enabled, captureMode: CFG.captureMode },
      },
      null,
      2
    );
    const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = CFG.exportFileName();
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    console.log("[mbx-trace] exported:", a.download);
  };

  window.__MBX_TRACE_CLEAR__ = () => {
    TRACE.events.length = 0;
    TRACE.transactions = {};
    TX.currentId = null;
    TX.lastClickAt = 0;
    try {
      localStorage.removeItem(CFG.storageKey);
    } catch {}
    console.log("[mbx-trace] cleared");
  };

  window.__MBX_TRACE_START__ = () => {
    if (RUN.enabled) return;
    RUN.enabled = true;
    installHooks();
    persist();
    console.log("[mbx-trace] started");
  };

  window.__MBX_TRACE_STOP__ = () => {
    if (!RUN.enabled) return;
    RUN.enabled = false;
    uninstallHooks();
    persist();
    console.log("[mbx-trace] stopped");
  };

  window.__MBX_TRACE_MODE__ = (mode) => {
    const normalized = normalizeMode(mode);
    if (!normalized) {
      console.warn("[mbx-trace] invalid mode:", mode, "(use mini/max)");
      return;
    }
    CFG.captureMode = normalized;
    persist();
    console.log("[mbx-trace] mode set:", displayMode(normalized));
  };

  // ====== click transaction ======
  if (CFG.enableClickTransaction) {
    document.addEventListener(
      "click",
      (event) => {
        if (!RUN.enabled) return;
        const txId = newTxId();
        const now = Date.now();
        TX.currentId = txId;
        TX.lastClickAt = now;

        const clickEv = {
          type: "click",
          ts: new Date().toISOString(),
          page: { url: location.href, title: document.title },
          transactionId: txId,
          element: (() => {
            try {
              const target = event.target;
              const el =
                target?.closest?.("button, a, [role='button'], [onclick], input, select, textarea") ||
                target;
              if (!el || el.nodeType !== 1) return null;
              return {
                tagName: el.tagName,
                id: el.id || null,
                className: typeof el.className === "string" ? el.className : null,
                ariaLabel: el.getAttribute?.("aria-label") || null,
                text: (el.textContent || "").trim().slice(0, 200),
              };
            } catch (e) {
              return { error: String(e) };
            }
          })(),
        };

        const clickIndex = addEvent(clickEv);
        TRACE.transactions[txId] = {
          transactionId: txId,
          startedAt: new Date(now).toISOString(),
          lastTouchAt: new Date(now).toISOString(),
          clickEventIndex: clickIndex,
          networkEventIndexes: [],
        };
      },
      true
    );
  }

  // ====== XHR/Fetch hooks ======
  let originalXHROpen = null;
  let originalXHRSend = null;
  let originalXHRSetHeader = null;
  let originalFetch = null;

  const installHooks = () => {
    if (RUN.hooksInstalled) return;
    RUN.hooksInstalled = true;

    originalXHROpen = XMLHttpRequest.prototype.open;
    originalXHRSend = XMLHttpRequest.prototype.send;
    originalXHRSetHeader = XMLHttpRequest.prototype.setRequestHeader;
    originalFetch = window.fetch;

    XMLHttpRequest.prototype.open = function (method, url) {
      this.__mbxTrace = {
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

    XMLHttpRequest.prototype.setRequestHeader = function (k, v) {
      try {
        if (this.__mbxTrace) this.__mbxTrace.requestHeaders[String(k)] = String(v);
      } catch {}
      return originalXHRSetHeader.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function (data) {
      try {
        if (this.__mbxTrace) this.__mbxTrace.requestBody = data;
      } catch {}

      const xhr = this;
      const done = (isError) => {
        if (!RUN.enabled) return;
        const t = xhr.__mbxTrace;
        if (!t) return;

        const u = parseUrl(t.url);
        const parsedBody = parseBody(t.requestBody);
        if (!shouldRecord(u, t.method, parsedBody)) return;

        const durationMs = Date.now() - (t.start || Date.now());
        let responseText = null;
        try {
          responseText = xhr.responseText;
        } catch (e) {
          responseText = `[unreadable responseText: ${String(e)}]`;
        }

        let record = {
          type: "network",
          kind: "xhr",
          ts: new Date().toISOString(),
          ts_start: t.ts_start,
          durationMs,
          request: {
            url: u.href,
            host: u.host,
            pathname: u.pathname,
            method: t.method,
            query: u.query,
            headers: t.requestHeaders,
            body: buildRecordedBody(u, parsedBody),
          },
          response: isError
            ? { error: "XHR error" }
            : {
                status: xhr.status,
                statusText: xhr.statusText,
                bodyText: CFG.readResponseBody ? cut(String(responseText || "")) : "[not read]",
              },
          page: { url: location.href, title: document.title },
        };

        record = attachTx(record);
        const idx = addEvent(record);
        if (record.transactionId) touchTx(record.transactionId, idx);
      };

      xhr.addEventListener("load", () => done(false));
      xhr.addEventListener("error", () => done(true));
      return originalXHRSend.apply(this, arguments);
    };

    window.fetch = async function (...args) {
      const start = Date.now();
      const ts_start = new Date().toISOString();

      const input = args[0];
      const init = args[1] || {};
      const url = typeof input === "string" ? input : (input && input.url) || String(input);
      const method = String(init.method || (input && input.method) || "GET").toUpperCase();
      const headers = (() => {
        try {
          const h = init.headers || (input && input.headers) || null;
          if (!h) return null;
          if (h instanceof Headers) {
            const o = {};
            h.forEach((v, k) => (o[k] = v));
            return o;
          }
          if (Array.isArray(h)) {
            const o = {};
            for (const [k, v] of h) o[k] = v;
            return o;
          }
          if (typeof h === "object") return { ...h };
          return String(h);
        } catch (e) {
          return { __error__: String(e) };
        }
      })();
      const reqBody = init.body ?? null;

      let res;
      try {
        res = await originalFetch.apply(this, args);
      } catch (err) {
        if (!RUN.enabled) throw err;
        const u = parseUrl(url);
        const parsedBody = parseBody(reqBody);
        if (!shouldRecord(u, method, parsedBody)) throw err;

        let record = {
          type: "network",
          kind: "fetch",
          ts: new Date().toISOString(),
          ts_start,
          durationMs: Date.now() - start,
          request: {
            url: u.href,
            host: u.host,
            pathname: u.pathname,
            method,
            query: u.query,
            headers,
            body: buildRecordedBody(u, parsedBody),
          },
          error: toJsonSafe(err),
          page: { url: location.href, title: document.title },
        };
        record = attachTx(record);
        const idx = addEvent(record);
        if (record.transactionId) touchTx(record.transactionId, idx);
        throw err;
      }

      if (!RUN.enabled) return res;

      const u = parseUrl(url);
      const parsedBody = parseBody(reqBody);
      if (!shouldRecord(u, method, parsedBody)) return res;

      let bodyText = "[not read]";
      if (CFG.readResponseBody) {
        try {
          const clone = res.clone();
          bodyText = cut(await clone.text());
        } catch (e) {
          bodyText = `[read failed: ${String(e)}]`;
        }
      }

      let record = {
        type: "network",
        kind: "fetch",
        ts: new Date().toISOString(),
        ts_start,
        durationMs: Date.now() - start,
        request: {
          url: u.href,
          host: u.host,
          pathname: u.pathname,
          method,
          query: u.query,
          headers,
          body: buildRecordedBody(u, parsedBody),
        },
        response: {
          status: res.status,
          statusText: res.statusText,
          bodyText,
        },
        page: { url: location.href, title: document.title },
      };

      record = attachTx(record);
      const idx = addEvent(record);
      if (record.transactionId) touchTx(record.transactionId, idx);

      return res;
    };
  };

  const uninstallHooks = () => {
    if (!RUN.hooksInstalled) return;
    RUN.hooksInstalled = false;
    try {
      if (originalXHROpen) XMLHttpRequest.prototype.open = originalXHROpen;
      if (originalXHRSend) XMLHttpRequest.prototype.send = originalXHRSend;
      if (originalXHRSetHeader) XMLHttpRequest.prototype.setRequestHeader = originalXHRSetHeader;
      if (originalFetch) window.fetch = originalFetch;
    } catch (e) {
      console.warn("[mbx-trace] uninstallHooks failed:", e);
    }
  };

  // ====== panel ======
  const mountPanel = () => {
    if (document.getElementById("__MBX_TRACE_PANEL__")) return;
    const panel = document.createElement("div");
    panel.id = "__MBX_TRACE_PANEL__";
    panel.style.cssText = [
      "position:fixed",
      "right:16px",
      "bottom:16px",
      "z-index:2147483647",
      "background:rgba(20,20,20,0.92)",
      "color:#fff",
      "padding:10px 12px",
      "border-radius:10px",
      "font-size:12px",
      "font-family:Arial,sans-serif",
      "box-shadow:0 6px 18px rgba(0,0,0,0.25)",
      "min-width:210px",
    ].join(";");

    const title = document.createElement("div");
    title.textContent = "mbx-trace (batchexecute)";
    title.style.cssText = "font-weight:600;margin-bottom:6px;";

    const row = document.createElement("div");
    row.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;";

    const btn = (label, bg, onClick) => {
      const b = document.createElement("button");
      b.textContent = label;
      b.style.cssText = [
        "background:" + bg,
        "color:#fff",
        "border:none",
        "padding:6px 10px",
        "border-radius:6px",
        "cursor:pointer",
        "font-size:12px",
      ].join(";");
      b.addEventListener("click", onClick);
      return b;
    };

    const status = document.createElement("div");
    status.textContent = "idle";
    status.style.cssText = "margin-top:6px;opacity:0.75;";

    const startBtn = btn("Start", "#2d8cff", () => {
      if (RUN.enabled) {
        window.__MBX_TRACE_STOP__();
        startBtn.textContent = "Start";
        status.textContent = "idle";
        return;
      }
      window.__MBX_TRACE_START__();
      startBtn.textContent = "Stop";
      status.textContent = "running";
    });

    const modeBtn = btn(`Mode: ${displayMode(CFG.captureMode)}`, "#6f42c1", () => {
      const next = CFG.captureMode === "minimal" ? "all" : "minimal";
      window.__MBX_TRACE_MODE__(next);
      modeBtn.textContent = `Mode: ${displayMode(next)}`;
    });

    const downloadBtn = btn("Download JSON", "#21a366", () => window.__MBX_TRACE_EXPORT__());
    const clearBtn = btn("Clear", "#d9534f", () => {
      window.__MBX_TRACE_CLEAR__();
      status.textContent = RUN.enabled ? "running" : "idle";
    });

    row.append(startBtn, modeBtn, downloadBtn, clearBtn);
    panel.append(title, row, status);
    document.body.appendChild(panel);

    // restore running state
    if (RUN.enabled) {
      startBtn.textContent = "Stop";
      status.textContent = "running";
    }
  };

  restore();

  if (document.body) mountPanel();
  else document.addEventListener("DOMContentLoaded", mountPanel, { once: true });

  // 如果上次状态是 running，则自动继续（跨页持续）
  if (RUN.enabled) {
    installHooks();
    console.log("[mbx-trace] resumed (running=true)");
  } else {
    console.log("[mbx-trace] installed (idle).");
  }
})();
