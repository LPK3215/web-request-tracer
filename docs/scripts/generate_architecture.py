"""
Generate architecture diagram SVG for Web Request Tracer.

Dependencies: none (pure Python stdlib)
Usage:       python docs/scripts/generate_architecture.py
Output:      docs/architecture.svg

The diagram shows the three capture layers (XHR, fetch, WebSocket),
the filter pipeline, the event store, and the dual export formats.
"""

import os

SVG_WIDTH = 800
SVG_HEIGHT = 580

COLORS = {
    "bg": "#080c10",
    "card_bg": "#0f1722",
    "border": "#1e2d3d",
    "blue": "#60a5fa",
    "blue_bg": "rgba(96,165,250,0.10)",
    "purple": "#a78bfa",
    "purple_bg": "rgba(167,139,250,0.10)",
    "cyan": "#22d3ee",
    "cyan_bg": "rgba(34,211,238,0.10)",
    "amber": "#f59e0b",
    "amber_bg": "rgba(245,158,11,0.10)",
    "green": "#34d399",
    "green_bg": "rgba(52,211,153,0.10)",
    "white": "#e2e8f0",
    "muted": "#64748b",
    "line": "#334155",
}

def box(x, y, w, h, rx=8, fill=COLORS["card_bg"], stroke=COLORS["border"], sw=1.5):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>'

def text(x, y, content, size=13, fill=COLORS["white"], anchor="start", weight="normal", class_=""):
    return f'<text x="{x}" y="{y}" font-family="Outfit,Inter,system-ui,sans-serif" font-size="{size}" fill="{fill}" text-anchor="{anchor}" font-weight="{weight}" class="{class_}">{content}</text>'

