/**
 * Minimal WHMCS API client interface used by MCP tool handlers.
 *
 * Only the shapes required by tools implemented in this package are defined
 * here; the full production client lives in the server binary and satisfies
 * the same interface at runtime.
 */

export interface OpenTicketParams {
  /** Numeric WHMCS client ID. Required unless `email` is supplied. */
  clientid?: string;
  /** Client e-mail address. Required unless `clientid` is supplied. */
  email?: string;
  subject: string;
  message: string;
  /** Numeric support-department ID (see GetSupportDepartments). */
  deptid: string;
  priority: 'low' | 'medium' | 'high';
  /** Optional staff username to attribute the ticket to a staff member. */
  adminusername?: string;
}

export interface WhmcsTicketResult {
  result: 'success' | 'error';
  /** Numeric internal ticket ID returned on success. */
  id?: number;
  /** Human-readable ticket ID (e.g. "ABC-123456") returned on success. */
  tid?: string;
  /** Error description returned on failure. */
  message?: string;
}

/** Subset of the WHMCS API surface used by the ticket tools. */
export interface WhmcsClient {
  openTicket(params: OpenTicketParams): Promise<WhmcsTicketResult>;
}
