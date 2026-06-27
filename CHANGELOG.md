# Changelog

## [Unreleased] — 2026-06-27

### Security
- **HSTS** (Aikido #89): Added explicit `Strict-Transport-Security` header via Helmet (`maxAge: 31536000`, `includeSubDomains`, `preload`). Previously relying on Helmet's default which Coolify's proxy was stripping.
- **CSP unsafe-eval** (Aikido #75): Removed `'unsafe-inline'` from `script-src`. Extracted all inline JavaScript from `index.html` into `public/form.js` served as a static asset, eliminating the class of attacks that `unsafe-inline` enables.
- **CSP fallback directives** (Aikido #75): Added missing directives — `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `script-src-attr 'none'`, `frame-ancestors 'none'`. Re-enabled `upgrade-insecure-requests` (was explicitly nulled out).
- Replaced `innerHTML` + inline `onclick` pattern in file list rendering with `createElement` + `addEventListener` to comply with `script-src-attr 'none'`.

### Added
- `public/form.js` — extracted and refactored form interaction logic (department/tool dropdowns, file upload management, reCAPTCHA submit flow).
- `express.static` middleware to serve the `public/` directory.
