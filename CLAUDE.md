# monsta_pipeline_issues — Claude Context

External issue submission form for Monsta Studios' pipeline tools. Deployed at `https://issue-form.monsta.my`.

## Stack

- **Runtime:** Node.js / Express.js (no framework, no build step)
- **Frontend:** Single HTML file (`index.html`) + `public/form.js` (static)
- **Security:** Helmet v7 — all security headers in `server.js`
- **Captcha:** Google reCAPTCHA v3
- **Storage:** AWS S3 (image uploads)
- **Issues:** GitHub REST API (auto-creates issues on submission)
- **Deployment:** Coolify (self-hosted) behind Cloudflare

## Key Files

| File | Purpose |
|------|---------|
| `server.js` | Express app, Helmet config, rate limiting, static serving |
| `index.html` | Form HTML + inline CSS only — no inline JS |
| `public/form.js` | All form interaction JS (extracted for CSP compliance) |
| `api/report.js` | POST handler — reCAPTCHA verify, S3 upload, GitHub issue create |

## Docs

- `_docs/architecture.md` — system overview, component diagram, env vars
- `_docs/security.md` — CSP directives, HSTS, Cloudflare caveat, Aikido history
- `_docs/api.md` — POST /api/report request/response reference
- `_docs/deployment.md` — Coolify setup, smoke tests, credential rotation

## Security Rules

- **Never** add `'unsafe-inline'` to `script-src` — all JS must be in `public/form.js`
- **Never** add `'unsafe-eval'` to `script-src` — if Aikido flags it, the source is Cloudflare's edge, not this codebase
- **Always** set HSTS explicitly in the `hsts: {}` Helmet block — the Helmet default is stripped by Coolify's proxy
- **Never** use inline `onclick`/`onX` attributes in HTML — `script-src-attr 'none'` is set
- All env vars (tokens, keys, secrets) live in Coolify — never in source files or git

## Running Locally

```bash
cp .env.example .env   # fill in credentials
npm install
npm start              # runs on port 3000
```

## After Any Change to server.js

Verify headers:

```bash
node server.js &
curl -si http://localhost:3000/ | grep -iE 'strict-transport|content-security'
kill %1
```