def arrow(x1, y1, x2, y2, color=COLORS["line"], sw=1.5):
    mx, my = (x1 + x2) / 2, (y1 + y2) / 2
    return (
        f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{color}" stroke-width="{sw}" marker-end="url(#arrowhead-{color[1:]})"/>'
    )

def build_svg():
    parts = []
    parts.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SVG_WIDTH} {SVG_HEIGHT}">')
    parts.append(f'<defs>')
    for name, color in [("a", COLORS["line"]), ("b", COLORS["blue"]), ("c", COLORS["purple"]), ("d", COLORS["cyan"]), ("e", COLORS["amber"]), ("f", COLORS["green"])]:
        parts.append(f'<marker id="arrowhead-{color[1:]}" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">')
        parts.append(f'<polygon points="0 0, 8 3, 0 6" fill="{color}"/>')
        parts.append(f'</marker>')
    parts.append(f'</defs>')

    # Background
    parts.append(f'<rect width="{SVG_WIDTH}" height="{SVG_HEIGHT}" fill="{COLORS["bg"]}" rx="12"/>')

    # Title
    parts.append(text(400, 38, "Web Request Tracer — Architecture", size=20, fill=COLORS["white"], anchor="middle", weight="bold"))

    # ── Row 1: Capture Layers (Y=60..240) ──
    parts.append(text(30, 78, "Capture Layers", size=14, fill=COLORS["muted"], weight="bold"))

    # XHR card
    xhr_x, xhr_y, xhr_w, xhr_h = 30, 90, 230, 140
    parts.append(box(xhr_x, xhr_y, xhr_w, xhr_h, stroke=COLORS["blue"]))
    parts.append(box(xhr_x, xhr_y, xhr_w, 32, rx=8, fill=COLORS["blue_bg"], stroke=COLORS["blue"]))
    parts.append(text(xhr_x + 12, xhr_y + 22, "XMLHttpRequest", size=13, fill=COLORS["blue"], weight="bold"))
    parts.append(text(xhr_x + 14, xhr_y + 52, "open / send / abort", size=12, fill=COLORS["muted"]))
    parts.append(text(xhr_x + 14, xhr_y + 72, "getAllResponseHeaders()", size=12, fill=COLORS["muted"]))
    parts.append(text(xhr_x + 14, xhr_y + 92, "readyState → done", size=12, fill=COLORS["muted"]))
    parts.append(text(xhr_x + 14, xhr_y + 112, "status / body capture", size=12, fill=COLORS["muted"]))

    # Fetch card
    fetch_x, fetch_y, fetch_w, fetch_h = 285, 90, 230, 140
    parts.append(box(fetch_x, fetch_y, fetch_w, fetch_h, stroke=COLORS["purple"]))
    parts.append(box(fetch_x, fetch_y, fetch_w, 32, rx=8, fill=COLORS["purple_bg"], stroke=COLORS["purple"]))
    parts.append(text(fetch_x + 12, fetch_y + 22, "fetch API", size=13, fill=COLORS["purple"], weight="bold"))
    parts.append(text(fetch_x + 14, fetch_y + 52, "window.fetch wrapper", size=12, fill=COLORS["muted"]))
    parts.append(text(fetch_x + 14, fetch_y + 72, "res.headers (Map→obj)", size=12, fill=COLORS["muted"]))
    parts.append(text(fetch_x + 14, fetch_y + 92, "res.clone().text() body", size=12, fill=COLORS["muted"]))
    parts.append(text(fetch_x + 14, fetch_y + 112, "fetch(Request) support", size=12, fill=COLORS["muted"]))

    # WebSocket card
    ws_x, ws_y, ws_w, ws_h = 540, 90, 230, 140
    parts.append(box(ws_x, ws_y, ws_w, ws_h, stroke=COLORS["cyan"]))
    parts.append(box(ws_x, ws_y, ws_w, 32, rx=8, fill=COLORS["cyan_bg"], stroke=COLORS["cyan"]))
    parts.append(text(ws_x + 12, ws_y + 22, "WebSocket", size=13, fill=COLORS["cyan"], weight="bold"))
    parts.append(text(ws_x + 14, ws_y + 52, "constructor wrapper", size=12, fill=COLORS["muted"]))
    parts.append(text(ws_x + 14, ws_y + 72, "onopen/onmessage/onclose", size=12, fill=COLORS["muted"]))
    parts.append(text(ws_x + 14, ws_y + 92, "addEventListener hook", size=12, fill=COLORS["muted"]))
    parts.append(text(ws_x + 14, ws_y + 112, "Blob/ArrayBuffer metadata", size=12, fill=COLORS["muted"]))

    # Arrows: capture → filter
    parts.append(arrow(400, 230, 400, 275, color=COLORS["line"]))

    # ── Row 2: Filter + Click (Y=275..400) ──
    parts.append(text(30, 290, "Processing Pipeline", size=14, fill=COLORS["muted"], weight="bold"))

    # Filter card
    filt_x, filt_y, filt_w, filt_h = 30, 300, 365, 100
    parts.append(box(filt_x, filt_y, filt_w, filt_h, stroke=COLORS["amber"]))
    parts.append(box(filt_x, filt_y, filt_w, 32, rx=8, fill=COLORS["amber_bg"], stroke=COLORS["amber"]))
    parts.append(text(filt_x + 12, filt_y + 22, "Filter Engine", size=13, fill=COLORS["amber"], weight="bold"))
    parts.append(text(filt_x + 14, filt_y + 48, "host / hostPattern", size=12, fill=COLORS["muted"]))
    parts.append(text(filt_x + 190, filt_y + 48, "method whitelist", size=12, fill=COLORS["muted"]))
    parts.append(text(filt_x + 14, filt_y + 68, "pathContains / pathPattern", size=12, fill=COLORS["muted"]))
    parts.append(text(filt_x + 190, filt_y + 68, "req/res header filters", size=12, fill=COLORS["muted"]))
    parts.append(text(filt_x + 14, filt_y + 88, "regex cache (avoid recompile)", size=12, fill=COLORS["muted"]))

    # Click card
    clk_x, clk_y, clk_w, clk_h = 415, 300, 355, 100
    parts.append(box(clk_x, clk_y, clk_w, clk_h, stroke=COLORS["green"]))
    parts.append(box(clk_x, clk_y, clk_w, 32, rx=8, fill=COLORS["green_bg"], stroke=COLORS["green"]))
    parts.append(text(clk_x + 12, clk_y + 22, "Click Tracker", size=13, fill=COLORS["green"], weight="bold"))
    parts.append(text(clk_x + 14, clk_y + 52, "document click listener", size=12, fill=COLORS["muted"]))
    parts.append(text(clk_x + 14, clk_y + 72, "time-window association (3s default)", size=12, fill=COLORS["muted"]))
    parts.append(text(clk_x + 14, clk_y + 88, "pruning → maxEvents cap", size=12, fill=COLORS["muted"]))

    # Arrows: filter → store
    parts.append(arrow(212, 400, 212, 450, color=COLORS["line"]))
    parts.append(arrow(592, 400, 592, 450, color=COLORS["line"]))

    # ── Row 3: Store + Export (Y=450..530) ──
    # Event Store
    store_x, store_y, store_w, store_h = 30, 445, 365, 70
    parts.append(box(store_x, store_y, store_w, store_h, stroke=COLORS["white"]))
    parts.append(text(store_x + 12, store_y + 22, "Event Store", size=13, fill=COLORS["white"], weight="bold"))
    parts.append(text(store_x + 14, store_y + 42, "in-memory array + localStorage persistence", size=12, fill=COLORS["muted"]))
    parts.append(text(store_x + 14, store_y + 60, "cross-page survive on same origin", size=12, fill=COLORS["muted"]))

    # Export formats
    exp_x, exp_y, exp_w, exp_h = 415, 445, 355, 70
    parts.append(box(exp_x, exp_y, exp_w, exp_h, stroke=COLORS["green"]))
    parts.append(text(exp_x + 12, exp_y + 22, "Dual Export", size=13, fill=COLORS["green"], weight="bold"))
    parts.append(text(exp_x + 14, exp_y + 42, "JSON: meta + events + transactions + state", size=12, fill=COLORS["muted"]))
    parts.append(text(exp_x + 14, exp_y + 60, "HAR 1.2: Chrome DevTools / Charles / Fiddler", size=12, fill=COLORS["muted"]))

    # Footer
    parts.append(text(400, SVG_HEIGHT - 20, "v0.4.0  ·  MIT License  ·  github.com/LPK3215/web-request-tracer", size=11, fill=COLORS["muted"], anchor="middle"))

    parts.append('</svg>')
    return '\n'.join(parts)

def main():
    svg = build_svg()
    out_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "")
    out_path = os.path.join(out_dir, "architecture.svg")
    os.makedirs(out_dir, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(svg)
    print(f"Generated: {out_path}")

if __name__ == "__main__":
    main()
