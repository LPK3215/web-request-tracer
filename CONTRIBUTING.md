# Contributing

Thanks for your interest in contributing to Web Request Tracer.

## Getting Started

This is a pure JavaScript project with no build step. Both source files are plain scripts:

- `trace-recorder.js` — Console version (paste into DevTools)
- `trace-recorder.user.js` — UserScript version (install via Tampermonkey)

The two files must remain logically identical. Any feature or bugfix must be applied to both files.

## Development Workflow

1. Fork the repository
2. Make changes to both `trace-recorder.js` and `trace-recorder.user.js`
3. Start the test server to verify your changes:
   ```bash
   pip install websockets
   python test/test-server.py
   ```
4. Open `http://localhost:8765/` in your browser
5. Inject `trace-recorder.js` via the DevTools Console (or load from `http://localhost:8765/trace-recorder.js`)
6. Click test buttons to verify all features (XHR, fetch, WebSocket, filters, export)
7. Check the browser console for errors

## Code Style

- Use 2-space indentation
- Prefer `var` for top-level variables (for DevTools Console compatibility)
- Keep the `CFG` object at the top of both files consistent
- Avoid ES6+ features not supported in older browser console contexts (no `const`/`let` block scope for IIFE-internal globals, no arrow functions as method definitions)
- Run `node --check` on both files before committing

## Testing Checklist

Before submitting a PR, verify:

- [ ] `node --check trace-recorder.js` passes
- [ ] `node --check trace-recorder.user.js` passes
- [ ] Both files are logically identical (same functions, same behavior)
- [ ] All test page buttons work correctly
- [ ] JSON export produces valid JSON
- [ ] HAR export produces valid HAR 1.2 format
- [ ] WebSocket open/send/receive/close events are captured
- [ ] Filter rules (host, path, method, headers) work correctly
- [ ] Cross-page persistence works (navigate away and back, events preserved)

## Pull Request Guidelines

- Keep PRs focused on a single feature or bugfix
- Reference related issues in the PR description
- Update `CHANGELOG.md` under `[Unreleased]`
- If the change affects user-facing behavior, update `README.md` accordingly

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
