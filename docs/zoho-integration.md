# Zoho integration (Phase 2)

Phase 2 requires deals to come from Zoho CRM and accepted proposals and BOQ lines from Zoho Creator, with revisions sent back to Zoho. The revision features are built against a `ZohoSource` interface (`src/zoho/source.ts`). Until the live source exists, the Revisions page uses a BOQ_Summary export held in memory for testing.

## Why a server is needed

The app is a static site. Zoho's APIs need an OAuth client secret and refresh token, which must never be in browser code, and they do not accept calls straight from a browser. A small server (for example a Supabase Edge Function, as used for the Fleet app) holds the credentials and calls Zoho for the app. It must also check that the user is signed in, so the public site cannot read Zoho data.

## Needed from Oryx

| Item | Notes |
|---|---|
| Zoho data centre | .com, .eu, .in, .com.au, … |
| OAuth client (Server-based or Self Client) | Client ID and secret, stored only on the server |
| Scopes | `ZohoCRM.modules.deals.READ`, `ZohoCreator.report.READ`, `ZohoCreator.form.CREATE`, `ZohoCreator.report.UPDATE` |
| Creator app | Owner and app link name (the exports show `oryxdoors` / `proposals-2-0`) |
| Creator reports and forms | Link names for proposals and BOQ lines, and the field link names |
| Status values | The exact "accepted" status (the BOQ shows "Accepted by the Client"; the plan says "Accepted Proposal") and the "superseded" status for a revised proposal |
| Revision workflow | How a revision is stored: new proposal record with its own BOQ lines, and how it links to the original |
| Sign-in | Who may use revisions, and how they sign in |

## Interface the live source implements

- `searchDeals(query)`: Zoho CRM Deals search.
- `proposals(dealName)`: Creator proposals for the deal (the page shows only accepted ones).
- `boq(proposal)`: Creator BOQ lines for the selected proposal, fetched on selection.
- `submit(draft)`: create the revised proposal and its BOQ lines (with status, replaces/replaced-by and size revision type), and mark the original as superseded. Never delete the original.
