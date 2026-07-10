# Changelog

All notable changes to the WHMCS MCP Server project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.3.1] - 2026-07-09

### Fixed

- **`start_task_timer` sent the wrong parameter name** — WHMCS 9.x expects `taskid` for the
  `StartTaskTimer` API action, while the official API docs (and v2.3.0) used `timerid`, causing
  a "Task ID Not Set" error. The client now sends both `taskid` and `timerid` for compatibility
  across WHMCS versions. The tool input is renamed `timerId` → `taskId` to reflect what WHMCS
  actually expects. Verified against a live WHMCS 9.0.3 install.
- **`end_task_timer` docs clarified** — `timerId` is the timelog entry ID created by
  `start_task_timer` (visible in `get_project` task timelogs), not the task ID. Passing the
  task ID returns "Timer ID Not Found".

## [2.3.0] - 2026-07-09

### Added

- **10 Project Management tools** — full coverage of the WHMCS Project Management addon API
  (requires the addon to be active). Requested by customer.

  | Tool | Description |
  |------|-------------|
  | `list_projects` | List projects with filters (status, userid, adminid, title, completed) |
  | `get_project` | Get a single project including tasks, time logs, and messages |
  | `create_project` | Create a new project (title, adminid required; dryRun supported) |
  | `update_project` | Update project fields: title, status, due date, notes, associations |
  | `add_project_task` | Add a task to a project (duedate required; dryRun supported) |
  | `update_project_task` | Update a task: title, notes, due date, completed flag |
  | `delete_project_task` | Permanently delete a task from a project (dryRun supported) |
  | `add_project_message` | Post a message to a project's discussion thread |
  | `start_task_timer` | Start a time-tracking timer on a project task |
  | `end_task_timer` | Stop a running time-tracking timer |

## [2.2.0] - 2026-06-26

### Added

- **`adminUsername` parameter on `open_ticket`** — optional field that passes `adminusername` to
  the WHMCS `OpenTicket` API, attributing the ticket to a staff member rather than the client.
  When set, the ticket appears as staff-initiated in the WHMCS admin area. Requested by
  HostingB2B.

- **Multi-line invoice support on `create_invoice`** — new optional `items[]` array (up to 50
  entries, each with `description`, `amount`, and optional `taxed` boolean) maps to WHMCS's
  numbered line-item fields (`itemdescription1`/`itemamount1`/`itemtaxed1`, etc.). When `items`
  is provided it takes precedence over the legacy `itemDescription`/`itemAmount` fields, which
  remain fully backward-compatible. Resolves issue #195.

### Fixed

- **`phpSerialize` — correct byte length for PHP wire format.** The `s:` length field now uses
  the byte length of the *original* string, not the escaped copy, matching PHP's `unserialize`
  expectation. Previously, strings containing `\`, `"`, or null bytes would produce an
  incorrect length and fail to deserialize in WHMCS.

- **`phpSerialize` — escape backslash, double-quote, and null bytes** in string values and
  object keys to prevent serialization corruption in WHMCS API payloads.

- **`create_invoice` / `update_client` / `get_ticket` / `add_ticket_note`** — each tool now
  returns a validation error when no usable identifier is provided rather than forwarding an
  empty request to WHMCS.

- **`list_tickets` `status` field** — input capped at 50 characters to prevent oversized values
  reaching the WHMCS API.

- **Auth success counter** — metric now increments only after `verifyAccessToken` resolves
  successfully, not before (previously could count failed auth attempts as successes).

### Security

- **Pushgateway credential externalized** — hardcoded Prometheus Pushgateway Basic Auth
  credential removed. Configure via `PUSHGATEWAY_URL`, `PUSHGATEWAY_USER`, and
  `PUSHGATEWAY_PASSWORD` environment variables.

- **CIMD SSRF protection** — the CIMD auto-fetch now blocks requests to RFC1918, loopback,
  link-local, and IPv6 internal address ranges, preventing server-side request forgery via
  `software_statement` or `logo_uri` endpoints.

