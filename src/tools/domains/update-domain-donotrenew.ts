/**
 * update_domain_donotrenew
 *
 * Enable or disable the Do Not Renew flag on a WHMCS domain.
 *
 * WHMCS API: UpdateClientDomain (action = "UpdateClientDomain")
 *   https://developers.whmcs.com/api-reference/updateclientdomain/
 *
 * When donotrenew is true, WHMCS will not generate a renewal invoice for the
 * domain on its next due date. The flag is stored as a boolean in tbldomains.
 *
 * Domain lookup by name: when only `domain` is supplied (no `domainid`), the
 * tool resolves the ID via GetClientsDomains before calling UpdateClientDomain,
 * because UpdateClientDomain requires a numeric domainid.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Minimal subset of the WHMCS API response used by this tool.
 * The real WhmcsClient in the server wraps a full typed response.
 */
export interface WhmcsCallResult {
  result: 'success' | 'error';
  message?: string;
  domainid?: number | string;
  totalresults?: number | string;
  domains?: {
    domain?: Array<{
      id: number | string;
      domainname: string;
      donotrenew?: string | number | boolean;
    }>;
  };
}

/**
 * Function signature for a WHMCS API call.  Injected so that unit tests can
 * supply a mock without hitting a real WHMCS install.
 */
export type WhmcsCallFn = (
  action: string,
  params: Record<string, unknown>,
) => Promise<WhmcsCallResult>;

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

/**
 * Zod schema for the tool input.
 * Matches the JSON Schema emitted by the live tool registry
 * ($schema: "http://json-schema.org/draft-07/schema#").
 */
export const UpdateDomainDonotrenewSchema = z
  .object({
    domainid: z
      .number()
      .int()
      .positive()
      .optional()
      .describe('WHMCS domain ID'),
    domain: z
      .string()
      .max(253)
      .optional()
      .describe('Domain name (used to look up the domainid when omitted)'),
    donotrenew: z
      .boolean()
      .describe(
        'true = prevent auto-renewal (Do Not Renew on), false = allow auto-renewal (Do Not Renew off)',
      ),
    dryRun: z
      .boolean()
      .optional()
      .describe('If true, validate only — do not apply changes'),
  })
  .refine((d) => d.domainid !== undefined || d.domain !== undefined, {
    message: 'Either domainid or domain is required',
  });

export type UpdateDomainDonotrenewInput = z.infer<
  typeof UpdateDomainDonotrenewSchema
>;

// ---------------------------------------------------------------------------
// XSS-safe label helper
// Mirrors the `sanitize` utility used throughout the server for dryRun output.
// ---------------------------------------------------------------------------

function sanitize(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// ---------------------------------------------------------------------------
// Domain-ID resolver
// ---------------------------------------------------------------------------

/**
 * Resolve a numeric WHMCS domain ID from a domain name by calling
 * GetClientsDomains with the domain filter.
 */
async function resolveDomainId(
  domainName: string,
  call: WhmcsCallFn,
): Promise<number> {
  const res = await call('GetClientsDomains', { domain: domainName });

  if (res.result !== 'success') {
    throw new Error(
      res.message ?? `GetClientsDomains failed for domain "${domainName}"`,
    );
  }

  const record = res.domains?.domain?.[0];
  if (!record) {
    throw new Error(`Domain not found: ${domainName}`);
  }

  const id = Number(record.id);
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error(
      `GetClientsDomains returned an invalid domain ID for "${domainName}"`,
    );
  }

  return id;
}

// ---------------------------------------------------------------------------
// Tool handler
// ---------------------------------------------------------------------------

/**
 * Enable or disable the Do Not Renew flag for a WHMCS domain.
 *
 * @param input  Validated tool input.
 * @param call   WHMCS API call function (real client or test mock).
 * @returns      Human-readable success message or dryRun preview.
 */
export async function updateDomainDonotrenew(
  input: UpdateDomainDonotrenewInput,
  call: WhmcsCallFn,
): Promise<string> {
  const { donotrenew, dryRun } = input;

  // Resolve domainid — either supplied directly or looked up by domain name.
  let domainid = input.domainid;
  const domainLabel =
    input.domain ?? (domainid !== undefined ? `ID ${domainid}` : '');

  if (domainid === undefined) {
    // domain is guaranteed non-undefined by the .refine() above
    domainid = await resolveDomainId(input.domain as string, call);
  }

  const action = donotrenew
    ? 'enable Do Not Renew'
    : 'disable Do Not Renew';

  if (dryRun) {
    return `[dryRun] Would ${action} for domain ${sanitize(domainLabel)} (ID ${domainid})`;
  }

  // Call WHMCS UpdateClientDomain.
  // donotrenew is sent as a boolean; the HTTP client serialises it correctly.
  const res = await call('UpdateClientDomain', {
    domainid,
    donotrenew,
  });

  if (res.result !== 'success') {
    throw new Error(
      res.message ?? 'UpdateClientDomain failed with an unknown error',
    );
  }

  const resolvedId = res.domainid ?? domainid;
  return `Do Not Renew ${donotrenew ? 'enabled' : 'disabled'} for domain ${sanitize(domainLabel)} (ID ${resolvedId}).`;
}

// ---------------------------------------------------------------------------
// Tool descriptor — consumed by the MCP tool registry
// ---------------------------------------------------------------------------

export const updateDomainDonotrenewTool = {
  name: 'update_domain_donotrenew' as const,
  description:
    'Enable or disable Do Not Renew for a domain. When enabled, WHMCS will not generate a renewal invoice for the domain on its next due date. Use dryRun=true to validate without applying.',
  inputSchema: UpdateDomainDonotrenewSchema,
  handler: updateDomainDonotrenew,
} as const;
