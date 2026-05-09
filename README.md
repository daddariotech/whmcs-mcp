# WHMCS MCP Server

**The first production-grade AI integration for WHMCS.** Connect ChatGPT, Claude, and Cursor directly to your WHMCS installation — manage clients, invoices, tickets, and services through natural language.

```
You: "Send a payment reminder to all clients with overdue invoices over $50"
AI:  Fetching overdue invoices... Found 12. Sending reminder emails... Done.
```

[![License](https://img.shields.io/badge/license-Commercial-blue)](https://daddar.io)
[![Docker](https://img.shields.io/docker/v/daddariotech/whmcs-mcp?label=docker)](https://hub.docker.com/r/daddariotech/whmcs-mcp)
[![MCP](https://img.shields.io/badge/MCP-compatible-green)](https://modelcontextprotocol.io)

---

## Prerequisites — WHMCS API Setup

Before running the installer you need a WHMCS API credential with the right permissions.

**1. Create an API Role**

In WHMCS Admin: **Setup → Staff Management → API Roles → Add Role**

Choose a permission preset based on how much you trust the AI:

**Minimum permissions (read-only — AI can look but not touch):**
`GetClients` `GetClientsDetails` `GetClientsProducts` `GetClientsDomains` `GetClientsAddons` `GetClientGroups` `GetContacts` `GetEmails` `GetInvoice` `GetInvoices` `GetOrders` `GetOrderStatuses` `GetProducts` `GetTicket` `GetTickets` `GetSupportDepartments` `GetQuotes` `GetCredits` `GetTransactions` `GetStats` `GetActivityLog` `GetCancelledPackages` `GetEmailTemplates` `GetCurrencies` `GetPaymentMethods` `GetHealthStatus` `GetProductGroups` `GetRegistrars` `GetServers` `GetAffiliates` `GetAnnouncements` `GetSupportStatuses` `GetTicketCounts` `GetTicketPredefinedCats` `GetAdminUsers` `GetToDoItems` `GetToDoItemStatuses` `GetStaffOnline` `DomainWhois` `DomainGetNameservers` `DomainGetLockingStatus` `GetTLDPricing` `GetPromotions`

**Maximum permissions (full access — AI can take any action):**
Everything above, plus:
`AddClient` `UpdateClient` `AddClientNote` `AddContact` `UpdateContact` `CreateInvoice` `AddInvoicePayment` `AddOrder` `AcceptOrder` `CancelOrder` `OpenTicket` `AddTicketReply` `UpdateTicket` `CreateQuote` `UpdateQuote` `SendQuote` `AcceptQuote` `DeleteQuote` `AddCredit` `ApplyCredit` `AddBillableItem` `SendEmail` `UpdateClientProduct` `ModuleSuspend` `ModuleUnsuspend` `ModuleTerminate` `ModuleCreate` `UpgradeProduct` `RegisterDomain` `TransferDomain` `RenewDomain` `DomainUpdateNameservers` `DomainUpdateLockingStatus` `DomainToggleIdProtect` `FraudOrder` `PendingOrder` `UpdateInvoice` `ModuleChangePw` `LogActivity` `AddTicketNote` `AffiliateActivate`

> **Tip:** Start with minimum permissions and add write permissions only as needed. This limits blast radius if an AI client goes rogue or gets a bad prompt.

**2. Set an API Access Key (recommended)**

An Access Key bypasses IP restrictions entirely — the recommended approach since the MCP server's outbound IP can change (Docker restarts, server moves, etc.).

Add this line to your `configuration.php` in the WHMCS root:

```php
$api_access_key = 'your-secret-passphrase';
```

> Allowed characters: letters, numbers, and `! @ # $ % . ( ) * [ ] - _`

Then set `WHMCS_ACCESS_KEY` to the same value in your `.env` or Portainer stack.

**3. Create an API Credential**

**Setup → Staff Management → API Credentials → Generate New Credential**

- Role: select the role you just created
- Allowed IPs: leave blank if using an Access Key (recommended), or enter the server IP if you prefer IP-based restrictions
- Copy the **Identifier** and **Secret** — you'll need these during install

---

## Quick Start — running in under 5 minutes

**Binary (no Docker required):**

```bash
curl -fsSL https://daddar.io/whmcs-mcp/install.sh | sudo bash
```

Prompts for your WHMCS credentials and license key, installs the binary to `/usr/local/bin`, and registers a systemd service.

**Docker (recommended for servers already running Docker):**

```bash
curl -fsSL https://daddar.io/whmcs-mcp/install-docker.sh | bash
```

Prompts for credentials, writes `.env`, and starts the stack via Docker Compose.

---

## Get a License

Purchase a license at **[daddar.io/store/ai-tools/whmcs-mcp](https://daddar.io/store/ai-tools/whmcs-mcp)** — after checkout, your license key appears in the client portal. Paste it into `setup.sh` when prompted.

No license? A **14-day free trial** starts automatically on first run.

---

## What You Can Do

### 86 WHMCS Tools

| Category | Tools |
|---|---|
| **Clients** | `get_client` `list_clients` `add_client` `update_client` `get_client_details` `get_client_groups` `get_client_emails` `get_client_domains` `get_client_addons` `add_client_note` |
| **Invoices** | `get_invoice` `list_invoices` `create_invoice` `add_invoice_payment` `get_overdue_invoices` `get_transactions` `update_invoice` |
| **Orders** | `add_order` `get_orders` `accept_order` `cancel_order` `get_order_statuses` `fraud_order` `pending_order` |
| **Services** | `list_services` `update_service` `upgrade_product` `module_create` `module_suspend` `module_unsuspend` `module_terminate` `get_cancelled_packages` |
| **Tickets** | `get_ticket` `list_tickets` `open_ticket` `add_ticket_reply` `update_ticket` `get_support_departments` `add_ticket_note` `get_support_statuses` `get_ticket_counts` `get_ticket_predefined_categories` |
| **Quotes** | `get_quotes` `create_quote` `send_quote` `accept_quote` `update_quote` `delete_quote` |
| **Contacts** | `get_contacts` `add_contact` `update_contact` |
| **Credits** | `get_credits` `add_credit` `apply_credit` |
| **Billing** | `add_billable_item` `get_payment_methods` `get_currencies` |
| **Email** | `send_email` `get_email_templates` |
| **Products** | `get_products` `get_product_groups` |
| **Domains** | `register_domain` `transfer_domain` `renew_domain` `get_domain_whois` `get_domain_nameservers` `update_domain_nameservers` `get_domain_lock_status` `update_domain_lock_status` `get_tld_pricing` |
| **Admin** | `get_admin_users` `get_staff_online` `get_whmcs_details` `log_activity` `get_activity_log` |
| **Affiliates** | `get_affiliates` `activate_affiliate` |
| **Promotions** | `get_promotions` |
| **Servers** | `get_servers` `module_change_password` |
| **System** | `get_health_status` `get_todo_items` `get_todo_item_statuses` `get_announcements` `get_registrars` `get_stats` |
| **Reports** | `get_stats` `get_activity_log` `get_transactions` |

All tools support `dryRun` mode — preview what would happen before making changes.

### 24 Real-Time Resources

Resources are read-only data endpoints that AI clients can subscribe to via `whmcs://` URIs. Data is served from a 60-second TTL cache.

| URI | Description |
|---|---|
| `whmcs://stats` | Live system statistics (revenue, client counts, invoice totals) |
| `whmcs://health` | Server health status |
| `whmcs://system/info` | WHMCS installation details (version, PHP, database) |
| `whmcs://products` | Full product and service catalog |
| `whmcs://product-groups` | Product groups with product counts |
| `whmcs://tld-pricing` | Domain TLD registration/transfer/renewal pricing |
| `whmcs://promotions` | Active promotions and coupon codes |
| `whmcs://order-statuses` | Available order status values |
| `whmcs://currencies` | Configured currencies with exchange rates |
| `whmcs://payment-methods` | Active payment gateway modules |
| `whmcs://registrars` | Configured domain registrar modules |
| `whmcs://servers` | Provisioning servers |
| `whmcs://client-groups` | Client group definitions |
| `whmcs://affiliates` | Registered affiliate accounts |
| `whmcs://email-templates` | Email template library |
| `whmcs://announcements` | Published announcements |
| `whmcs://support/departments` | Support departments |
| `whmcs://support/statuses` | Available ticket status values |
| `whmcs://support/ticket-counts` | Ticket counts by department and status |
| `whmcs://support/predefined-categories` | Predefined ticket reply categories |
| `whmcs://admin/users` | Admin user accounts |
| `whmcs://admin/todo` | Admin to-do items |
| `whmcs://admin/todo-statuses` | Available to-do item status values |
| `whmcs://admin/staff-online` | Staff currently logged into the admin area |

### 18 Workflow Prompts

Prompts are pre-built workflow templates that MCP clients surface as one-click guided interactions.

| Prompt | Description |
|---|---|
| `new_client` | Guided new client account creation |
| `new_order` | Place and accept a product order for a client |
| `new_invoice` | Create a custom invoice with optional send |
| `new_quote` | Draft a sales quote with send/accept lifecycle |
| `ticket_response` | Load a ticket, draft a professional staff reply |
| `client_onboarding` | Full account onboarding review checklist |
| `fraud_investigation` | Security audit for a suspicious order |
| `bulk_invoice_reminder` | Find overdue invoices and send payment reminders |
| `revenue_report` | MRR + outstanding + paid financial breakdown |
| `client_health_check` | Deep account scorecard (services, billing, support) |
| `domain_expiry_audit` | Flag at-risk domains, draft renewal reminders |
| `new_product_setup` | Step-by-step product configuration guide |
| `churn_risk_report` | Ranked churn-risk table with recommended actions |
| `support_queue_triage` | Priority-ordered ticket queue with quick-win suggestions |
| `affiliate_performance` | Top performers, commissions, activation gaps |
| `service_renewal_forecast` | N-month renewal revenue projection |
| `addon_upsell_opportunities` | Missing add-on detection + upsell quote generation |
| `promo_effectiveness` | Promo code usage, revenue impact, and expiry analysis |

### vs other WHMCS MCP servers

| Feature | WHMCS MCP Server (us) | scarecr0w12/whmcs-mcp-tool | MX Modules |
|---|---|---|---|
| Tools | 86 | ~50 | ~20 |
| HTTP transport (ChatGPT, Claude remote) | Yes | **No — stdio only** | Yes |
| Authentication | OAuth 2.0 PKCE + bearer tokens | **None** | Static tokens only |
| One-click install | Yes (`curl \| bash`) | Manual (clone + npm) | Manual |
| Real-time webhook push | Yes | No | No |
| Audit log | Yes | No | No |
| Prometheus metrics | Yes | No | No |
| Rate limiting | Yes | No | No |
| `dryRun` mode on every tool | Yes | No | No |
| Trial period | 14 days free | Free forever (MIT) | None |
| Commercial support | Yes | None | Limited |
| License | Commercial | MIT | Commercial |

---

## Supported AI Clients

| Client | Transport | Auth |
|---|---|---|
| **ChatGPT** (via GPT Actions) | HTTP | Bearer token or OAuth 2.0 |
| **Claude Desktop** | HTTP | Bearer token or OAuth 2.0 |
| **Cursor IDE** | stdio or HTTP | Bearer token or OAuth 2.0 |
| **Any MCP-compatible client** | HTTP | Bearer token or OAuth 2.0 |

---

## Security

- **OAuth 2.0 PKCE** — industry-standard authorization with short-lived tokens and refresh
- **Bearer token mode** — simple API key setup for single-tenant deployments
- **Rate limiting** — per-IP and per-token controls (configurable)
- **Audit log** — every authenticated request logged with client ID, method, and timestamp
- **Helmet.js** — security headers (CSP, HSTS, X-Frame-Options, etc.)
- **Input sanitization** — defense-in-depth against injection
- **HTTPS enforcement** — rejects plain HTTP in production
- **Docker secrets** — credentials read from `/run/secrets/` if present

---

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and fill in your values.

**Required:**

| Variable | Description |
|---|---|
| `WHMCS_API_URL` | Your WHMCS URL, e.g. `https://billing.example.com` |
| `WHMCS_IDENTIFIER` | WHMCS API identifier |
| `WHMCS_SECRET` | WHMCS API secret |

**License:**

| Variable | Description | Default |
|---|---|---|
| `LICENSE_KEY` | Your license key from daddar.io | (14-day free trial starts automatically) |

**Authentication:**

| Variable | Description | Default |
|---|---|---|
| `MCP_OAUTH_ADMIN_PASSWORD` | Enables the `/authorize` consent UI for OAuth PKCE flows | (unset — consent UI disabled) |
| `MCP_AUTH_TOKENS_FILE` | Path to bearer token store | `/app/data/tokens.json` |

> **Note (v2.1.0):** `MCP_AUTH_MODE` and `MCP_REQUIRE_AUTH` have been removed. The server always runs the full auth stack — bearer tokens and OAuth are both available in every configuration. Auth is always enforced in HTTP mode.

**Webhooks (optional):**

| Variable | Description |
|---|---|
| `WHMCS_WEBHOOK_SECRET` | HMAC secret shared with your WHMCS PHP hook |

See [.env.example](.env.example) for all options.

---

## Connecting AI Clients

### Cursor IDE

**Bearer token (simple):** Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "whmcs": {
      "url": "https://your-server:3100/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN"
      }
    }
  }
}
```

**OAuth (New App UI):** When adding via Cursor's "New App" with OAuth, the server must have `MCP_CLIENT_REGISTRATION_SECRET` set (in Portainer or `.env`). Generate with `openssl rand -hex 24`, set it on the server, then enter the same value in Cursor's Advanced OAuth settings under "Client registration secret" (or equivalent). This enables Dynamic Client Registration so Cursor can self-register.

Or for local stdio mode:

```json
{
  "mcpServers": {
    "whmcs": {
      "command": "node",
      "args": ["/path/to/whmcs-mcp/dist/index.js"],
      "env": {
        "WHMCS_API_URL": "https://your-whmcs.example.com",
        "WHMCS_IDENTIFIER": "your-identifier",
        "WHMCS_SECRET": "your-secret"
      }
    }
  }
}
```

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "whmcs": {
      "url": "https://your-server:3100/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN"
      }
    }
  }
}
```

### ChatGPT (GPT Actions)

Point your GPT Action schema at `https://your-server:3100/mcp`. Use OAuth 2.0 mode for multi-user setups.

---

## Real-Time Webhook Push

Receive WHMCS events pushed to your AI in real time — new tickets, invoices, overdue payments.

See [docs/WEBHOOKS.md](docs/WEBHOOKS.md) for setup instructions.

---

## Deployment

### Docker Compose (recommended)

```bash
docker compose -f docker-compose.marketplace.yml up -d
```

Generates tokens:

```bash
docker exec -it whmcs-mcp node dist/scripts/auth-cli.js generate \
  --name "My AI" --scopes "mcp:read,mcp:write"
```

### Kubernetes

See [k8s-deployment.yaml](k8s-deployment.yaml) and [DEPLOYMENT.md](DEPLOYMENT.md).

### Behind a Reverse Proxy (nginx / Caddy / Traefik)

Remove the `ports` block from `docker-compose.marketplace.yml` and proxy to `whmcs-mcp:3100`. See comments in that file.

---

## Observability

- **Health check:** `GET /health`
- **Readiness:** `GET /ready`
- **Prometheus metrics:** port 9090 (configurable via `MCP_METRICS_PORT`)

Key metrics: `whmcs_mcp_requests_total`, `whmcs_mcp_request_duration_seconds`, `whmcs_mcp_active_sessions`, `whmcs_mcp_auth_total`

---

## Support & Licensing

- **Purchase / manage license:** [daddar.io/store/ai-tools/whmcs-mcp](https://daddar.io/store/ai-tools/whmcs-mcp)
- **Documentation:** this repo + [DEPLOYMENT.md](DEPLOYMENT.md) + [docs/WEBHOOKS.md](docs/WEBHOOKS.md)
- **Support:** [support@daddar.io](mailto:support@daddar.io)
- **Security issues:** [SECURITY.md](SECURITY.md)

Copyright © 2026 Daddario Tech Solutions. All rights reserved. See [LICENSE](LICENSE).
