/**
 * Integration tests for open_ticket MCP elicitation.
 *
 * Each test wires a real McpServer and Client together through an in-memory
 * transport.  The client declares the `elicitation` capability so the server's
 * legacy shim can push elicitation/create requests when the tool returns
 * inputRequired — simulating how a real MCP host behaves.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  McpServer,
  InMemoryTransport,
} from '@modelcontextprotocol/server';
import { Client } from '@modelcontextprotocol/client';
import { registerOpenTicketTool } from '../src/tools/open-ticket.js';
import type { WhmcsClient, WhmcsTicketResult } from '../src/whmcs-client.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a connected server + client pair ready for tool calls. */
async function createConnectedPair(whmcs: WhmcsClient): Promise<{
  server: McpServer;
  client: Client;
  cleanup: () => Promise<void>;
}> {
  const server = new McpServer({ name: 'whmcs-mcp-test', version: '0.0.0' });
  registerOpenTicketTool(server, whmcs);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  const client = new Client(
    { name: 'test-client', version: '1.0.0' },
    // Declare form elicitation so the SDK shim can forward elicitation/create
    // requests from the server's inputRequired returns to our handler below.
    { capabilities: { elicitation: { form: {} } } },
  );

  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);

  return {
    server,
    client,
    cleanup: async () => {
      await client.close();
    },
  };
}

/** Complete set of valid ticket arguments (no elicitation needed). */
const FULL_ARGS = {
  clientid: '42',
  subject: 'Cannot login',
  message: 'I keep getting an error when I try to log in.',
  deptid: '1',
  priority: 'high' as const,
} as const;

// ---------------------------------------------------------------------------
// Mock WHMCS client
// ---------------------------------------------------------------------------

