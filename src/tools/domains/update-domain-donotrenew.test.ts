/**
 * Tests for update_domain_donotrenew
 *
 * Covers:
 *   - dryRun=true, donotrenew=true  (enable preview)
 *   - dryRun=true, donotrenew=false (disable preview)
 *   - Successful enable (domainid supplied)
 *   - Successful disable (domainid supplied)
 *   - Successful enable via domain name lookup (domain supplied, no domainid)
 *   - Successful disable via domain name lookup
 *   - Domain not found (GetClientsDomains returns 0 results)
 *   - GetClientsDomains returns API error
 *   - UpdateClientDomain returns API error
 *   - Validation: neither domainid nor domain supplied
 *   - Validation: domainid must be a positive integer
 *   - dryRun output is XSS-safe (sanitizes domain label)
 */

import {
  updateDomainDonotrenew,
  UpdateDomainDonotrenewSchema,
  type WhmcsCallFn,
  type WhmcsCallResult,
} from './update-domain-donotrenew';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockCall(responses: Record<string, WhmcsCallResult>): WhmcsCallFn {
  return jest.fn(async (action: string) => {
    if (action in responses) return responses[action];
    throw new Error(`Unexpected WHMCS action: ${action}`);
  });
}

function domainLookupSuccess(id = 16, domainname = 'daddariodns.com'): WhmcsCallResult {
  return {
    result: 'success',
    totalresults: 1,
    domains: {
      domain: [{ id, domainname, donotrenew: '0' }],
    },
  };
}

function updateSuccess(domainid = 16): WhmcsCallResult {
  return { result: 'success', domainid };
}

// ---------------------------------------------------------------------------
// Input schema validation
// ---------------------------------------------------------------------------