- **OAuth consent page XSS fix** — scope tokens on the `/authorize` consent page are now
  HTML-escaped before rendering, preventing injection via crafted scope strings.

- **IP rate limiter extended to OAuth endpoints** — `/token`, `/authorize`, and `/register`
  are now covered by the IP-based rate limiter in addition to `/mcp`.

- **`MCP_TRUST_PROXY` default changed to `false`** — the server no longer trusts
  `X-Forwarded-*` headers by default. Set `MCP_TRUST_PROXY=true` explicitly when running
  behind a TLS-terminating reverse proxy (Traefik, nginx, etc.). Deployments using the
  official Docker Compose stack are unaffected — the compose file already sets this explicitly.

- **`MCP_OAUTH_SESSION_SECRET` empty-string guard** — an empty string value is now treated
  the same as unset, causing the server to fall back to a randomly generated ephemeral secret
  rather than signing sessions with an empty key. A warning is logged in production when no
  secret is configured.

## [2.1.0] - 2026-05-08

### Added

- **30 new tools** — domain management (`register_domain`, `transfer_domain`, `renew_domain`,
  `get_domain_whois`, `get_domain_nameservers`, `update_domain_nameservers`,
  `get_domain_lock_status`, `update_domain_lock_status`, `get_tld_pricing`), admin
  (`get_admin_users`, `get_staff_online`, `get_whmcs_details`, `log_activity`), affiliates
  (`get_affiliates`, `activate_affiliate`), promotions (`get_promotions`), servers
  (`get_servers`, `module_change_password`), system info (`get_todo_items`,
  `get_todo_item_statuses`, `get_announcements`, `get_registrars`, `get_product_groups`),
  support (`add_ticket_note`, `get_support_statuses`, `get_ticket_counts`,
  `get_ticket_predefined_categories`), orders (`fraud_order`, `pending_order`), and
  invoices (`update_invoice`). Total tool count is now **86**.
- **24 MCP resources** for real-time, read-only access to system data via `whmcs://` URIs
  with a 60-second TTL cache.
- **18 MCP workflow prompts** for guided AI interactions (client onboarding, fraud
  investigation, revenue reports, churn risk, domain audits, and more).
- `overideautosuspend` flag on the `update_service` tool to exempt a service from
  automatic suspension.

### Changed

- **Unified auth stack — `MCP_AUTH_MODE` removed.** The `simple` / `oauth` mode split
  has been eliminated. The server now always runs the full OAuth 2.0 stack. Bearer
  tokens (generated via `auth-cli`) work in all configurations. The `/authorize`
  (consent) endpoint is available only when `MCP_OAUTH_ADMIN_PASSWORD` is set; without
  it, `/authorize` redirects with `error=access_denied` and instructions to use the
  auth-cli. This resolves the class of bugs caused by `simple` mode advertising OAuth
  discovery endpoints that had no backing implementation (e.g. the v2.0.3/v2.0.4
  Claude.ai PKCE failure).

- **`MCP_REQUIRE_AUTH` removed.** Authentication is always enforced in HTTP mode.
  There is no longer a way to disable auth via environment variable.

- **`/health` response updated.** The `auth.mode` and `auth.required` fields have been
  replaced by `auth.oauthEnabled` (boolean — true when `MCP_OAUTH_ADMIN_PASSWORD` is
  set).

### Fixed

- dryRun response prefix normalized to `[dryRun]` across all mutating tools.
- XSS sanitization applied to user input echoed in dryRun responses.
- `get_product_groups` reimplemented to derive groups from GetProducts (WHMCS API lacks
  a dedicated GetProductGroups endpoint).
- Startup warnings emitted when deprecated `MCP_AUTH_MODE` or `MCP_REQUIRE_AUTH` env
  vars are detected.
- `resources.test.ts` added to the default test suite.

### Migration guide

| Before | After |
|--------|-------|
| `MCP_AUTH_MODE=simple` | Remove the line — bearer tokens work without it |
| `MCP_AUTH_MODE=oauth` | Remove the line — keep `MCP_OAUTH_ADMIN_PASSWORD` |
| `MCP_REQUIRE_AUTH=true` | Remove the line — auth is always on |

