import { z } from 'zod';
import {
  inputRequired,
  acceptedContent,
  inputResponse,
  type McpServer,
  type InputRequiredResult,
  type CallToolResult,
} from '@modelcontextprotocol/server';
import type { WhmcsClient } from '../whmcs-client.js';

// ---------------------------------------------------------------------------
// Input schema (defines what callers may supply up-front)
// ---------------------------------------------------------------------------

export const openTicketInputSchema = z.object({
  /** Numeric WHMCS client ID. Required unless `email` is provided. */
  clientid: z.string().optional(),
  /** Client e-mail address. Required unless `clientid` is provided. */
  email: z.string().optional(),
  /** One-line ticket subject. */
  subject: z.string().optional(),
  /** Full ticket body / message. */
  message: z.string().optional(),
  /** Numeric support-department ID (use `get_support_departments` to list). */
  deptid: z.string().optional(),
  /** Ticket urgency. Defaults to `medium` when not supplied. */
  priority: z.enum(['low', 'medium', 'high']).optional(),
  /**
   * Optional staff username to attribute the ticket to a staff member
   * rather than the client (same as the `adminusername` WHMCS API param).
   */
  adminUsername: z.string().optional(),
  /** Preview what would be sent without creating the ticket. */
  dryRun: z.boolean().optional(),
});

export type OpenTicketInput = z.infer<typeof openTicketInputSchema>;

/** Fields the server can elicit from the user when they are absent. */
type TicketElicitContent = {
  clientid?: string;
  email?: string;
  subject?: string;
  message?: string;
  deptid?: string;
  priority?: 'low' | 'medium' | 'high';
};

// ---------------------------------------------------------------------------
// Elicitation key — a stable string that names the round-trip
// ---------------------------------------------------------------------------

const ELICIT_KEY = 'ticket_fields';

// ---------------------------------------------------------------------------
// Build a human-readable elicitation prompt listing the missing fields
// ---------------------------------------------------------------------------

function buildElicitMessage(missing: {
  client: boolean;
  subject: boolean;
  message: boolean;
  deptid: boolean;
}): string {
  const parts: string[] = [];
  if (missing.client) parts.push('client identifier (ID or email)');
  if (missing.subject) parts.push('subject');
  if (missing.message) parts.push('message');
  if (missing.deptid) parts.push('department ID');

  return (
    `To open a support ticket, please provide the missing required ` +
    `field${parts.length > 1 ? 's' : ''}: ${parts.join(', ')}.`
  );
}

// ---------------------------------------------------------------------------
// Build the restricted elicitation schema for only the missing fields
// ---------------------------------------------------------------------------