describe('UpdateDomainDonotrenewSchema', () => {
  it('rejects when neither domainid nor domain is supplied', () => {
    const result = UpdateDomainDonotrenewSchema.safeParse({ donotrenew: true });
    expect(result.success).toBe(false);
  });

  it('rejects a non-positive domainid', () => {
    const result = UpdateDomainDonotrenewSchema.safeParse({
      domainid: 0,
      donotrenew: true,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a float domainid', () => {
    const result = UpdateDomainDonotrenewSchema.safeParse({
      domainid: 1.5,
      donotrenew: true,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a domain name longer than 253 characters', () => {
    const result = UpdateDomainDonotrenewSchema.safeParse({
      domain: 'a'.repeat(254),
      donotrenew: true,
    });
    expect(result.success).toBe(false);
  });

  it('accepts domainid alone', () => {
    expect(
      UpdateDomainDonotrenewSchema.safeParse({ domainid: 16, donotrenew: true }).success,
    ).toBe(true);
  });

  it('accepts domain name alone', () => {
    expect(
      UpdateDomainDonotrenewSchema.safeParse({
        domain: 'daddariodns.com',
        donotrenew: false,
      }).success,
    ).toBe(true);
  });

  it('accepts both domainid and domain together', () => {
    expect(
      UpdateDomainDonotrenewSchema.safeParse({
        domainid: 16,
        domain: 'daddariodns.com',
        donotrenew: true,
      }).success,
    ).toBe(true);
  });

  it('accepts optional dryRun=true', () => {
    expect(
      UpdateDomainDonotrenewSchema.safeParse({
        domainid: 16,
        donotrenew: true,
        dryRun: true,
      }).success,
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// dryRun mode
// ---------------------------------------------------------------------------

describe('updateDomainDonotrenew — dryRun', () => {
  it('returns dryRun preview for enable (domainid supplied)', async () => {
    const call = mockCall({});
    const result = await updateDomainDonotrenew(
      { domainid: 16, donotrenew: true, dryRun: true },
      call,
    );
    expect(result).toBe(
      '[dryRun] Would enable Do Not Renew for domain ID 16 (ID 16)',
    );
    expect(call).not.toHaveBeenCalled();
  });

  it('returns dryRun preview for disable (domainid supplied)', async () => {
    const call = mockCall({});
    const result = await updateDomainDonotrenew(
      { domainid: 16, donotrenew: false, dryRun: true },
      call,
    );
    expect(result).toBe(
      '[dryRun] Would disable Do Not Renew for domain ID 16 (ID 16)',
    );
    expect(call).not.toHaveBeenCalled();
  });

  it('returns dryRun preview for enable (domain name supplied, resolves ID)', async () => {
    const call = mockCall({ GetClientsDomains: domainLookupSuccess(16, 'daddariodns.com') });
    const result = await updateDomainDonotrenew(
      { domain: 'daddariodns.com', donotrenew: true, dryRun: true },
      call,
    );
    expect(result).toBe(
      '[dryRun] Would enable Do Not Renew for domain daddariodns.com (ID 16)',
    );
    expect(call).toHaveBeenCalledTimes(1);
    expect(call).toHaveBeenCalledWith('GetClientsDomains', {
      domain: 'daddariodns.com',
    });
  });

  it('returns dryRun preview for disable (domain name supplied)', async () => {
    const call = mockCall({ GetClientsDomains: domainLookupSuccess(16, 'daddariodns.com') });
    const result = await updateDomainDonotrenew(
      { domain: 'daddariodns.com', donotrenew: false, dryRun: true },
      call,
    );
    expect(result).toBe(
      '[dryRun] Would disable Do Not Renew for domain daddariodns.com (ID 16)',
    );
  });

  it('sanitizes XSS characters in domain label for dryRun output', async () => {
    // Should not be reachable via normal usage (domain names cannot contain
    // these characters) but the sanitizer must handle them defensively.
    const call = mockCall({
      GetClientsDomains: domainLookupSuccess(99, '<script>'),
    });
    const result = await updateDomainDonotrenew(
      { domain: '<script>', donotrenew: true, dryRun: true },
      call,
    );
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
  });
});

// ---------------------------------------------------------------------------
// Successful mutations (domainid supplied)
// ---------------------------------------------------------------------------

describe('updateDomainDonotrenew — enable (domainid supplied)', () => {
  it('calls UpdateClientDomain with donotrenew=true', async () => {
    const call = mockCall({ UpdateClientDomain: updateSuccess(16) });
    const result = await updateDomainDonotrenew(
      { domainid: 16, donotrenew: true },
      call,
    );

    expect(call).toHaveBeenCalledTimes(1);
    expect(call).toHaveBeenCalledWith('UpdateClientDomain', {
      domainid: 16,
      donotrenew: true,
    });
    expect(result).toMatch(/enabled/i);
    expect(result).toContain('16');
  });
});

describe('updateDomainDonotrenew — disable (domainid supplied)', () => {
  it('calls UpdateClientDomain with donotrenew=false', async () => {
    const call = mockCall({ UpdateClientDomain: updateSuccess(16) });
    const result = await updateDomainDonotrenew(
      { domainid: 16, donotrenew: false },
      call,
    );

    expect(call).toHaveBeenCalledWith('UpdateClientDomain', {
      domainid: 16,
      donotrenew: false,
    });
    expect(result).toMatch(/disabled/i);
    expect(result).toContain('16');
  });
});

// ---------------------------------------------------------------------------
// Domain name lookup path
// ---------------------------------------------------------------------------

describe('updateDomainDonotrenew — domain name lookup', () => {
  it('resolves domain ID then calls UpdateClientDomain (enable)', async () => {
    const call = mockCall({
      GetClientsDomains: domainLookupSuccess(16, 'daddariodns.com'),
      UpdateClientDomain: updateSuccess(16),
    });

    const result = await updateDomainDonotrenew(
      { domain: 'daddariodns.com', donotrenew: true },
      call,
    );

    expect(call).toHaveBeenCalledTimes(2);
    expect(call).toHaveBeenNthCalledWith(1, 'GetClientsDomains', {
      domain: 'daddariodns.com',
    });
    expect(call).toHaveBeenNthCalledWith(2, 'UpdateClientDomain', {
      domainid: 16,
      donotrenew: true,
    });
    expect(result).toMatch(/enabled/i);
    expect(result).toContain('daddariodns.com');
  });

  it('resolves domain ID then calls UpdateClientDomain (disable)', async () => {
    const call = mockCall({
      GetClientsDomains: domainLookupSuccess(16, 'daddariodns.com'),
      UpdateClientDomain: updateSuccess(16),
    });

    const result = await updateDomainDonotrenew(
      { domain: 'daddariodns.com', donotrenew: false },
      call,
    );

    expect(call).toHaveBeenNthCalledWith(2, 'UpdateClientDomain', {
      domainid: 16,
      donotrenew: false,
    });
    expect(result).toMatch(/disabled/i);
  });

  it('uses supplied domainid directly when both domainid and domain provided', async () => {
    const call = mockCall({ UpdateClientDomain: updateSuccess(16) });

    await updateDomainDonotrenew(
      { domainid: 16, domain: 'daddariodns.com', donotrenew: true },
      call,
    );

    // GetClientsDomains must NOT be called when domainid is already known.
    expect(call).not.toHaveBeenCalledWith('GetClientsDomains', expect.anything());
    expect(call).toHaveBeenCalledWith('UpdateClientDomain', {
      domainid: 16,
      donotrenew: true,
    });
  });
});

// ---------------------------------------------------------------------------
// Error paths
// ---------------------------------------------------------------------------

describe('updateDomainDonotrenew — error handling', () => {
  it('throws when GetClientsDomains returns 0 results', async () => {
    const call = mockCall({
      GetClientsDomains: {
        result: 'success',
        totalresults: 0,
        domains: { domain: [] },
      },
    });

    await expect(
      updateDomainDonotrenew({ domain: 'missing.com', donotrenew: true }, call),
    ).rejects.toThrow('Domain not found: missing.com');
  });

  it('throws when GetClientsDomains returns no domains key', async () => {
    const call = mockCall({
      GetClientsDomains: { result: 'success', totalresults: 0 },
    });

    await expect(
      updateDomainDonotrenew({ domain: 'missing.com', donotrenew: true }, call),
    ).rejects.toThrow('Domain not found: missing.com');
  });

  it('throws when GetClientsDomains returns an API error', async () => {
    const call = mockCall({
      GetClientsDomains: { result: 'error', message: 'Permission denied' },
    });

    await expect(
      updateDomainDonotrenew({ domain: 'daddariodns.com', donotrenew: true }, call),
    ).rejects.toThrow('Permission denied');
  });

  it('throws when UpdateClientDomain returns an API error', async () => {
    const call = mockCall({
      UpdateClientDomain: { result: 'error', message: 'Domain ID Not Found' },
    });

    await expect(
      updateDomainDonotrenew({ domainid: 999, donotrenew: true }, call),
    ).rejects.toThrow('Domain ID Not Found');
  });

  it('throws with a fallback message when UpdateClientDomain has no message', async () => {
    const call = mockCall({
      UpdateClientDomain: { result: 'error' },
    });

    await expect(
      updateDomainDonotrenew({ domainid: 16, donotrenew: false }, call),
    ).rejects.toThrow('UpdateClientDomain failed with an unknown error');
  });
});

// ---------------------------------------------------------------------------
// Tool descriptor sanity
// ---------------------------------------------------------------------------

describe('updateDomainDonotrenewTool descriptor', () => {
  // Imported separately to keep the descriptor test isolated.
  it('has the correct tool name', async () => {
    const { updateDomainDonotrenewTool } = await import('./update-domain-donotrenew');
    expect(updateDomainDonotrenewTool.name).toBe('update_domain_donotrenew');
  });

  it('has a non-empty description', async () => {
    const { updateDomainDonotrenewTool } = await import('./update-domain-donotrenew');
    expect(updateDomainDonotrenewTool.description.length).toBeGreaterThan(0);
  });
});
