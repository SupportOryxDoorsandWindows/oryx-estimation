// Oryx Estimations → Zoho, through the Zoho MCP server.
//
// The browser never sees the Zoho link: it is the ZOHO_MCP_URL environment
// variable of this Catalyst function, set in the console and never in the repo.
// Every request is identified by Catalyst Authentication; only an active App
// Administrator gets an answer. Only the read-only actions below exist: no other
// Zoho tool can be reached.
//
// Actions (POST JSON):
//   {action: "me"}                      The signed-in user. Used by the sign-in gate.
//   {action: "searchDeals", query}      CRM Deals whose Deal_Name contains query.
//   {action: "dealDetails", dealId}     One CRM deal, plus Deal_Owner_Number etc.
//                                       from its latest Creator proposal.
//   {action: "dealProposals", dealId}   Creator proposals of a CRM deal.
//   {action: "proposalBoq", proposalId} BOQ lines of one Creator proposal.
'use strict'

const ADMIN_ROLE = 'App Administrator'
const CREATOR = { account_owner_name: 'oryxdoors', app_link_name: 'proposals-2-0' }
const DEAL_FIELDS = 'Deal_Name,Account_Name,Contact_Name,Owner,Stage,Closing_Date,Amount,Address,Location_Tag,order_number,Proposal_No'

// BOQ line fields the Revisions page needs (link names from the BOQ_Summary report).
const BOQ_FIELDS = [
  'ID', 'Reference1', 'Location1', 'Type_of_Frame', 'No_of_Panels', 'Width', 'Height', 'Quantity1', 'Unit_Rate_AED', 'Amount_AED',
  'Fusion_Profile_AED_per_SQM', 'Origin_Profile_GBP', 'Inotherm_Door_EUR', 'Glass_Rate', 'Glass_Thickness', 'Freight_AED',
  'Other_Charges_AED', 'Equipment_Rental_AED', 'Bonding_Charges_AED', 'Distributed_Equipment_Rental_AED',
  'Salesperson_s_Item_Pricing', 'Mark_Up', 'Margin_Change', 'Order_Type', 'Sequence',
]

const isAdmin = (user) =>
  !!user && user.status === 'ACTIVE' && user.role_details?.role_name === ADMIN_ROLE

// ---- Minimal MCP client (streamable HTTP, JSON-RPC) ----

async function rpc(url, session, body, fetchImpl) {
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...(session ? { 'Mcp-Session-Id': session } : {}),
    },
    body: JSON.stringify({ jsonrpc: '2.0', ...body }),
  })
  if (!res.ok) throw new Error(`mcp_http_${res.status}`)
  const next = res.headers.get('Mcp-Session-Id') || session
  const raw = await res.text()
  if (!('id' in body) || !raw.trim()) return { session: next, result: null }
  const text = raw.trimStart().startsWith('{')
    ? raw
    : raw.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).at(-1) ?? '{}'
  return { session: next, result: JSON.parse(text) }
}

function mcpTool(url, fetchImpl) {
  return async (name, args) => {
    if (!url) throw new Error('zoho_not_configured')
    let { session } = await rpc(url, null, {
      id: 1, method: 'initialize',
      params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'oryx-estimations', version: '1.0' } },
    }, fetchImpl)
    ;({ session } = await rpc(url, session, { method: 'notifications/initialized' }, fetchImpl))
    const { result } = await rpc(url, session, { id: 2, method: 'tools/call', params: { name, arguments: args } }, fetchImpl)
    const r = result?.result
    if (!r || r.isError) throw new Error(`zoho_tool_error:${name}`)
    const text = (r.content ?? []).map((c) => c.text ?? '').join('')
    return JSON.parse(text)
  }
}

/** Zoho wraps records as {data: {data: [...]}} (CRM) or {data: [...]} (Creator). */
function records(payload) {
  const d = payload?.data
  if (Array.isArray(d)) return d
  if (Array.isArray(d?.data)) return d.data
  return []
}

// ---- Actions ----

