import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'

const { respond, mcpTool, ADMIN_ROLE } = createRequire(import.meta.url)('./handler.js')

const admin = { email_id: 'a@oryxdoors.com', status: 'ACTIVE', role_details: { role_name: ADMIN_ROLE } }
const appUser = { email_id: 'u@oryxdoors.com', status: 'ACTIVE', role_details: { role_name: 'App User' } }
const noTool = () => { throw new Error('Zoho must not be called') }
const call = (over) => respond({ method: 'POST', user: admin, body: {}, tool: noTool, ...over })

describe('access', () => {
  it('refuses a request with nobody signed in', async () => {
    expect(await call({ user: null, body: { action: 'searchDeals', query: 'villa' } })).toEqual({ status: 401, body: { error: 'not_signed_in' } })
  })

  it('refuses every Zoho action to anyone but an active App Administrator', async () => {
    const disabled = { ...admin, status: 'DISABLED' }
    for (const user of [appUser, disabled, { email_id: 'x' }]) {
      for (const action of ['searchDeals', 'dealDetails', 'dealProposals', 'proposalBoq']) {
        expect(await call({ user, body: { action, query: 'villa', dealId: '12345', proposalId: '12345' } })).toEqual({ status: 403, body: { error: 'admins_only' } })
      }
    }
  })

  it('only answers POST', async () => {
    expect((await call({ method: 'GET' })).status).toBe(405)
  })

  it('tells the sign-in gate who is signed in and whether they are an Admin', async () => {
    expect(await call({ body: { action: 'me' } })).toEqual({ status: 200, body: { email: 'a@oryxdoors.com', admin: true } })
    expect(await call({ user: appUser, body: { action: 'me' } })).toEqual({ status: 200, body: { email: 'u@oryxdoors.com', admin: false } })
  })
})

describe('input', () => {
  it('rejects IDs that are not plain digits, before reaching Zoho', async () => {
    expect((await call({ body: { action: 'dealProposals', dealId: '1" || Deal_Name != "' } })).status).toBe(400)
    expect((await call({ body: { action: 'proposalBoq', proposalId: '12' } })).status).toBe(400)
    expect((await call({ body: { action: 'dealDetails' } })).status).toBe(400)
  })

  it('rejects unknown actions and missing bodies', async () => {
    expect((await call({ body: { action: 'updateForm' } })).status).toBe(400)
    expect((await call({ body: null })).status).toBe(400)
  })

  it('does not search on fewer than two characters', async () => {
    expect(await call({ body: { action: 'searchDeals', query: ' a ' } })).toEqual({ status: 200, body: { deals: [] } })
  })
})

describe('Zoho data', () => {
  it('maps CRM deals', async () => {
    const tool = vi.fn(async () => ({ data: { data: [{ id: 111, Deal_Name: 'Villa 12', Account_Name: { name: 'Acme' }, Stage: 'Won' }] } }))
    const out = await call({ tool, body: { action: 'searchDeals', query: 'villa' } })
    expect(out.body).toEqual({ deals: [{ id: '111', name: 'Villa 12', company: 'Acme', stage: 'Won' }] })
    expect(tool.mock.calls[0][0]).toBe('ZohoCRM_getDealsRecords')
  })

  it('uses the latest proposal revision for deal details', async () => {
    const tool = vi.fn(async (name) => name === 'ZohoCRM_getDealsRecord'
      ? { data: [{ id: 111, Deal_Name: 'Villa 12', Amount: '1500' }] }
      : { data: [{ Revision_Number: '1', Proposal_Reference: 'R1' }, { Revision_Number: '5', Proposal_Reference: 'R5' }] })
    const { body } = await call({ tool, body: { action: 'dealDetails', dealId: '12345' } })
    expect(body.crm.orderValueInCrm).toBe(1500)
    expect(body.creator.proposalReference).toBe('R5')
  })

  it('treats a Creator "no records" tool error as an empty list', async () => {
    const tool = vi.fn(async () => { throw new Error('zoho_tool_error:ZohoCreator_getCreatorRecords') })
    expect(await call({ tool, body: { action: 'dealProposals', dealId: '12345' } })).toEqual({ status: 200, body: { proposals: [] } })
  })

  it('follows the Creator record cursor', async () => {
    const tool = vi.fn()
      .mockResolvedValueOnce({ data: [{ ID: 1 }], headers: { record_cursor: 'next' } })
      .mockResolvedValueOnce({ data: [{ ID: 2 }] })
    const { body } = await call({ tool, body: { action: 'proposalBoq', proposalId: '12345' } })
    expect(body.lines.map((l) => l.ID)).toEqual([1, 2])
    expect(tool.mock.calls[1][1].headers).toEqual({ record_cursor: 'next' })
  })

  it('never passes Zoho error details to the browser', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const tool = vi.fn(async () => { throw new Error('mcp_http_500 https://secret-link') })
    expect(await call({ tool, body: { action: 'searchDeals', query: 'villa' } })).toEqual({ status: 502, body: { error: 'zoho_unavailable' } })
    error.mockRestore()
  })

  it('reports a missing Zoho link', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const out = await call({ tool: mcpTool(undefined, noTool), body: { action: 'searchDeals', query: 'villa' } })
    expect(out).toEqual({ status: 502, body: { error: 'zoho_not_configured' } })
    error.mockRestore()
  })
})

describe('MCP client', () => {
  const response = (text, session) => ({ ok: true, headers: new Headers(session ? { 'Mcp-Session-Id': session } : {}), text: async () => text })

  it('initialises, keeps the session and reads a streamed answer', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(response('{"result":{}}', 'S1'))
      .mockResolvedValueOnce(response(''))
      .mockResolvedValueOnce(response('event: message\ndata: {"result":{"content":[{"text":"{\\"data\\":[1]}"}]}}\n'))
    expect(await mcpTool('https://mcp.example', fetchImpl)('t', {})).toEqual({ data: [1] })
    expect(fetchImpl.mock.calls[2][1].headers['Mcp-Session-Id']).toBe('S1')
  })

  it('raises a tool error when Zoho flags one', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(response('{"result":{}}', 'S1'))
      .mockResolvedValueOnce(response(''))
      .mockResolvedValueOnce(response('{"result":{"isError":true}}'))
    await expect(mcpTool('https://mcp.example', fetchImpl)('t', {})).rejects.toThrow('zoho_tool_error:t')
  })
})