function buildElicitSchema(missing: {
  client: boolean;
  subject: boolean;
  message: boolean;
  deptid: boolean;
}) {
  const required: string[] = [];

  // Build each property only when the field is absent from the original call.
  const properties = {
    ...(missing.client
      ? {
          // clientid/email are mutually optional — the handler validates that at
          // least one is present after elicitation.
          clientid: {
            type: 'string' as const,
            title: 'Client ID',
            description: 'Numeric WHMCS client ID (leave blank to identify by email instead)',
          },
          email: {
            type: 'string' as const,
            format: 'email' as const,
            title: 'Client Email',
            description: 'Required when Client ID is not provided',
          },
        }
      : {}),
    ...(missing.subject
      ? (() => {
          required.push('subject');
          return {
            subject: {
              type: 'string' as const,
              title: 'Subject',
              description: 'One-line summary of the issue',
            },
          };
        })()
      : {}),
    ...(missing.message
      ? (() => {
          required.push('message');
          return {
            message: {
              type: 'string' as const,
              title: 'Message',
              description: 'Full description of the support request',
            },
          };
        })()
      : {}),
    ...(missing.deptid
      ? (() => {
          required.push('deptid');
          return {
            deptid: {
              type: 'string' as const,
              title: 'Department ID',
              description:
                'Numeric support-department ID (call get_support_departments to list options)',
            },
          };
        })()
      : {}),
    // Always include priority (with default) so the user can override it when
    // they are already filling out a form for the other missing fields.
    priority: {
      type: 'string' as const,
      title: 'Priority',
      enum: ['low', 'medium', 'high'] as ['low', 'medium', 'high'],
      default: 'medium' as const,
    },
  };

  return {
    type: 'object' as const,
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

/**
 * Registers the `open_ticket` MCP tool on `server`.
 *
 * When required fields (`clientid`/`email`, `subject`, `message`, `deptid`)
 * are absent the handler pauses the tool call and sends an `elicitation/create`
 * request to the client.  The client presents the form to the user, then
 * retries the call with the collected answers.  Calls that already supply all
 * required fields bypass elicitation entirely.
 *
 * Compatible with both 2025-era connections (push-style elicitation via the
 * SDK's legacy shim) and 2026-07-28 connections (stateless inputRequired
 * return).
 */
export function registerOpenTicketTool(server: McpServer, whmcs: WhmcsClient): void {
  server.registerTool(
    'open_ticket',
    {
      description:
        'Open a new support ticket in WHMCS. ' +
        'Required fields (clientid or email, subject, message, deptid) are ' +
        'elicited from the user when not provided.',
      inputSchema: openTicketInputSchema,
    },
    async (args, ctx): Promise<CallToolResult | InputRequiredResult> => {
      // ── 1. Read any answers from a previous elicitation round ──────────

      const elicitView = inputResponse(ctx.mcpReq.inputResponses, ELICIT_KEY);

      // User explicitly declined or cancelled — return early.
      if (elicitView.kind === 'elicit' && elicitView.action !== 'accept') {
        return {
          content: [
            {
              type: 'text',
              text: `[${elicitView.action}] Ticket creation was ${elicitView.action}ed by the user.`,
            },
          ],
          isError: true,
        };
      }

      const elicited = acceptedContent<TicketElicitContent>(
        ctx.mcpReq.inputResponses,
        ELICIT_KEY,
      );

      // ── 2. Merge caller-supplied args with elicited values ──────────────

      const clientid = args.clientid ?? elicited?.clientid;
      const email = args.email ?? elicited?.email;
      const subject = args.subject ?? elicited?.subject;
      const message = args.message ?? elicited?.message;
      const deptid = args.deptid ?? elicited?.deptid;
      // Priority has a sensible default; include it in the elicitation form
      // only when we are already asking for other missing fields.
      const priority: 'low' | 'medium' | 'high' =
        args.priority ?? elicited?.priority ?? 'medium';

      // ── 3. Determine which required fields are still absent ─────────────

      const missing = {
        client: !clientid && !email,
        subject: !subject,
        message: !message,
        deptid: !deptid,
      };
      const anyMissing = missing.client || missing.subject || missing.message || missing.deptid;

      // ── 4. Elicit missing fields ────────────────────────────────────────

      if (anyMissing) {
        return inputRequired({
          inputRequests: {
            [ELICIT_KEY]: inputRequired.elicit({
              message: buildElicitMessage(missing),
              requestedSchema: buildElicitSchema(missing),
            }),
          },
        });
      }

      // ── 5. All fields present — validate and execute ────────────────────

      // These assertions hold because anyMissing is false above.
      if (!subject || !message || !deptid) {
        return {
          content: [{ type: 'text', text: 'Internal error: required field missing after elicitation.' }],
          isError: true,
        };
      }
      if (!clientid && !email) {
        return {
          content: [{ type: 'text', text: 'Either clientid or email must be provided.' }],
          isError: true,
        };
      }

      // ── 6. Dry-run shortcut ─────────────────────────────────────────────

      if (args.dryRun === true) {
        const preview = {
          action: 'OpenTicket',
          ...(clientid != null ? { clientid } : {}),
          ...(clientid == null && email != null ? { email } : {}),
          subject,
          message,
          deptid,
          priority,
          ...(args.adminUsername != null ? { adminusername: args.adminUsername } : {}),
        };
        return {
          content: [
            {
              type: 'text',
              text: `[dryRun] Would open ticket:\n${JSON.stringify(preview, null, 2)}`,
            },
          ],
        };
      }

      // ── 7. Call the WHMCS API ───────────────────────────────────────────

      const result = await whmcs.openTicket({
        // Exactly one of clientid / email is always defined here (validated above).
        ...(clientid != null ? { clientid } : {}),
        ...(clientid == null && email != null ? { email } : {}),
        subject,
        message,
        deptid,
        priority,
        ...(args.adminUsername != null ? { adminusername: args.adminUsername } : {}),
      });

      if (result.result === 'error') {
        return {
          content: [
            {
              type: 'text',
              text: `WHMCS error: ${result.message ?? 'unknown error'}`,
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    },
  );
}