function makeWhmcsMock(
  result: WhmcsTicketResult = { result: 'success', id: 101, tid: 'ABC-101' },
): WhmcsClient {
  return { openTicket: vi.fn().mockResolvedValue(result) };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('open_ticket — elicitation', () => {
  // ── Happy path: all fields provided up-front ──────────────────────────────

  it('calls the WHMCS API directly when all required fields are provided', async () => {
    const whmcs = makeWhmcsMock();
    const { client, cleanup } = await createConnectedPair(whmcs);

    try {
      const result = await client.callTool({ name: 'open_ticket', arguments: FULL_ARGS });

      expect(result.isError).toBeFalsy();
      expect(result.content[0]).toMatchObject({ type: 'text' });
      expect((result.content[0] as { type: 'text'; text: string }).text).toContain('101');
      expect(whmcs.openTicket).toHaveBeenCalledOnce();
      expect(whmcs.openTicket).toHaveBeenCalledWith(
        expect.objectContaining({
          clientid: '42',
          subject: 'Cannot login',
          priority: 'high',
        }),
      );
    } finally {
      await cleanup();
    }
  });

  // ── Elicitation: all required fields missing ───────────────────────────────

  it('elicits all missing required fields and completes the call', async () => {
    const whmcs = makeWhmcsMock();
    const { client, cleanup } = await createConnectedPair(whmcs);

    try {
      // Provide the missing fields via the elicitation handler.
      client.setRequestHandler('elicitation/create', async () => ({
        action: 'accept',
        content: {
          email: 'customer@example.com',
          subject: 'Billing question',
          message: 'Why was I charged twice?',
          deptid: '2',
          priority: 'medium',
        },
      }));

      // Call with NO arguments — all required fields are missing.
      const result = await client.callTool({ name: 'open_ticket', arguments: {} });

      expect(result.isError).toBeFalsy();
      expect(whmcs.openTicket).toHaveBeenCalledOnce();
      expect(whmcs.openTicket).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'customer@example.com',
          subject: 'Billing question',
          message: 'Why was I charged twice?',
          deptid: '2',
          priority: 'medium',
        }),
      );
    } finally {
      await cleanup();
    }
  });

  // ── Elicitation: only some fields missing ────────────────────────────────

  it('elicits only the truly missing fields when some are pre-supplied', async () => {
    const whmcs = makeWhmcsMock();
    const { client, cleanup } = await createConnectedPair(whmcs);

    try {
      let elicitCallCount = 0;
      let capturedSchema: Record<string, unknown> | undefined;

      client.setRequestHandler('elicitation/create', async (req) => {
        elicitCallCount++;
        // Narrow to form mode before accessing requestedSchema (URL mode does not
        // have requestedSchema; form mode may omit the mode field or use 'form').
        if (req.params.mode !== 'url') {
          capturedSchema = req.params.requestedSchema as Record<string, unknown>;
        }
        return {
          action: 'accept',
          content: {
            message: 'The site is down.',
            deptid: '3',
            priority: 'high',
          },
        };
      });

      // Provide clientid and subject up-front; message and deptid are missing.
      const result = await client.callTool({
        name: 'open_ticket',
        arguments: { clientid: '7', subject: 'Site outage' },
      });

      expect(result.isError).toBeFalsy();
      // Only one elicitation round should have occurred.
      expect(elicitCallCount).toBe(1);

      // The schema should include the missing fields but NOT subject/clientid.
      const properties = (capturedSchema?.['properties'] ?? {}) as Record<string, unknown>;
      expect(properties).not.toHaveProperty('subject');
      // clientid was provided, so neither client field should be in the schema
      expect(properties).not.toHaveProperty('clientid');
      expect(properties).not.toHaveProperty('email');
      // missing fields should be present
      expect(properties).toHaveProperty('message');
      expect(properties).toHaveProperty('deptid');

      expect(whmcs.openTicket).toHaveBeenCalledWith(
        expect.objectContaining({
          clientid: '7',
          subject: 'Site outage',
          message: 'The site is down.',
          deptid: '3',
          priority: 'high',
        }),
      );
    } finally {
      await cleanup();
    }
  });

  // ── Elicitation: user declines ────────────────────────────────────────────

  it('returns an error result when the user declines elicitation', async () => {
    const whmcs = makeWhmcsMock();
    const { client, cleanup } = await createConnectedPair(whmcs);

    try {
      client.setRequestHandler('elicitation/create', async () => ({
        action: 'decline',
      }));

      const result = await client.callTool({ name: 'open_ticket', arguments: {} });

      expect(result.isError).toBe(true);
      const text = (result.content[0] as { type: 'text'; text: string }).text;
      expect(text).toContain('decline');
      expect(whmcs.openTicket).not.toHaveBeenCalled();
    } finally {
      await cleanup();
    }
  });

  // ── Elicitation: user cancels ─────────────────────────────────────────────

  it('returns an error result when the user cancels elicitation', async () => {
    const whmcs = makeWhmcsMock();
    const { client, cleanup } = await createConnectedPair(whmcs);

    try {
      client.setRequestHandler('elicitation/create', async () => ({
        action: 'cancel',
      }));

      const result = await client.callTool({ name: 'open_ticket', arguments: {} });

      expect(result.isError).toBe(true);
      const text = (result.content[0] as { type: 'text'; text: string }).text;
      expect(text).toContain('cancel');
      expect(whmcs.openTicket).not.toHaveBeenCalled();
    } finally {
      await cleanup();
    }
  });

  // ── Priority defaulting ───────────────────────────────────────────────────

  it('defaults priority to medium when not provided and not elicited', async () => {
    const whmcs = makeWhmcsMock();
    const { client, cleanup } = await createConnectedPair(whmcs);

    try {
      // Elicitation handler intentionally omits priority
      client.setRequestHandler('elicitation/create', async () => ({
        action: 'accept',
        content: {
          email: 'user@example.com',
          subject: 'Question',
          message: 'How do I upgrade?',
          deptid: '1',
          // no priority — should default to 'medium'
        },
      }));

      const result = await client.callTool({ name: 'open_ticket', arguments: {} });

      expect(result.isError).toBeFalsy();
      expect(whmcs.openTicket).toHaveBeenCalledWith(
        expect.objectContaining({ priority: 'medium' }),
      );
    } finally {
      await cleanup();
    }
  });

  // ── Priority elicited when user changes it ────────────────────────────────

  it('uses the elicited priority when the user changes it from the default', async () => {
    const whmcs = makeWhmcsMock();
    const { client, cleanup } = await createConnectedPair(whmcs);

    try {
      client.setRequestHandler('elicitation/create', async () => ({
        action: 'accept',
        content: {
          email: 'user@example.com',
          subject: 'Urgent issue',
          message: 'Everything is on fire!',
          deptid: '1',
          priority: 'high',
        },
      }));

      const result = await client.callTool({ name: 'open_ticket', arguments: {} });

      expect(result.isError).toBeFalsy();
      expect(whmcs.openTicket).toHaveBeenCalledWith(
        expect.objectContaining({ priority: 'high' }),
      );
    } finally {
      await cleanup();
    }
  });

  // ── dryRun mode: no elicitation needed, no API call ──────────────────────

  it('returns a dryRun preview without calling the WHMCS API', async () => {
    const whmcs = makeWhmcsMock();
    const { client, cleanup } = await createConnectedPair(whmcs);

    try {
      const result = await client.callTool({
        name: 'open_ticket',
        arguments: { ...FULL_ARGS, dryRun: true },
      });

      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { type: 'text'; text: string }).text;
      expect(text).toContain('[dryRun]');
      expect(text).toContain('Cannot login');
      expect(whmcs.openTicket).not.toHaveBeenCalled();
    } finally {
      await cleanup();
    }
  });

  // ── WHMCS API error propagation ───────────────────────────────────────────

  it('surfaces WHMCS API errors as isError tool results', async () => {
    const whmcs = makeWhmcsMock({
      result: 'error',
      message: 'Client ID Not Found',
    });
    const { client, cleanup } = await createConnectedPair(whmcs);

    try {
      const result = await client.callTool({ name: 'open_ticket', arguments: FULL_ARGS });

      expect(result.isError).toBe(true);
      const text = (result.content[0] as { type: 'text'; text: string }).text;
      expect(text).toContain('Client ID Not Found');
    } finally {
      await cleanup();
    }
  });

  // ── adminUsername forwarding ──────────────────────────────────────────────

  it('forwards adminUsername as adminusername to the WHMCS API', async () => {
    const whmcs = makeWhmcsMock();
    const { client, cleanup } = await createConnectedPair(whmcs);

    try {
      await client.callTool({
        name: 'open_ticket',
        arguments: { ...FULL_ARGS, adminUsername: 'support.agent' },
      });

      expect(whmcs.openTicket).toHaveBeenCalledWith(
        expect.objectContaining({ adminusername: 'support.agent' }),
      );
    } finally {
      await cleanup();
    }
  });
});
