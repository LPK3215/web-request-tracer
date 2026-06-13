# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.4.0] - 2026-06-13

### Fixed
- JSON request body being misparsed as URL-encoded parameters

### Added
- `fetch(Request)` object support (method, headers now extracted correctly)
- XHR `abort` event recording (previously silently dropped)
- WebSocket property-based event handler interception (`ws.onopen = ...` now recorded)
- Test server and test page included in the repository

### Changed
- Regex pattern caching to avoid recompilation on every request
- Transaction pruning to prevent unbounded localStorage growth
- Removed unused variables and parameters

## [0.3.0] - 2026-06-13

### Added
- Response headers recording (XHR via `getAllResponseHeaders()`, fetch via `res.headers`)
- Dynamic filter settings modal (click "Filters" on panel to configure rules in-page)
- Regex filter support (`hostPattern`, `pathPattern`)
- Request/response header filters
- HAR format export
- WebSocket support (open/send/receive/close/error events)

### Changed
- Filters now persist across page navigations via localStorage state

## [0.2.0] - 2026-06-13

### Added
- Initial public release
- XHR/fetch hooks
- Click transactions
- JSON export
- Cross-page persistence

[Unreleased]: https://github.com/LPK3215/web-request-tracer/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/LPK3215/web-request-tracer/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/LPK3215/web-request-tracer/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/LPK3215/web-request-tracer/releases/tag/v0.2.0
