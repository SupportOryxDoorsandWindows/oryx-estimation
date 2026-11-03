// Estimation App → Zoho, through the Zoho MCP server.
//
// The browser never sees the Zoho link: it is the ZOHO_MCP_URL secret of this
// function. Every request carries the caller's Supabase sign-in token; only an
// active Admin (user_profiles, shared with Oryx StockFlow) gets an answer.
// Only the read-only actions below exist — no other Zoho tool can be reached.
//
// Actions (POST JSON):
//   {action: "searchDeals", query}  CRM Deals whose Deal_Name contains query.
//   {action: "dealDetails", dealId} One CRM deal, plus Deal_Owner_Number etc.
//                                   from its latest Creator proposal.

import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = ["https://supportoryxdoorsandwindows.github.io", "http://localhost:5173", "http://127.0.0.1:5173"];
const CREATOR = { account_owner_name: "oryxdoors", app_link_name: "proposals-2-0" };
const DEAL_FIELDS = "Deal_Name,Account_Name,Contact_Name,Owner,Stage,Closing_Date,Amount,Address,Location_Tag,order_number,Proposal_No";

function cors(req: Request) {
  const origin = req.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

async function isAdmin(req: Request) {
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!jwt) return false;
  const { data, error } = await supabase.auth.getUser(jwt);
  if (error || !data?.user) return false;
  const { data: p } = await supabase.from("user_profiles").select("role, active").eq("user_id", data.user.id).maybeSingle();
  return !!(p && p.active && p.role === "admin");
}

// ---- Minimal MCP client (streamable HTTP, JSON-RPC) ----

async function rpc(url: string, session: string | null, body: Record<string, unknown>) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...(session ? { "Mcp-Session-Id": session } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", ...body }),
  });
  if (!res.ok) throw new Error(`mcp_http_${res.status}`);
  const next = res.headers.get("Mcp-Session-Id") || session;
  const raw = await res.text();
  if (!("id" in body) || !raw.trim()) return { session: next, result: null };
  const text = raw.trimStart().startsWith("{")
    ? raw
    : raw.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).at(-1) ?? "{}";
  return { session: next, result: JSON.parse(text) };
}

async function tool(name: string, args: Record<string, unknown>) {
  const url = Deno.env.get("ZOHO_MCP_URL");
  if (!url) throw new Error("zoho_not_configured");
  let { session } = await rpc(url, null, {
    id: 1, method: "initialize",
    params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "oryx-estimation", version: "1.0" } },
  });
  ({ session } = await rpc(url, session, { method: "notifications/initialized" }));
  const { result } = await rpc(url, session, { id: 2, method: "tools/call", params: { name, arguments: args } });
  const r = result?.result;
  if (!r || r.isError) throw new Error(`zoho_tool_error:${name}`);
  const text = (r.content ?? []).map((c: { text?: string }) => c.text ?? "").join("");
  return JSON.parse(text);
}

/** Zoho wraps records as {data: {data: [...]}} (CRM) or {data: [...]} (Creator). */
function records(payload: any): any[] {
  const d = payload?.data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.data)) return d.data;
  return [];
}

// ---- Actions ----

async function searchDeals(query: string) {
  const res = await tool("ZohoCRM_getDealsRecords", {
    query_params: {
      fields: "Deal_Name,Account_Name,Stage",
      per_page: 15,
      sort_by: "Modified_Time",
      sort_order: "desc",
      filters: { field: { api_name: "Deal_Name" }, comparator: "contains", value: query },
    },
  });
  return records(res).map((d) => ({ id: String(d.id), name: d.Deal_Name ?? "", company: d.Account_Name?.name ?? "", stage: d.Stage ?? "" }));
}

async function dealDetails(dealId: string) {
  const crm = records(await tool("ZohoCRM_getDealsRecord", { path_variables: { recordId: dealId }, query_params: { fields: DEAL_FIELDS } }))[0];
  if (!crm) return null;

  // Creator-only fields come from the deal's latest proposal, if it has one.
  let proposal: any = null;
  try {
    const props = records(await tool("ZohoCreator_getCreatorRecords", {
      path_variables: { ...CREATOR, report_link_name: "All_Proposals2" },
      query_params: { criteria: `Deal_Name == "${dealId}"` },
    }));
    proposal = props.sort((a, b) => Number(b.Revision_Number || 0) - Number(a.Revision_Number || 0))[0] ?? null;
  } catch {
    // "No records found" is an error in Creator: the deal simply has no proposal yet.
  }

  return {
    crm: {
      id: String(crm.id),
      dealName: crm.Deal_Name ?? "",
      contactName: crm.Contact_Name?.name ?? "",
      companyName: crm.Account_Name?.name ?? "",
      dealOwner: crm.Owner?.name ?? "",
      dealOwnerEmail: crm.Owner?.email ?? "",
      stage: crm.Stage ?? "",
      closingDate: crm.Closing_Date ?? "",
      orderValueInCrm: typeof crm.Amount === "number" ? crm.Amount : Number(crm.Amount) || 0,
      address: crm.Address ?? "",
      locationTag: crm.Location_Tag ?? "",
      orderNumber: crm.order_number ?? "",
      proposalNumber: crm.Proposal_No ?? "",
    },
    creator: proposal
      ? {
          proposalReference: proposal.Proposal_Reference ?? "",
          dealOwnerNumber: proposal.Deal_Owner_Number ?? "",
          projectName: proposal.Project_Name ?? "",
          proposalReferenceNumber: proposal.Proposal_Reference_Number ?? "",
        }
      : null,
  };
}

Deno.serve(async (req: Request) => {
  const headers = { "Content-Type": "application/json", ...cors(req) };
  const reply = (obj: unknown, status = 200) => new Response(JSON.stringify(obj), { status, headers });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return reply({ error: "method_not_allowed" }, 405);
  if (!(await isAdmin(req))) return reply({ error: "admins_only" }, 403);

  let body: any = {};
  try { body = await req.json(); } catch { return reply({ error: "bad_json" }, 400); }

  try {
    if (body.action === "searchDeals") {
      const q = typeof body.query === "string" ? body.query.trim().slice(0, 80) : "";
      if (q.length < 2) return reply({ deals: [] });
      return reply({ deals: await searchDeals(q) });
    }
    if (body.action === "dealDetails") {
      const id = String(body.dealId ?? "");
      if (!/^\d{5,25}$/.test(id)) return reply({ error: "bad_deal_id" }, 400);
      const deal = await dealDetails(id);
      return deal ? reply(deal) : reply({ error: "deal_not_found" }, 404);
    }
    return reply({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error("estimation-zoho", body.action, e);
    const msg = String((e as Error).message || e);
    return reply({ error: msg === "zoho_not_configured" ? msg : "zoho_unavailable" }, 502);
  }
});