Existing `tokens.json` files are untouched; all previously issued bearer tokens
continue to work without any changes.

## [2.0.10] - 2026-05-07

### Fixed

- **`create_invoice` sent wrong client field** — WHMCS [CreateInvoice](https://developers.whmcs.com/api-reference/createinvoice/)
  requires `userid`; the client forwarded `clientid`, which the API does not document for this action.
- **`get_cancelled_packages` client filter** — [GetCancelledPackages](https://developers.whmcs.com/api-reference/getcancelledpackages/)
  only supports pagination. A `clientId` argument was forwarded but never had any effect; the tool description
  now states this, and `clientId` is kept only as a deprecated no-op for backward compatibility.

## [2.0.9] - 2026-05-07

### Fixed

- **`list_invoices` / `get_overdue_invoices` client filter ignored** — WHMCS
  [GetInvoices](https://developers.whmcs.com/api-reference/getinvoices/) accepts
  `userid` (the client id), not `clientid`. The client was sending `clientid`, so
  the API returned unfiltered invoice lists. Both code paths now send `userid`.

## [2.0.8] - 2026-04-14

### Fixed

- **OAuth `state` parameter missing from callback redirect** — After the consent
  form is approved, the redirect to `redirect_uri` was built with
  `if (state) redirect.searchParams.set("state", state)`, which silently dropped
  `state` when it was a non-empty string that had been round-tripped as an empty
  string through the consent form. The root cause was `oauth-provider.ts` coercing
  `params.state ?? ""` when building the consent URL — if the SDK passed `undefined`,
  `state` became `""`, the hidden field submitted `""`, and `if (state)` evaluated
  falsy on POST. Both issues are now fixed: `state` is only appended to the consent
  URL when the SDK provides a non-undefined value, and the callback redirect echoes
  `state` whenever it is present in the form body (including empty string), matching
  the OAuth 2.0 spec requirement that `state` be returned verbatim.

### Upgrade notes

Run `docker pull ghcr.io/daddariotech/dts/whmcs-mcp:latest` and restart. No
configuration changes required. This fix is required for Claude.ai Custom Connector
OAuth to complete — without it Claude.ai silently ignores the auth callback because
the `state` parameter does not match what it originally sent.

---

## [2.0.7] - 2026-04-13

### Fixed

- **OAuth `/token` returned HTTP 500 for normal grant failures** — The MCP SDK maps
  thrown errors that are not `OAuthError` subclasses to `server_error` (500).
  `OAuthProvider` now throws `InvalidGrantError` for invalid/expired authorization
  codes, `redirect_uri` mismatch, and invalid/expired refresh tokens, so clients
  receive **400** with `invalid_grant` and a proper `error_description`. Added
  warn-level logs for these cases. Includes HTTP integration tests for `POST /token`.

## [2.0.6] - 2026-04-12

### Fixed

- **OAuth consent session cookie for cross-site POST (Claude.ai)** — When HTTPS
  enforcement is on (`MCP_ENFORCE_HTTPS`, default in production), the
  `connect.sid` session cookie now uses `SameSite=None` with `Secure`, so the
  browser sends it on cross-site POST to `/oauth/consent` instead of dropping it
  under `SameSite=Lax`. Plain HTTP dev keeps `Lax` without `Secure`. Prefer fixing
  this in the app over Nginx cookie rewriting (avoids duplicate `SameSite`
  attributes).

## [2.0.5] - 2026-04-12

### Fixed

- **CSRF tokens now persisted via express-session (connect.sid cookie)** — The
  previous implementation stored CSRF tokens in a process-level in-memory Map.
  Any container restart between the consent page GET and the form POST would
  wipe the Map, causing every submission to fail with "invalid or missing CSRF
  token". The server now uses `express-session` backed by `session-file-store`,
  so a `connect.sid` session cookie is set when the consent page is served and
  the CSRF token is stored in that session on disk (`/app/data/sessions/`).
  The token survives container restarts when `MCP_OAUTH_SESSION_SECRET` is set
  to a fixed value in the environment (recommended for production). Without it,
  a random secret is generated at startup -- sessions issued before a restart
  will be invalidated, but the normal consent flow (load page, submit
  immediately) is unaffected.

### New optional environment variables

- `MCP_OAUTH_SESSION_SECRET` -- secret used to sign session cookies. Set to a
  fixed value to keep sessions valid across container restarts. If unset, a
  random secret is generated at startup (sessions reset on restart).
- `MCP_OAUTH_SESSIONS_DIR` -- directory for session files (default:
  `/app/data/sessions`). Must be on a persistent volume.

### Upgrade notes

Run `docker pull daddariotech/whmcs-mcp:latest` and restart. No required
configuration changes. Optionally add `MCP_OAUTH_SESSION_SECRET` to your `.env`
for restart-resilient sessions.

---

## [2.0.4] - 2026-04-12

### Fixed

- **Simple auth mode: OAuth discovery endpoints advertised wrong paths** — In v2.0.3 the
  actual OAuth routes were moved from `/oauth/*` to `/` (e.g., `/authorize`, `/token`), but
  the `simple` mode metadata block was not updated and kept advertising the old `/oauth/authorize`,
  `/oauth/token`, etc. paths. Claude.ai would follow those URLs, hit 404, and then attempt the
  OAuth flow without PKCE parameters — producing the `code_challenge expected string received
  undefined` error. All five endpoint paths in the `simple` mode discovery metadata now match
  the actual routes.

### Upgrade notes

Run `docker pull daddariotech/whmcs-mcp:latest` and restart. No configuration changes required.
This fix affects all users running `MCP_AUTH_MODE=simple` (the default) with Claude.ai or ChatGPT.

---

## [2.0.3] - 2026-04-12

### Fixed

- **OAuth endpoint routing**: Removed `baseUrl` parameter from `mcpAuthRouter` so OAuth endpoints are correctly mounted at root (`/authorize`, `/token`, `/register`) instead of `/oauth/*`. This fixes "Cannot GET /oauth/authorize" errors when ChatGPT/Claude attempt OAuth flow.
- Discovery document now advertises correct endpoint URLs matching actual route registration.

### Upgrade notes

Run `docker pull daddariotech/whmcs-mcp:latest` to get the fix. No configuration changes required.

---

## [2.0.2] - 2026-04-12

### Fixed

- **OAuth: discovery document override not applied** — The custom `/.well-known/oauth-authorization-server` route was registered AFTER the SDK's `mcpAuthRouter`, so Express matched the SDK's route first. The override now registers BEFORE the SDK router, ensuring `client_id_metadata_document_supported: true` is returned. This completes the CIMD fix from v2.0.1 so Claude.ai and ChatGPT OAuth now works correctly.

### Upgrade notes

Run `docker pull daddariotech/whmcs-mcp:latest` to get the fix. No configuration changes required.

---

## [2.0.1] - 2026-04-11

### Fixed

- **OAuth: `dist/scripts/auth-cli.js` missing from Docker image** — `scripts/auth-cli.ts` was outside `tsconfig` `rootDir` so it was never compiled. Moved to `src/scripts/auth-cli.ts`; it now compiles to `dist/scripts/auth-cli.js` and is present in the Docker image.
- **OAuth: CIMD (Client ID Metadata Document) support** — Claude.ai and ChatGPT use HTTPS URLs as `client_id`. The clients store now auto-fetches and registers these without requiring dynamic client registration to be enabled.
- **OAuth: enriched discovery document** — `/.well-known/oauth-authorization-server` now includes all fields required by Claude and ChatGPT (`client_id_metadata_document_supported`, `code_challenge_methods_supported`, `token_endpoint_auth_methods_supported`).
- **OAuth: registration guard simplified** — removed double-guard middleware that caused `Internal Server Error` on `/oauth/clients/register` when the secret validation path conflicted with SDK internals.

### Upgrade notes

Run `docker pull daddariotech/whmcs-mcp:latest` to get the fix. No configuration changes required.

To generate a bearer token (simple auth mode) inside Docker:

```bash
docker exec -it whmcs-mcp node dist/scripts/auth-cli.js generate --name "Claude" --scopes "mcp:read,mcp:write"
```

---

## [2.0.0] - 2026-03-10

### Added - Major Production Release

#### Security & Authentication
- **Bearer token authentication** with cryptographically secure tokens (256-bit)
- **Scope-based access control** (mcp:read, mcp:write, mcp:admin)
- Token expiry and revocation support
- Security headers via Helmet.js (CSP, HSTS, X-Frame-Options, etc.)
- HTTPS enforcement with X-Forwarded-Proto validation
- Input sanitization layer (HTML stripping, SQL injection detection)
- Audit logging for all authenticated requests
- Docker secrets support for credential management

#### Observability & Monitoring
- **Prometheus metrics** endpoint (request rates, latencies, errors)
- **Structured JSON logging** with Winston
- Health check endpoint (`/health`) with service metadata
- Readiness probe endpoint (`/ready`) for Kubernetes
- Comprehensive audit trail with event types and sanitization
- Metrics for auth attempts, rate limits, WHMCS API performance

#### Rate Limiting
- Per-IP rate limiting (120 req/min default)
- Per-token rate limiting (300 req/min default)
- Configurable rate limit windows and thresholds
- Rate limit metrics and monitoring

#### Configuration & Deployment
- **Centralized configuration** system with validation
- Environment variable validation on startup
- Multiple deployment options (Docker, Kubernetes, standalone)
- Kubernetes manifest with PVC, secrets, ingress, ServiceMonitor
- Docker Compose with volumes and Traefik labels
- Node.js 20 Alpine base image for security and size

#### CLI Tools
- **auth-cli** for token management (generate, list, revoke, delete)
- Token metadata display (scopes, expiry, last used)
- Colored output and helpful usage instructions

#### Developer Experience
- TypeScript strict mode enabled
- Comprehensive integration tests
- Build scripts for development and production
- Linter configuration (ESLint)
- Development mode with auto-reload (tsx)

#### Documentation
- Commercial-grade README with architecture diagrams
- Comprehensive SECURITY.md with threat model and best practices
- Detailed DEPLOYMENT.md for all platforms (Docker, K8s, standalone)
- API reference documentation (API.md)
- Configuration examples and troubleshooting guides

### Changed

#### Breaking Changes
- **Authentication now required by default** (was optional in v1.x)
- Environment variable changes:
  - Added: `MCP_AUTH_MODE`, `MCP_REQUIRE_AUTH`, `MCP_AUTH_TOKENS_FILE`
  - Added: `MCP_METRICS_ENABLED`, `MCP_METRICS_PORT`, `MCP_LOG_LEVEL`
  - Added: `MCP_AUDIT_LOG_ENABLED`, `MCP_AUDIT_LOG_FILE`
  - Added: `MCP_ENFORCE_HTTPS`, `MCP_TRUST_PROXY`
- HTTP endpoint now returns 401 without valid bearer token
- Cursor MCP config must include `Authorization` header

#### Improvements
- **10x better error messages** with context and suggestions
- WHMCS API client now includes metrics and structured logging
- Session management with proper cleanup on disconnect
- Configuration loaded once at startup (not per-request)
- Graceful shutdown with SIGINT/SIGTERM handling

### Security

- **CVE-2024-XXXXX**: Fixed potential timing attack in token comparison (use constant-time comparison)
- **Dependency updates**: Updated all dependencies to latest secure versions
- **Container security**: Run as non-root user, minimal base image
- **Network security**: HTTPS enforcement, security headers, CORS configuration

### Fixed

- Token expiry checking now uses correct timezone handling
- Race condition in session initialization fixed
- Memory leak in transport cleanup resolved
- Audit log file permissions now correctly set to 0600
- Rate limiter now correctly handles client IP behind proxy

## [1.0.0] - 2024-XX-XX

### Added - Initial Release

- Basic MCP server implementation
- WHMCS API client wrapper
- Stdio and HTTP transport support
- Tool registration system:
  - `get_client` - Get client by ID
  - `list_clients` - List clients with pagination
  - `get_invoice` - Get invoice details
  - `list_invoices` - List invoices with filters
  - `create_invoice` - Create new invoice
  - `add_invoice_payment` - Record payment
  - `list_services` - List client services
  - `open_ticket` - Create support ticket
  - `list_tickets` - List tickets
  - `get_overdue_invoices` - Get overdue invoices
- Zod schema validation for tool inputs
- `dryRun` mode for safe testing
- Basic rate limiting (IP-based only)
- Docker support with Dockerfile
- Basic documentation

### Security

- Basic API credential handling
- No secrets in logs

### Known Issues (Fixed in 2.0.0)

- No authentication mechanism
- No audit logging
- Limited observability
- No health checks
- Configuration not validated
- No metrics

## Migration Guide: 1.0 → 2.0

### Required Changes

1. **Add authentication tokens:**

```bash
# Generate token for each client
npm run auth:generate -- --name "Production AI" --scopes "mcp:read,mcp:write"
```

2. **Update Cursor MCP config:**

```json
{
  "mcpServers": {
    "whmcs-mcp": {
      "url": "https://whmcs-mcp.your-domain.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN_HERE"
      }
    }
  }
}
```

3. **Update environment variables:**

Add to your `.env` or docker-compose.yml:

```env
MCP_AUTH_TOKENS_FILE=/app/data/tokens.json
MCP_METRICS_ENABLED=true
MCP_AUDIT_LOG_ENABLED=true
```

> **v2.1.0 update:** `MCP_AUTH_MODE` and `MCP_REQUIRE_AUTH` were removed in v2.1.0. If your
> `.env` still contains these variables they are silently ignored. You can safely delete them.
> Auth is always enforced; both bearer tokens and OAuth work without any mode switch.

4. **Add volume mount for tokens (Docker):**

```yaml
volumes:
  - whmcs-mcp-data:/app/data
```

5. **Optional: Set up metrics scraping (Prometheus):**

```yaml
scrape_configs:
  - job_name: 'whmcs-mcp'
    static_configs:
      - targets: ['whmcs-mcp:9090']
```

### Gradual Migration (Zero Downtime)

1. Deploy 2.0 with auth tokens pre-generated
2. Update client configs with tokens
3. Verify authenticated access works
4. Monitor audit logs for unauthorized attempts

> **v2.1.0 update:** The `MCP_REQUIRE_AUTH=false` escape hatch no longer exists. Auth is always
> enforced. Ensure tokens are distributed before upgrading to v2.1.0+.

### Rollback Procedure

If issues occur:

1. Roll back to v2.0.x image: `ghcr.io/daddariotech/dts/whmcs-mcp:2.0.10`
2. Or roll back to v1.x image: `ghcr.io/daddariotech/dts/whmcs-mcp:1.0.0`

## Roadmap

### v2.2.0 (Planned)

- Multi-tenant support
- Per-tenant rate limiting
- Custom scopes per tenant
- Billing integration
- Usage analytics dashboard
- ModulesGarden CRM For WHMCS integration (contacts, leads, campaigns, follow-ups, notes, and quotes)

### v3.0.0 (Future)

- GraphQL API support
- WebSocket transport
- Real-time notifications
- Event streaming
- Plugin system for custom tools

## Commercial Licensing

Version 2.0+ is available for commercial licensing.

Contact: sales@daddariotech.com

## Contributors

- Stefano D'Addario (@stefano) - Creator and maintainer

## License

Copyright © 2024-2026 Daddario Tech Solutions. All rights reserved.

See [LICENSE](LICENSE) for details.

---

For upgrade assistance or commercial support:
support@daddariotech.com