function zohoActions(tool) {
  async function creatorRecords(report, criteria, max = 1000) {
    const out = []
    let cursor
    do {
      let payload
      try {
        payload = await tool('ZohoCreator_getCreatorRecords', {
          path_variables: { ...CREATOR, report_link_name: report },
          query_params: { criteria },
          ...(cursor ? { headers: { record_cursor: cursor } } : {}),
        })
      } catch (e) {
        // Creator reports "no records found" as a tool error; anything else is a real failure.
        if (String(e.message).startsWith('zoho_tool_error')) break
        throw e
      }
      out.push(...records(payload))
      cursor = payload?.headers?.record_cursor
    } while (cursor && out.length < max)
    return out
  }

  async function searchDeals(query) {
    const res = await tool('ZohoCRM_getDealsRecords', {
      query_params: {
        fields: 'Deal_Name,Account_Name,Stage',
        per_page: 15,
        sort_by: 'Modified_Time',
        sort_order: 'desc',
        filters: { field: { api_name: 'Deal_Name' }, comparator: 'contains', value: query },
      },
    })
    return records(res).map((d) => ({ id: String(d.id), name: d.Deal_Name ?? '', company: d.Account_Name?.name ?? '', stage: d.Stage ?? '' }))
  }

  async function dealDetails(dealId) {
    const crm = records(await tool('ZohoCRM_getDealsRecord', { path_variables: { recordId: dealId }, query_params: { fields: DEAL_FIELDS } }))[0]
    if (!crm) return null

    // Creator-only fields come from the deal's latest proposal, if it has one.
    const props = await creatorRecords('All_Proposals2', `Deal_Name == "${dealId}"`)
    const proposal = props.sort((a, b) => Number(b.Revision_Number || 0) - Number(a.Revision_Number || 0))[0] ?? null

    return {
      crm: {
        id: String(crm.id),
        dealName: crm.Deal_Name ?? '',
        contactName: crm.Contact_Name?.name ?? '',
        companyName: crm.Account_Name?.name ?? '',
        dealOwner: crm.Owner?.name ?? '',
        dealOwnerEmail: crm.Owner?.email ?? '',
        stage: crm.Stage ?? '',
        closingDate: crm.Closing_Date ?? '',
        orderValueInCrm: typeof crm.Amount === 'number' ? crm.Amount : Number(crm.Amount) || 0,
        address: crm.Address ?? '',
        locationTag: crm.Location_Tag ?? '',
        orderNumber: crm.order_number ?? '',
        proposalNumber: crm.Proposal_No ?? '',
      },
      creator: proposal
        ? {
            proposalReference: proposal.Proposal_Reference ?? '',
            dealOwnerNumber: proposal.Deal_Owner_Number ?? '',
            projectName: proposal.Project_Name ?? '',
            proposalReferenceNumber: proposal.Proposal_Reference_Number ?? '',
          }
        : null,
    }
  }

  async function dealProposals(dealId) {
    const props = await creatorRecords('All_Proposals2', `Deal_Name == "${dealId}"`)
    return props.map((p) => ({
      id: String(p.ID),
      reference: p.Proposal_Reference ?? '',
      revision: Number(p.Revision_Number) || 0,
      status: p.Quote_Status ?? '',
      total: Number(p.Order_Value) || 0,
      dealName: p.Deal_Name?.zc_display_value ?? '',
    }))
  }

  async function proposalBoq(proposalId) {
    const lines = await creatorRecords('BOQ_Summary', `Proposal_Reference == ${proposalId}`)
    return lines.map((l) => {
      const line = {}
      for (const f of BOQ_FIELDS) line[f] = l[f] ?? ''
      line.Product_Code = l.Product_Code_Detailed?.zc_display_value ?? ''
      return line
    })
  }

  return { searchDeals, dealDetails, dealProposals, proposalBoq }
}

const validId = (v) => /^\d{5,25}$/.test(String(v ?? ''))

/** One request. `user` is the Catalyst user, or null when nobody is signed in. Returns {status, body}. */
async function respond({ method, user, body, tool }) {
  if (method !== 'POST') return { status: 405, body: { error: 'method_not_allowed' } }
  if (!user) return { status: 401, body: { error: 'not_signed_in' } }
  if (body?.action === 'me') return { status: 200, body: { email: user.email_id ?? '', admin: isAdmin(user) } }
  if (!isAdmin(user)) return { status: 403, body: { error: 'admins_only' } }

  const zoho = zohoActions(tool)
  try {
    if (body?.action === 'searchDeals') {
      const q = typeof body.query === 'string' ? body.query.trim().slice(0, 80) : ''
      if (q.length < 2) return { status: 200, body: { deals: [] } }
      return { status: 200, body: { deals: await zoho.searchDeals(q) } }
    }
    if (body?.action === 'dealDetails') {
      if (!validId(body.dealId)) return { status: 400, body: { error: 'bad_deal_id' } }
      const deal = await zoho.dealDetails(String(body.dealId))
      return deal ? { status: 200, body: deal } : { status: 404, body: { error: 'deal_not_found' } }
    }
    if (body?.action === 'dealProposals') {
      if (!validId(body.dealId)) return { status: 400, body: { error: 'bad_deal_id' } }
      return { status: 200, body: { proposals: await zoho.dealProposals(String(body.dealId)) } }
    }
    if (body?.action === 'proposalBoq') {
      if (!validId(body.proposalId)) return { status: 400, body: { error: 'bad_proposal_id' } }
      return { status: 200, body: { lines: await zoho.proposalBoq(String(body.proposalId)) } }
    }
    return { status: 400, body: { error: 'unknown_action' } }
  } catch (e) {
    const msg = String(e?.message || e)
    console.error('estimation_zoho', body?.action, msg)
    return { status: 502, body: { error: msg === 'zoho_not_configured' ? msg : 'zoho_unavailable' } }
  }
}

module.exports = { respond, mcpTool, isAdmin, ADMIN_ROLE }
